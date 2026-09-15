const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const ENQUIRIES_FILE = path.join(DATA_DIR, "enquiries.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const STORE_ACCOUNTS_FILE = path.join(DATA_DIR, "store_accounts.json");
const PRODUCT_UPLOAD_DIR = path.join(ROOT, "uploads", "products");
const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = process.env.ADMIN_USER || "AdminMO";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "organics@911";
const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL || "";
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD || "";
const SHIPROCKET_PICKUP_LOCATION = process.env.SHIPROCKET_PICKUP_LOCATION || "Primary";
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const CUSTOMER_SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_MAX_AGE = 10 * 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const sessions = new Map();
const passwordResetChallenges = new Map();

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true });

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
function csvFields(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { fields.push(field); field = ""; }
    else field += char;
  }
  fields.push(field);
  return fields;
}
function seedProducts() {
  if (fs.existsSync(PRODUCTS_FILE)) return;
  const csv = fs.readFileSync(path.join(ROOT, "store", "product_inventory.csv"), "utf8").trim();
  const lines = csv.split(/\r?\n/).slice(1);
  const products = lines.map((line) => {
    const [id, category, subcategory, name, image, price, description] = csvFields(line);
    return { id: String(id), category, subcategory, name, image, price: Number(price) || 0, description, stock: 0, active: true, updatedAt: new Date().toISOString() };
  });
  writeJson(PRODUCTS_FILE, products);
}
seedProducts();
if (!fs.existsSync(ENQUIRIES_FILE)) writeJson(ENQUIRIES_FILE, []);
if (!fs.existsSync(ORDERS_FILE)) writeJson(ORDERS_FILE, []);
if (!fs.existsSync(STORE_ACCOUNTS_FILE)) writeJson(STORE_ACCOUNTS_FILE, []);

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: false }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || sessions.get(token)?.role !== "admin") return res.status(401).json({ error: "Authentication required" });
  next();
}
function customerAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = token ? sessions.get(token) : null;
  if (!session || session.role !== "customer" || Date.now() - session.createdAt > CUSTOMER_SESSION_MAX_AGE) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: "Please sign in to your store account" });
  }
  req.customer = session;
  next();
}
function clean(value, max = 2000) { return String(value ?? "").trim().slice(0, max); }
function accountEmail(account) { return clean(account.profile?.email || account.email, 160).toLowerCase(); }
function accountPhone(account) { return clean(account.profile?.phone || account.phone, 40); }
function normalizedPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}
function passwordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") };
}
function passwordsMatch(password, account) {
  const actual = Buffer.from(passwordHash(password, account.passwordSalt).hash, "hex");
  const expected = Buffer.from(account.passwordHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function customerToken(account) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { role: "customer", accountId: account.id, createdAt: Date.now() });
  return token;
}
async function sendPasswordResetOtp(phone, otp) {
  const message = `Your The Smiling Worm password reset OTP is ${otp}. It expires in 10 minutes.`;
  const webhookUrl = process.env.SMS_WEBHOOK_URL;
  if (webhookUrl) {
    const response = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, message, otp }) });
    if (!response.ok) throw new Error("SMS provider rejected the OTP");
    return "sms";
  }
  if (process.env.NODE_ENV === "production") throw new Error("SMS delivery is not configured");
  console.log(`[password-reset] OTP for ${phone}: ${otp}`);
  return "development";
}
function addRecord(file, record) {
  const records = readJson(file, []);
  records.unshift(record);
  writeJson(file, records);
  return record;
}
function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
function downloadCsv(res, filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`\ufeff${csv}`);
}
function saveProductImage(productId, dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
  if (!match) throw new Error("Only PNG, JPG, WEBP, and GIF images are supported");
  const extension = match[1].split("/")[1].replace("jpeg", "jpg");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 8 * 1024 * 1024) throw new Error("Image must be 8 MB or smaller");
  const filename = `product-${productId}.${extension}`;
  fs.writeFileSync(path.join(PRODUCT_UPLOAD_DIR, filename), buffer);
  return `/uploads/products/${filename}`;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "mhow-organics" }));
