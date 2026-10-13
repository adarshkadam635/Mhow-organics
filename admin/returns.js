/* Return Requests module for the admin dashboard. Loaded after app.js
   (uses its globals: api, $, invoiceText, render, state). */
const RETURN_STATUSES = [
  ["", "All statuses"],
  ["pending_review", "Pending Review"],
  ["under_review", "Under Review"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["completed", "Completed"],
];
const returnsView = { status: "", q: "", sort: "created_at", dir: "desc", page: 1, pageSize: 20, data: null, detail: null, busy: false, error: "" };
const rEsc = (v) => invoiceText(v);
const rDate = (v) => (v ? new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
const rLabel = (s) => (RETURN_STATUSES.find(([k]) => k === s) || [s, s])[1];
const rBadge = (s) => `<span class="return-pill ${rEsc(s)}">${rEsc(rLabel(s))}</span>`;

window.renderReturnsTab = async function renderReturnsTab() {
  if (returnsView.detail) return renderReturnDetail();
  const content = $("#content");
  content.innerHTML = `<div class="panel"><div class="toolbar"><h2>Return Requests${returnsView.data ? ` (${returnsView.data.total})` : ""}</h2>
<div class="toolbar-actions"><input id="rrSearch" placeholder="Search ID, order, customer, product" value="${rEsc(returnsView.q)}"><select id="rrStatus">${RETURN_STATUSES.map(([k, l]) => `<option value="${k}" ${returnsView.status === k ? "selected" : ""}>${l}${k && returnsView.data?.statusCounts?.[k] ? ` (${returnsView.data.statusCounts[k]})` : ""}</option>`).join("")}</select>
<select id="rrSort"><option value="created_at:desc">Newest first</option><option value="created_at:asc">Oldest first</option><option value="status:asc">Status A–Z</option><option value="customer_name:asc">Customer A–Z</option><option value="product_name:asc">Product A–Z</option></select></div></div>
<div id="rrTable"><p class="muted">Loading return requests…</p></div></div>`;
  $("#rrSort").value = `${returnsView.sort}:${returnsView.dir}`;
  let timer;
  $("#rrSearch").oninput = (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { returnsView.q = e.target.value; returnsView.page = 1; window.renderReturnsTab(); }, 350);
  };
  $("#rrStatus").onchange = (e) => { returnsView.status = e.target.value; returnsView.page = 1; window.renderReturnsTab(); };
  $("#rrSort").onchange = (e) => { [returnsView.sort, returnsView.dir] = e.target.value.split(":"); window.renderReturnsTab(); };
  try {
    const params = new URLSearchParams({ page: returnsView.page, pageSize: returnsView.pageSize, sort: returnsView.sort, dir: returnsView.dir });
    if (returnsView.status) params.set("status", returnsView.status);
    if (returnsView.q) params.set("q", returnsView.q);
    returnsView.data = await api(`/returns?${params}`);
  } catch (error) {
    $("#rrTable").innerHTML = `<p class="error">${rEsc(error.message)}</p>`;
    return;
  }
  const { requests, total, page, pageSize } = returnsView.data;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  $("#rrTable").innerHTML = requests.length
    ? `<div class="table-wrap"><table class="table"><thead><tr><th>Request ID</th><th>Order ID</th><th>Customer</th><th>Email</th><th>Product</th><th>Category</th><th>Requested</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead><tbody>${requests
        .map((r) => `<tr><td><strong>${rEsc(r.number)}</strong></td><td>${rEsc(r.orderId)}</td><td>${rEsc(r.customerName)}</td><td>${rEsc(r.customerEmail)}</td><td>${rEsc(r.productName)}</td><td>${rEsc(r.productCategory)}</td><td>${rDate(r.createdAt)}</td><td>${rEsc(r.reasonLabel)}</td><td>${rBadge(r.status)}</td><td><button class="small" data-rr-open="${rEsc(r.id)}">Review</button></td></tr>`)
        .join("")}</tbody></table></div><div class="pager"><button class="ghost small" data-rr-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>← Prev</button><span>Page ${page} of ${pages}</span><button class="ghost small" data-rr-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Next →</button></div>`
    : `<p class="muted empty-state">${returnsView.q || returnsView.status ? "No return requests match your filters." : "No return requests yet. New requests from customers will appear here automatically."}</p>`;
  document.querySelectorAll("[data-rr-open]").forEach((b) => (b.onclick = () => openReturnDetail(b.dataset.rrOpen)));
  document.querySelectorAll("[data-rr-page]").forEach((b) => (b.onclick = () => { returnsView.page = Number(b.dataset.rrPage); window.renderReturnsTab(); }));
};

async function openReturnDetail(id) {
  returnsView.error = "";
  try {
    returnsView.detail = await api(`/returns/${encodeURIComponent(id)}`);
  } catch (error) {
    return alert(error.message);
  }
  renderReturnDetail();
}

function renderReturnDetail() {
  const r = returnsView.detail;
  const canStart = r.status === "pending_review";
  const canDecide = r.status === "pending_review" || r.status === "under_review";
  const canApprove = canDecide && r.returnable;
  const canComplete = r.status === "approved";
  $("#content").innerHTML = `<div class="panel return-detail"><button class="ghost small" id="rrBack">← Back to all requests</button>
<div class="toolbar"><h2>${rEsc(r.number)} ${rBadge(r.status)}</h2></div>
${r.returnable ? "" : `<p class="rr-alert"><strong>Non-returnable product.</strong> ${rEsc(r.nonReturnableReason)} This request can only be rejected.</p>`}
<div class="rr-grid">
<section><h3>Customer</h3><p>${rEsc(r.customer.name)}<br>${rEsc(r.customer.email)}<br>${rEsc(r.customer.phone)}<br>${rEsc(r.customer.address)}</p></section>
<section><h3>Order</h3><p>Order <strong>${rEsc(r.orderId)}</strong><br>Purchased ${r.order ? rDate(r.order.createdAt) : "—"}<br>Order status: ${rEsc(r.order?.status || "—")}</p></section>
<section><h3>Product</h3><div class="rr-product">${r.productImage ? `<img src="${rEsc(r.productImage.startsWith("/") || /^https?:/.test(r.productImage) ? r.productImage : "../" + r.productImage)}" alt="" onerror="this.style.display='none'">` : ""}<p><strong>${rEsc(r.productName)}</strong><br>Category: ${rEsc(r.productCategory)}</p></div></section>
<section><h3>Request</h3><p>Submitted ${rDate(r.createdAt)}<br>Reason: <strong>${rEsc(r.reasonLabel)}</strong>${r.reviewedBy ? `<br>Reviewed by ${rEsc(r.reviewedBy)} on ${rDate(r.reviewedAt)}` : ""}${r.completedAt ? `<br>Completed ${rDate(r.completedAt)}` : ""}</p></section></div>
<h3>Customer's description</h3><p class="rr-text">${rEsc(r.description)}</p>${r.additionalInfo ? `<h3>Additional information</h3><p class="rr-text">${rEsc(r.additionalInfo)}</p>` : ""}
<h3>Uploaded photos (${r.images.length})</h3><div class="rr-gallery">${r.images.map((u, i) => `<a href="${rEsc(u)}" target="_blank" rel="noopener"><img src="${rEsc(u)}" alt="Evidence ${i + 1}"></a>`).join("") || '<p class="muted">No photos.</p>'}</div>
<h3>Admin note / response</h3>${r.adminResponse ? `<p class="rr-text">${rEsc(r.adminResponse)}</p>` : ""}${r.rejectionReason ? `<p class="rr-alert"><strong>Rejection reason:</strong> ${rEsc(r.rejectionReason)}</p>` : ""}
${r.status === "rejected" || r.status === "completed" ? "" : `<label class="rr-note">Note to customer ${r.approvalNoteRequired ? "(required to approve)" : "(optional; required to reject)"}<textarea id="rrNote" rows="3" maxlength="2000"></textarea></label>
<p class="error" id="rrError" aria-live="polite"></p>
<div class="rr-actions">${canStart ? `<button data-rr-action="start-review">Start review</button>` : ""}${canDecide ? `<button data-rr-action="approve" ${canApprove ? "" : "disabled title=\"Non-returnable products cannot be approved\""}>Approve</button><button class="danger" data-rr-action="reject">Reject</button>` : ""}${canComplete ? `<button data-rr-action="complete">Mark as completed</button>` : ""}</div>
<p class="muted">Approval authorises the return process only. It does not issue a refund or create a reverse shipment.</p>`}
<h3>Review history</h3><ol class="rr-history">${r.history.map((h) => `<li><strong>${rEsc(h.toLabel)}</strong> · ${rDate(h.at)} · ${rEsc(h.by)}${h.note ? `<br>${rEsc(h.note)}` : ""}</li>`).join("")}</ol></div>`;
  $("#rrBack").onclick = () => { returnsView.detail = null; window.renderReturnsTab(); };
  document.querySelectorAll("[data-rr-action]").forEach((button) => {
    button.onclick = async () => {
      if (returnsView.busy) return;
      const action = button.dataset.rrAction;
      const note = ($("#rrNote")?.value || "").trim();
      if (action === "reject" && note.length < 5) return void ($("#rrError").textContent = "Enter a rejection reason (at least 5 characters) in the note box.");
      if (action === "approve" && r.approvalNoteRequired && !note) return void ($("#rrError").textContent = "A review note is required to approve.");
      if (!confirm(`${button.textContent.trim()} this return request? The customer will be notified.`)) return;
      returnsView.busy = true;
      document.querySelectorAll("[data-rr-action]").forEach((b) => (b.disabled = true));
      try {
        await api(`/returns/${encodeURIComponent(r.id)}/${action}`, { method: "POST", body: JSON.stringify({ note }) });
        returnsView.busy = false;
        await openReturnDetail(r.id);
      } catch (error) {
        returnsView.busy = false;
        document.querySelectorAll("[data-rr-action]").forEach((b) => (b.disabled = false));
        $("#rrError").textContent = error.message;
      }
    };
  });
}
