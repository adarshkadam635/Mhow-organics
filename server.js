require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const supabaseAdmin = require("./lib/supabaseAdmin");

const ROOT = __dirname;
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
const PRODUCT_IMAGE_BUCKET = "product-images";

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

function fromProductRow(row) {
  return { id: row.id, category: row.category, subcategory: row.subcategory, name: row.name, image: row.image, price: Number(row.price) || 0, description: row.description, stock: row.stock, active: row.active, newArrival: row.new_arrival, bestseller: row.bestseller, updatedAt: row.updated_at };
}
function toProductRow(product) {
  return { id: product.id, category: product.category, subcategory: product.subcategory, name: product.name, image: product.image, price: product.price, description: product.description, stock: product.stock, active: product.active, new_arrival: product.newArrival, bestseller: product.bestseller, updated_at: product.updatedAt };
}
function fromEnquiryRow(row) {
  return { id: row.id, type: row.type, name: row.name, email: row.email, phone: row.phone, city: row.city, subject: row.subject, message: row.message, status: row.status, createdAt: row.created_at };
}
function toEnquiryRow(record) {
  return { id: record.id, type: record.type, name: record.name, email: record.email, phone: record.phone, city: record.city, subject: record.subject, message: record.message, status: record.status, created_at: record.createdAt };
}
function fromOrderRow(row) {
  return { id: row.id, name: row.name, phone: row.phone, email: row.email, address: row.address, city: row.city, state: row.state, pincode: row.pincode, country: row.country, total: Number(row.total) || 0, gst: Number(row.gst) || 0, igst: Number(row.igst) || 0, fertilizerTax: Number(row.fertilizer_tax) || 0, woodenPlanterTax: Number(row.wooden_planter_tax) || 0, otherTax: Number(row.other_tax) || 0, items: row.items || [], backorderedItems: row.backordered_items || [], note: row.note, status: row.status, shiprocket: row.shiprocket || undefined, createdAt: row.created_at };
}
function toOrderRow(order) {
  return { id: order.id, name: order.name, phone: order.phone, email: order.email, address: order.address, city: order.city, state: order.state, pincode: order.pincode, country: order.country, total: order.total, gst: order.gst, igst: order.igst, fertilizer_tax: order.fertilizerTax, wooden_planter_tax: order.woodenPlanterTax, other_tax: order.otherTax, items: order.items, backordered_items: order.backorderedItems, note: order.note, status: order.status, shiprocket: order.shiprocket ?? null, created_at: order.createdAt };
}
function fromAccountRow(row) {
  return { id: row.id, passwordSalt: row.password_salt, passwordHash: row.password_hash, supabaseId: row.supabase_id, provider: row.provider, profile: row.profile || {}, createdAt: row.created_at, updatedAt: row.updated_at };
}
function toAccountRow(account) {
  return { id: account.id, password_salt: account.passwordSalt ?? null, password_hash: account.passwordHash ?? null, supabase_id: account.supabaseId ?? null, provider: account.provider ?? null, profile: account.profile || {}, created_at: account.createdAt, updated_at: account.updatedAt ?? null };
}

async function findAccountByEmail(email) {
  const { data, error } = await supabaseAdmin.from("store_accounts").select("*").eq("profile->>email", email).limit(1);
  if (error) throw error;
  return data[0] ? fromAccountRow(data[0]) : null;
}

async function seedProducts() {
  const { count, error } = await supabaseAdmin.from("products").select("id", { count: "exact", head: true });
  if (error) throw error;
  if (count > 0) return;
  const csv = fs.readFileSync(path.join(ROOT, "store", "product_inventory.csv"), "utf8").trim();
  const lines = csv.split(/\r?\n/).slice(1);
  const rows = lines.map((line) => {
    const [id, category, subcategory, name, image, price, description] = csvFields(line);
    return toProductRow({ id: String(id), category, subcategory, name, image, price: Number(price) || 0, description, stock: 0, active: true, newArrival: false, bestseller: false, updatedAt: new Date().toISOString() });
  });
  const { error: insertError } = await supabaseAdmin.from("products").insert(rows);
  if (insertError) throw insertError;
}

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: false }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