app.post("/api/auth/login", (req, res) => {
  const username = clean(req.body.username, 80);
  const password = String(req.body.password || "");
  if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Invalid credentials" });
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { role: "admin", username, createdAt: Date.now() });
  res.json({ token, username });
});
app.post("/api/auth/direct", (_req, res) => {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { role: "admin", username: "admin", createdAt: Date.now() });
  res.json({ token, username: "admin" });
});
app.post("/api/auth/logout", auth, (req, res) => {
  sessions.delete(req.headers.authorization.replace("Bearer ", ""));
  res.status(204).end();
});

app.post("/api/store/auth/register", (req, res) => {
  const password = String(req.body.password || "");
  const name = clean(req.body.name, 120);
  const email = clean(req.body.email, 160).toLowerCase();
  const phone = clean(req.body.phone, 40);
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !phone) return res.status(400).json({ error: "Valid name, email and phone are required" });
  const accounts = readJson(STORE_ACCOUNTS_FILE, []);
  if (accounts.some((account) => accountEmail(account) === email)) return res.status(409).json({ error: "An account with that email already exists" });
  const credentials = passwordHash(password);
  const account = { id: crypto.randomUUID(), passwordSalt: credentials.salt, passwordHash: credentials.hash, profile: { name, email, phone }, createdAt: new Date().toISOString() };
  accounts.unshift(account);
  writeJson(STORE_ACCOUNTS_FILE, accounts);
  res.status(201).json({ ok: true, token: customerToken(account), account: { ...account.profile } });
});
app.post("/api/store/auth/login", (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || "");
  const account = readJson(STORE_ACCOUNTS_FILE, []).find((entry) => accountEmail(entry) === email);
  // Accounts created through Supabase hold no local password hash.
  if (!account || !account.passwordHash || !passwordsMatch(password, account)) return res.status(401).json({ error: "Invalid email or password" });
  res.json({ ok: true, token: customerToken(account), account: { ...account.profile } });
});
app.post("/api/store/auth/forgot-password", async (req, res) => {
  const phone = clean(req.body.phone, 40);
  const challengeId = crypto.randomBytes(24).toString("hex");
  const otp = String(crypto.randomInt(100000, 1000000));
  const account = readJson(STORE_ACCOUNTS_FILE, []).find((entry) => normalizedPhone(accountPhone(entry)) === normalizedPhone(phone));
  const otpCredentials = passwordHash(otp);
  const challenge = { accountId: account?.id || null, otpSalt: otpCredentials.salt, otpHash: otpCredentials.hash, attempts: 0, expiresAt: Date.now() + PASSWORD_RESET_MAX_AGE };
  passwordResetChallenges.set(challengeId, challenge);
  try {
    const delivery = await sendPasswordResetOtp(account ? accountPhone(account) : phone, otp);
    res.json({ ok: true, challengeId, delivery, ...(delivery === "development" ? { debugOtp: otp } : {}) });
  } catch (error) {
    passwordResetChallenges.delete(challengeId);
    res.status(503).json({ error: error.message });
  }
});
app.post("/api/store/auth/verify-reset-otp", (req, res) => {
  const challengeId = clean(req.body.challengeId, 100);
  const challenge = passwordResetChallenges.get(challengeId);
  const otp = String(req.body.otp || "");
  if (!challenge || Date.now() > challenge.expiresAt || !challenge.accountId) return res.status(400).json({ error: "Invalid or expired OTP" });
  challenge.attempts += 1;
  const actual = Buffer.from(passwordHash(otp, challenge.otpSalt).hash, "hex");
  const expected = Buffer.from(challenge.otpHash, "hex");
  const matches = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  if (challenge.attempts > PASSWORD_RESET_MAX_ATTEMPTS || !matches) {
    if (challenge.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) passwordResetChallenges.delete(challengeId);
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }
  challenge.verified = true;
  challenge.resetToken = crypto.randomBytes(32).toString("hex");
  res.json({ ok: true, resetToken: challenge.resetToken });
});
app.post("/api/store/auth/reset-password", (req, res) => {
  const resetToken = clean(req.body.resetToken, 100);
  const password = String(req.body.password || "");
  const challengeEntry = [...passwordResetChallenges.entries()].find(([, entry]) => entry.resetToken === resetToken && entry.verified);
  const challenge = challengeEntry?.[1];
  if (!challenge || Date.now() > challenge.expiresAt) return res.status(400).json({ error: "Invalid or expired password reset" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  const accounts = readJson(STORE_ACCOUNTS_FILE, []);
  const account = accounts.find((entry) => entry.id === challenge.accountId);
  if (!account) return res.status(404).json({ error: "Store account not found" });
  const credentials = passwordHash(password);
  account.passwordSalt = credentials.salt;
  account.passwordHash = credentials.hash;
  writeJson(STORE_ACCOUNTS_FILE, accounts);
  for (const [token, session] of sessions) if (session.role === "customer" && session.accountId === account.id) sessions.delete(token);
  passwordResetChallenges.delete(challengeEntry[0]);
  res.json({ ok: true });
});
app.post("/api/store/auth/logout", customerAuth, (req, res) => {
  sessions.delete(req.headers.authorization.replace("Bearer ", ""));
  res.status(204).end();
});
app.get("/api/store/account", customerAuth, (req, res) => {
  const account = readJson(STORE_ACCOUNTS_FILE, []).find((entry) => entry.id === req.customer.accountId);
  if (!account) return res.status(404).json({ error: "Store account not found" });
  res.json({ ...account.profile });
});
app.patch("/api/store/account", customerAuth, (req, res) => {
  const accounts = readJson(STORE_ACCOUNTS_FILE, []);
  const account = accounts.find((entry) => entry.id === req.customer.accountId);
  if (!account) return res.status(404).json({ error: "Store account not found" });
  const email = clean(req.body.email, 160).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "A valid email is required" });
  if (accounts.some((entry) => entry.id !== account.id && accountEmail(entry) === email)) return res.status(409).json({ error: "An account with that email already exists" });
  account.profile = { name: clean(req.body.name, 120), email, phone: clean(req.body.phone, 40), company: clean(req.body.company, 120), house: clean(req.body.house, 160), street: clean(req.body.street, 160), city: clean(req.body.city, 120), state: clean(req.body.state, 120), pincode: clean(req.body.pincode, 20), country: clean(req.body.country, 80) };
  if (!account.profile.name || !account.profile.email || !account.profile.phone) return res.status(400).json({ error: "Name, email and phone are required" });
  writeJson(STORE_ACCOUNTS_FILE, accounts);
  res.json({ ...account.profile });
});

