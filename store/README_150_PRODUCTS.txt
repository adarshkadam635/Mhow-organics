THE SMILING WORM — 150-PRODUCT MERGED SHOP
==============================================

SOURCE CONTENT
--------------
This package combines the visual/store experience from the supplied Store
package with the requested 150-product catalogue structure from the supplied
150-product shop template.

The Store package supplies the main branding, logo, navigation, search,
category browsing, hero area, cart, wishlist, account, checkout, journal,
support/policy pages and overall storefront styling.

The catalogue is structured exactly as requested:
- Organic Fertilizer: 5
- Pest & Disease Control: 5
- Wooden Planters: 25
- Metallic Planters: 25
- Office Gifts: 25
- Premium Plastic Planters: 25
- Garden Tools: 25
- Combo Deals: 15
TOTAL: 150


MANUAL PRODUCT EDITING
----------------------
Open app.js and locate:
    function makeProducts(){

Each product is created by an `add(...)` call. Every product has:
- name
- description
- price
- originalPrice
- discount
- category
- subcategory
- image path
- stock
- SKU
- rating/reviews
- badges
- bestseller/new-arrival flags

The first four fertilizer products reuse product content from the supplied Store
package. The fifth fertilizer slot and all remaining requested catalogue slots
are intentionally editable placeholders.


MANUAL PRODUCT IMAGES
---------------------
All 150 image spaces are already created here:
    assets/images/products/product-001.svg
    ...
    assets/images/products/product-150.svg

To add a real image, the easiest method is to replace the matching SVG file
while keeping the SAME filename. This means you do not have to edit app.js.

Example:
    Replace product-001.svg with your own image content/file.

If you want to use JPG/PNG/WebP with a different filename/extension, edit that
product's `image:` value in app.js.


MANUAL PRODUCT DETAILS
----------------------
For each product in app.js, edit:
- product name
- description
- price
- original price (optional)
- discount (optional)
- stock
- SKU
- rating/reviews
- badge
- category/subcategory
- image path
- featured/bestseller/newArrival flags

The product cards automatically use the image assigned to each product.

The product detail page and cart also use the same image, so one image update
flows through the storefront.


CATEGORY STRUCTURE
------------------
The Home Decor category contains four subcategories of exactly 25 products:
1. Wooden Planters — 25
2. Metallic Planters — 25
3. Premium Plastic Planters — 25
4. Office Gifts — 25

The other categories use the requested totals.


IMPORTANT
---------
Prices are set to 0 for placeholder products so no fake commercial pricing is
presented. Replace them with your real prices before publishing.

Descriptions for placeholder products are intentionally marked for manual
editing. Replace them with verified product information, specifications,
claims and usage instructions.


MAIN FILES
----------
index.html              Storefront structure
style.css               Storefront styling + 150-product image styling
app.js                  Store logic + 150-product catalogue data
product_inventory.csv   Simple 150-row manual tracking sheet
README.md               Original Store package notes
README_150_PRODUCTS.txt Detailed manual editing instructions
assets/logo.png         Supplied The Smiling Worm / MHOW Organics logo
assets/hero-reference.png Supplied hero reference image
assets/ui-reference.png Supplied store UI reference image


LAUNCH
------
This is a static HTML/CSS/JS storefront. Open index.html locally for a preview
or deploy the folder to your static hosting provider.