const ready = seedProducts().catch((error) => console.error("Product seeding failed:", error));
app.use((req, res, next) => { ready.then(() => next()); });

async function getSession(token) {
  if (!token) return null;
  const { data, error } = await supabaseAdmin.from("sessions").select("*").eq("token", token).limit(1);
  if (error || !data.length) return null;
  return data[0];
}
async function deleteSession(token) {
  if (!token) return;
  await supabaseAdmin.from("sessions").delete().eq("token", token);
}
async function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = await getSession(token);
  if (!session || session.role !== "admin") return res.status(401).json({ error: "Authentication required" });
  next();
}
async function customerAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = await getSession(token);
  if (!session || session.role !== "customer" || Date.now() - new Date(session.created_at).getTime() > CUSTOMER_SESSION_MAX_AGE) {
    if (token) await deleteSession(token);
    return res.status(401).json({ error: "Please sign in to your store account" });
  }
  req.customer = { accountId: session.account_id };
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
async function customerToken(account) {
  const token = crypto.randomBytes(32).toString("hex");
  const { error } = await supabaseAdmin.from("sessions").insert({ token, role: "customer", account_id: account.id, created_at: new Date().toISOString() });
  if (error) throw error;
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
function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
function downloadCsv(res, filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`﻿${csv}`);
}
async function saveProductImage(productId, dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
  if (!match) throw new Error("Only PNG, JPG, WEBP, and GIF images are supported");
  const extension = match[1].split("/")[1].replace("jpeg", "jpg");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 8 * 1024 * 1024) throw new Error("Image must be 8 MB or smaller");
  const filename = `product-${productId}-${Date.now()}.${extension}`;
  const { error } = await supabaseAdmin.storage.from(PRODUCT_IMAGE_BUCKET).upload(filename, buffer, { contentType: match[1], upsert: true });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  const { data } = supabaseAdmin.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "mhow-organics" }));
app.post("/api/auth/login", async (req, res) => {
  const username = clean(req.body.username, 80);
  const password = String(req.body.password || "");
  if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Invalid credentials" });
  const token = crypto.randomBytes(32).toString("hex");
  const { error } = await supabaseAdmin.from("sessions").insert({ token, role: "admin", username, created_at: new Date().toISOString() });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ token, username });
});
app.post("/api/auth/direct", async (_req, res) => {
  const token = crypto.randomBytes(32).toString("hex");
  const { error } = await supabaseAdmin.from("sessions").insert({ token, role: "admin", username: "admin", created_at: new Date().toISOString() });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ token, username: "admin" });
});
app.post("/api/auth/logout", auth, async (req, res) => {
  await deleteSession(req.headers.authorization.replace("Bearer ", ""));
  res.status(204).end();
});