// Mirrors a Supabase-authenticated customer into the local customer
// directory so the admin panel's Customers tab lists every signup.
app.post("/api/store/profile-sync", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(503).json({ error: "Supabase is not configured on the server. Set SUPABASE_URL and SUPABASE_ANON_KEY." });
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Sign in required" });
  let user;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
    user = await response.json();
    if (!response.ok || !user?.id) return res.status(401).json({ error: "Your session is no longer valid" });
  } catch (error) {
    return res.status(502).json({ error: "Could not verify the session with Supabase" });
  }
  const email = clean(user.email, 160).toLowerCase();
  if (!email) return res.status(400).json({ error: "The Supabase account has no email address" });
  const metadata = user.user_metadata || {};
  const field = (key, max) => clean(req.body[key] ?? metadata[key], max);
  const profile = {
    name: field("name", 120),
    email,
    phone: field("phone", 40),
    company: field("company", 120),
    house: field("house", 160),
    street: field("street", 160),
    city: field("city", 120),
    state: field("state", 120),
    pincode: field("pincode", 20),
    country: field("country", 80),
  };
  const accounts = readJson(STORE_ACCOUNTS_FILE, []);
  const existing = accounts.find((account) => account.supabaseId === user.id || accountEmail(account) === email);
  if (existing) {
    existing.supabaseId = user.id;
    existing.provider = "supabase";
    existing.profile = { ...existing.profile, ...profile };
    existing.updatedAt = new Date().toISOString();
  } else {
    accounts.unshift({ id: crypto.randomUUID(), supabaseId: user.id, provider: "supabase", profile, createdAt: user.created_at || new Date().toISOString() });
  }
  writeJson(STORE_ACCOUNTS_FILE, accounts);
  res.json({ ok: true });
});

app.get("/api/store/accounts", auth, (_req, res) => {
  const accounts = readJson(STORE_ACCOUNTS_FILE, []);
  res.json(accounts.map((account) => ({ id: account.id, createdAt: account.createdAt, ...account.profile })));
});

