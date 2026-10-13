// Development-only stand-in for the Supabase client, used when SUPABASE_SERVICE_ROLE_KEY
// is not set. Data persists in data/local-db.json and uploads in data/storage/.
// It implements just the query-builder calls this app uses. Never used in production.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "local-db.json");
const STORAGE_DIR = path.join(DATA_DIR, "storage");
const ACTIVE_RETURN = ["pending_review", "under_review", "approved"];

fs.mkdirSync(STORAGE_DIR, { recursive: true });
let tables = {};
try { tables = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch { tables = {}; }
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(tables));
const now = () => new Date().toISOString();
const table = (name) => (tables[name] ||= []);
const getPath = (row, key) => key.split("->>").reduce((v, k) => (v == null ? v : v[k]), row);
const escapeRe = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function likeRegex(pattern) {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    out += c === "\\" ? escapeRe(pattern[++i] || "") : c === "%" ? ".*" : c === "_" ? "." : escapeRe(c);
  }
  return new RegExp(`^${out}$`, "is");
}
const clone = (v) => JSON.parse(JSON.stringify(v));

// Column defaults that Postgres would apply on insert.
const DEFAULTS = {
  products: () => ({ price: 0, stock: 0, active: true, new_arrival: false, bestseller: false, updated_at: now() }),
  enquiries: () => ({ id: crypto.randomUUID(), status: "new", created_at: now() }),
  orders: () => ({ total: 0, gst: 0, igst: 0, fertilizer_tax: 0, wooden_planter_tax: 0, other_tax: 0, items: [], backordered_items: [], status: "new", created_at: now() }),
  store_accounts: () => ({ id: crypto.randomUUID(), profile: {}, created_at: now() }),
  sessions: () => ({ created_at: now() }),
  password_reset_challenges: () => ({ attempts: 0, verified: false }),
  notifications: () => ({ id: crypto.randomUUID(), read: false, created_at: now() }),
};

function checkUnique(name, row) {
  const rows = table(name);
  const pk = { products: "id", orders: "id", sessions: "token", password_reset_challenges: "id" }[name];
  if (pk && rows.some((r) => r[pk] === row[pk])) return { code: "23505", message: `duplicate key value violates unique constraint on ${name}.${pk}` };
  if (name === "return_requests" && ACTIVE_RETURN.includes(row.status) && rows.some((r) => r.order_item_id === row.order_item_id && ACTIVE_RETURN.includes(r.status)))
    return { code: "23505", message: "duplicate key value violates unique constraint return_requests_one_active_per_item" };
  return null;
}

function builder(name) {
  const filters = [];
  let op = "select", payload = null, ord = null, rng = null, lim = null, wantCount = false, head = false, returning = false;
  const q = {
    select(_cols, opts = {}) { if (op === "select") op = "select"; else returning = true; wantCount = !!opts.count; head = !!opts.head; return q; },
    insert(rows) { op = "insert"; payload = Array.isArray(rows) ? rows : [rows]; return q; },
    update(patch) { op = "update"; payload = patch; return q; },
    delete() { op = "delete"; return q; },
    eq: (k, v) => (filters.push((r) => getPath(r, k) === v), q),
    neq: (k, v) => (filters.push((r) => getPath(r, k) !== v), q),
    is: (k, v) => (filters.push((r) => (getPath(r, k) ?? null) === v), q),
    in: (k, vs) => (filters.push((r) => vs.includes(getPath(r, k))), q),
    not: (k, operator, v) => (filters.push((r) => !(operator === "is" ? (getPath(r, k) ?? null) === v : getPath(r, k) === v)), q),
    ilike: (k, p) => { const re = likeRegex(p); filters.push((r) => re.test(String(getPath(r, k) ?? ""))); return q; },
    or(expr) {
      const conds = expr.split(",").map((c) => { const [k, , ...p] = c.split("."); return [k, likeRegex(p.join("."))]; });
      filters.push((r) => conds.some(([k, re]) => re.test(String(getPath(r, k) ?? ""))));
      return q;
    },
    order(k, { ascending = true } = {}) { ord = [k, ascending]; return q; },
    range(a, b) { rng = [a, b]; return q; },
    limit(n) { lim = n; return q; },
    then(resolve, reject) {
      try { resolve(run()); } catch (error) { (reject || resolve)({ data: null, error: { message: error.message } }); }
    },
  };
  function run() {
    const rows = table(name);
    const match = (r) => filters.every((f) => f(r));
    if (op === "insert") {
      const inserted = [];
      for (const input of payload) {
        const row = { ...(DEFAULTS[name]?.() || {}), ...clone(input) };
        for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];
        const conflict = checkUnique(name, row);
        if (conflict) return { data: null, error: conflict, count: null };
        rows.push(row);
        inserted.push(row);
      }
      save();
      return { data: returning ? clone(inserted) : null, error: null, count: null };
    }
    if (op === "update") {
      const hit = rows.filter(match);
      hit.forEach((r) => Object.assign(r, clone(payload)));
      save();
      return { data: returning ? clone(hit) : null, error: null, count: null };
    }
    if (op === "delete") {
      const keep = rows.filter((r) => !match(r));
      tables[name] = keep;
      save();
      return { data: null, error: null, count: null };
    }
    let out = rows.filter(match);
    const total = out.length;
    if (ord) out = [...out].sort((a, b) => ((getPath(a, ord[0]) ?? "") > (getPath(b, ord[0]) ?? "") ? 1 : -1) * (ord[1] ? 1 : -1));
    if (rng) out = out.slice(rng[0], rng[1] + 1);
    if (lim != null) out = out.slice(0, lim);
    return { data: head ? null : clone(out), error: null, count: wantCount ? total : null };
  }
  return q;
}