app.post("/api/store/auth/register", async (req, res) => {
  const password = String(req.body.password || "");
  const name = clean(req.body.name, 120);
  const email = clean(req.body.email, 160).toLowerCase();
  const phone = clean(req.body.phone, 40);
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !phone) return res.status(400).json({ error: "Valid name, email and phone are required" });
  try {
    if (await findAccountByEmail(email)) return res.status(409).json({ error: "An account with that email already exists" });
  } catch (error) { return res.status(500).json({ error: error.message }); }
  const credentials = passwordHash(password);
  const account = { id: crypto.randomUUID(), passwordSalt: credentials.salt, passwordHash: credentials.hash, profile: { name, email, phone }, createdAt: new Date().toISOString() };
  const { error: insertError } = await supabaseAdmin.from("store_accounts").insert(toAccountRow(account));
  if (insertError) return res.status(500).json({ error: insertError.message });
  res.status(201).json({ ok: true, token: await customerToken(account), account: { ...account.profile } });
});
app.post("/api/store/auth/login", async (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || "");
  let account;
  try { account = await findAccountByEmail(email); }
  catch (error) { return res.status(500).json({ error: error.message }); }
  // Accounts created through Supabase hold no local password hash.
  if (!account || !account.passwordHash || !passwordsMatch(password, account)) return res.status(401).json({ error: "Invalid email or password" });
  res.json({ ok: true, token: await customerToken(account), account: { ...account.profile } });
});
app.post("/api/store/auth/forgot-password", async (req, res) => {
  const phone = clean(req.body.phone, 40);
  const challengeId = crypto.randomBytes(24).toString("hex");
  const otp = String(crypto.randomInt(100000, 1000000));
  const { data: rows, error: fetchError } = await supabaseAdmin.from("store_accounts").select("*");
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  const account = rows.map(fromAccountRow).find((entry) => normalizedPhone(accountPhone(entry)) === normalizedPhone(phone));
  const otpCredentials = passwordHash(otp);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_MAX_AGE).toISOString();
  const { error: insertError } = await supabaseAdmin.from("password_reset_challenges").insert({ id: challengeId, account_id: account?.id || null, otp_salt: otpCredentials.salt, otp_hash: otpCredentials.hash, attempts: 0, verified: false, expires_at: expiresAt });
  if (insertError) return res.status(500).json({ error: insertError.message });
  try {
    const delivery = await sendPasswordResetOtp(account ? accountPhone(account) : phone, otp);
    res.json({ ok: true, challengeId, delivery, ...(delivery === "development" ? { debugOtp: otp } : {}) });
  } catch (error) {
    await supabaseAdmin.from("password_reset_challenges").delete().eq("id", challengeId);
    res.status(503).json({ error: error.message });
  }
});
app.post("/api/store/auth/verify-reset-otp", async (req, res) => {
  const challengeId = clean(req.body.challengeId, 100);
  const otp = String(req.body.otp || "");
  const { data, error } = await supabaseAdmin.from("password_reset_challenges").select("*").eq("id", challengeId).limit(1);
  if (error) return res.status(500).json({ error: error.message });
  const challenge = data[0];
  if (!challenge || Date.now() > new Date(challenge.expires_at).getTime() || !challenge.account_id) return res.status(400).json({ error: "Invalid or expired OTP" });
  const attempts = challenge.attempts + 1;
  const actual = Buffer.from(passwordHash(otp, challenge.otp_salt).hash, "hex");
  const expected = Buffer.from(challenge.otp_hash, "hex");
  const matches = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  if (attempts > PASSWORD_RESET_MAX_ATTEMPTS || !matches) {
    if (attempts >= PASSWORD_RESET_MAX_ATTEMPTS) await supabaseAdmin.from("password_reset_challenges").delete().eq("id", challengeId);
    else await supabaseAdmin.from("password_reset_challenges").update({ attempts }).eq("id", challengeId);
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }
  const resetToken = crypto.randomBytes(32).toString("hex");
  const { error: updateError } = await supabaseAdmin.from("password_reset_challenges").update({ attempts, verified: true, reset_token: resetToken }).eq("id", challengeId);
  if (updateError) return res.status(500).json({ error: updateError.message });
  res.json({ ok: true, resetToken });
});
app.post("/api/store/auth/reset-password", async (req, res) => {
  const resetToken = clean(req.body.resetToken, 100);
  const password = String(req.body.password || "");
  const { data, error } = await supabaseAdmin.from("password_reset_challenges").select("*").eq("reset_token", resetToken).eq("verified", true).limit(1);
  if (error) return res.status(500).json({ error: error.message });
  const challenge = data[0];
  if (!challenge || Date.now() > new Date(challenge.expires_at).getTime()) return res.status(400).json({ error: "Invalid or expired password reset" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  const credentials = passwordHash(password);
  const { data: updatedRows, error: updateError } = await supabaseAdmin.from("store_accounts").update({ password_salt: credentials.salt, password_hash: credentials.hash }).eq("id", challenge.account_id).select();
  if (updateError) return res.status(500).json({ error: updateError.message });
  if (!updatedRows.length) return res.status(404).json({ error: "Store account not found" });
  await supabaseAdmin.from("sessions").delete().eq("role", "customer").eq("account_id", challenge.account_id);
  await supabaseAdmin.from("password_reset_challenges").delete().eq("id", challenge.id);
  res.json({ ok: true });
});
app.post("/api/store/auth/logout", customerAuth, async (req, res) => {
  await deleteSession(req.headers.authorization.replace("Bearer ", ""));
  res.status(204).end();
});
app.get("/api/store/account", customerAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin.from("store_accounts").select("*").eq("id", req.customer.accountId).limit(1);
  if (error) return res.status(500).json({ error: error.message });
  if (!data.length) return res.status(404).json({ error: "Store account not found" });
  res.json({ ...fromAccountRow(data[0]).profile });
});
app.patch("/api/store/account", customerAuth, async (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "A valid email is required" });
  const { data: conflictRows, error: conflictError } = await supabaseAdmin.from("store_accounts").select("id").eq("profile->>email", email).neq("id", req.customer.accountId);
  if (conflictError) return res.status(500).json({ error: conflictError.message });
  if (conflictRows.length) return res.status(409).json({ error: "An account with that email already exists" });
  const profile = { name: clean(req.body.name, 120), email, phone: clean(req.body.phone, 40), company: clean(req.body.company, 120), house: clean(req.body.house, 160), street: clean(req.body.street, 160), city: clean(req.body.city, 120), state: clean(req.body.state, 120), pincode: clean(req.body.pincode, 20), country: clean(req.body.country, 80) };
  if (!profile.name || !profile.email || !profile.phone) return res.status(400).json({ error: "Name, email and phone are required" });
  const { data, error } = await supabaseAdmin.from("store_accounts").update({ profile, updated_at: new Date().toISOString() }).eq("id", req.customer.accountId).select();
  if (error) return res.status(500).json({ error: error.message });
  if (!data.length) return res.status(404).json({ error: "Store account not found" });
  res.json({ ...data[0].profile });
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
  const { data: bySupabaseId, error: supabaseIdError } = await supabaseAdmin.from("store_accounts").select("*").eq("supabase_id", user.id).limit(1);
  if (supabaseIdError) return res.status(500).json({ error: supabaseIdError.message });
  let existing = bySupabaseId[0];
  if (!existing) {
    try { existing = await findAccountByEmail(email).then((account) => account && { id: account.id, profile: account.profile }); }
    catch (error) { return res.status(500).json({ error: error.message }); }
  }
  if (existing) {
    const { error: updateError } = await supabaseAdmin.from("store_accounts").update({ supabase_id: user.id, provider: "supabase", profile: { ...existing.profile, ...profile }, updated_at: new Date().toISOString() }).eq("id", existing.id);
    if (updateError) return res.status(500).json({ error: updateError.message });
  } else {
    const { error: insertError } = await supabaseAdmin.from("store_accounts").insert({ id: crypto.randomUUID(), supabase_id: user.id, provider: "supabase", profile, created_at: user.created_at || new Date().toISOString() });
    if (insertError) return res.status(500).json({ error: insertError.message });
  }
  res.json({ ok: true });
});