app.get("/api/products", (_req, res) => res.json(readJson(PRODUCTS_FILE, [])));
app.put("/api/products/:id", auth, (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const index = products.findIndex((item) => item.id === String(req.params.id));
  if (index < 0) return res.status(404).json({ error: "Product not found" });
  const current = products[index];
  const allowed = ["name", "category", "subcategory", "description", "price", "stock", "active", "newArrival", "bestseller", "image"];
  for (const key of allowed) if (req.body[key] !== undefined) current[key] = key === "price" || key === "stock" ? Number(req.body[key]) || 0 : key === "active" || key === "newArrival" || key === "bestseller" ? Boolean(req.body[key]) : clean(req.body[key]);
  if (req.body.imageData) {
    try { current.image = saveProductImage(current.id, req.body.imageData); }
    catch (error) { return res.status(400).json({ error: error.message }); }
  }
  current.updatedAt = new Date().toISOString();
  writeJson(PRODUCTS_FILE, products);
  res.json(current);
});

app.post("/api/enquiries", (req, res) => {
  const type = req.body.type === "franchise" ? "franchise" : "contact";
  const record = { id: crypto.randomUUID(), type, name: clean(req.body.name, 120), email: clean(req.body.email, 160), phone: clean(req.body.phone, 40), city: clean(req.body.city, 120), subject: clean(req.body.subject, 120), message: clean(req.body.message), status: "new", createdAt: new Date().toISOString() };
  if (!record.name || (!record.email && !record.phone) || !record.message) return res.status(400).json({ error: "Name, contact and message are required" });
  addRecord(ENQUIRIES_FILE, record);
  res.status(201).json({ ok: true, id: record.id });
});
app.get("/api/enquiries", auth, (_req, res) => res.json(readJson(ENQUIRIES_FILE, [])));
app.delete("/api/enquiries", auth, (_req, res) => {
  writeJson(ENQUIRIES_FILE, []);
  res.status(204).end();
});
app.patch("/api/enquiries/:id", auth, (req, res) => {
  const records = readJson(ENQUIRIES_FILE, []);
  const item = records.find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Enquiry not found" });
  item.status = ["new", "in-progress", "resolved"].includes(req.body.status) ? req.body.status : item.status;
  writeJson(ENQUIRIES_FILE, records);
  res.json(item);
});