async function rpc(name, args) {
  if (name === "create_return_request") {
    const p = args.p;
    const { data, error } = await builder("return_requests").insert({
      return_request_number: `RR-${1001 + table("return_requests").length}`, status: "pending_review", created_at: now(), updated_at: now(),
      admin_notes: null, rejection_reason: null, reviewed_by: null, reviewed_at: null, completed_at: null, id: crypto.randomUUID(),
      user_id: p.user_id, order_id: p.order_id, order_item_id: p.order_item_id, product_id: p.product_id, product_name: p.product_name,
      product_category: p.product_category, product_image: p.product_image, customer_name: p.customer_name, customer_email: p.customer_email,
      reason: p.reason, description: p.description, additional_info: p.additional_info, image_paths: p.image_paths || [],
    }).select();
    if (error) return { data: null, error };
    const row = data[0];
    table("return_status_history").push({ id: crypto.randomUUID(), return_request_id: row.id, from_status: null, to_status: "pending_review", actor: `customer:${row.user_id}`, note: "Return request submitted", created_at: now() });
    table("notifications").push({ id: crypto.randomUUID(), account_id: row.user_id, type: "return", title: "Return request submitted", body: `Your return request ${row.return_request_number} for ${row.product_name || "your item"} was received and is pending review.`, ref_id: row.id, read: false, created_at: now() });
    save();
    return { data: row, error: null };
  }
  if (name === "transition_return_request") {
    const r = table("return_requests").find((x) => x.id === args.p_id);
    if (!r) return { data: null, error: { message: "NOT_FOUND" } };
    if (!args.p_from.includes(r.status)) return { data: null, error: { message: `BAD_STATE:${r.status}` } };
    const prev = r.status, to = args.p_to, t = now();
    Object.assign(r, { status: to, admin_notes: args.p_note || r.admin_notes, updated_at: t });
    if (to === "rejected") r.rejection_reason = args.p_rejection;
    if (["under_review", "approved", "rejected"].includes(to)) Object.assign(r, { reviewed_by: args.p_actor, reviewed_at: t });
    if (to === "completed") r.completed_at = t;
    table("return_status_history").push({ id: crypto.randomUUID(), return_request_id: r.id, from_status: prev, to_status: to, actor: `admin:${args.p_actor}`, note: args.p_rejection || args.p_note || null, created_at: t });
    table("notifications").push({ id: crypto.randomUUID(), account_id: r.user_id, type: "return", title: args.p_title, body: args.p_body, ref_id: r.id, read: false, created_at: t });
    save();
    return { data: clone(r), error: null };
  }
  return { data: null, error: { message: `Unknown function ${name}` } };
}

const bucketDir = (bucket) => path.join(STORAGE_DIR, bucket);
const safeFile = (bucket, p) => {
  const full = path.resolve(bucketDir(bucket), p);
  if (!full.startsWith(path.resolve(bucketDir(bucket)) + path.sep)) throw new Error("Invalid path");
  return full;
};
const storage = {
  from: (bucket) => ({
    async upload(p, buffer) {
      try {
        const full = safeFile(bucket, p);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, buffer);
        return { data: { path: p }, error: null };
      } catch (error) { return { data: null, error: { message: error.message } }; }
    },
    getPublicUrl: (p) => ({ data: { publicUrl: `/local-storage/${bucket}/${p}` } }),
    async list(folder) {
      try { return { data: fs.readdirSync(safeFile(bucket, folder)).map((name) => ({ name })), error: null }; }
      catch { return { data: [], error: null }; }
    },
    async createSignedUrls(paths) { return { data: paths.map((p) => ({ path: p, signedUrl: `/local-storage/${bucket}/${p}` })), error: null }; },
  }),
};

module.exports = { from: (name) => builder(name), rpc, storage, STORAGE_DIR, isLocal: true };
