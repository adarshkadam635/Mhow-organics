const CATEGORIES = [
  {
    id: "plants",
    name: "Plants",
    icon: "🌿",
    desc: "Live plants for home & garden",
    subs: ["Indoor Plants", "Outdoor Plants"],
  },
  {
    id: "pots-planters",
    name: "Pots & Planters",
    icon: "🪴",
    desc: "Planters & office gifts",
    subs: [
      "Wooden Planters",
      "Metallic Planters",
      "Premium Plastic Planters",
      "Office Gifts",
    ],
  },
  {
    id: "tools-accessories",
    name: "Tools & Accessories",
    icon: "🧰",
    desc: "Tools for everyday care",
  },
  {
    id: "stands",
    name: "Stands",
    icon: "🗄️",
    desc: "Plant stands for every space",
    subs: ["Metal Stands", "Wooden Stands"],
  },
  {
    id: "plant-care",
    name: "Plant Care",
    icon: "🌱",
    desc: "Fertilizers & pest control",
    subs: ["Organic Fertilizer", "Pest & Disease Control"],
  },
  {
    id: "seeds",
    name: "Seeds",
    icon: "🌾",
    desc: "Seeds & seed combos",
    subs: ["Vegetable Seeds", "Flower Seeds"],
  },
  {
    id: "combos",
    name: "Combo Deals",
    icon: "🎁",
    desc: "More value, together",
    navHidden: true,
  },
];
const STATE_CITIES = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Tirupati", "Nellore"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Tawang", "Pasighat"],
  Assam: ["Guwahati", "Dibrugarh", "Jorhat", "Silchar", "Tezpur"],
  Bihar: ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga"],
  Chhattisgarh: ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg"],
  Goa: ["Panaji", "Margao", "Vasco da Gama", "Mapusa"],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar"],
  Haryana: ["Gurugram", "Faridabad", "Panipat", "Ambala", "Hisar"],
  "Himachal Pradesh": ["Shimla", "Manali", "Dharamshala", "Solan", "Mandi"],
  Jharkhand: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar"],
  Karnataka: ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Belagavi"],
  Kerala: ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam"],
  "Madhya Pradesh": ["Indore", "Bhopal", "Mhow", "Gwalior", "Jabalpur", "Ujjain", "Sagar"],
  Maharashtra: ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad", "Kolhapur"],
  Manipur: ["Imphal", "Thoubal", "Churachandpur", "Ukhrul"],
  Meghalaya: ["Shillong", "Tura", "Jowai", "Nongpoh"],
  Mizoram: ["Aizawl", "Lunglei", "Champhai", "Serchhip"],
  Nagaland: ["Kohima", "Dimapur", "Mokokchung", "Tuensang"],
  Odisha: ["Bhubaneswar", "Cuttack", "Rourkela", "Puri", "Sambalpur"],
  Punjab: ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda"],
  Rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer"],
  Sikkim: ["Gangtok", "Namchi", "Gyalshing", "Mangan"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Salem", "Tiruchirappalli"],
  Telangana: ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam"],
  Tripura: ["Agartala", "Udaipur", "Dharmanagar", "Kailashahar"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Agra", "Varanasi", "Noida", "Prayagraj"],
  Uttarakhand: ["Dehradun", "Haridwar", "Rishikesh", "Haldwani", "Nainital"],
  "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Siliguri", "Asansol"],
  "Andaman and Nicobar Islands": ["Port Blair", "Diglipur", "Mayabunder"],
  Chandigarh: ["Chandigarh"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Silvassa"],
  Delhi: ["New Delhi", "Delhi"],
  Jammu: ["Jammu", "Srinagar", "Anantnag", "Baramulla"],
  Ladakh: ["Leh", "Kargil"],
  Lakshadweep: ["Kavaratti", "Agatti", "Andrott"],
  Puducherry: ["Puducherry", "Karaikal", "Mahe", "Yanam"],
};
const STATES = Object.keys(STATE_CITIES).sort();

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}
function stateOptions(selected) {
  return `<option value="">Select state</option>${STATES.map((name) => `<option value="${name}" ${normalized(name) === normalized(selected) ? "selected" : ""}>${name}</option>`).join("")}`;
}
const state = {
  cart: JSON.parse(localStorage.getItem("tsw-cart") || "[]"),
  wishlist: JSON.parse(localStorage.getItem("tsw-wishlist") || "[]"),
  account: JSON.parse(localStorage.getItem("tsw-account") || "{}"),
  accountToken: sessionStorage.getItem("tsw-account-token") || "",
  hero: 0,
  subcat: "all",
  priceRange: "all",
  inStockOnly: false,
};

const money = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const FERTILIZER_GST_RATE = 0.05;
const WOODEN_PLANTER_GST_RATE = 0.12;
const OTHER_PRODUCT_GST_RATE = 0.18;
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function isMadhyaPradesh(value) {
  return /^(mp|madhya pradesh)$/.test(
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[.,]/g, "")
      .replace(/\s+/g, " "),
  );
}

function getOrderTotals(customerState = state.account?.state) {
  const subtotal = state.cart.reduce(
    (sum, item) => sum + productById(item.id).price * item.qty,
    0,
  );
  const discount = state.cart.reduce(
    (sum, item) =>
      sum +
      (productById(item.id).originalPrice - productById(item.id).price) *
        item.qty,
    0,
  );
  const isFertilizer = (product) => product.subcat === "Organic Fertilizer";
  const isWoodenPlanter = (product) => product.subcat === "Wooden Planters";
  const fertilizerTax = state.cart.reduce((sum, item) => {
    const product = productById(item.id);
    return isFertilizer(product)
      ? sum + product.price * item.qty * FERTILIZER_GST_RATE
      : sum;
  }, 0);
  const woodenPlanterTax = state.cart.reduce((sum, item) => {
    const product = productById(item.id);
    return isWoodenPlanter(product)
      ? sum + product.price * item.qty * WOODEN_PLANTER_GST_RATE
      : sum;
  }, 0);
  const otherTax = state.cart.reduce((sum, item) => {
    const product = productById(item.id);
    return isFertilizer(product) || isWoodenPlanter(product)
      ? sum
      : sum + product.price * item.qty * OTHER_PRODUCT_GST_RATE;
  }, 0);
  const shipping = subtotal >= 1499 ? 0 : 99;
  const hasDeliveryState = String(customerState || "").trim().length > 0;
  const outsideMadhyaPradesh =
    hasDeliveryState && !isMadhyaPradesh(customerState);
  const tax = fertilizerTax + woodenPlanterTax + otherTax;
  return {
    subtotal,
    discount,
    shipping,
    fertilizerTax,
    woodenPlanterTax,
    otherTax,
    gst: outsideMadhyaPradesh ? 0 : tax,
    igst: outsideMadhyaPradesh ? tax : 0,
    outsideMadhyaPradesh,
    total: subtotal + shipping + tax,
  };
}

function taxRows(totals, prefix = "") {
  const rows = [];
  const addTaxRows = (taxName, idPrefix) => {
    if (totals.fertilizerTax) {
      rows.push(
        `<div class="sum-row" ${prefix ? `id="${prefix}${idPrefix}FertilizerTax"` : ""}><span>${taxName} @ ${FERTILIZER_GST_RATE * 100}%</span><strong>${money(totals.fertilizerTax)}</strong></div>`,
      );
    }
    if (totals.otherTax) {
      rows.push(
        `<div class="sum-row" ${prefix ? `id="${prefix}${idPrefix}OtherTax"` : ""}><span>${taxName} @ ${OTHER_PRODUCT_GST_RATE * 100}%</span><strong>${money(totals.otherTax)}</strong></div>`,
      );
    }
    if (totals.woodenPlanterTax) {
      rows.splice(rows.length - (totals.otherTax ? 1 : 0), 0, `<div class="sum-row" ${prefix ? `id="${prefix}${idPrefix}WoodenPlanterTax"` : ""}><span>${taxName} @ ${WOODEN_PLANTER_GST_RATE * 100}%</span><strong>${money(totals.woodenPlanterTax)}</strong></div>`);
    }
  };
  addTaxRows(totals.outsideMadhyaPradesh ? "IGST" : "GST", totals.outsideMadhyaPradesh ? "Igst" : "Gst");
  return rows.join("");
}