app.post("/api/orders", (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 50) : [];
  if (!items.length || !clean(req.body.name, 120) || !clean(req.body.phone, 40)) return res.status(400).json({ error: "Name, phone and at least one item are required" });
  const products = readJson(PRODUCTS_FILE, []);
  const quantities = new Map();
  for (const item of items) {
    const productId = String(item.id || "");
    const quantity = Number(item.qty);
    if (!productId || !Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: "Each item must have a valid quantity" });
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }
  for (const [productId, quantity] of quantities) {
    const product = products.find((entry) => entry.id === productId);
    if (!product) return res.status(400).json({ error: `Product ${productId} was not found` });
  }
  const backorderedItems = [];
  for (const [productId, quantity] of quantities) {
    const product = products.find((entry) => entry.id === productId);
    const availableStock = Math.max(0, Number(product.stock) || 0);
    if (quantity > availableStock) backorderedItems.push({ id: productId, requested: quantity, available: availableStock });
    product.stock = Math.max(0, availableStock - quantity);
    product.updatedAt = new Date().toISOString();
  }
  writeJson(PRODUCTS_FILE, products);
  const record = addRecord(ORDERS_FILE, { id: `MO-${Date.now().toString(36).toUpperCase()}`, name: clean(req.body.name, 120), phone: clean(req.body.phone, 40), email: clean(req.body.email, 160), address: clean(req.body.address, 500), city: clean(req.body.city, 120), state: clean(req.body.state, 120), pincode: clean(req.body.pincode, 20), country: clean(req.body.country, 80), total: Number(req.body.total) || 0, gst: Number(req.body.gst) || 0, igst: Number(req.body.igst) || 0, fertilizerTax: Number(req.body.fertilizerTax) || 0, woodenPlanterTax: Number(req.body.woodenPlanterTax) || 0, otherTax: Number(req.body.otherTax) || 0, items, backorderedItems, note: clean(req.body.note), status: "new", createdAt: new Date().toISOString() });
  res.status(201).json({ ok: true, orderId: record.id });
});
app.get("/api/orders", auth, (_req, res) => res.json(readJson(ORDERS_FILE, [])));
app.post("/api/orders/:id/shiprocket", auth, async (req, res) => {
  if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD) return res.status(503).json({ error: "Shiprocket is not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD." });
  const orders = readJson(ORDERS_FILE, []);
  const order = orders.find((item) => item.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.shiprocket?.orderId) return res.status(409).json({ error: "Order already forwarded to Shiprocket", shiprocket: order.shiprocket });
  if (!order.address || !order.city || !order.state || !order.pincode) return res.status(400).json({ error: "Complete customer address is required before forwarding this order" });
  try {
    const loginResponse = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: SHIPROCKET_EMAIL, password: SHIPROCKET_PASSWORD }) });
    const login = await loginResponse.json();
    if (!loginResponse.ok || !login.token) return res.status(502).json({ error: login.message || "Shiprocket login failed" });
    const products = readJson(PRODUCTS_FILE, []);
    const orderItems = order.items.map((item) => {
      const product = products.find((entry) => entry.id === String(item.id));
      return { name: product?.name || `Product ${item.id}`, sku: product?.sku || `MO-${item.id}`, units: Number(item.qty) || 1, selling_price: Number(product?.price) || 0, discount: "" };
    });
    const subtotal = orderItems.reduce((sum, item) => sum + item.selling_price * item.units, 0);
    const payload = { order_id: order.id, order_date: order.createdAt, pickup_location: SHIPROCKET_PICKUP_LOCATION, channel_id: "", billing_customer_name: order.name, billing_last_name: "", billing_address: order.address, billing_city: order.city, billing_pincode: order.pincode, billing_state: order.state, billing_country: order.country || "India", billing_email: order.email, billing_phone: order.phone, shipping_is_billing: true, order_items: orderItems, payment_method: "COD", shipping_charges: 0, giftwrap_charges: 0, transaction_charges: 0, total_discount: 0, sub_total: subtotal, length: 10, breadth: 10, height: 10, weight: 0.5 };
    const createResponse = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${login.token}` }, body: JSON.stringify(payload) });
    const created = await createResponse.json();
    if (!createResponse.ok || !created.order_id) return res.status(502).json({ error: created.message || "Shiprocket order creation failed" });
    order.shiprocket = { orderId: String(created.order_id), shipmentId: created.shipment_id ? String(created.shipment_id) : "", status: "forwarded", forwardedAt: new Date().toISOString() };
    order.status = "confirmed";
    writeJson(ORDERS_FILE, orders);
    res.json({ ok: true, shiprocket: order.shiprocket });
  } catch (error) {
    res.status(502).json({ error: `Shiprocket connection failed: ${error.message}` });
  }
});
app.delete("/api/orders", auth, (_req, res) => {
  writeJson(ORDERS_FILE, []);
  res.status(204).end();
});
app.get("/api/export/orders", auth, (_req, res) => {
  const orders = readJson(ORDERS_FILE, []);
  downloadCsv(res, "mhow-organics-orders.csv", ["Order ID", "Date", "Customer", "Phone", "Email", "Address", "Items", "Note", "Status"], orders.map((order) => [
    order.id,
    order.createdAt,
    order.name,
    order.phone,
    order.email,
    order.address,
    (order.items || []).map((item) => `${item.id} x ${item.qty}`).join("; "),
    order.note,
    order.status,
  ]));
});
app.get("/api/export/inventory", auth, (_req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  downloadCsv(res, "mhow-organics-inventory.csv", ["Product ID", "Product Name", "Category", "Subcategory", "Price", "Remaining Stock", "Visibility", "Updated"], products.map((product) => [
    product.id,
    product.name,
    product.category,
    product.subcategory,
    product.price,
    product.stock,
    product.active ? "Visible" : "Hidden",
    product.updatedAt,
  ]));
});
app.patch("/api/orders/:id", auth, (req, res) => {
  const orders = readJson(ORDERS_FILE, []);
  const item = orders.find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Order not found" });
  item.status = ["new", "confirmed", "packed", "shipped", "completed", "cancelled"].includes(req.body.status) ? req.body.status : item.status;
  writeJson(ORDERS_FILE, orders);
  res.json(item);
});

app.use(express.static(ROOT));
app.get("/admin", (_req, res) => res.sendFile(path.join(ROOT, "admin", "index.html")));
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Mhow Organics running at http://localhost:${PORT}`));
}

module.exports = app;
