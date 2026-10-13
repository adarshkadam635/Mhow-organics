// Run with: node --test tests/
const test = require("node:test");
const assert = require("node:assert");
const express = require("express");
const registerReturnRoutes = require("../lib/returns");
const makeDb = require("./fakeDb");

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG = "data:image/png;base64," + Buffer.concat([PNG_HEAD, Buffer.alloc(64)]).toString("base64");

function setup() {
  const now = new Date().toISOString();
  const db = makeDb({
    products: [
      { id: "1", name: "Wooden Planter", category: "Pots & Planters", subcategory: "Wooden Planters", image: "a.png", is_returnable: null },
      { id: "2", name: "Vermicompost Fertilizer", category: "Plant Care", subcategory: "Organic Fertilizer", image: "b.png", is_returnable: true },
      { id: "3", name: "Seed Pack", category: "Seeds", subcategory: "Vegetable Seeds", image: "c.png", is_returnable: false },
    ],
    orders: [
      { id: "O1", account_id: ALICE, email: "alice@x.com", name: "Alice", status: "completed", created_at: now, items: [{ id: "1", qty: 1 }, { id: "2", qty: 1 }, { id: "3", qty: 1 }] },
      { id: "O2", account_id: BOB, email: "bob@x.com", name: "Bob", status: "completed", created_at: now, items: [{ id: "1", qty: 1 }] },
      { id: "O3", account_id: null, email: "Alice@X.com", name: "Alice legacy", status: "completed", created_at: now, items: [{ id: "1", qty: 1 }] },
      { id: "O4", account_id: ALICE, email: "alice@x.com", name: "Alice", status: "shipped", created_at: now, items: [{ id: "1", qty: 1 }] },
    ],
  });
  const app = express();
  app.use(express.json({ limit: "12mb" }));
  const customerAuth = (req, res, next) => {
    const who = { alice: { accountId: ALICE, email: "alice@x.com", name: "Alice" }, bob: { accountId: BOB, email: "bob@x.com", name: "Bob" } }[req.headers["x-user"]];
    if (!who) return res.status(401).json({ error: "sign in" });
    req.customer = who;
    next();
  };
  const adminAuth = (req, res, next) => (req.headers["x-admin"] ? ((req.admin = { username: "root" }), next()) : res.status(401).json({ error: "admin only" }));
  registerReturnRoutes(app, { db, adminAuth, customerAuth });
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      const call = async (method, path, { user, admin, body } = {}) => {
        const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(user ? { "x-user": user } : {}), ...(admin ? { "x-admin": "1" } : {}) }, body: body ? JSON.stringify(body) : undefined });
        return { status: res.status, body: await res.json().catch(() => ({})) };
      };
      resolve({ db, call, close: () => { server.closeAllConnections(); server.close(); } });
    });
  });
}
const upload = async (call, user) => (await call("POST", "/api/store/returns/images", { user, body: { dataUrl: PNG } })).body.path;
const payload = (over = {}) => ({ orderId: "O1", productId: "1", reason: "damaged", description: "Arrived cracked on one side", imagePaths: [], ...over });

test("full lifecycle: submit, review, approve, complete, with notifications", async () => {
  const { call, close, db } = await setup();
  const path = await upload(call, "alice");
  const sub = await call("POST", "/api/store/returns", { user: "alice", body: payload({ imagePaths: [path] }) });
  assert.equal(sub.status, 201);
  assert.match(sub.body.message, /submitted successfully/);
  const id = sub.body.request.id;
  assert.equal((await call("GET", "/api/returns", { admin: true })).body.total, 1);
  const detail = await call("GET", `/api/returns/${id}`, { admin: true });
  assert.equal(detail.body.images.length, 1);
  assert.equal(detail.body.returnable, true);
  assert.equal((await call("POST", `/api/returns/${id}/complete`, { admin: true, body: {} })).status, 409, "cannot complete before approval");
  assert.equal((await call("POST", `/api/returns/${id}/start-review`, { admin: true })).body.request.status, "under_review");
  assert.equal((await call("POST", `/api/returns/${id}/approve`, { admin: true, body: { note: "ok" } })).body.request.status, "approved");
  assert.equal((await call("POST", `/api/returns/${id}/approve`, { admin: true, body: {} })).status, 409, "double approve rejected");
  assert.equal((await call("POST", `/api/returns/${id}/complete`, { admin: true, body: {} })).body.request.status, "completed");
  const mine = await call("GET", `/api/store/returns/${id}`, { user: "alice" });
  assert.equal(mine.body.status, "completed");
  assert.equal(mine.body.history.length, 4);
  assert.equal(db.tables.notifications.length, 4);
  close();
});

