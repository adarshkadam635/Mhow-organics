/* Returns & Refunds — customer UI for the Account page.
   Loaded after app.js; relies on its globals (state, storeApi, toast, escapeHtml, money). */
const FERTILIZER_NOTICE =
  "Fertilizers are non-returnable and non-refundable. Please check the product details carefully before placing your order.";
const RETURN_STATUS_CLASS = { pending_review: "pending", under_review: "review", approved: "approved", rejected: "rejected", completed: "completed" };
const RETURN_STATUS_LABEL = { pending_review: "Pending Review", under_review: "Under Review", approved: "Approved", rejected: "Rejected", completed: "Completed" };
const RETURN_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const returnsUi = { items: [], requests: [], policy: null, notifications: [], loading: false, error: "", submitting: false };

function isFertilizerProduct(p) {
  return /fertili[sz]er/i.test(`${p?.subcategory || p?.subcat || ""} ${p?.category || ""} ${p?.name || ""}`);
}
function returnImageSrc(src, productId) {
  if (!src) return `assets/images/products/product-${String(productId).padStart(3, "0")}.svg`;
  return /^(https?:|\/|data:)/.test(src) ? src : `../${src}`;
}
function returnDate(value) {
  return value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";
}
function returnBadge(status) {
  return `<span class="return-status ${RETURN_STATUS_CLASS[status] || ""}">${RETURN_STATUS_LABEL[status] || escapeHtml(status)}</span>`;
}

function returnsSectionHtml() {
  return `<section class="section" id="returnsSectionWrap"><div class="container panel" id="returnsSection"><div class="account-header"><div><h2>Returns &amp; Refunds</h2><p class="muted">Request a return for eligible items and track its status.</p></div></div><div id="returnsBody"><p class="muted">Loading your orders…</p></div></div></section>`;
}

function renderReturnsBody() {
  const body = document.getElementById("returnsBody");
  if (!body) return;
  if (returnsUi.loading) return void (body.innerHTML = `<p class="muted">Loading your orders…</p>`);
  if (returnsUi.error) return void (body.innerHTML = `<p class="return-error">${escapeHtml(returnsUi.error)}</p><button class="btn outline small" type="button" data-returns-reload>Try again</button>`);
  const unread = returnsUi.notifications.filter((n) => !n.read);
  const notices = returnsUi.notifications.length
    ? `<div class="return-notifications"><div class="return-sub-head"><h3>Updates${unread.length ? ` <span class="return-dot">${unread.length}</span>` : ""}</h3>${unread.length ? `<button class="link-btn" type="button" data-returns-mark-read>Mark all as read</button>` : ""}</div>${returnsUi.notifications
        .slice(0, 5)
        .map((n) => `<div class="return-note ${n.read ? "" : "unread"}"><strong>${escapeHtml(n.title)}</strong><p>${escapeHtml(n.body)}</p><small>${returnDate(n.createdAt)}</small></div>`)
        .join("")}</div>`
    : "";
  const windowText = returnsUi.policy?.windowDays ? `Returns must be requested within ${returnsUi.policy.windowDays} days of delivery. The countdown starts when your order is marked delivered.` : "";
  const items = returnsUi.items
    .map((item) => {
      let action;
      const timer = item.returnDeadline && item.returnable ? `<div class="return-timer" data-deadline="${escapeHtml(item.returnDeadline)}"></div>` : "";
      if (item.canRequest) action = timer + `<button class="btn small" type="button" data-request-return="${escapeHtml(item.orderId)}|${escapeHtml(item.productId)}">Request Return</button>`;
      else if (!item.returnable) action = `<p class="return-fertilizer-note">${escapeHtml(item.nonReturnableReason)}</p>`;
      else action = `<small class="muted">${escapeHtml(item.blockedReason)}</small>`;
      return `<div class="return-item"><img src="${escapeHtml(returnImageSrc(item.image, item.productId))}" alt="" onerror="this.style.visibility='hidden'"><div class="return-item-main"><strong>${escapeHtml(item.name)}</strong><small>Order ${escapeHtml(item.orderId)} · ${new Date(item.orderDate).toLocaleDateString("en-IN")} · Qty ${item.qty}</small></div><div class="return-item-action">${action}</div></div>`;
    })
    .join("");
  const requests = returnsUi.requests
    .map(
      (r) => `<article class="return-card"><img src="${escapeHtml(returnImageSrc(r.productImage, r.productId))}" alt="" onerror="this.style.visibility='hidden'"><div class="return-card-main"><div class="return-card-top"><strong>${escapeHtml(r.productName)}</strong>${returnBadge(r.status)}</div><small>${escapeHtml(r.number)} · Order ${escapeHtml(r.orderId)}</small><small>Submitted ${returnDate(r.createdAt)} · Updated ${returnDate(r.updatedAt)}</small><small>Reason: ${escapeHtml(r.reasonLabel)}</small>${r.status === "rejected" && r.rejectionReason ? `<p class="return-reply rejected"><b>Rejection reason:</b> ${escapeHtml(r.rejectionReason)}</p>` : r.adminResponse ? `<p class="return-reply"><b>Our response:</b> ${escapeHtml(r.adminResponse)}</p>` : ""}<button class="link-btn" type="button" data-return-view="${escapeHtml(r.id)}">View details</button></div></article>`,
    )
    .join("");
  body.innerHTML = `${notices}<div class="return-policy-box"><strong>Return policy</strong><p>${FERTILIZER_NOTICE}</p>${windowText ? `<p>${escapeHtml(windowText)}</p>` : ""}<p>Returns open once your order is delivered. Approval authorises the return process — it is not confirmation that a refund has been paid.</p></div>
<div class="return-sub-head"><h3>Your purchased items</h3></div>${items || `<div class="empty">You have no eligible orders yet. Items you order while signed in will appear here.</div>`}
<div class="return-sub-head"><h3>Your return requests</h3></div>${requests || `<div class="empty">You haven't submitted any return requests.</div>`}`;
}

