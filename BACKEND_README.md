# Mhow Organics backend

All persistent data (products, orders, enquiries, customer accounts, login
sessions, password-reset OTPs, and uploaded product images) lives in
Supabase — Postgres tables plus a Storage bucket. The `data/*.json` files and
`uploads/products/` folder are legacy; they're only read once by the optional
migration script below.

## 1. Create the Supabase project

1. Go to https://supabase.com, sign in, and click **New project**. Pick a
   name, a strong database password, and a region close to your users. Wait
   ~2 minutes for it to provision.
2. Open **Project Settings → API** and copy three values:
   - **Project URL**
   - **anon public** key
   - **service_role** key (secret — server only, never put this in
     `store/supabase-config.js` or any file served to the browser)
3. Open the **SQL Editor**, paste in the full contents of `supabase/schema.sql`
   from this repo, and run it once. This creates all six tables (`products`,
   `enquiries`, `orders`, `store_accounts`, `sessions`,
   `password_reset_challenges`) with row level security enabled and no public
   policies — only the `service_role` key can read/write them — plus a public
   `product-images` storage bucket.

## 2. Configure environment variables

```powershell
cp .env.example .env
```

Edit `.env` and fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, plus `ADMIN_USER`/`ADMIN_PASSWORD` and (optionally)
the Shiprocket and SMS webhook values. `server.js` loads `.env` automatically
via `dotenv`. When deploying to Vercel, set the same variables under
**Project Settings → Environment Variables** there.

Also paste the **Project URL** and **anon public** key into
`store/supabase-config.js` — that file is what the browser uses for customer
sign-in via Supabase Auth (see "Customer accounts with Supabase" below).

## 3. Install and run

```powershell
npm install
npm start
```

Open `http://localhost:3000/` for the website and `http://localhost:3000/admin` for the admin panel. The admin panel currently opens directly without a password.

On first run, if the `products` table is empty, the server seeds it from
`store/product_inventory.csv` automatically (0 stock, blank descriptions —
just the catalog structure).

## 4. Migrate existing data (optional, one time)

If you already have real data in `data/*.json` (custom stock levels, real
orders, real customer accounts) or images in `uploads/products/`, migrate it
into Supabase instead of relying on the fresh CSV seed:

```powershell
node scripts/migrate-to-supabase.js
```

Safe to re-run — every table is upserted on its primary key. Uploaded product
images referenced by `data/products.json` are copied into the
`product-images` bucket and the product rows are repointed at the new public
URLs.

## API areas

- `POST /api/auth/login` signs an admin in.
- `POST /api/store/profile-sync` copies a Supabase-signed-in customer into the `store_accounts` table so they appear in the admin panel. It checks the customer's Supabase session before saving anything.
- `POST /api/store/auth/register` / `POST /api/store/auth/login` are the fallback customer sign-in used only while Supabase Auth is not configured (i.e. `store/supabase-config.js` still has placeholder values).
- `GET /api/store/accounts` lists every registered customer account (name, email, phone, address) for the admin panel's Customers tab (admin token required).
- `GET /api/products` powers the store catalog.
- `PUT /api/products/:id` updates a product (admin token required).
- `POST /api/enquiries` receives contact and franchise submissions.
- `GET/PATCH /api/enquiries` manages enquiries (admin token required).
- `POST /api/orders` receives checkout orders.
- `GET/PATCH /api/orders` manages order status (admin token required).
- `GET /api/export/orders` downloads all orders as an Excel-compatible CSV (admin token required).
- `GET /api/export/inventory` downloads remaining stock as an Excel-compatible CSV (admin token required).
- `POST /api/orders/:id/shiprocket` forwards an order to Shiprocket (admin token required).

To forward an order, configure the three Shiprocket variables above, create orders with a complete address, then click **Forward to Shiprocket** in the admin Orders tab. The returned Shiprocket order ID is saved on the local order and prevents duplicate forwarding.

## Customer accounts with Supabase Auth

The store's Account page signs customers in with Supabase Auth directly (separate from the `sessions` table, which is used by this server's own admin/fallback-customer logins) and emails them a link when they forget their password.

1. In Supabase, open **Authentication → URL Configuration**. Set **Site URL** to your live domain, and add these to **Redirect URLs**:

```
http://localhost:3000/store/reset-password.html
https://your-live-domain/store/reset-password.html
```

2. Before launch, add your own mail server under **Project Settings → Authentication → SMTP Settings** — Supabase's built-in mailer only sends a few emails per hour.

Password reset flow: the customer clicks **Forgot password?**, enters their email, and Supabase emails a link. The link opens `store/reset-password.html`, where they choose a new password and are sent back to sign in.

Until `store/supabase-config.js` has real values, the Account page keeps using this server's own sign-in (`/api/store/auth/*`, backed by the `store_accounts` table).

Before deployment, set a strong `ADMIN_PASSWORD` and put the server behind HTTPS.