test("rejection requires a reason and is shown to the customer", async () => {
  const { call, close } = await setup();
  const path = await upload(call, "alice");
  const id = (await call("POST", "/api/store/returns", { user: "alice", body: payload({ imagePaths: [path] }) })).body.request.id;
  assert.equal((await call("POST", `/api/returns/${id}/reject`, { admin: true, body: {} })).status, 400);
  await call("POST", `/api/returns/${id}/reject`, { admin: true, body: { note: "Damage is not covered" } });
  const mine = (await call("GET", "/api/store/returns", { user: "alice" })).body;
  assert.equal(mine[0].status, "rejected");
  assert.equal(mine[0].rejectionReason, "Damage is not covered");
  close();
});

test("fertilizers are rejected by the API even if is_returnable=true, and cannot be approved", async () => {
  const { call, close, db } = await setup();
  const path = await upload(call, "alice");
  const r = await call("POST", "/api/store/returns", { user: "alice", body: payload({ productId: "2", imagePaths: [path] }) });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "fertilizer");
  assert.match(r.body.error, /non-returnable and non-refundable/);
  // Even a pre-existing fertilizer request (e.g. data inserted out of band) cannot be approved.
  const row = { id: "99999999-9999-4999-8999-999999999999", return_request_number: "RR-1", user_id: ALICE, product_id: "2", status: "under_review", image_paths: [] };
  db.tables.return_requests.push(row);
  const a = await call("POST", `/api/returns/${row.id}/approve`, { admin: true, body: {} });
  assert.equal(a.status, 409);
  assert.equal(row.status, "under_review");
  const items = (await call("GET", "/api/store/returns/items", { user: "alice" })).body.items;
  const fert = items.find((i) => i.productId === "2");
  assert.equal(fert.canRequest, false);
  assert.equal(fert.returnable, false);
  close();
});

test("is_returnable=false products are rejected", async () => {
  const { call, close } = await setup();
  const path = await upload(call, "alice");
  assert.equal((await call("POST", "/api/store/returns", { user: "alice", body: payload({ productId: "3", imagePaths: [path] }) })).status, 403);
  close();
});

test("ownership: customers cannot return, read or list other customers' data", async () => {
  const { call, close } = await setup();
  const bobPath = await upload(call, "bob");
  assert.equal((await call("POST", "/api/store/returns", { user: "bob", body: payload({ imagePaths: [bobPath] }) })).status, 404, "O1 belongs to Alice");
  const alicePath = await upload(call, "alice");
  const id = (await call("POST", "/api/store/returns", { user: "alice", body: payload({ imagePaths: [alicePath] }) })).body.request.id;
  assert.equal((await call("GET", `/api/store/returns/${id}`, { user: "bob" })).status, 404);
  assert.deepEqual((await call("GET", "/api/store/returns", { user: "bob" })).body, []);
  const stolen = await call("POST", "/api/store/returns", { user: "bob", body: payload({ orderId: "O2", imagePaths: [alicePath] }) });
  assert.equal(stolen.status, 400, "cannot attach another customer's evidence");
  close();
});

test("legacy orders without account_id match by email; undelivered orders are blocked", async () => {
  const { call, close } = await setup();
  const items = (await call("GET", "/api/store/returns/items", { user: "alice" })).body.items;
  assert.ok(items.some((i) => i.orderId === "O3" && i.canRequest), "email-matched legacy order is listed");
  assert.ok(!items.some((i) => i.orderId === "O2"), "Bob's order never listed");
  const path = await upload(call, "alice");
  const shipped = await call("POST", "/api/store/returns", { user: "alice", body: payload({ orderId: "O4", imagePaths: [path] }) });
  assert.equal(shipped.status, 403, "order not delivered yet");
  close();
});

test("duplicate active requests are blocked; resubmission allowed after rejection", async () => {
  const { call, close } = await setup();
  const p1 = await upload(call, "alice");
  const first = await call("POST", "/api/store/returns", { user: "alice", body: payload({ imagePaths: [p1] }) });
  const dup = await call("POST", "/api/store/returns", { user: "alice", body: payload({ imagePaths: [p1] }) });
  assert.equal(dup.status, 409);
  await call("POST", `/api/returns/${first.body.request.id}/reject`, { admin: true, body: { note: "No evidence of damage" } });
  assert.equal((await call("POST", "/api/store/returns", { user: "alice", body: payload({ imagePaths: [p1] }) })).status, 201);
  close();
});