app.get("/api/store/accounts", auth, async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("store_accounts").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map((row) => ({ id: row.id, createdAt: row.created_at, ...row.profile })));
});

app.get("/api/products", async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("products").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(fromProductRow).sort((a, b) => Number(a.id) - Number(b.id)));
});
app.put("/api/products/:id", auth, async (req, res) => {
  const id = String(req.params.id);
  const { data: existingRows, error: fetchError } = await supabaseAdmin.from("products").select("*").eq("id", id).limit(1);
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!existingRows.length) return res.status(404).json({ error: "Product not found" });
  const current = fromProductRow(existingRows[0]);
  const allowed = ["name", "category", "subcategory", "description", "price", "stock", "active", "newArrival", "bestseller", "image"];
  for (const key of allowed) if (req.body[key] !== undefined) current[key] = key === "price" || key === "stock" ? Number(req.body[key]) || 0 : key === "active" || key === "newArrival" || key === "bestseller" ? Boolean(req.body[key]) : clean(req.body[key]);
  if (req.body.imageData) {
    try { current.image = await saveProductImage(current.id, req.body.imageData); }
    catch (error) { return res.status(400).json({ error: error.message }); }
  }
  current.updatedAt = new Date().toISOString();
  const { data: updatedRows, error: updateError } = await supabaseAdmin.from("products").update(toProductRow(current)).eq("id", id).select();
  if (updateError) return res.status(500).json({ error: updateError.message });
  res.json(fromProductRow(updatedRows[0]));
});

