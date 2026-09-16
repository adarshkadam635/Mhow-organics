-- Mhow Organics: run this once in the Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste this whole file -> Run)

create table if not exists products (
  id text primary key,
  category text,
  subcategory text,
  name text,
  image text,
  price numeric default 0,
  description text,
  stock int default 0,
  active boolean default true,
  new_arrival boolean default false,
  bestseller boolean default false,
  updated_at timestamptz default now()
);

create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  type text,
  name text,
  email text,
  phone text,
  city text,
  subject text,
  message text,
  status text default 'new',
  created_at timestamptz default now()
);

create table if not exists orders (
  id text primary key,
  name text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  pincode text,
  country text,
  total numeric default 0,
  gst numeric default 0,
  igst numeric default 0,
  fertilizer_tax numeric default 0,
  wooden_planter_tax numeric default 0,
  other_tax numeric default 0,
  items jsonb not null default '[]',
  backordered_items jsonb not null default '[]',
  note text,
  status text default 'new',
  shiprocket jsonb,
  created_at timestamptz default now()
);

create table if not exists store_accounts (
  id uuid primary key default gen_random_uuid(),
  password_salt text,
  password_hash text,
  supabase_id text,
  provider text,
  profile jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists sessions (
  token text primary key,
  role text not null,
  username text,
  account_id uuid,
  created_at timestamptz default now()
);

create table if not exists password_reset_challenges (
  id text primary key,
  account_id uuid,
  otp_salt text,
  otp_hash text,
  attempts int default 0,
  verified boolean default false,
  reset_token text,
  expires_at timestamptz not null
);

alter table products enable row level security;
alter table enquiries enable row level security;
alter table orders enable row level security;
alter table store_accounts enable row level security;
alter table sessions enable row level security;
alter table password_reset_challenges enable row level security;
-- No policies are added: only the service_role key (used by the server) can
-- read/write these tables. The anon key (used client-side for Supabase Auth
-- only) has no direct access.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
