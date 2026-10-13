// Minimal in-memory stand-in for the supabase-js calls used by lib/returns.js.
const crypto = require("crypto");
const escapeRe = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function likeToRegex(pattern) {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\") out += escapeRe(pattern[++i]);
    else if (c === "%") out += ".*";
    else if (c === "_") out += ".";
    else out += escapeRe(c);
  }
  return new RegExp(`^${out}$`, "i");
}
function makeDb(seed = {}) {
  const tables = { orders: [], products: [], return_requests: [], return_status_history: [], notifications: [], ...seed };
  const files = new Set();
  let seq = 1000;
  const activeStatuses = ["pending_review", "under_review", "approved"];
  function query(table) {
    let rows = tables[table] || [];
    let count = false, order = null, range = null, lim = null;
    const q = {
      select(_c, opts) { if (opts?.count) count = true; return q; },
      eq(k, v) { rows = rows.filter((r) => r[k] === v); return q; },
      neq(k, v) { rows = rows.filter((r) => r[k] !== v); return q; },
      is(k, v) { rows = rows.filter((r) => (r[k] ?? null) === v); return q; },
      in(k, vs) { rows = rows.filter((r) => vs.includes(r[k])); return q; },
      ilike(k, p) { const re = likeToRegex(p); rows = rows.filter((r) => re.test(String(r[k] ?? ""))); return q; },
      or(expr) {
        const conds = expr.split(",").map((c) => c.split("."));
        rows = rows.filter((r) => conds.some(([k, , ...p]) => likeToRegex(p.join(".")).test(String(r[k] ?? ""))));
        return q;
      },
      order(k, { ascending = true } = {}) { order = [k, ascending]; return q; },
      range(a, b) { range = [a, b]; return q; },
      limit(n) { lim = n; return q; },
      update(patch) { rows.forEach((r) => Object.assign(r, patch)); return q; },
      then(resolve) {
        let out = [...rows];
        if (order) out.sort((a, b) => (a[order[0]] > b[order[0]] ? 1 : -1) * (order[1] ? 1 : -1));
        const total = out.length;
        if (range) out = out.slice(range[0], range[1] + 1);
        if (lim) out = out.slice(0, lim);
        resolve({ data: out, error: null, count: count ? total : null });
      },
    };
    return q;
  }
  return {
    tables, files,
    from: (t) => query(t),
    rpc: async (name, args) => {
      if (name === "create_return_request") {
        const p = args.p;
        if (tables.return_requests.some((r) => r.order_item_id === p.order_item_id && activeStatuses.includes(r.status)))
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        const now = new Date().toISOString();
        const row = { id: crypto.randomUUID(), return_request_number: `RR-${++seq}`, status: "pending_review", admin_notes: null, rejection_reason: null, reviewed_by: null, reviewed_at: null, completed_at: null, created_at: now, updated_at: now, ...p };
        tables.return_requests.push(row);
        tables.return_status_history.push({ return_request_id: row.id, from_status: null, to_status: "pending_review", actor: "customer:" + p.user_id, note: null, created_at: now });
        tables.notifications.push({ id: crypto.randomUUID(), account_id: p.user_id, title: "Return request submitted", body: "", read: false, created_at: now });
        return { data: row, error: null };
      }
      if (name === "transition_return_request") {
        const r = tables.return_requests.find((x) => x.id === args.p_id);
        if (!r) return { data: null, error: { message: "NOT_FOUND" } };
        if (!args.p_from.includes(r.status)) return { data: null, error: { message: "BAD_STATE:" + r.status } };
        const prev = r.status;
        const now = new Date().toISOString();
        Object.assign(r, { status: args.p_to, admin_notes: args.p_note || r.admin_notes, rejection_reason: args.p_to === "rejected" ? args.p_rejection : r.rejection_reason, reviewed_by: args.p_actor, reviewed_at: now, updated_at: now });
        if (args.p_to === "completed") r.completed_at = now;
        tables.return_status_history.push({ return_request_id: r.id, from_status: prev, to_status: args.p_to, actor: "admin:" + args.p_actor, note: args.p_rejection || args.p_note || null, created_at: now });
        tables.notifications.push({ id: crypto.randomUUID(), account_id: r.user_id, title: args.p_title, body: args.p_body, read: false, created_at: now });
        return { data: r, error: null };
      }
      return { data: null, error: { message: "unknown rpc" } };
    },
    storage: {
      from: () => ({
        upload: async (p) => { files.add(p); return { error: null }; },
        list: async (folder) => ({ data: [...files].filter((f) => f.startsWith(folder + "/")).map((f) => ({ name: f.split("/")[1] })), error: null }),
        createSignedUrls: async (paths) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed.example/${p}` })), error: null }),
      }),
    },
  };
}
module.exports = makeDb;
