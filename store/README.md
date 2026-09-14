# The Smiling Worm — E-commerce Starter

A self-contained, responsive e-commerce frontend for **The Smiling Worm by MHOW Organics**.

## Included
- Premium gardening-store UI inspired by the supplied references
- 149 generated product records across all requested categories
- Category dropdown + dedicated category views
- Home Decor subcategories: Wooden, Metallic, Plastic, Office Gifts
- Search, sorting and basic filtering
- Functional cart with + / - quantity controls
- Wishlist with localStorage persistence
- Account details saved locally
- Checkout flow + payment API placeholder
- Order confirmation demo flow
- Fully responsive layout

## Run
Open `index.html` directly in a modern browser. No build step is required.

## Payment integration
Add the provider SDK you prefer and connect it to the checkout form. Keep real secrets in environment variables/backend services in production. The UI exposes a placeholder for `VITE_PAYMENT_API_KEY` only as a configuration reference.

## Product data
All products are generated in `app.js` so the layout has the requested capacity of 149 products. Replace or expand the `makeProducts()` function with your real catalog data later.


See README_150_PRODUCTS.txt for the 150-product manual catalogue.