test("validation: images, description, reason, auth", async () => {
  const { call, close } = await setup();
  assert.equal((await call("POST", "/api/store/returns", { body: payload() })).status, 401);
  const path = await upload(call, "alice");
  assert.equal((await call("POST", "/api/store/returns", { user: "alice", body: payload() })).status, 400, "no images");
  assert.equal((await call("POST", "/api/store/returns", { user: "alice", body: payload({ imagePaths: [path], description: "short" }) })).status, 400);
  assert.equal((await call("POST", "/api/store/returns", { user: "alice", body: payload({ imagePaths: [path], reason: "bogus" }) })).status, 400);
  const six = [];
  for (let i = 0; i < 6; i++) six.push(await upload(call, "alice"));
  assert.equal((await call("POST", "/api/store/returns", { user: "alice", body: payload({ imagePaths: six }) })).status, 400, "max 5");
  assert.equal((await call("POST", "/api/store/returns", { user: "alice", body: payload({ imagePaths: [`${ALICE}/../x.png`] }) })).status, 400, "path traversal");
  assert.equal((await call("POST", "/api/store/returns/images", { user: "alice", body: { dataUrl: "data:image/gif;base64,R0lGODlh" } })).status, 400);
  assert.equal((await call("POST", "/api/store/returns/images", { user: "alice", body: { dataUrl: "data:image/png;base64," + Buffer.from("not a png").toString("base64") } })).status, 400, "bad signature");
  const big = "data:image/png;base64," + Buffer.concat([PNG_HEAD, Buffer.alloc(4 * 1024 * 1024)]).toString("base64");
  assert.equal((await call("POST", "/api/store/returns/images", { user: "alice", body: { dataUrl: big } })).status, 400, "too large");
  close();
});

test("admin endpoints require admin; filtering/search/pagination work", async () => {
  const { call, close } = await setup();
  assert.equal((await call("GET", "/api/returns", { user: "alice" })).status, 401);
  const path = await upload(call, "alice");
  const id = (await call("POST", "/api/store/returns", { user: "alice", body: payload({ imagePaths: [path] }) })).body.request.id;
  assert.equal((await call("POST", `/api/returns/${id}/approve`, { user: "alice", body: {} })).status, 401);
  assert.equal((await call("GET", "/api/returns?status=approved", { admin: true })).body.total, 0);
  assert.equal((await call("GET", "/api/returns?status=pending_review&q=alice", { admin: true })).body.total, 1);
  assert.equal((await call("GET", "/api/returns?q=Wooden", { admin: true })).body.total, 1);
  assert.equal((await call("GET", "/api/returns?q=zzz", { admin: true })).body.total, 0);
  assert.equal((await call("GET", "/api/returns?pageSize=1&page=2", { admin: true })).body.requests.length, 0);
  close();
});

test("7-day return window counts from delivery and exposes a deadline", async () => {
  const { call, close, db } = await setup();
  const day = 86400000;
  db.tables.orders.push(
    { id: "OLD", account_id: ALICE, email: "alice@x.com", name: "Alice", status: "completed", created_at: new Date(Date.now() - 30 * day).toISOString(), delivered_at: new Date(Date.now() - 8 * day).toISOString(), items: [{ id: "1", qty: 1 }] },
    { id: "FRESH", account_id: ALICE, email: "alice@x.com", name: "Alice", status: "completed", created_at: new Date(Date.now() - 30 * day).toISOString(), delivered_at: new Date(Date.now() - 2 * day).toISOString(), items: [{ id: "1", qty: 1 }] },
  );
  const items = (await call("GET", "/api/store/returns/items", { user: "alice" })).body.items;
  const old = items.find((i) => i.orderId === "OLD");
  const fresh = items.find((i) => i.orderId === "FRESH");
  assert.equal(old.canRequest, false);
  assert.match(old.blockedReason, /7-day return window/);
  assert.equal(fresh.canRequest, true);
  const left = new Date(fresh.returnDeadline).getTime() - Date.now();
  assert.ok(left > 4.9 * day && left < 5.1 * day, "about 5 days left");
  const path = await upload(call, "alice");
  assert.equal((await call("POST", "/api/store/returns", { user: "alice", body: payload({ orderId: "OLD", imagePaths: [path] }) })).status, 403, "API enforces the window");
  assert.equal((await call("POST", "/api/store/returns", { user: "alice", body: payload({ orderId: "FRESH", imagePaths: [path] }) })).status, 201);
  close();
});