function save() {
  localStorage.setItem("tsw-cart", JSON.stringify(state.cart));
  localStorage.setItem("tsw-wishlist", JSON.stringify(state.wishlist));
  localStorage.setItem("tsw-account", JSON.stringify(state.account));
  updateCounts();
}
async function restoreAccountSession() {
  if (!state.accountToken) return;
  try {
    state.account = await storeApi("/account");
    save();
  } catch (error) {
    state.accountToken = "";
    state.account = {};
    sessionStorage.removeItem("tsw-account-token");
    save();
  }
}
async function storeApi(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api/store${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(state.accountToken ? { Authorization: `Bearer ${state.accountToken}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    throw new Error("Account service is unavailable. Please start the website server and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Account request failed (${response.status})`);
  return data;
}
function updateCounts() {
  document.getElementById("cartCount").textContent = state.cart.reduce(
    (s, x) => s + x.qty,
    0,
  );
  document.getElementById("wishlistCount").textContent = state.wishlist.length;
}
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.getElementById("toast-root").appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
function productById(id) {
  return PRODUCTS.find((p) => p.id === String(id));
}
function isWish(id) {
  return state.wishlist.includes(String(id));
}
function addToCart(id, qty = 1) {
  const p = productById(id);
  if (!p) return;
  const existing = state.cart.find((x) => x.id === p.id);
  if (existing) existing.qty += qty;
  else state.cart.push({ id: p.id, qty });
  save();
  toast(`${p.name} added to cart`);
}
function setQty(id, delta) {
  const item = state.cart.find((x) => x.id === String(id));
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  save();
  render();
}
function removeFromCart(id) {
  state.cart = state.cart.filter((x) => x.id !== String(id));
  save();
  render();
  toast("Item removed");
}
function toggleWishlist(id) {
  id = String(id);
  state.wishlist = state.wishlist.includes(id)
    ? state.wishlist.filter((x) => x !== id)
    : [...state.wishlist, id];
  save();
  render();
  toast(
    state.wishlist.includes(id) ? "Added to wishlist" : "Removed from wishlist",
  );
}

function productCard(p) {
  return `<article class="product-card">
  <div class="product-image"><img src="${p.images[0]}" alt="${p.name.replace(/"/g, "&quot;")}" loading="lazy" onerror="this.src='assets/images/products/product-${String(p.id).padStart(3, "0")}.svg'">${p.badge && p.badge.trim() ? `<span class="badge">${p.badge}</span>` : ""}<button class="wish-btn ${isWish(p.id) ? "active" : ""}" data-wish="${p.id}" aria-label="Wishlist">${isWish(p.id) ? "♥" : "♡"}</button></div>
  <div class="product-body"><h3>${p.name}</h3><div class="product-description">${p.description}</div><div class="price-row"><span class="price">${money(p.price)}</span>${p.originalPrice > p.price ? `<span class="old-price">${money(p.originalPrice)}</span><span class="discount">${p.discount}% off</span>` : ""}</div><div class="product-meta"><span>${p.stock > 0 ? "In stock" : "Out of stock"}</span><span>★ ${p.rating}</span></div><div class="qty-row"><div class="qty"><button data-quickdec="${p.id}">−</button><span id="q-${p.id}">1</span><button data-quickinc="${p.id}">+</button></div><div class="card-spacer"></div></div><div class="add-row"><button class="btn small" data-add="${p.id}">Add to Cart</button><button class="btn small outline" data-view="${p.id}">View</button></div></div></article>`;
}

function bindProductEvents(root = document) {
  root.querySelectorAll("[data-add]").forEach(
    (b) =>
      (b.onclick = () => {
        const q = document.getElementById(`q-${b.dataset.add}`);
        addToCart(b.dataset.add, Number(q?.textContent || 1));
      }),
  );
  root
    .querySelectorAll("[data-wish]")
    .forEach((b) => (b.onclick = () => toggleWishlist(b.dataset.wish)));
  root.querySelectorAll("[data-quickinc]").forEach(
    (b) =>
      (b.onclick = () => {
        const s = document.getElementById(`q-${b.dataset.quickinc}`);
        s.textContent = Number(s.textContent) + 1;
      }),
  );
  root.querySelectorAll("[data-quickdec]").forEach(
    (b) =>
      (b.onclick = () => {
        const s = document.getElementById(`q-${b.dataset.quickdec}`);
        s.textContent = Math.max(1, Number(s.textContent) - 1);
      }),
  );
  root
    .querySelectorAll("[data-view]")
    .forEach((b) => (b.onclick = () => renderProduct(b.dataset.view)));
}

function home() {
  const curatedBestIds = ["1", "6", "31", "56", "81", "106", "131", "146"];
  const curatedNewIds = ["5", "30", "55", "80", "105", "130", "145", "150"];
  const best = PRODUCTS.filter(
    (p) => p.bestseller || curatedBestIds.includes(String(p.id)),
  ).slice(0, 8);
  const featured = PRODUCTS.filter(
    (p) => p.newArrival || curatedNewIds.includes(String(p.id)),
  ).slice(0, 8);
  const categorySections = CATEGORIES.map((c) => {
    const items = PRODUCTS.filter((p) => p.category === c.name).slice(0, 4);
    return `<section class="section category-products"><div class="container"><div class="section-head"><div><h2>${c.icon} ${c.name}</h2><p>${c.desc}</p></div><button class="link-btn" data-route="category:${c.id}">View all →</button></div><div class="product-grid carousel">${items.map(productCard).join("")}</div></div></section>`;
  }).join("");
  return `<section class="hero" id="hero"><div class="hero-track" id="heroTrack"></div><div class="hero-controls"><button id="prevHero" aria-label="Previous slide">‹</button><button id="nextHero" aria-label="Next slide">›</button></div><div class="dots" id="heroDots" aria-label="Hero slides"></div></section>
${promoBanner()}
<section class="section"><div class="container"><div class="section-head"><div><h2>Shop by Category</h2><p>Browse every part of The Smiling Worm directly from the home page.</p></div><button class="link-btn" data-route="home">Shop all →</button></div><div class="category-grid">${CATEGORIES.map((c) => `<button class="cat-card" data-route="category:${c.id}"><span class="category-icon">${c.icon}</span><div><h3>${c.name}</h3><p>${c.desc}</p><span class="btn small secondary">Shop now</span></div></button>`).join("")}</div></div></section>
<section class="section soft"><div class="container"><div class="section-head"><div><h2>Best Sellers</h2><p>Customer favourites are featured right here on the front page.</p></div><button class="link-btn" data-route="bestsellers">View all →</button></div><div class="product-grid carousel">${best.map(productCard).join("")}</div></div></section>
<section class="section"><div class="container"><div class="section-head"><div><h2>New Arrivals</h2><p>Fresh picks are visible on the front page for quick discovery.</p></div><button class="link-btn" data-route="new-arrivals">See everything →</button></div><div class="product-grid carousel">${featured.map(productCard).join("")}</div></div></section>
${categorySections}
<section class="section soft"><div class="container"><div class="promo-grid"><article class="promo-card primary"><div><h3>Thoughtful plant care</h3><p>Natural-feeling solutions selected for homes, balconies, offices and gardens.</p><button class="btn small" data-route="plant-care">Explore plant care</button></div><span class="promo-art">🌿</span></article><article class="promo-card secondary"><div><h3>Combo deals</h3><p>Curated kits that make everyday plant care easier.</p><button class="btn small" data-route="category:combos">Shop combos</button></div><span class="promo-art">🎁</span></article></div></div></section>
<section class="section"><div class="container"><div class="service-strip"><div class="service-item"><span>🚚</span><div><strong>Easy ordering</strong><small>Simple shopping from discovery to checkout.</small></div></div><div class="service-item"><span>♡</span><div><strong>Wishlist ready</strong><small>Keep favourite products close by.</small></div></div><div class="service-item"><span>↻</span><div><strong>Saved cart</strong><small>Your cart stays between visits.</small></div></div><div class="service-item"><span>🌱</span><div><strong>Grow with confidence</strong><small>Clear descriptions and organised categories.</small></div></div></div></div></section>`;
}
const PROMO_SALE_END = new Date("2026-10-15T23:59:59+05:30").getTime();
function promoBanner() {
  if (Date.now() >= PROMO_SALE_END) return "";
  return `<section class="promo-strip"><div class="container promo-strip-inner"><div class="promo-strip-copy"><span class="promo-strip-badge">Limited time</span><h2>Monsoon Garden Sale — save on plant care essentials</h2><p>Stock up on fertilizers, planters, tools and more before the offer ends.</p><button class="btn" data-route="category:plant-care">Shop the sale</button></div><div class="promo-countdown" id="promoCountdown" data-end="${PROMO_SALE_END}"><div><strong id="cdDays">00</strong><span>Days</span></div><div><strong id="cdHours">00</strong><span>Hrs</span></div><div><strong id="cdMinutes">00</strong><span>Min</span></div><div><strong id="cdSeconds">00</strong><span>Sec</span></div></div></div></section>`;
}
function startCountdown() {
  const el = document.getElementById("promoCountdown");
  clearInterval(window.countdownTimer);
  if (!el) return;
  const end = Number(el.dataset.end);
  const pad = (n) => String(Math.max(0, n)).padStart(2, "0");
  const tick = () => {
    const remaining = end - Date.now();
    if (remaining <= 0) {
      clearInterval(window.countdownTimer);
      render();
      return;
    }
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    document.getElementById("cdDays").textContent = pad(days);
    document.getElementById("cdHours").textContent = pad(hours);
    document.getElementById("cdMinutes").textContent = pad(minutes);
    document.getElementById("cdSeconds").textContent = pad(seconds);
  };
  tick();
  window.countdownTimer = setInterval(tick, 1000);
}
const HEROES = [
  {
    title: "We take care of your garden & trees",
    text: "Natural solutions for healthier plants, greener gardens and happier homes.",
    cta: "Shop plant care",
    route: "category:plant-care",
    position: "center",
  },
  {
    title: "Grow better. Naturally.",
    text: "Planters, tools and everyday care essentials for thoughtful plant parents.",
    cta: "Explore products",
    route: "home",
    position: "48% center",
  },
  {
    title: "Special garden deals",
    text: "Bundle up and save on carefully curated combinations for your next project.",
    cta: "View combo deals",
    route: "category:combos",
    position: "52% center",
  },
];
function setupHero() {
  const hero = document.getElementById("hero");
  if (!hero) return;
  const track = document.getElementById("heroTrack");
  const dots = document.getElementById("heroDots");
  if (!track || !dots) return;
  track.innerHTML = HEROES.map(
    (h, i) =>
      `<article class="hero-slide ${i === state.hero ? "active" : ""}" data-index="${i}"><img src="assets/hero-reference.png" alt="Organic farming field" style="object-position:${h.position}"><div class="hero-overlay"></div><div class="hero-content container"><span class="eyebrow">THE SMILING WORM · MHOW ORGANICS</span><h1>${h.title}</h1><p>${h.text}</p><div class="hero-actions"><button class="btn" data-route="${h.route}">${h.cta}</button><button class="btn secondary" data-route="category:pots-planters">Explore Pots & Planters</button></div></div></article>`,
  ).join("");
  dots.innerHTML = HEROES.map(
    (_, i) =>
      `<button class="dot ${i === state.hero ? "active" : ""}" data-hero-dot="${i}" aria-label="Go to slide ${i + 1}"></button>`,
  ).join("");
  const go = (next) => {
    state.hero = (next + HEROES.length) % HEROES.length;
    track
      .querySelectorAll(".hero-slide")
      .forEach((slide, i) =>
        slide.classList.toggle("active", i === state.hero),
      );
    dots
      .querySelectorAll(".dot")
      .forEach((dot, i) => dot.classList.toggle("active", i === state.hero));
    bindGlobal(track);
  };
  document.getElementById("prevHero").onclick = () => go(state.hero - 1);
  document.getElementById("nextHero").onclick = () => go(state.hero + 1);
  dots
    .querySelectorAll("[data-hero-dot]")
    .forEach((d) => (d.onclick = () => go(Number(d.dataset.heroDot))));
  clearInterval(window.heroTimer);
  window.heroTimer = setInterval(() => go(state.hero + 1), 6500);
  let startX = 0;
  hero.onpointerdown = (e) => {
    startX = e.clientX;
  };
  hero.onpointerup = (e) => {
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 55) go(state.hero + (dx < 0 ? 1 : -1));
  };
}

function pageHeader(title, desc) {
  return `<section class="page-hero"><div class="container"><h1>${title}</h1><p>${desc}</p></div></section>`;
}
const PRICE_RANGES = [
  { id: "all", label: "All prices" },
  { id: "under-500", label: "Under ₹500", test: (p) => p.price < 500 },
  {
    id: "500-1000",
    label: "₹500 – ₹1,000",
    test: (p) => p.price >= 500 && p.price <= 1000,
  },
  {
    id: "1000-2500",
    label: "₹1,000 – ₹2,500",
    test: (p) => p.price > 1000 && p.price <= 2500,
  },
  { id: "above-2500", label: "Above ₹2,500", test: (p) => p.price > 2500 },
];
function categoryPage(id, search = "") {
  const c = CATEGORIES.find((x) => x.id === id);
  if (!c) return notFound();
  let list = PRODUCTS.filter((p) => p.category === c.name);
  const sub = state.subcat;
  if (c.subs && sub !== "all")
    list = list.filter((p) => normalized(p.subcat) === normalized(sub));
  if (search)
    list = list.filter((p) =>
      `${p.name} ${p.description} ${p.category} ${p.subcat}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const activeRange = PRICE_RANGES.find((r) => r.id === state.priceRange);
  if (activeRange?.test) list = list.filter(activeRange.test);
  if (state.inStockOnly) list = list.filter((p) => p.stock > 0);
  const sort = document.getElementById("sortSelect")?.value || "recommended";
  list = [...list];
  if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
  if (sort === "newest")
    list.sort((a, b) => Number(b.newArrival) - Number(a.newArrival));
  if (sort === "best")
    list.sort((a, b) => Number(b.bestseller) - Number(a.bestseller));
  const sidebar = `<aside class="filter-sidebar">${
    c.subs
      ? `<div class="filter-group"><h4>${c.name}</h4><div class="filters">${["all", ...c.subs].map((x) => `<button class="subcat ${sub === x ? "active" : ""}" data-subcat="${x}">${x === "all" ? "All" : x}</button>`).join("")}</div></div>`
      : ""
  }<div class="filter-group"><h4>Price</h4><div class="filters vertical">${PRICE_RANGES.map((r) => `<button class="subcat ${state.priceRange === r.id ? "active" : ""}" data-price="${r.id}">${r.label}</button>`).join("")}</div></div><div class="filter-group"><label class="stock-toggle"><input type="checkbox" id="inStockOnly" ${state.inStockOnly ? "checked" : ""}> In stock only</label></div></aside>`;
  return `${pageHeader(c.name, `Explore ${list.length || ""} curated products in ${c.name.toLowerCase()}.`)}<section class="section"><div class="container category-layout">${sidebar}<div class="category-main"><div class="toolbar"><span>${list.length} products</span><select class="select" id="sortSelect"><option value="recommended">Recommended</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option><option value="newest">Newest</option><option value="best">Best Selling</option></select></div><div class="product-grid">${list.length ? list.map(productCard).join("") : `<div class="empty" style="grid-column:1/-1">No products matched these filters.</div>`}</div></div></div></section>`;
}

function listingPage(title, desc, filter) {
  let list = filter(PRODUCTS);
  return `${pageHeader(title, desc)}<section class="section"><div class="container"><div class="toolbar"><span>${list.length} products</span><select class="select" id="sortSelect"><option value="recommended">Recommended</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option><option value="newest">Newest</option><option value="best">Best Selling</option></select></div><div class="product-grid">${list.map(productCard).join("")}</div></div></section>`;
}
function searchPage(q) {
  const list = PRODUCTS.filter((p) =>
    `${p.name} ${p.description} ${p.category} ${p.subcat}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return `${pageHeader(`Search results for “${q}”`, `${list.length} matching products`)}<section class="section"><div class="container"><div class="product-grid">${list.length ? list.map(productCard).join("") : `<div class="empty" style="grid-column:1/-1">No products matched your search. Try fertilizer, wood, office, planter or tool.</div>`}</div></div></section>`;
}
function wishlistPage() {
  const list = state.wishlist.map(productById).filter(Boolean);
  return `${pageHeader("Wishlist", "Keep favourite products close by and move them to your cart when you are ready.")}<section class="section"><div class="container"><div class="product-grid">${list.length ? list.map(productCard).join("") : `<div class="empty" style="grid-column:1/-1">Your wishlist is empty. Tap the heart on any product to save it here.</div>`}</div></div></section>`;
}
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function invoiceDocument(order, logoDataUrl) {
  const items = (order.items || [])
    .map((item) => {
      const product = productById(item.id);
      if (!product) return "";
      return `<tr><td><strong>${escapeHtml(product.name)}</strong><br><small>${escapeHtml(product.description)}</small></td><td>${escapeHtml(product.category)}</td><td>${escapeHtml(product.sku || `TSW-${item.id}`)}</td><td>${item.qty}</td><td>${money(product.price)}</td><td>${money(product.price * item.qty)}</td></tr>`;
    })
    .join("");
  const gst = Number(order.gst) || 0;
  const igst = Number(order.igst) || 0;
  const fertilizerTax = Number(order.fertilizerTax) || 0;
  const otherTax = Number(order.otherTax) || 0;
  const subtotal = Number(order.subtotal) || 0;
  const shipping = Number(order.shipping) || 0;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Order Invoice ${escapeHtml(order.id)}</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#20362b;margin:0;padding:32px;background:#f4f7f2}.invoice{max-width:1000px;margin:auto;background:#fff;padding:40px;box-shadow:0 8px 30px #20362b18}header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #dce8dd;padding-bottom:24px}header img{width:150px;max-height:80px;object-fit:contain}h1{margin:0 0 8px;color:#08752f}h2{font-size:18px;margin:28px 0 10px}.muted{color:#6c7b71;font-size:13px;line-height:1.5}.details{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:11px 8px;border-bottom:1px solid #e4ebe5;text-align:left;vertical-align:top}th{background:#eef5ed;color:#31503d}.number{text-align:right}.totals{margin:24px 0 0 auto;width:320px}.totals div{display:flex;justify-content:space-between;padding:7px 0}.grand{border-top:2px solid #20362b;font-size:17px;font-weight:bold;margin-top:6px;padding-top:12px!important}@media print{body{background:#fff;padding:0}.invoice{box-shadow:none;max-width:none}}
</style></head><body><main class="invoice"><header><div><img src="${logoDataUrl}" alt="The Smiling Worm by Mhow Organics"><p class="muted">The Smiling Worm by Mhow Organics<br>15, Peet Road, Dr. Ambedkar Nagar, Madhya Pradesh 453441<br>+91 7985451261 · mhoworganics@gmail.com</p></div><div><h1>Order Invoice</h1><p class="muted"><strong>Invoice:</strong> ${escapeHtml(order.id)}<br><strong>Date:</strong> ${escapeHtml(new Date().toLocaleDateString("en-IN"))}</p></div></header><div class="details"><div><h2>Bill To</h2><p class="muted">${escapeHtml(order.name)}<br>${escapeHtml(order.email)}<br>${escapeHtml(order.phone)}<br>${escapeHtml(order.address || [order.house, order.street, order.city, order.state, order.pincode, order.country].filter(Boolean).join(", "))}</p></div><div><h2>Tax Details</h2><p class="muted">State: ${escapeHtml(order.state || "Not provided")}<br>GST: ${money(gst)}<br>IGST: ${money(igst)}</p></div></div><h2>Product Details</h2><table><thead><tr><th>Product</th><th>Category</th><th>SKU</th><th>Qty</th><th>Unit Price</th><th class="number">Amount</th></tr></thead><tbody>${items}</tbody></table><div class="totals"><div><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div><span>Shipping</span><strong>${shipping ? money(shipping) : "Free"}</strong></div><div><span>GST</span><strong>${money(gst)}</strong></div><div><span>IGST</span><strong>${money(igst)}</strong></div><div><span>Fertilizer tax @ 5%</span><strong>${money(fertilizerTax)}</strong></div><div><span>Other product tax @ 18%</span><strong>${money(otherTax)}</strong></div><div class="grand"><span>Total</span><strong>${money(order.total)}</strong></div></div><p class="muted">Thank you for choosing The Smiling Worm by Mhow Organics.</p></main></body></html>`;
}
async function downloadInvoice(order) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast("Please allow pop-ups to create the PDF invoice.");
    return;
  }
  try {
    const response = await fetch("assets/logo.png");
    if (!response.ok) throw new Error("Logo unavailable");
    const blob = await response.blob();
    const logoDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    printWindow.document.write(invoiceDocument(order, logoDataUrl));
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  } catch (error) {
    printWindow.close();
    toast("Unable to load the invoice logo.");
  }
}
function cartPage() {
  if (!state.cart.length)
    return `${pageHeader("Your Cart", "Your saved items live here.")}<section class="section"><div class="container empty"><h2>Your cart is empty</h2><p>Browse the store and add something you would love for your plants.</p><button class="btn" data-route="home">Start shopping</button></div></section>`;
  const rows = state.cart
    .map((item) => {
      const p = productById(item.id);
      return `<div class="cart-item"><div class="cart-thumb"><img src="${p.images[0]}" alt="${p.name.replace(/"/g, "&quot;")}" onerror="this.src='assets/images/products/product-${String(p.id).padStart(3, "0")}.svg'"></div><div><h4>${p.name}</h4><p>${p.description}</p><div class="price-row"><span class="price">${money(p.price)}</span></div><div class="qty-row" style="margin-top:8px"><div class="qty"><button data-cartdec="${p.id}">−</button><span>${item.qty}</span><button data-cartinc="${p.id}">+</button></div><button class="link-btn" data-remove="${p.id}">Remove</button></div></div><strong>${money(p.price * item.qty)}</strong></div>`;
    })
    .join("");
  const totals = getOrderTotals();
  return `${pageHeader("Your Cart", "Review items, adjust quantities and continue to secure checkout.")}<section class="section"><div class="container cart-layout"><div class="cart-list">${rows}</div><aside class="summary-card"><h3>Order summary</h3><div class="sum-row"><span>Subtotal</span><strong>${money(totals.subtotal)}</strong></div><div class="sum-row"><span>Product savings</span><strong>−${money(totals.discount)}</strong></div>${taxRows(totals)}<div class="sum-row"><span>Shipping</span><strong>${totals.shipping ? money(totals.shipping) : "Free"}</strong></div><div class="sum-row total"><span>Total</span><strong>${money(totals.total)}</strong></div><button class="btn" style="width:100%;margin-top:14px" data-route="checkout">Proceed to Checkout</button><p style="font-size:12px;color:var(--muted);margin:12px 0 0">Free shipping on orders above ₹1,499. Tax is based on your delivery state.</p></aside></div></section>`;
}

