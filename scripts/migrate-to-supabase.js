// One-time migration of the existing data/*.json files (and any locally
// uploaded product images) into Supabase. Safe to re-run: every table is
// upserted on its primary key.
//
// Usage:
//   1. Run supabase/schema.sql in the Supabase SQL Editor first.
//   2. Fill in .env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
//   3. node scripts/migrate-to-supabase.js

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const supabaseAdmin = require("../lib/supabaseAdmin");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads", "products");
const PRODUCT_IMAGE_BUCKET = "product-images";

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function contentTypeFor(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

async function migrateProductImage(product) {
  if (!product.image || !product.image.startsWith("/uploads/products/")) return product.image;
  const filename = product.image.replace("/uploads/products/", "");
  const localPath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(localPath)) return product.image;
  const buffer = fs.readFileSync(localPath);
  const { error } = await supabaseAdmin.storage.from(PRODUCT_IMAGE_BUCKET).upload(filename, buffer, { contentType: contentTypeFor(filename), upsert: true });
  if (error) { console.error(`  ! Failed to upload ${filename}: ${error.message}`); return product.image; }
  const { data } = supabaseAdmin.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

async function migrateProducts() {
  const products = readJson(path.join(DATA_DIR, "products.json"), []);
  if (!products.length) { console.log("products: nothing to migrate"); return; }
  const rows = [];
  for (const product of products) {
    const image = await migrateProductImage(product);
    rows.push({
      id: String(product.id),
      category: product.category || "",
      subcategory: product.subcategory || "",
      name: product.name || "",
      image,
      price: Number(product.price) || 0,
      description: product.description || "",
      stock: Number(product.stock) || 0,
      active: product.active !== false,
      new_arrival: Boolean(product.newArrival),
      bestseller: Boolean(product.bestseller),
      updated_at: product.updatedAt || new Date().toISOString(),
    });
  }
  const { error } = await supabaseAdmin.from("products").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  console.log(`products: migrated ${rows.length}`);
}

async function migrateOrders() {
  const orders = readJson(path.join(DATA_DIR, "orders.json"), []);
  if (!orders.length) { console.log("orders: nothing to migrate"); return; }
  const rows = orders.map((order) => ({
    id: order.id,
    name: order.name || "",
    phone: order.phone || "",
    email: order.email || "",
    address: order.address || "",
    city: order.city || "",
    state: order.state || "",
    pincode: order.pincode || "",
    country: order.country || "",
    total: Number(order.total) || 0,
    gst: Number(order.gst) || 0,
    igst: Number(order.igst) || 0,
    fertilizer_tax: Number(order.fertilizerTax) || 0,
    wooden_planter_tax: Number(order.woodenPlanterTax) || 0,
    other_tax: Number(order.otherTax) || 0,
    items: order.items || [],
    backordered_items: order.backorderedItems || [],
    note: order.note || "",
    status: order.status || "new",
    shiprocket: order.shiprocket || null,
    created_at: order.createdAt || new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin.from("orders").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  console.log(`orders: migrated ${rows.length}`);
}

async function migrateEnquiries() {
  const enquiries = readJson(path.join(DATA_DIR, "enquiries.json"), []);
  if (!enquiries.length) { console.log("enquiries: nothing to migrate"); return; }
  const rows = enquiries.map((entry) => ({
    id: entry.id,
    type: entry.type || "contact",
    name: entry.name || "",
    email: entry.email || "",
    phone: entry.phone || "",
    city: entry.city || "",
    subject: entry.subject || "",
    message: entry.message || "",
    status: entry.status || "new",
    created_at: entry.createdAt || new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin.from("enquiries").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  console.log(`enquiries: migrated ${rows.length}`);
}

async function migrateStoreAccounts() {
  const accounts = readJson(path.join(DATA_DIR, "store_accounts.json"), []);
  if (!accounts.length) { console.log("store_accounts: nothing to migrate"); return; }
  const rows = accounts.map((account) => ({
    id: account.id,
    password_salt: account.passwordSalt || null,
    password_hash: account.passwordHash || null,
    supabase_id: account.supabaseId || null,
    provider: account.provider || null,
    profile: account.profile || {},
    created_at: account.createdAt || new Date().toISOString(),
    updated_at: account.updatedAt || null,
  }));
  const { error } = await supabaseAdmin.from("store_accounts").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  console.log(`store_accounts: migrated ${rows.length}`);
}

(async () => {
  try {
    await migrateProducts();
    await migrateOrders();
    await migrateEnquiries();
    await migrateStoreAccounts();
    console.log("Migration complete.");
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }
})();