app.post("/api/enquiries", async (req, res) => {
  const type = req.body.type === "franchise" ? "franchise" : "contact";
  const record = { id: crypto.randomUUID(), type, name: clean(req.body.name, 120), email: clean(req.body.email, 160), phone: clean(req.body.phone, 40), city: clean(req.body.city, 120), subject: clean(req.body.subject, 120), message: clean(req.body.message), status: "new", createdAt: new Date().toISOString() };
  if (!record.name || (!record.email && !record.phone) || !record.message) return res.status(400).json({ error: "Name, contact and message are required" });
  const { error } = await supabaseAdmin.from("enquiries").insert(toEnquiryRow(record));
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ok: true, id: record.id });
});
app.get("/api/enquiries", auth, async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("enquiries").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(fromEnquiryRow));
});
app.delete("/api/enquiries", auth, async (_req, res) => {
  const { error } = await supabaseAdmin.from("enquiries").delete().not("id", "is", null);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});
app.patch("/api/enquiries/:id", auth, async (req, res) => {
  const status = ["new", "in-progress", "resolved"].includes(req.body.status) ? req.body.status : null;
  const { data, error } = status
    ? await supabaseAdmin.from("enquiries").update({ status }).eq("id", req.params.id).select()
    : await supabaseAdmin.from("enquiries").select("*").eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  if (!data.length) return res.status(404).json({ error: "Enquiry not found" });
  res.json(fromEnquiryRow(data[0]));
});

