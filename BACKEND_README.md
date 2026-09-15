# Mhow Organics backend

## Run locally

```powershell
npm install
$env:ADMIN_USER="admin"
$env:ADMIN_PASSWORD=
$env:SHIPROCKET_EMAIL="your-shiprocket-email"
$env:SHIPROCKET_PASSWORD="your-shiprocket-password"
$env:SHIPROCKET_PICKUP_LOCATION="Primary"
npm start
```

The environment variables must be set in the same PowerShell window before running `npm start`. For better security, replace `change-me-now` with your own password, restart the server, and use that password when signing in.

Open `http://localhost:3000/` for the website and `http://localhost:3000/admin` for the admin panel. The admin panel currently opens directly without a password.

The first run creates `data/products.json` from `store/product_inventory.csv`, plus `data/enquiries.json` and `data/orders.json`. Product edits and incoming enquiries/orders are persisted in those files.

## API areas

- `POST /api/auth/login` signs an admin in.
- `POST /api/store/profile-sync` copies a Supabase-signed-in customer into `data/store_accounts.json` so they appear in the admin panel. It checks the customer's Supabase session before saving anything.
- `POST /api/store/auth/register` / `POST /api/store/auth/login` are the fallback customer sign-in used only while Supabase is not configured.
- `GET /api/store/accounts` lists every registered customer account (name, email, phone, address) for the admin panel's Customers tab (admin token required).

## Customer accounts with Supabase

The store's Account page signs customers in with Supabase and emails them a link when they forget their password.

1. Create a project at https://supabase.com.
2. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.
3. Paste both into `store/supabase-config.js`.
4. Set the same two values on the server so new signups reach the admin panel:

```powershell
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_ANON_KEY="your-anon-public-key"
npm start
```

5. In Supabase open **Authentication → URL Configuration**. Set **Site URL** to your live domain. Add these to **Redirect URLs**:

```
http://localhost:3000/store/reset-password.html
https://your-live-domain/store/reset-password.html
```

6. Before launch, add your own mail server under **Project Settings → Authentication → SMTP Settings**. Supabase's built-in mailer only sends a few emails per hour.

Password reset flow: the customer clicks **Forgot password?**, enters their email, and Supabase emails a link. The link opens `store/reset-password.html`, where they choose a new password and are sent back to sign in.

Supabase keeps its own user list, so the two customers who registered before the switch will not exist there. Ask them to create their account again, or add them under **Authentication → Users** in Supabase. Until `store/supabase-config.js` is filled in, the Account page keeps using this server's own sign-in.
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

Before deployment, set a strong `ADMIN_PASSWORD`, put the server behind HTTPS, and replace file storage with a managed database if multiple operators or high traffic are expected.