async function loadReturnsSection() {
  if (!state.accountToken || !document.getElementById("returnsBody")) return;
  returnsUi.loading = true;
  returnsUi.error = "";
  renderReturnsBody();
  try {
    const [itemsData, requests, notes] = await Promise.all([storeApi("/returns/items"), storeApi("/returns"), storeApi("/notifications").catch(() => ({ notifications: [] }))]);
    returnsUi.items = itemsData.items;
    returnsUi.policy = itemsData.policy;
    returnsUi.requests = requests;
    returnsUi.notifications = notes.notifications || [];
  } catch (error) {
    returnsUi.error = error.message;
  }
  returnsUi.loading = false;
  renderReturnsBody();
  tickReturnTimers();
  if (!returnsUi.timerId) returnsUi.timerId = setInterval(tickReturnTimers, 1000);
}

// Live "time left to return" countdowns. Reloads the list when one runs out.
function tickReturnTimers() {
  const timers = document.querySelectorAll(".return-timer");
  if (!timers.length && !document.getElementById("returnsBody")) return clearInterval(returnsUi.timerId), (returnsUi.timerId = null);
  let expired = false;
  timers.forEach((el) => {
    const ms = new Date(el.dataset.deadline).getTime() - Date.now();
    if (ms <= 0) { expired = true; return; }
    const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
    el.classList.toggle("urgent", ms < 86400000);
    el.textContent = `⏱ Return window closes in ${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  });
  if (expired) loadReturnsSection();
}

function bindReturnsSection() {
  const section = document.getElementById("returnsSection");
  if (!section || section.dataset.bound) return;
  section.dataset.bound = "1";
  section.addEventListener("click", async (e) => {
    const target = e.target.closest("button");
    if (!target) return;
    if (target.hasAttribute("data-returns-reload")) loadReturnsSection();
    else if (target.hasAttribute("data-returns-mark-read")) {
      await storeApi("/notifications/read", { method: "POST" }).catch(() => {});
      returnsUi.notifications.forEach((n) => (n.read = true));
      renderReturnsBody();
    } else if (target.dataset.requestReturn) {
      const [orderId, productId] = target.dataset.requestReturn.split("|");
      openReturnForm(returnsUi.items.find((i) => i.orderId === orderId && i.productId === productId));
    } else if (target.dataset.returnView) openReturnDetails(target.dataset.returnView);
  });
}

window.initReturnsSection = function initReturnsSection() {
  if (!document.getElementById("returnsSection")) return;
  bindReturnsSection();
  loadReturnsSection();
};

/* ------------------------------ modal helpers ------------------------------ */
function openReturnModal(html) {
  closeReturnModal();
  const overlay = document.createElement("div");
  overlay.className = "return-overlay";
  overlay.id = "returnModal";
  overlay.innerHTML = `<div class="return-modal" role="dialog" aria-modal="true">${html}</div>`;
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay && !returnsUi.submitting) closeReturnModal();
  });
  document.body.append(overlay);
  document.body.style.overflow = "hidden";
  return overlay;
}
function closeReturnModal() {
  document.getElementById("returnModal")?.remove();
  document.body.style.overflow = "";
}

/* ------------------------------ request form ------------------------------ */
function openReturnForm(item) {
  if (!item) return;
  const reasons = Object.entries(returnsUi.policy?.reasons || {});
  const maxImages = returnsUi.policy?.maxImages || 5;
  const maxBytes = returnsUi.policy?.maxImageBytes || 3 * 1024 * 1024;
  const files = []; // { file, url }
  const overlay = openReturnModal(`<button class="return-close" type="button" aria-label="Close" data-close>×</button><h2>Request a return</h2>
<form id="returnForm" novalidate>
<div class="return-product"><img src="${escapeHtml(returnImageSrc(item.image, item.productId))}" alt="${escapeHtml(item.name)}"><div><strong>${escapeHtml(item.name)}</strong><small>Order ID: <b>${escapeHtml(item.orderId)}</b></small></div></div>
<div class="field"><label for="rfReason">Reason for return *</label><select id="rfReason" name="reason" required><option value="">Select a reason</option>${reasons.map(([k, v]) => `<option value="${escapeHtml(k)}">${escapeHtml(v)}</option>`).join("")}</select></div>
<div class="field"><label for="rfDesc">Describe the issue *</label><textarea id="rfDesc" name="description" rows="4" maxlength="2000" required placeholder="Tell us what is wrong with the product"></textarea></div>
<div class="field"><label>Photos of the product *</label><div class="return-drop"><button class="btn outline small" type="button" id="rfPick">Add photos</button><small>JPG, PNG or WEBP · up to ${maxImages} photos · ${Math.round(maxBytes / 1024 / 1024)} MB each. Show the product, packaging and any damage.</small><input type="file" id="rfFiles" accept="image/jpeg,image/png,image/webp" multiple hidden></div><div class="return-previews" id="rfPreviews"></div></div>
<div class="field"><label for="rfExtra">Additional information (optional)</label><textarea id="rfExtra" name="additionalInfo" rows="2" maxlength="2000"></textarea></div>
<p class="return-error" id="rfError" role="alert"></p>
<div class="return-actions"><button class="btn outline" type="button" data-close>Cancel</button><button class="btn" type="submit" id="rfSubmit">Send Return Request</button></div>
</form>`);
  const form = overlay.querySelector("#returnForm");
  const errorBox = overlay.querySelector("#rfError");
  const previews = overlay.querySelector("#rfPreviews");
  const picker = overlay.querySelector("#rfFiles");
  overlay.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => !returnsUi.submitting && closeReturnModal()));
  const showError = (msg) => (errorBox.textContent = msg || "");
  const drawPreviews = () => {
    previews.innerHTML = files
      .map((f, i) => `<div class="return-preview"><img src="${f.url}" alt="Selected photo ${i + 1}"><button type="button" data-remove="${i}" aria-label="Remove photo ${i + 1}">×</button><button type="button" class="replace" data-replace="${i}">Replace</button></div>`)
      .join("");
    overlay.querySelector("#rfPick").disabled = files.length >= maxImages;
  };
  const validateFile = (file) => {
    if (!RETURN_ALLOWED_TYPES.includes(file.type)) return `${file.name}: only JPG, PNG and WEBP images are allowed.`;
    if (file.size > maxBytes) return `${file.name}: images must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`;
    return "";
  };
  let replaceIndex = -1;
  overlay.querySelector("#rfPick").onclick = () => {
    replaceIndex = -1;
    picker.multiple = true;
    picker.click();
  };
  picker.onchange = () => {
    showError("");
    const chosen = [...picker.files];
    picker.value = "";
    if (replaceIndex >= 0) {
      const file = chosen[0];
      const problem = file && validateFile(file);
      if (problem) return showError(problem);
      if (file) {
        URL.revokeObjectURL(files[replaceIndex].url);
        files[replaceIndex] = { file, url: URL.createObjectURL(file) };
      }
    } else {
      for (const file of chosen) {
        if (files.length >= maxImages) return showError(`You can upload up to ${maxImages} photos.`), drawPreviews();
        const problem = validateFile(file);
        if (problem) { showError(problem); continue; }
        files.push({ file, url: URL.createObjectURL(file) });
      }
    }
    drawPreviews();
  };
  previews.onclick = (e) => {
    const remove = e.target.closest("[data-remove]");
    const replace = e.target.closest("[data-replace]");
    if (remove) {
      const [gone] = files.splice(Number(remove.dataset.remove), 1);
      URL.revokeObjectURL(gone.url);
      drawPreviews();
    } else if (replace) {
      replaceIndex = Number(replace.dataset.replace);
      picker.multiple = false;
      picker.click();
    }
  };
  const readAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read one of the images"));
      reader.readAsDataURL(file);
    });
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (returnsUi.submitting) return; // blocks duplicate submissions
    showError("");
    const reason = form.reason.value;
    const description = form.description.value.trim();
    if (!reason) return showError("Please choose a reason for the return.");
    if (description.length < 10) return showError("Please describe the issue in at least 10 characters.");
    if (!files.length) return showError("Please add at least one photo of the product.");
    if (!window.confirm("Send this return request? You won't be able to edit it afterwards.")) return;
    returnsUi.submitting = true;
    const submit = overlay.querySelector("#rfSubmit");
    submit.disabled = true;
    try {
      const imagePaths = [];
      for (let i = 0; i < files.length; i++) {
        submit.textContent = `Uploading photo ${i + 1} of ${files.length}…`;
        const uploaded = await storeApi("/returns/images", { method: "POST", body: JSON.stringify({ dataUrl: await readAsDataUrl(files[i].file) }) });
        imagePaths.push(uploaded.path);
      }
      submit.textContent = "Sending…";
      const result = await storeApi("/returns", { method: "POST", body: JSON.stringify({ orderId: item.orderId, productId: item.productId, reason, description, additionalInfo: form.additionalInfo.value.trim(), imagePaths }) });
      files.forEach((f) => URL.revokeObjectURL(f.url));
      returnsUi.submitting = false;
      openReturnModal(`<div class="return-success"><div class="return-tick">✓</div><h2>Request submitted</h2><p>${escapeHtml(result.message)}</p><p><small>Reference: <b>${escapeHtml(result.request.number)}</b></small></p><button class="btn" type="button" data-close>Done</button></div>`).querySelector("[data-close]").onclick = closeReturnModal;
      loadReturnsSection();
    } catch (error) {
      returnsUi.submitting = false;
      submit.disabled = false;
      submit.textContent = "Send Return Request";
      showError(error.message);
    }
  };
}

/* ------------------------------ request details ------------------------------ */
async function openReturnDetails(id) {
  const overlay = openReturnModal(`<button class="return-close" type="button" aria-label="Close" data-close>×</button><p class="muted">Loading…</p>`);
  overlay.querySelector("[data-close]").onclick = closeReturnModal;
  try {
    const r = await storeApi(`/returns/${encodeURIComponent(id)}`);
    const modal = overlay.querySelector(".return-modal");
    modal.innerHTML = `<button class="return-close" type="button" aria-label="Close" data-close>×</button><h2>${escapeHtml(r.number)} ${returnBadge(r.status)}</h2>
<div class="return-product"><img src="${escapeHtml(returnImageSrc(r.productImage, r.productId))}" alt=""><div><strong>${escapeHtml(r.productName)}</strong><small>Order ${escapeHtml(r.orderId)}</small></div></div>
<dl class="return-dl"><dt>Reason</dt><dd>${escapeHtml(r.reasonLabel)}</dd><dt>Description</dt><dd>${escapeHtml(r.description)}</dd>${r.additionalInfo ? `<dt>Additional information</dt><dd>${escapeHtml(r.additionalInfo)}</dd>` : ""}<dt>Submitted</dt><dd>${returnDate(r.createdAt)}</dd><dt>Last updated</dt><dd>${returnDate(r.updatedAt)}</dd>${r.rejectionReason ? `<dt>Rejection reason</dt><dd class="return-reply rejected">${escapeHtml(r.rejectionReason)}</dd>` : ""}${r.adminResponse ? `<dt>Our response</dt><dd>${escapeHtml(r.adminResponse)}</dd>` : ""}</dl>
<h3>Your photos</h3><div class="return-gallery">${r.images.map((u, i) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener"><img src="${escapeHtml(u)}" alt="Evidence photo ${i + 1}"></a>`).join("")}</div>
<h3>Status history</h3><ol class="return-timeline">${r.history.map((h) => `<li><b>${escapeHtml(h.toLabel)}</b> <small>${returnDate(h.at)} · ${escapeHtml(h.by)}</small>${h.note ? `<p>${escapeHtml(h.note)}</p>` : ""}</li>`).join("")}</ol>`;
    modal.querySelector("[data-close]").onclick = closeReturnModal;
  } catch (error) {
    overlay.querySelector(".return-modal").innerHTML = `<button class="return-close" type="button" data-close>×</button><p class="return-error">${escapeHtml(error.message)}</p>`;
    overlay.querySelector("[data-close]").onclick = closeReturnModal;
  }
}