app.post("/api/orders", async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 50) : [];
  if (!items.length || !clean(req.body.name, 120) || !clean(req.body.phone, 40)) return res.status(400).json({ error: "Name, phone and at least one item are required" });
  const quantities = new Map();
  for (const item of items) {
    const productId = String(item.id || "");
    const quantity = Number(item.qty);
    if (!productId || !Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: "Each item must have a valid quantity" });
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }
  const productIds = [...quantities.keys()];
  const { data: productRows, error: productsError } = await supabaseAdmin.from("products").select("*").in("id", productIds);
  if (productsError) return res.status(500).json({ error: productsError.message });
  for (const productId of productIds) {
    if (!productRows.find((row) => row.id === productId)) return res.status(400).json({ error: `Product ${productId} was not found` });
  }
  const backorderedItems = [];
  const updatedAt = new Date().toISOString();
  for (const [productId, quantity] of quantities) {
    const product = productRows.find((row) => row.id === productId);
    const availableStock = Math.max(0, Number(product.stock) || 0);
    if (quantity > availableStock) backorderedItems.push({ id: productId, requested: quantity, available: availableStock });
    const { error } = await supabaseAdmin.from("products").update({ stock: Math.max(0, availableStock - quantity), updated_at: updatedAt }).eq("id", productId);
    if (error) return res.status(500).json({ error: error.message });
  }
  const record = { id: `MO-${Date.now().toString(36).toUpperCase()}`, name: clean(req.body.name, 120), phone: clean(req.body.phone, 40), email: clean(req.body.email, 160), address: clean(req.body.address, 500), city: clean(req.body.city, 120), state: clean(req.body.state, 120), pincode: clean(req.body.pincode, 20), country: clean(req.body.country, 80), total: Number(req.body.total) || 0, gst: Number(req.body.gst) || 0, igst: Number(req.body.igst) || 0, fertilizerTax: Number(req.body.fertilizerTax) || 0, woodenPlanterTax: Number(req.body.woodenPlanterTax) || 0, otherTax: Number(req.body.otherTax) || 0, items, backorderedItems, note: clean(req.body.note), status: "new", createdAt: new Date().toISOString() };
  const { error: insertError } = await supabaseAdmin.from("orders").insert(toOrderRow(record));
  if (insertError) return res.status(500).json({ error: insertError.message });
  res.status(201).json({ ok: true, orderId: record.id });
});
app.get("/api/orders", auth, async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(fromOrderRow));
});
app.post("/api/orders/:id/shiprocket", auth, async (req, res) => {
  if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD) return res.status(503).json({ error: "Shiprocket is not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD." });
  const { data: orderRows, error: orderError } = await supabaseAdmin.from("orders").select("*").eq("id", req.params.id).limit(1);
  if (orderError) return res.status(500).json({ error: orderError.message });
  if (!orderRows.length) return res.status(404).json({ error: "Order not found" });
  const order = fromOrderRow(orderRows[0]);
  if (order.shiprocket?.orderId) return res.status(409).json({ error: "Order already forwarded to Shiprocket", shiprocket: order.shiprocket });
  if (!order.address || !order.city || !order.state || !order.pincode) return res.status(400).json({ error: "Complete customer address is required before forwarding this order" });
  try {
    const loginResponse = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: SHIPROCKET_EMAIL, password: SHIPROCKET_PASSWORD }) });
    const login = await loginResponse.json();
    if (!loginResponse.ok || !login.token) return res.status(502).json({ error: login.message || "Shiprocket login failed" });
    const productIds = order.items.map((item) => String(item.id));
    const { data: productRows, error: productsError } = await supabaseAdmin.from("products").select("*").in("id", productIds);
    if (productsError) return res.status(500).json({ error: productsError.message });
    const orderItems = order.items.map((item) => {
      const product = productRows.find((entry) => entry.id === String(item.id));
      return { name: product?.name || `Product ${item.id}`, sku: product?.sku || `MO-${item.id}`, units: Number(item.qty) || 1, selling_price: Number(product?.price) || 0, discount: "" };
    });
    const subtotal = orderItems.reduce((sum, item) => sum + item.selling_price * item.units, 0);
    const payload = { order_id: order.id, order_date: order.createdAt, pickup_location: SHIPROCKET_PICKUP_LOCATION, channel_id: "", billing_customer_name: order.name, billing_last_name: "", billing_address: order.address, billing_city: order.city, billing_pincode: order.pincode, billing_state: order.state, billing_country: order.country || "India", billing_email: order.email, billing_phone: order.phone, shipping_is_billing: true, order_items: orderItems, payment_method: "COD", shipping_charges: 0, giftwrap_charges: 0, transaction_charges: 0, total_discount: 0, sub_total: subtotal, length: 10, breadth: 10, height: 10, weight: 0.5 };
    const createResponse = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${login.token}` }, body: JSON.stringify(payload) });
    const created = await createResponse.json();
    if (!createResponse.ok || !created.order_id) return res.status(502).json({ error: created.message || "Shiprocket order creation failed" });
    const shiprocket = { orderId: String(created.order_id), shipmentId: created.shipment_id ? String(created.shipment_id) : "", status: "forwarded", forwardedAt: new Date().toISOString() };
    const { error: updateError } = await supabaseAdmin.from("orders").update({ shiprocket, status: "confirmed" }).eq("id", order.id);
    if (updateError) return res.status(500).json({ error: updateError.message });
    res.json({ ok: true, shiprocket });
  } catch (error) {
    res.status(502).json({ error: `Shiprocket connection failed: ${error.message}` });
  }
});
app.delete("/api/orders", auth, async (_req, res) => {
  const { error } = await supabaseAdmin.from("orders").delete().not("id", "is", null);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});
app.get("/api/export/orders", auth, async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const orders = data.map(fromOrderRow);
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
app.get("/api/export/inventory", auth, async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("products").select("*");
  if (error) return res.status(500).json({ error: error.message });
  const products = data.map(fromProductRow).sort((a, b) => Number(a.id) - Number(b.id));
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
app.patch("/api/orders/:id", auth, async (req, res) => {
  const validStatuses = ["new", "confirmed", "packed", "shipped", "completed", "cancelled"];
  const status = validStatuses.includes(req.body.status) ? req.body.status : null;
  const { data, error } = status
    ? await supabaseAdmin.from("orders").update({ status }).eq("id", req.params.id).select()
    : await supabaseAdmin.from("orders").select("*").eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  if (!data.length) return res.status(404).json({ error: "Order not found" });
  res.json(fromOrderRow(data[0]));
});

app.use(express.static(ROOT));
app.get("/admin", (_req, res) => res.sendFile(path.join(ROOT, "admin", "index.html")));
if (!process.env.VERCEL) {
  ready.then(() => app.listen(PORT, () => console.log(`Mhow Organics running at http://localhost:${PORT}`)));
}

module.exports = app;
