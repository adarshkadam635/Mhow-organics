-- Return Requests: run once in the Supabase SQL Editor (safe to re-run).

-- 1. Product-level return eligibility. NULL = follow the category default
--    (everything returnable except fertilizers). Fertilizers are ALWAYS
--    non-returnable, enforced in server.js regardless of this flag.
alter table products add column if not exists is_returnable boolean;
update products set is_returnable = false
  where subcategory ilike '%fertili%' or name ilike '%fertili%';

-- 2. Link new orders to the signed-in customer (older orders are matched by email).
alter table orders add column if not exists account_id uuid;
-- Set when an order is marked completed; the 7-day return window counts from here.
alter table orders add column if not exists delivered_at timestamptz;
create index if not exists orders_account_id_idx on orders (account_id);

-- 3. Return requests
create sequence if not exists return_request_seq start 1001;

create table if not exists return_requests (
  id uuid primary key default gen_random_uuid(),
  return_request_number text unique not null default ('RR-' || nextval('return_request_seq')),
  user_id uuid not null,
  order_id text not null references orders(id) on delete cascade,
  order_item_id text not null,              -- "<order_id>:<product_id>"
  product_id text not null,
  product_name text,
  product_category text,
  product_image text,
  customer_name text,
  customer_email text,
  reason text not null,
  description text not null,
  additional_info text,
  image_paths jsonb not null default '[]',  -- paths in the private return-evidence bucket
  status text not null default 'pending_review'
    check (status in ('pending_review','under_review','approved','rejected','completed')),
  admin_notes text,
  rejection_reason text,
  reviewed_by text,
  reviewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active (non-rejected, non-completed) request per order item, enforced by the DB.
create unique index if not exists return_requests_one_active_per_item
  on return_requests (order_item_id) where status in ('pending_review','under_review','approved');
create index if not exists return_requests_user_idx on return_requests (user_id, created_at desc);
create index if not exists return_requests_status_idx on return_requests (status, created_at desc);

create table if not exists return_status_history (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references return_requests(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor text not null,                      -- 'customer:<account id>' or 'admin:<username>'
  note text,
  created_at timestamptz not null default now()
);
create index if not exists return_status_history_req_idx on return_status_history (return_request_id, created_at);

-- 4. In-app notifications (no notification system existed before)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  type text not null,
  title text not null,
  body text,
  ref_id text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_account_idx on notifications (account_id, created_at desc);

alter table return_requests enable row level security;
alter table return_status_history enable row level security;
alter table notifications enable row level security;

-- 5. Atomic create: request + history row + notification in one transaction.
create or replace function create_return_request(p jsonb) returns return_requests
language plpgsql as $$
declare r return_requests;
begin
  insert into return_requests (user_id, order_id, order_item_id, product_id, product_name, product_category,
    product_image, customer_name, customer_email, reason, description, additional_info, image_paths)
  values ((p->>'user_id')::uuid, p->>'order_id', p->>'order_item_id', p->>'product_id', p->>'product_name',
    p->>'product_category', p->>'product_image', p->>'customer_name', p->>'customer_email', p->>'reason',
    p->>'description', p->>'additional_info', coalesce(p->'image_paths', '[]'::jsonb))
  returning * into r;
  insert into return_status_history (return_request_id, from_status, to_status, actor, note)
    values (r.id, null, 'pending_review', 'customer:' || r.user_id, 'Return request submitted');
  insert into notifications (account_id, type, title, body, ref_id)
    values (r.user_id, 'return', 'Return request submitted',
      'Your return request ' || r.return_request_number || ' for ' || coalesce(r.product_name, 'your item') || ' was received and is pending review.', r.id::text);
  return r;
end $$;

-- 6. Atomic status change: guarded by the allowed "from" statuses so two admins can't race.
create or replace function transition_return_request(
  p_id uuid, p_from text[], p_to text, p_actor text, p_note text, p_rejection text, p_title text, p_body text
) returns return_requests
language plpgsql as $$
declare r return_requests; prev text;
begin
  select status into prev from return_requests where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not (prev = any(p_from)) then raise exception 'BAD_STATE:%', prev; end if;
  update return_requests set
    status = p_to,
    admin_notes = coalesce(nullif(p_note, ''), admin_notes),
    rejection_reason = case when p_to = 'rejected' then p_rejection else rejection_reason end,
    reviewed_by = case when p_to in ('under_review','approved','rejected') then p_actor else reviewed_by end,
    reviewed_at = case when p_to in ('under_review','approved','rejected') then now() else reviewed_at end,
    completed_at = case when p_to = 'completed' then now() else completed_at end,
    updated_at = now()
  where id = p_id returning * into r;
  insert into return_status_history (return_request_id, from_status, to_status, actor, note)
    values (p_id, prev, p_to, 'admin:' || p_actor, coalesce(nullif(p_rejection, ''), nullif(p_note, '')));
  insert into notifications (account_id, type, title, body, ref_id)
    values (r.user_id, 'return', p_title, p_body, r.id::text);
  return r;
end $$;

-- 7. Private storage bucket for customer evidence photos (served via signed URLs).
insert into storage.buckets (id, name, public)
values ('return-evidence', 'return-evidence', false)
on conflict (id) do nothing;
