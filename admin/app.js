const state = {
  token: localStorage.getItem("mo-admin-token"),
  products: [],
  enquiries: [],
  orders: [],
};
const $ = (s) => document.querySelector(s);
let currentTab = "overview";
let productFilter = "all";
const loginForm = $("#loginForm");
const loginError = $("#loginError");
const PRODUCT_CATEGORIES = [
  "Fertilizers",
  "Home Decor",
  "Pest & Disease Control",
  "Garden Tools",
  "Combo Deals",
];

function invoiceText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function legacyDownloadOrderInvoice(order) {
  const items = (order.items || []).map((item) => {
    const product = state.products.find((entry) => entry.id === String(item.id));
    const quantity = Number(item.qty) || 1;
    const price = Number(product?.price) || 0;
    return { name: product?.name || `Product ${item.id}`, quantity, price, total: quantity * price };
  });
  const total = Number(order.total) || items.reduce((sum, item) => sum + item.total, 0);
  const rows = items.map((item) => `<tr><td>${invoiceText(item.name)}</td><td>${item.quantity}</td><td>₹${item.price.toLocaleString("en-IN")}</td><td>₹${item.total.toLocaleString("en-IN")}</td></tr>`).join("");
  const invoice = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice - ${invoiceText(order.id)}</title><style>body{font-family:Arial,sans-serif;color:#183524;max-width:760px;margin:40px auto;padding:0 24px}header{display:flex;justify-content:space-between;border-bottom:2px solid #21633c;padding-bottom:18px}h1{margin:0;color:#21633c}table{width:100%;border-collapse:collapse;margin-top:28px}th,td{text-align:left;padding:12px 10px;border-bottom:1px solid #dce5d9}th{background:#f5f7f1}.customer{margin-top:28px;line-height:1.7}.total{text-align:right;font-size:20px;font-weight:bold;margin-top:24px}@media print{body{margin:0}}</style></head><body><header><div><h1>Mhow Organics</h1><p>Order invoice</p></div><div><strong>Order</strong><br>${invoiceText(order.id)}<br>${invoiceText(new Date(order.createdAt).toLocaleDateString("en-IN"))}</div></header><div class="customer"><strong>Customer</strong><br>${invoiceText(order.name)}<br>${invoiceText(order.phone)}<br>${invoiceText(order.email)}<br>${invoiceText(order.address)}${order.city ? `<br>${invoiceText(order.city)}, ${invoiceText(order.state || "")} ${invoiceText(order.pincode || "")}` : ""}</div><table><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><p class="total">Total: ₹${total.toLocaleString("en-IN")}</p></body></html>`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([invoice], { type: "text/html" }));
  link.download = `mhow-organics-invoice-${order.id}.html`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function downloadOrderInvoice(order) {
  const items = (order.items || []).map((item) => {
    const product = state.products.find((entry) => entry.id === String(item.id));
    const quantity = Number(item.qty) || 1;
    const price = Number(product?.price) || 0;
    return { name: product?.name || `Product ${item.id}`, quantity, price, total: quantity * price };
  });
  const subtotal = Number(order.subtotal) || items.reduce((sum, item) => sum + item.total, 0);
  const shipping = Number(order.shipping) || 0;
  const gst = Number(order.gst) || 0;
  const igst = Number(order.igst) || 0;
  const fertilizerTax = Number(order.fertilizerTax) || 0;
  const otherTax = Number(order.otherTax) || 0;
  const total = Number(order.total) || subtotal + shipping + gst + igst;
  let logoDataUrl = "";
  try {
    const response = await fetch("/store/assets/logo.png");
    if (response.ok) {
      const blob = await response.blob();
      logoDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch (error) {
    // The invoice remains usable if the logo cannot be loaded.
  }
  const rows = items.map((item) => `<tr><td>${invoiceText(item.name)}</td><td>${item.quantity}</td><td>₹${item.price.toLocaleString("en-IN")}</td><td>₹${item.total.toLocaleString("en-IN")}</td></tr>`).join("");
  const invoice = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice - ${invoiceText(order.id)}</title><style>body{font-family:Arial,sans-serif;color:#183524;max-width:820px;margin:40px auto;padding:0 24px}header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2px solid #21633c;padding-bottom:18px}header img{width:170px;height:80px;object-fit:contain;object-position:left}h1{margin:0;color:#21633c}h2{font-size:17px;margin:28px 0 10px}.muted{color:#657468;line-height:1.6}.customer{margin-top:28px;line-height:1.7}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{text-align:left;padding:12px 10px;border-bottom:1px solid #dce5d9}th{background:#f5f7f1}.number{text-align:right}.totals{width:340px;margin:24px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:7px 0}.grand{border-top:2px solid #183524;font-size:20px;font-weight:bold;margin-top:8px;padding-top:13px!important}@media print{body{margin:0;padding:0}header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><header><div>${logoDataUrl ? `<img src="${logoDataUrl}" alt="Mhow Organics logo">` : ""}<p class="muted">Mhow Organics<br>15, Peet Road, Dr. Ambedkar Nagar, Madhya Pradesh 453441<br>+91 7985451261 · mhoworganics@gmail.com</p></div><div><h1>Invoice</h1><p class="muted"><strong>Order:</strong> ${invoiceText(order.id)}<br><strong>Date:</strong> ${invoiceText(new Date(order.createdAt).toLocaleDateString("en-IN"))}</p></div></header><section class="customer"><strong>Customer</strong><br>${invoiceText(order.name)}<br>${invoiceText(order.email)}<br>${invoiceText(order.phone)}<br>${invoiceText(order.address)}${order.city ? `<br>${invoiceText(order.city)}, ${invoiceText(order.state || "")} ${invoiceText(order.pincode || "")}` : ""}</section><h2>Products</h2><table><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>Subtotal</span><strong>₹${subtotal.toLocaleString("en-IN")}</strong></div><div><span>Shipping</span><strong>${shipping ? `₹${shipping.toLocaleString("en-IN")}` : "Free"}</strong></div><div><span>GST</span><strong>₹${gst.toLocaleString("en-IN")}</strong></div><div><span>IGST</span><strong>₹${igst.toLocaleString("en-IN")}</strong></div><div><span>Fertilizer tax</span><strong>₹${fertilizerTax.toLocaleString("en-IN")}</strong></div><div><span>Other product tax</span><strong>₹${otherTax.toLocaleString("en-IN")}</strong></div><div class="grand"><span>Grand total</span><strong>₹${total.toLocaleString("en-IN")}</strong></div></div></body></html>`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([invoice], { type: "text/html" }));
  link.download = `mhow-organics-invoice-${order.id}.html`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function categoryOptions(category) {
  const categories = PRODUCT_CATEGORIES.includes(category)
    ? PRODUCT_CATEGORIES
    : [category, ...PRODUCT_CATEGORIES].filter(Boolean);
  return categories
    .map((option) => {
      const escaped = option.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
      return `<option value="${escaped}" ${option === category ? "selected" : ""}>${escaped}</option>`;
    })
    .join("");
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Error(data.error || "Request failed");
  return data;
}
function setLoggedIn(on) {
  $("#login").hidden = on;
  $("#dashboard").hidden = !on;
}
async function logout() {
  if (state.token) {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (error) {
      // Ignore logout errors and clear client session anyway.
    }
  }

  state.token = null;
  localStorage.removeItem("mo-admin-token");
  setLoggedIn(false);
  $("#password").value = "";
  $("#loginError").textContent = "";
}
async function login(username, password) {
  const result = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  state.token = result.token;
  localStorage.setItem("mo-admin-token", state.token);
  setLoggedIn(true);
  await load();
}
async function load() {
  const [products, enquiries, orders] = await Promise.allSettled([
    api("/products"),
    api("/enquiries"),
    api("/orders"),
  ]);
  if (orders.status === "rejected") throw orders.reason;
  state.products = products.status === "fulfilled" ? products.value : [];
  state.enquiries = enquiries.status === "fulfilled" ? enquiries.value : [];
  state.orders = orders.value;
  render(currentTab);
}
function render(tab) {
  currentTab = tab;
  document
    .querySelectorAll(".tabs button")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const content = $("#content");
  if (tab === "overview")
    content.innerHTML = `<div class="stats"><div class="stat"><strong>${state.products.filter((p) => p.active).length}</strong><span>Active products</span></div><div class="stat"><strong>${state.products.filter((p) => !p.active).length}</strong><span>Hidden products</span></div><div class="stat"><strong>${state.enquiries.filter((e) => e.status === "new").length}</strong><span>New enquiries</span></div><div class="stat"><strong>${state.orders.filter((o) => o.status === "new").length}</strong><span>New orders</span></div></div><div class="panel"><h2>Recent activity</h2><p class="muted">${
      state.enquiries
        .slice(0, 3)
        .map((e) => `${e.name} sent a ${e.type} enquiry`)
        .join("<br>") || "No enquiries yet."
    }</p></div>`;
  if (tab === "products")
    ((content.innerHTML = `<div class="panel"><div class="toolbar"><h2>Products</h2><input id="productSearch" placeholder="Search products"></div><div class="product-filters" role="tablist" aria-label="Product sections"><button type="button" class="product-filter ${productFilter === "all" ? "active" : ""}" data-product-filter="all" role="tab" aria-selected="${productFilter === "all"}">All</button><button type="button" class="product-filter ${productFilter === "newArrival" ? "active" : ""}" data-product-filter="newArrival" role="tab" aria-selected="${productFilter === "newArrival"}">New arrivals</button><button type="button" class="product-filter ${productFilter === "bestseller" ? "active" : ""}" data-product-filter="bestseller" role="tab" aria-selected="${productFilter === "bestseller"}">Bestsellers</button></div><div id="productRows"></div></div>`),
      renderProducts());
  if (tab === "enquiries")
    content.innerHTML = `<div class="panel"><div class="toolbar"><h2>Enquiries</h2><div class="toolbar-actions"><button class="ghost small" data-download-enquiries>Download Excel</button><button class="ghost small" data-clear-enquiries>Clear enquiries</button></div></div><table class="table"><thead><tr><th>Received</th><th>Person</th><th>Type</th><th>Message</th><th>Status</th></tr></thead><tbody>${state.enquiries.map((e) => `<tr><td>${new Date(e.createdAt).toLocaleString()}</td><td>${e.name}<br>${e.email || ""}<br>${e.phone || ""}</td><td><span class="badge">${e.type}</span><br><small>${e.phone || "No phone provided"}</small></td><td>${e.subject || ""}<br>${e.message}</td><td><select data-enquiry="${e.id}"><option ${e.status === "new" ? "selected" : ""}>new</option><option ${e.status === "in-progress" ? "selected" : ""}>in-progress</option><option ${e.status === "resolved" ? "selected" : ""}>resolved</select></td></tr>`).join("")}</tbody></table></div>`;
  if (tab === "orders")
    content.innerHTML = `<div class="panel"><div class="toolbar"><h2>Orders (${state.orders.length})</h2><button class="ghost small" data-clear-orders>Clear orders</button></div><table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Address</th><th>Received</th><th>Status</th><th>Shiprocket</th><th>Invoice</th></tr></thead><tbody>${state.orders.map((o) => { const noteTotal = String(o.note || "").match(/Store total:\s*([\d.]+)/i)?.[1]; const total = Number(o.total) || Number(noteTotal) || 0; const items = Array.isArray(o.items) ? o.items : []; return `<tr><td>${o.id}</td><td>${o.name}<br>${o.phone}<br>${o.email || ""}</td><td>${items.map((i) => `${state.products.find((p) => p.id === String(i.id))?.name || `Product ${i.id}`} × ${i.qty}`).join(", ") || "No items recorded"}</td><td><strong>₹${total.toLocaleString("en-IN")}</strong></td><td>${o.address || "Not provided"}</td><td>${new Date(o.createdAt).toLocaleString()}</td><td><select data-order="${o.id}">${["new", "confirmed", "packed", "shipped", "completed", "cancelled"].map((s) => `<option ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></td><td>${o.shiprocket?.orderId ? `<span class="badge">Forwarded</span><br><small>${o.shiprocket.orderId}</small>` : `<button class="small" data-shiprocket="${o.id}">Forward to Shiprocket</button>`}</td><td><button class="ghost small" data-order-invoice="${o.id}">Download invoice</button></td></tr>`; }).join("")}</tbody></table></div>`;
  bindStatusHandlers();
}
function renderProducts() {
  const q = ($("#productSearch")?.value || "").toLowerCase();
  $("#productRows").innerHTML = state.products
    .filter(
      (p) =>
        (productFilter === "all" || p[productFilter]) &&
        (p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)),
    )
    .map(
      (p) => {
        const imagePath = p.image?.startsWith("/") ? p.image : `../${p.image || ""}`;
        const placement = p.newArrival ? "newArrival" : p.bestseller ? "bestseller" : "";
        return `<form class="panel edit-grid" data-product="${p.id}"><label>Name<input name="name" value="${p.name.replaceAll('"', "&quot;")}"></label><label>Category<select name="category">${categoryOptions(p.category)}</select></label><label>Store section<select name="placement"><option value="" ${!placement ? "selected" : ""}>Standard</option><option value="newArrival" ${placement === "newArrival" ? "selected" : ""}>New arrival</option><option value="bestseller" ${placement === "bestseller" ? "selected" : ""}>Bestseller</option></select></label><label>Price<input name="price" type="number" min="0" value="${p.price}"></label><label>Stock<input name="stock" type="number" min="0" value="${p.stock}"></label><label class="wide">Description<textarea name="description">${p.description}</textarea></label><div class="wide image-upload" tabindex="0"><div class="image-preview"><img src="${imagePath}" alt="Current ${p.name.replaceAll('"', "&quot;")} image"><div><strong>Product picture</strong><small class="muted">Paste an image here or use PNG, JPG, WEBP or GIF up to 8 MB</small></div></div><label class="upload-button" for="image-${p.id}">Add picture<input id="image-${p.id}" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></label></div><label>Active<select name="active"><option value="true" ${p.active ? "selected" : ""}>Visible</option><option value="false" ${!p.active ? "selected" : ""}>Hidden</option></select></label><div class="save-row"><span class="save-status" aria-live="polite"></span><button class="save small">Save product ${p.id}</button></div></form>`;
      },
    )
    .join("");
  document.querySelectorAll("[data-product]").forEach(
    (form) => {
      const imageInput = form.querySelector('input[name="imageFile"]');
      const imagePreview = form.querySelector(".image-preview img");
      const setImagePreview = (file) => {
        if (file?.type.startsWith("image/")) imagePreview.src = URL.createObjectURL(file);
      };
      imageInput.onchange = () => setImagePreview(imageInput.files[0]);
      form.onpaste = (event) => {
        const imageItem = [...(event.clipboardData?.items || [])].find((item) => item.type.startsWith("image/"));
        const imageFile = imageItem?.getAsFile();
        if (!imageFile) return;
        event.preventDefault();
        const transfer = new DataTransfer();
        transfer.items.add(imageFile);
        imageInput.files = transfer.files;
        setImagePreview(imageFile);
      };
      form.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const imageFile = formData.get("imageFile");
        formData.delete("imageFile");
        const body = Object.fromEntries(formData);
        body.active = body.active === "true";
        body.newArrival = body.placement === "newArrival";
        body.bestseller = body.placement === "bestseller";
        delete body.placement;
        if (imageFile?.size) {
          body.imageData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Could not read image"));
            reader.readAsDataURL(imageFile);
          });
        }
        await api(`/products/${form.dataset.product}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        await load();
        const saveStatus = document.querySelector(`[data-product="${form.dataset.product}"] .save-status`);
        if (saveStatus) {
          saveStatus.textContent = "Done!";
          window.setTimeout(() => {
            saveStatus.textContent = "";
          }, 3000);
        }
      };
    },
  );
  document.querySelectorAll("[data-product-filter]").forEach(
    (button) =>
      (button.onclick = () => {
        productFilter = button.dataset.productFilter;
        renderProducts();
      }),
  );
  $("#productSearch").oninput = renderProducts;
}
function bindStatusHandlers() {
  const clearButton = $("[data-clear-enquiries]");
  if (clearButton)
    clearButton.onclick = async () => {
      if (!state.enquiries.length || !confirm("Clear all enquiries? This cannot be undone.")) return;
      await api("/enquiries", { method: "DELETE" });
      await load();
    };
  const clearOrdersButton = $("[data-clear-orders]");
  if (clearOrdersButton)
    clearOrdersButton.onclick = async () => {
      if (!state.orders.length || !confirm("Clear all orders? This cannot be undone.")) return;
      await api("/orders", { method: "DELETE" });
      await load();
    };
  document.querySelectorAll("[data-order-invoice]").forEach(
    (button) =>
      (button.onclick = () => {
        const order = state.orders.find((item) => item.id === button.dataset.orderInvoice);
        if (order) downloadOrderInvoice(order);
      }),
  );
  document.querySelectorAll("[data-enquiry]").forEach(
    (s) =>
      (s.onchange = async () => {
        await api(`/enquiries/${s.dataset.enquiry}`, {
          method: "PATCH",
          body: JSON.stringify({ status: s.value }),
        });
        await load();
      }),
  );
  document.querySelectorAll("[data-order]").forEach(
    (s) =>
      (s.onchange = async () => {
        await api(`/orders/${s.dataset.order}`, {
          method: "PATCH",
          body: JSON.stringify({ status: s.value }),
        });
        await load();
      }),
  );
  document.querySelectorAll("[data-shiprocket]").forEach(
    (button) =>
      (button.onclick = async () => {
        if (!confirm("Forward this order to Shiprocket?")) return;
        button.disabled = true;
        try {
          await api(`/orders/${button.dataset.shiprocket}/shiprocket`, { method: "POST" });
          await load();
        } catch (error) {
          button.disabled = false;
          alert(error.message);
        }
      }),
  );
}
document
  .querySelectorAll("[data-tab]")
  .forEach((b) => (b.onclick = () => render(b.dataset.tab)));
document.querySelectorAll("[data-download]").forEach((button) => {
  button.onclick = async () => {
    try {
      const response = await fetch(`/api/export/${button.dataset.download}`, {
        headers: { Authorization: `Bearer ${state.token}` },
      });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `mhow-organics-${button.dataset.download}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      alert(error.message);
    }
  };
});
loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = $("#username").value.trim();
  const password = $("#password").value;

  loginError.textContent = "";

  try {
    await login(username, password);
  } catch (error) {
    loginError.textContent = error.message;
  }
});

$("#logoutBtn")?.addEventListener("click", async () => {
  await logout();
});

async function startDashboard() {
  if (!state.token) {
    setLoggedIn(false);
    return;
  }

  try {
    await load();
    setLoggedIn(true);
  } catch (error) {
    localStorage.removeItem("mo-admin-token");
    state.token = null;
    setLoggedIn(false);
    loginError.textContent = "Session expired. Please log in again.";
  }
}

startDashboard();
window.setInterval(() => {
  if (document.visibilityState === "visible" && state.token && currentTab !== "products") {
    load().catch(() => {});
  }
}, 30000);
