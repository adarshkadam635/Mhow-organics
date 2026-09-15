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
- `POST /api/store/auth/register` / `POST /api/store/auth/login` let customers create a store account and sign in from the storefront's Account page.
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

Before deployment, set a strong `ADMIN_PASSWORD`, put the server behind HTTPS, and replace file storage with a managed database if multiple operators or high traffic are expected.