function localAccountPage() {
  const a = state.account || {};
    return `${pageHeader("Your Account", "Save your details and speed up checkout.")}<section class="section"><div class="container panel"><form id="accountForm" class="form-grid"><div class="field"><label>Full name</label><input name="name" value="${a.name || ""}" required /></div><div class="field"><label>Email</label><input type="email" name="email" value="${a.email || ""}" required /></div><div class="field"><label>Phone number</label><input name="phone" value="${a.phone || ""}" required /></div><div class="field"><label>Company (optional)</label><input name="company" value="${a.company || ""}" /></div><div class="field full"><label>House / Flat</label><input name="house" value="${a.house || ""}" /></div><div class="field"><label>Street</label><input name="street" value="${a.street || ""}" /></div><div class="field"><label>City</label><input name="city" value="${a.city || ""}" /></div><div class="field"><label>State</label><select name="state" data-location-state>${stateOptions(a.state)}</select></div><div class="field"><label>Pincode</label><input name="pincode" value="${a.pincode || ""}" /></div><div class="field"><label>Country</label><input name="country" value="${a.country || "India"}" /></div><div class="field full"><button class="btn" type="submit">Save account details</button></div></form></div></section>`;
}
function legacyAccountPage() {
  const a = state.account || {};
  if (!state.accountToken)
    return `${pageHeader("Your Account", "Create a secure store account or sign in to save your details.")}<section class="section"><div class="container account-auth-grid"><div class="panel"><h2>Sign in</h2><p class="muted">Use your account ID and password.</p><form id="accountLoginForm" class="form-grid"><div class="field full"><label>Account ID</label><input name="username" autocomplete="username" required /></div><div class="field full"><label>Password</label><input name="password" type="password" autocomplete="current-password" required /></div><div class="field full"><button class="btn" type="submit">Sign in</button></div></form></div><div class="panel"><h2>Create account</h2><p class="muted">Your password is stored securely on the server.</p><form id="accountRegisterForm" class="form-grid"><div class="field full"><label>Account ID</label><input name="username" autocomplete="username" pattern="[A-Za-z0-9._-]{3,40}" required /></div><div class="field"><label>Password</label><input name="password" type="password" minlength="8" autocomplete="new-password" required /></div><div class="field"><label>Confirm password</label><input name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required /></div><div class="field"><label>Full name</label><input name="name" autocomplete="name" required /></div><div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" required /></div><div class="field full"><label>Phone number</label><input name="phone" type="tel" autocomplete="tel" required /></div><div class="field full"><button class="btn" type="submit">Create account</button></div></form></div></div></section>`;
  return `${pageHeader("Your Account", `Signed in as ${escapeHtml(a.username || "customer")}.`)}<section class="section"><div class="container panel"><div class="account-header"><div><h2>Account details</h2><p class="muted">Your saved details are used to speed up checkout.</p></div><button class="btn outline" type="button" id="accountLogout">Sign out</button></div><form id="accountForm" class="form-grid"><div class="field"><label>Full name</label><input name="name" value="${escapeHtml(a.name)}" required /></div><div class="field"><label>Email</label><input type="email" name="email" value="${escapeHtml(a.email)}" required /></div><div class="field"><label>Phone number</label><input name="phone" value="${escapeHtml(a.phone)}" required /></div><div class="field"><label>Company (optional)</label><input name="company" value="${escapeHtml(a.company)}" /></div><div class="field full"><label>House / Flat</label><input name="house" value="${escapeHtml(a.house)}" /></div><div class="field"><label>Street</label><input name="street" value="${escapeHtml(a.street)}" /></div><div class="field"><label>City</label><input name="city" value="${escapeHtml(a.city)}" /></div><div class="field"><label>State</label><select name="state" data-location-state>${stateOptions(a.state)}</select></div><div class="field"><label>Pincode</label><input name="pincode" value="${escapeHtml(a.pincode)}" /></div><div class="field"><label>Country</label><input name="country" value="${escapeHtml(a.country || "India")}" /></div><div class="field full"><button class="btn" type="submit">Save account details</button></div></form></div></section>`;
}
function accountPage() {
  const a = state.account || {};
  if (!state.accountToken)
    return `${pageHeader("Your Account", "Create a secure store account or sign in to save your details.")}<section class="section"><div class="container account-auth-grid"><div class="panel"><h2>Sign in</h2><p class="muted">Use your email and password.</p><form id="accountLoginForm" class="form-grid"><div class="field full"><label>Email</label><input name="email" type="email" autocomplete="email" required /></div><div class="field full"><label>Password</label><input name="password" type="password" autocomplete="current-password" required /></div><div class="field full"><button class="btn" type="submit">Sign in</button></div></form><button class="link-btn" id="showForgotPassword" type="button">Forgot password?</button><form id="forgotPasswordForm" class="form-grid" hidden><div class="field full"><label>Phone number used for your account</label><input name="phone" type="tel" autocomplete="tel" required /></div><div class="field full" data-reset-step hidden><label>OTP</label><input name="otp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" /></div><div class="field" data-reset-step hidden><label>New password</label><input name="password" type="password" minlength="8" autocomplete="new-password" /></div><div class="field" data-reset-step hidden><label>Confirm password</label><input name="confirmPassword" type="password" minlength="8" autocomplete="new-password" /></div><div class="field full"><button class="btn" type="submit">Send OTP</button><p class="muted" data-reset-status role="status"></p></div></form></div><div class="panel"><h2>Create account</h2><p class="muted">Your password is stored securely on the server.</p><form id="accountRegisterForm" class="form-grid"><div class="field"><label>Password</label><input name="password" type="password" minlength="8" autocomplete="new-password" required /></div><div class="field"><label>Confirm password</label><input name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required /></div><div class="field"><label>Full name</label><input name="name" autocomplete="name" required /></div><div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" required /></div><div class="field full"><label>Phone number</label><input name="phone" type="tel" autocomplete="tel" required /></div><div class="field full"><button class="btn" type="submit">Create account</button></div></form></div></div></section>`;
  return `${pageHeader("Your Account", `Signed in as ${escapeHtml(a.email || "customer")}.`)}<section class="section"><div class="container panel"><div class="account-header"><div><h2>Account details</h2><p class="muted">Your saved details are used to speed up checkout.</p></div><button class="btn outline" type="button" id="accountLogout">Sign out</button></div><form id="accountForm" class="form-grid"><div class="field"><label>Full name</label><input name="name" value="${escapeHtml(a.name)}" required /></div><div class="field"><label>Email</label><input type="email" name="email" value="${escapeHtml(a.email)}" required /></div><div class="field"><label>Phone number</label><input name="phone" value="${escapeHtml(a.phone)}" required /></div><div class="field"><label>Company (optional)</label><input name="company" value="${escapeHtml(a.company)}" /></div><div class="field full"><label>House / Flat</label><input name="house" value="${escapeHtml(a.house)}" /></div><div class="field"><label>Street</label><input name="street" value="${escapeHtml(a.street)}" /></div><div class="field"><label>City</label><input name="city" value="${escapeHtml(a.city)}" /></div><div class="field"><label>State</label><select name="state" data-location-state>${stateOptions(a.state)}</select></div><div class="field"><label>Pincode</label><input name="pincode" value="${escapeHtml(a.pincode)}" /></div><div class="field"><label>Country</label><input name="country" value="${escapeHtml(a.country || "India")}" /></div><div class="field full"><button class="btn" type="submit">Save account details</button></div></form></div></section>`;
}
function checkoutPage() {
  if (!state.cart.length)
    return `${pageHeader("Checkout", "Add products to your cart before starting checkout.")}<section class="section"><div class="container empty"><button class="btn" data-route="home">Browse products</button></div></section>`;
    const a = state.account || {};
  const totals = getOrderTotals(a.state);
  return `${pageHeader("Checkout", "Complete your details and keep payment securely pluggable.")}<section class="section"><div class="container checkout-layout"><div class="panel"><div class="steps"><span class="step active">1 · Details</span><span class="step active">2 · Address</span><span class="step active">3 · Payment</span></div><form id="checkoutForm"><div class="form-grid"><div class="field"><label>Full name</label><input name="name" value="${a.name || ""}" required /></div><div class="field"><label>Email</label><input type="email" name="email" value="${a.email || ""}" required /></div><div class="field"><label>Phone</label><input name="phone" value="${a.phone || ""}" required /></div><div class="field"><label>Pincode</label><input name="pincode" value="${a.pincode || ""}" required /></div><div class="field full"><label>House / Flat</label><input name="house" value="${a.house || ""}" required /></div><div class="field"><label>Street</label><input name="street" value="${a.street || ""}" required /></div><div class="field"><label>City</label><input name="city" value="${a.city || ""}" required /></div><div class="field"><label>State</label><select name="state" data-location-state required>${stateOptions(a.state)}</select></div><div class="field"><label>Country</label><input name="country" value="${a.country || "India"}" required /></div><div class="field full"><label>Payment integration placeholder</label><div class="panel" style="padding:13px;background:#f8faf7"><strong>Payment API: ready for your provider</strong><p style="margin:6px 0 0;color:var(--muted);font-size:13px">Add your provider SDK and key through environment variables later. This demo keeps secrets out of the browser bundle.</p><code>VITE_PAYMENT_API_KEY=your_key_here</code></div></div><div class="field full"><button class="btn" id="checkoutSubmitButton" type="submit">Place order · ${money(totals.total)}</button></div></div></form></div><aside class="summary-card"><h3>Order summary</h3>${state.cart
    .map((x) => {
      const p = productById(x.id);
      return `<div class="sum-row"><span>${p.name} × ${x.qty}</span><strong>${money(p.price * x.qty)}</strong></div>`;
    })
    .join(
      "",
    )}<div id="checkoutTaxRows">${taxRows(totals, "checkout")}</div><div class="sum-row"><span>Shipping</span><strong id="checkoutShipping">${totals.shipping ? money(totals.shipping) : "Free"}</strong></div><div class="sum-row total"><span>Total</span><strong id="checkoutTotal">${money(totals.total)}</strong></div></aside></div></section>`;
}
function orderConfirmation(order) {
  return `${pageHeader("Order confirmed!", "Thank you for choosing The Smiling Worm. Your order is saved locally for this demo.")}<section class="section"><div class="container panel"><div style="text-align:center;max-width:720px;margin:0 auto"><div style="font-size:70px">🌿</div><h2>Thanks, ${order.name || "gardener"}!</h2><p>Your order <strong>${order.id}</strong> has been captured as a checkout demo. Payment is marked pending until your payment provider is connected.</p><div class="info-grid" style="margin-top:28px;text-align:left"><div class="info-card"><h3>Order total</h3><p><strong>${money(order.total)}</strong></p></div><div class="info-card"><h3>Payment</h3><p>Pending · connect provider API</p></div><div class="info-card"><h3>Delivery</h3><p>${order.city || ""}, ${order.state || ""} ${order.pincode || ""}</p></div></div><button class="btn" data-download-invoice style="margin-top:22px">Download Invoice</button><button class="btn outline" data-route="home" style="margin:22px 0 0 8px">Continue Shopping</button></div></div></section>`;
}
function renderProduct(id) {
  const p = productById(id);
  if (!p) return notFound();
  const returnRoute = location.hash.replace(/^#/, "") || "home";
  document.getElementById("app").innerHTML =
    `${pageHeader(p.name, p.category)}<section class="section"><div class="container checkout-layout"><div class="panel product-detail-image" style="display:grid;place-items:center;min-height:420px;background:linear-gradient(145deg,#edf4e8,#dbe7dd);overflow:hidden"><img src="${p.images[0]}" alt="${p.name.replace(/"/g, "&quot;")}" style="width:100%;height:100%;min-height:420px;object-fit:cover" onerror="this.src='assets/images/products/product-${String(p.id).padStart(3, "0")}.svg'"></div><div class="panel"><span class="eyebrow" style="color:var(--green);background:var(--sage);border:0">${p.badge || p.category}</span><h2 style="font-size:36px">${p.name}</h2><p style="color:var(--muted)">${p.description}</p><div class="price-row" style="margin:20px 0"><span class="price" style="font-size:30px">${money(p.price)}</span>${p.originalPrice > p.price ? `<span class="old-price">${money(p.originalPrice)}</span><span class="discount">${p.discount}% off</span>` : ""}</div><p style="font-size:13px;color:var(--muted)">SKU: ${p.sku} · ${p.stock} available · ★ ${p.rating}</p><div class="qty-row" style="margin:24px 0"><div class="qty"><button id="pdDec">−</button><span id="pdQty">1</span><button id="pdInc">+</button></div><button class="btn" id="pdAdd">Add to Cart</button></div><button class="btn outline" id="pdWish">${isWish(p.id) ? "♥ Remove from wishlist" : "♡ Add to wishlist"}</button></div></div></section>`;
  const productSection = document.querySelector("#app .section");
  const backButton = document.createElement("button");
  backButton.className = "link-btn product-back";
  backButton.type = "button";
  backButton.setAttribute("aria-label", "Back to previous page");
  backButton.textContent = "← Back";
  backButton.onclick = () => {
    if (location.hash === `#${returnRoute}`) render();
    else location.hash = returnRoute;
  };
  productSection?.prepend(Object.assign(document.createElement("div"), { className: "container product-back-wrap" }));
  document.querySelector("#app .product-back-wrap")?.append(backButton);
  document.getElementById("pdDec").onclick = () =>
    (document.getElementById("pdQty").textContent = Math.max(
      1,
      Number(document.getElementById("pdQty").textContent) - 1,
    ));
  document.getElementById("pdInc").onclick = () =>
    (document.getElementById("pdQty").textContent =
      Number(document.getElementById("pdQty").textContent) + 1);
  document.getElementById("pdAdd").onclick = () =>
    addToCart(p.id, Number(document.getElementById("pdQty").textContent));
  document.getElementById("pdWish").onclick = () => toggleWishlist(p.id);
  bindGlobal();
}
function notFound() {
  return `${pageHeader("Page not found", "Let’s get you back to the garden.")}<section class="section"><div class="container empty"><button class="btn" data-route="home">Back to Home</button></div></section>`;
}
function simplePage(title, desc, body) {
  return `${pageHeader(title, desc)}<section class="section"><div class="container prose">${body}</div></section>`;
}
function storyPage() {
  return `<section class="story-hero"><div class="container story-hero-inner"><div class="story-hero-copy"><span class="eyebrow">The Smiling Worm by Mhow Organics</span><h1>Growing good things, one small ritual at a time.</h1><p>We make gardening feel simpler, warmer and more rewarding, with honest products that help people care for plants and the spaces around them.</p><div class="story-actions"><button class="btn" data-route="home">Explore the collection</button><button class="link-btn" data-route="journal">Read the journal →</button></div></div><div class="story-hero-visual"><img src="assets/hero-reference.png" alt="Sunlight passing through a lush greenhouse garden"><div class="story-logo"><img src="assets/logo.png" alt="The Smiling Worm by Mhow Organics"></div></div></div></section><section class="section story-intro"><div class="container story-intro-grid"><div><span class="eyebrow">Where it began</span><h2>From healthy soil to happier spaces.</h2></div><div class="story-copy"><p>The Smiling Worm grew from a simple belief: caring for plants should feel less like a chore and more like a daily return to yourself.</p><p>As part of Mhow Organics, we bring together practical gardening essentials, thoughtful home pieces and organic solutions that help roots, rooms and routines thrive.</p></div></div></section><section class="section story-values-section"><div class="container"><div class="section-head story-section-head"><div><span class="eyebrow">What guides us</span><h2>Good products. Clear choices. More life.</h2></div><p>Everything we share is chosen to make the next step in your growing journey feel easy.</p></div><div class="story-values"><article class="story-value"><span class="story-value-number">01</span><h3>Rooted in nature</h3><p>We favour materials, care and growing practices that work with nature instead of against it.</p></article><article class="story-value"><span class="story-value-number">02</span><h3>Made for real homes</h3><p>From a first balcony plant to a flourishing garden, our collection fits the way people actually live.</p></article><article class="story-value"><span class="story-value-number">03</span><h3>Small steps matter</h3><p>A handful of healthy soil, a little patience and a daily moment of care can change a space.</p></article></div></div></section><section class="section story-cta"><div class="container story-cta-inner"><div><span class="eyebrow">Begin where you are</span><h2>Bring a little more green home.</h2><p>Find the products that make your next growing ritual feel good.</p></div><button class="btn" data-route="home">Shop The Smiling Worm</button></div></section>`;
}

function render() {
  const route = location.hash.replace(/^#/, "") || "home";
  state.subcat = state.subcat || "all";
  let html = "";
  if (route === "home") html = home();
  else if (route === "cart") html = cartPage();
  else if (route === "wishlist") html = wishlistPage();
  else if (route === "account") html = accountPage();
  else if (route === "checkout") html = checkoutPage();
  else if (route === "bestsellers")
    html = listingPage(
      "Bestsellers",
      "Our customer-loved products from across the store.",
      (p) => p.bestseller,
    );
  else if (route === "new-arrivals")
    html = listingPage(
      "New Arrivals",
      "Fresh products and new picks for your space.",
      (p) => p.newArrival,
    );
  else if (route.startsWith("category:"))
    html = categoryPage(route.split(":")[1]);
  else if (route.startsWith("search:"))
    html = searchPage(decodeURIComponent(route.slice(7)));
  else if (route === "story")
    html = storyPage();
  else if (route === "journal")
    html = `${pageHeader("Garden Journal", "Simple ideas for healthier plants, calmer routines and greener spaces.")}<section class="section"><div class="container journal-grid">${[
      [
        "🪴",
        "How to choose the right planter",
        "Match plant size, light and material to create a setup that thrives.",
      ],
      [
        "🌿",
        "Build a simple plant-care routine",
        "A few repeatable steps can make busy weeks easier on your garden.",
      ],
      [
        "🌱",
        "Start with healthy soil",
        "Good soil sets the foundation for resilient roots and steady growth.",
      ],
    ]
      .map(
        (x) =>
          `<article class="article"><div class="article-top">${x[0]}</div><div class="article-body"><h3>${x[1]}</h3><p>${x[2]}</p><button class="link-btn">Read article →</button></div></article>`,
      )
      .join("")}</div></section>`;
  else if (
    ["privacy", "terms", "support", "shipping", "returns", "faqs"].includes(
      route,
    )
  ) {
    const map = {
      privacy: [
        "Privacy Policy",
        "How this demo handles your local data.",
        "Account and cart details are stored in your browser using local storage. Connect your preferred backend/authentication service for production use.",
      ],
      terms: [
        "Terms & Conditions",
        "Starter terms for the demo store.",
        "Product information, payment processing and order fulfilment should be connected to your production systems before launch.",
      ],
      support: [
        "Contact Us",
        "We would love to help.",
        `<form id="supportForm" class="support-form"><label>Name<input name="name" required></label><label>Email<input name="email" type="email"></label><label>Phone<input name="phone" type="tel"></label><label>Subject<input name="subject"></label><label>Message<textarea name="message" required rows="5"></textarea></label><button class="btn" type="submit">Send enquiry</button><p id="supportStatus" role="status"></p></form>`,
      ],
      shipping: [
        "Shipping",
        "Simple shipping policy placeholder.",
        "Free shipping is shown in this demo above ₹1,499; update this rule to match your actual fulfilment policy.",
      ],
      returns: [
        "Returns",
        "Return policy placeholder.",
        "Define your eligibility window, exclusions, damaged-item process and refund timeline before launch.",
      ],
      faqs: [
        "FAQs",
        "Frequently asked questions.",
        "Add your actual product, delivery, payment and return FAQs here.",
      ],
    };
    const x = map[route];
    html = simplePage(
      x[0],
      x[1],
      `<p>${x[2]}</p><p>This section is intentionally editable so your real store policies and support details can be added without changing the layout.</p>`,
    );
  } else html = notFound();
  const app = document.getElementById("app");
  app.classList.remove("page-enter");
  void app.offsetWidth;
  app.innerHTML = html;
  if (route === "checkout" && state.cart.length) {
    const checkoutBack = document.createElement("div");
    checkoutBack.className = "container checkout-back-wrap";
    checkoutBack.innerHTML = '<button class="link-btn checkout-back" type="button" data-route="cart" aria-label="Back to cart">← Cart</button>';
    app.querySelector(".section")?.prepend(checkoutBack);
  }
  if (route.startsWith("category:")) {
    const categoryBack = document.createElement("div");
    categoryBack.className = "container category-back-wrap";
    const backButton = document.createElement("button");
    backButton.className = "link-btn category-back";
    backButton.type = "button";
    backButton.setAttribute("aria-label", "Back to previous page");
    backButton.textContent = "← Back";
    backButton.onclick = () => {
      if (history.length > 1) history.back();
      else location.hash = "home";
    };
    categoryBack.append(backButton);
    app.querySelector(".section")?.prepend(categoryBack);
  }
  app.classList.add("page-enter");
  document.getElementById("year").textContent = new Date().getFullYear();
  bindGlobal(app);
  bindGlobal(document);
  bindProductEvents(app);
  setupHero();
  startCountdown();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function resetCategoryFilters() {
  state.subcat = "all";
  state.priceRange = "all";
  state.inStockOnly = false;
}
function bindGlobal(root = document) {
  root.querySelectorAll("[data-route]").forEach((b) => {
    b.onclick = () => {
      const target = b.dataset.route;
      if (target === "home" && location.hash === "#home") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      resetCategoryFilters();
      location.hash = target;
    };
  });
  const menu = document.getElementById("categoryMenu");
  if (menu) {
    menu.innerHTML = CATEGORIES.filter((c) => !c.navHidden)
      .map(
        (c) =>
          `<div class="mega-col"><button class="mega-col-head" data-route="category:${c.id}">${c.icon} ${c.name}</button>${c.subs ? `<div class="mega-col-subs">${c.subs.map((s) => `<button data-route="category:${c.id}" data-subcat="${s}">${s}</button>`).join("")}</div>` : ""}</div>`,
      )
      .join("");
    menu.querySelectorAll("[data-route]").forEach(
      (b) =>
        (b.onclick = () => {
          location.hash = b.dataset.route;
          menu.hidden = true;
          resetCategoryFilters();
          if (b.dataset.subcat) state.subcat = b.dataset.subcat;
        }),
    );
  }
  const btn = document.getElementById("categoryMenuBtn");
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = "1";
    btn.onclick = (e) => {
      e.stopPropagation();
      const m = document.getElementById("categoryMenu");
      if (m) m.hidden = !m.hidden;
    };
  }
  if (!window.tswGlobalBound) {
    window.tswGlobalBound = true;
    document.addEventListener(
      "click",
      (e) => {
        const wrap = document.querySelector(".cat-menu-wrap");
        const m = document.getElementById("categoryMenu");
        if (m && wrap && !wrap.contains(e.target)) m.hidden = true;
      },
      { passive: true },
    );
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") {
          const m = document.getElementById("categoryMenu");
          if (m) m.hidden = true;
        }
      },
      { passive: true },
    );
  }
  root.querySelectorAll(".filter-sidebar [data-subcat]").forEach(
    (b) =>
      (b.onclick = () => {
        state.subcat = b.dataset.subcat;
        render();
      }),
  );
  root.querySelectorAll("[data-price]").forEach(
    (b) =>
      (b.onclick = () => {
        state.priceRange = b.dataset.price;
        render();
      }),
  );
  const stockToggle = document.getElementById("inStockOnly");
  if (stockToggle)
    stockToggle.onchange = () => {
      state.inStockOnly = stockToggle.checked;
      render();
    };
  const sort = document.getElementById("sortSelect");
  if (sort) sort.onchange = () => render();
  root
    .querySelectorAll("[data-cartinc]")
    .forEach((b) => (b.onclick = () => setQty(b.dataset.cartinc, 1)));
  root
    .querySelectorAll("[data-cartdec]")
    .forEach((b) => (b.onclick = () => setQty(b.dataset.cartdec, -1)));
  root
    .querySelectorAll("[data-remove]")
    .forEach((b) => (b.onclick = () => removeFromCart(b.dataset.remove)));
  root.querySelectorAll("[data-download-invoice]").forEach(
    (b) =>
      (b.onclick = () => {
        const order = JSON.parse(
          sessionStorage.getItem("tsw-last-order") || "null",
        );
        if (order) downloadInvoice(order);
      }),
  );
  const af = document.getElementById("accountForm");
  if (af)
    af.onsubmit = async (e) => {
      e.preventDefault();
      const button = af.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        state.account = await storeApi("/account", { method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(af))) });
        save();
        toast("Account details saved");
      } catch (error) {
        toast(error.message);
      } finally {
        button.disabled = false;
      }
    };
  const loginForm = document.getElementById("accountLoginForm");
  if (loginForm)
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const button = loginForm.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const result = await storeApi("/auth/login", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(loginForm))) });
        state.accountToken = result.token;
        sessionStorage.setItem("tsw-account-token", state.accountToken);
        state.account = result.account;
        save();
        render();
      } catch (error) {
        toast(error.message);
      } finally {
        button.disabled = false;
      }
    };
  const forgotPasswordButton = document.getElementById("showForgotPassword");
  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  if (forgotPasswordButton && forgotPasswordForm) {
    let resetStage = "request";
    let challengeId = "";
    let resetToken = "";
    forgotPasswordButton.onclick = () => {
      forgotPasswordForm.hidden = !forgotPasswordForm.hidden;
      if (!forgotPasswordForm.hidden) forgotPasswordForm.querySelector("input").focus();
    };
    forgotPasswordForm.onsubmit = async (e) => {
      e.preventDefault();
      const button = forgotPasswordForm.querySelector("button[type=submit]");
      const data = Object.fromEntries(new FormData(forgotPasswordForm));
      button.disabled = true;
      try {
        if (resetStage === "request") {
          const result = await storeApi("/auth/forgot-password", { method: "POST", body: JSON.stringify({ phone: data.phone }) });
          challengeId = result.challengeId;
          resetStage = "reset";
          forgotPasswordForm.querySelectorAll("[data-reset-step]").forEach((element) => { element.hidden = false; });
          forgotPasswordForm.querySelector("[data-reset-status]").textContent = result.debugOtp ? `Development OTP: ${result.debugOtp}` : "OTP sent to your registered phone number.";
          button.textContent = "Reset password";
          forgotPasswordForm.querySelector("[name=otp]").required = true;
          forgotPasswordForm.querySelector("[name=password]").required = true;
          forgotPasswordForm.querySelector("[name=confirmPassword]").required = true;
        } else {
          if (data.password !== data.confirmPassword) throw new Error("Passwords do not match");
          const verified = await storeApi("/auth/verify-reset-otp", { method: "POST", body: JSON.stringify({ challengeId, otp: data.otp }) });
          resetToken = verified.resetToken;
          await storeApi("/auth/reset-password", { method: "POST", body: JSON.stringify({ resetToken, password: data.password }) });
          toast("Password reset. You can sign in now.");
          forgotPasswordForm.reset();
          resetStage = "request";
          challengeId = "";
          resetToken = "";
          forgotPasswordForm.querySelectorAll("[data-reset-step]").forEach((element) => { element.hidden = true; });
          forgotPasswordForm.querySelector("[data-reset-status]").textContent = "";
          button.textContent = "Send OTP";
          forgotPasswordForm.hidden = true;
        }
      } catch (error) {
        toast(error.message);
      } finally {
        button.disabled = false;
      }
    };
  }
  const registerForm = document.getElementById("accountRegisterForm");
  if (registerForm)
    registerForm.onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(registerForm));
      if (data.password !== data.confirmPassword) {
        toast("Passwords do not match");
        return;
      }
      delete data.confirmPassword;
      const button = registerForm.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const result = await storeApi("/auth/register", { method: "POST", body: JSON.stringify(data) });
        state.accountToken = result.token;
        sessionStorage.setItem("tsw-account-token", state.accountToken);
        state.account = result.account;
        save();
        render();
      } catch (error) {
        toast(error.message);
      } finally {
        button.disabled = false;
      }
    };
  const logoutButton = document.getElementById("accountLogout");
  if (logoutButton)
    logoutButton.onclick = async () => {
      try {
        await storeApi("/auth/logout", { method: "POST" });
      } catch (error) {
        // Clear the local session even if the server session has expired.
      }
      state.accountToken = "";
      state.account = {};
      sessionStorage.removeItem("tsw-account-token");
      save();
      render();
    };
  const supportForm = document.getElementById("supportForm");
  if (supportForm)
    supportForm.onsubmit = async (e) => {
      e.preventDefault();
      const button = supportForm.querySelector("button[type=submit]");
      const status = document.getElementById("supportStatus");
      button.disabled = true;
      status.textContent = "Sending...";
      try {
        const response = await fetch("../api/enquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "contact", ...Object.fromEntries(new FormData(supportForm)) }),
        });
        if (!response.ok) throw new Error("Unable to submit enquiry");
        supportForm.reset();
        status.textContent = "Your enquiry has been received. We will get back to you soon.";
      } catch (error) {
        status.textContent = "We could not send your enquiry right now. Please try again.";
      } finally {
        button.disabled = false;
      }
    };
  const cf = document.getElementById("checkoutForm");
  if (cf) {
    const updateCheckoutTotals = () => {
      const totals = getOrderTotals(cf.elements.state.value);
      document.getElementById("checkoutTaxRows").innerHTML = taxRows(
        totals,
        "checkout",
      );
      document.getElementById("checkoutShipping").textContent = totals.shipping
        ? money(totals.shipping)
        : "Free";
      document.getElementById("checkoutTotal").textContent = money(
        totals.total,
      );
      document.getElementById("checkoutSubmitButton").textContent =
        `Place order · ${money(totals.total)}`;
    };
    cf.elements.state.addEventListener("input", updateCheckoutTotals);
    cf.elements.state.addEventListener("change", updateCheckoutTotals);
    cf.onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(cf));
      state.account = { ...state.account, ...data };
      const totals = getOrderTotals(data.state);
      const order = {
        id: "TSW-" + Date.now().toString().slice(-8),
        total: totals.total,
        gst: totals.gst,
        igst: totals.igst,
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        fertilizerTax: totals.fertilizerTax,
        woodenPlanterTax: totals.woodenPlanterTax,
        otherTax: totals.otherTax,
        items: state.cart.map((item) => ({ ...item })),
        ...data,
      };
      try {
        const response = await fetch("../api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            address: [
              data.house,
              data.street,
              data.city,
              data.state,
              data.pincode,
              data.country,
            ]
              .filter(Boolean)
              .join(", "),
            total: totals.total,
            gst: totals.gst,
            igst: totals.igst,
            fertilizerTax: totals.fertilizerTax,
            woodenPlanterTax: totals.woodenPlanterTax,
            otherTax: totals.otherTax,
            items: state.cart.map((item) => ({ id: item.id, qty: item.qty })),
            note: `Store total: ${totals.total}; ${totals.outsideMadhyaPradesh ? "IGST" : "GST"}: ${money(totals.gst || totals.igst)}`,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Order submission failed (${response.status})`);
        const saved = result;
        order.id = saved.orderId || order.id;
      } catch (error) {
        toast(error.message || "Order could not be submitted");
        return;
      }
      state.cart = [];
      save();
      location.hash = "order:" + order.id;
      sessionStorage.setItem("tsw-last-order", JSON.stringify(order));
      render();
    };
  }
}

document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("searchInput").value.trim();
  if (q) location.hash = "search:" + encodeURIComponent(q);
});
const mobileMenuToggle = document.getElementById("mobileMenuToggle");
if (mobileMenuToggle) {
  mobileMenuToggle.addEventListener("click", () => {
    const header = document.querySelector(".site-header");
    const isOpen = header.classList.toggle("menu-open");
    mobileMenuToggle.setAttribute("aria-expanded", String(isOpen));
    mobileMenuToggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation menu" : "Open navigation menu",
    );
  });
}
window.addEventListener("hashchange", () => {
  const r = location.hash.replace(/^#/, "");
  if (r.startsWith("order:")) {
    const order = JSON.parse(
      sessionStorage.getItem("tsw-last-order") || "null",
    );
    document.getElementById("app").innerHTML = orderConfirmation(
      order || { id: r.slice(6), name: "Gardener", total: 0 },
    );
    bindGlobal();
    return;
  }
  render();
});
window.addEventListener("DOMContentLoaded", async () => {
  updateCounts();
  await restoreAccountSession();
  fetch("../api/products")
    .then((response) => {
      if (!response.ok) throw new Error("Catalog unavailable");
      return response.json();
    })
    .then((products) => {
      PRODUCTS.splice(0, PRODUCTS.length, ...products.map((product) => ({
        ...product,
        images: [product.image || `assets/images/products/product-${String(product.id).padStart(3, "0")}.svg`],
        shortDescription: product.description,
        originalPrice: Number(product.price),
        discount: 0,
        rating: 4.7,
        reviews: 0,
        badge: "",
        tags: [product.category],
        featured: false,
        bestseller: Boolean(product.bestseller),
        newArrival: Boolean(product.newArrival),
        emoji: "🌱",
        subcat: product.subcategory || "",
      })));
      const knownCategories = new Set(CATEGORIES.map((category) => category.name));
      [...new Set(PRODUCTS.map((product) => product.category).filter(Boolean))].forEach((categoryName) => {
        if (!knownCategories.has(categoryName)) {
          CATEGORIES.push({
            id: slug(categoryName),
            name: categoryName,
            icon: "🌱",
            desc: `Explore ${categoryName.toLowerCase()}`,
          });
        }
      });
      render();
    })
    .catch(() => render());
});
