const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const EVIDENCE_BUCKET = "return-evidence";
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // keeps each JSON upload under serverless body limits
const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const RETURN_REASONS = {
  damaged: "Damaged product",
  defective: "Defective product",
  wrong_product: "Wrong product received",
  missing_items: "Missing items",
  other: "Other",
};
const STATUS_LABELS = { pending_review: "Pending Review", under_review: "Under Review", approved: "Approved", rejected: "Rejected", completed: "Completed" };
const ACTIVE_STATUSES = ["pending_review", "under_review", "approved"];
const FERTILIZER_NOTICE = "Fertilizers are non-returnable and non-refundable. Please check the product details carefully before placing your order.";

// Return window in days, counted from delivery (orders.delivered_at, falling back to the order date). Default 7; set 0 for no limit.
const RETURN_WINDOW_DAYS = process.env.RETURN_WINDOW_DAYS === undefined || process.env.RETURN_WINDOW_DAYS === "" ? 7 : Number(process.env.RETURN_WINDOW_DAYS) || 0;
// Orders only become return-eligible once they are in one of these statuses.
const RETURN_ORDER_STATUSES = (process.env.RETURN_ORDER_STATUSES || "completed").split(",").map((s) => s.trim()).filter(Boolean);
const APPROVAL_NOTE_REQUIRED = String(process.env.RETURN_APPROVAL_NOTE_REQUIRED || "").toLowerCase() === "true";

function isFertilizer(product) {
  return /fertili[sz]er/i.test(`${product?.subcategory || ""} ${product?.category || ""} ${product?.name || ""}`);
}
// Single source of truth for "can this product ever be returned?". Fertilizers are
// non-returnable no matter what the is_returnable flag says.
function productReturnability(product) {
  if (!product) return { ok: false, code: "missing", reason: "This product is no longer in our catalogue." };
  if (isFertilizer(product)) return { ok: false, code: "fertilizer", reason: FERTILIZER_NOTICE };
  if (product.is_returnable === false) return { ok: false, code: "non_returnable", reason: "This product is non-returnable." };
  return { ok: true };
}
function orderReturnability(order) {
  if (!RETURN_ORDER_STATUSES.includes(order.status)) {
    return { ok: false, code: "order_status", reason: order.status === "cancelled" ? "This order was cancelled." : "Returns open once your order has been delivered." };
  }
  const deadline = returnDeadline(order);
  if (deadline && Date.now() > deadline.getTime()) {
    return { ok: false, code: "window", reason: `The ${RETURN_WINDOW_DAYS}-day return window for this order has closed.` };
  }
  return { ok: true };
}
function returnDeadline(order) {
  if (!(RETURN_WINDOW_DAYS > 0) || !RETURN_ORDER_STATUSES.includes(order.status)) return null;
  return new Date(new Date(order.delivered_at || order.created_at).getTime() + RETURN_WINDOW_DAYS * 86400000);
}

const text = (value, max) => String(value ?? "").trim().slice(0, max);
const likeEscape = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);
const orderItems = (order) => (Array.isArray(order.items) ? order.items : []);
const itemKey = (orderId, productId) => `${orderId}:${productId}`;

module.exports = function registerReturnRoutes(app, { db, adminAuth, customerAuth }) {
  async function ordersForCustomer(customer) {
    const [byAccount, byEmail] = await Promise.all([
      db.from("orders").select("*").eq("account_id", customer.accountId),
      customer.email ? db.from("orders").select("*").is("account_id", null).ilike("email", likeEscape(customer.email)) : { data: [] },
    ]);
    if (byAccount.error) throw byAccount.error;
    if (byEmail.error) throw byEmail.error;
    const seen = new Map();
    for (const order of byAccount.data || []) seen.set(order.id, order);
    // Legacy/guest orders carry no account_id; match them on exact (case-insensitive) email.
    for (const order of byEmail.data || []) if (String(order.email || "").trim().toLowerCase() === customer.email) seen.set(order.id, order);
    return [...seen.values()];
  }
  async function findOwnedOrder(customer, orderId) {
    const { data, error } = await db.from("orders").select("*").eq("id", orderId).limit(1);
    if (error) throw error;
    const order = data[0];
    if (!order) return null;
    if (order.account_id) return order.account_id === customer.accountId ? order : null;
    return String(order.email || "").trim().toLowerCase() === customer.email && customer.email ? order : null;
  }
  async function productsById(ids) {
    if (!ids.length) return new Map();
    const { data, error } = await db.from("products").select("*").in("id", ids);
    if (error) throw error;
    return new Map(data.map((p) => [p.id, p]));
  }
  async function signImages(paths) {
    const list = Array.isArray(paths) ? paths : [];
    if (!list.length) return [];
    const { data, error } = await db.storage.from(EVIDENCE_BUCKET).createSignedUrls(list, 3600);
    if (error) return [];
    return data.filter((entry) => entry.signedUrl).map((entry) => entry.signedUrl);
  }
  const statusLabel = (status) => STATUS_LABELS[status] || status;
  async function presentRequest(row, { history } = {}) {
    const out = {
      id: row.id, number: row.return_request_number, orderId: row.order_id, productId: row.product_id,
      productName: row.product_name, productImage: row.product_image, productCategory: row.product_category,
      reason: row.reason, reasonLabel: RETURN_REASONS[row.reason] || row.reason, description: row.description, additionalInfo: row.additional_info,
      images: await signImages(row.image_paths), status: row.status, statusLabel: statusLabel(row.status),
      adminResponse: row.admin_notes, rejectionReason: row.rejection_reason, createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at,
    };
    if (history) out.history = history.map((h) => ({ from: h.from_status, to: h.to_status, toLabel: statusLabel(h.to_status), note: h.note, by: String(h.actor).startsWith("admin:") ? "Support team" : "You", at: h.created_at }));
    return out;
  }

  /* ---------------- customer ---------------- */
  const imageLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, message: { error: "Too many uploads. Please try again later." } });
  const submitLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { error: "Too many return requests. Please try again later." } });

  app.get("/api/store/returns/items", customerAuth, async (req, res) => {
    try {
      const orders = (await ordersForCustomer(req.customer)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const products = await productsById([...new Set(orders.flatMap((o) => orderItems(o).map((i) => String(i.id))))]);
      const { data: requests, error } = await db.from("return_requests").select("id,order_item_id,status,return_request_number").eq("user_id", req.customer.accountId);
      if (error) throw error;
      const items = [];
      for (const order of orders) {
        const orderCheck = orderReturnability(order);
        for (const item of orderItems(order)) {
          const productId = String(item.id);
          const product = products.get(productId);
          const productCheck = productReturnability(product);
          const active = requests.find((r) => r.order_item_id === itemKey(order.id, productId) && ACTIVE_STATUSES.includes(r.status));
          const past = requests.find((r) => r.order_item_id === itemKey(order.id, productId));
          const blocked = !productCheck.ok ? productCheck : !orderCheck.ok ? orderCheck : null;
          items.push({
            orderId: order.id, orderDate: order.created_at, orderStatus: order.status, returnDeadline: returnDeadline(order)?.toISOString() || null, productId,
            name: product?.name || `Product ${productId}`, image: product?.image || "", category: product?.category || "", qty: Number(item.qty) || 1,
            returnable: productCheck.ok, nonReturnableReason: productCheck.ok ? "" : productCheck.reason,
            canRequest: !blocked && !active, blockedReason: blocked ? blocked.reason : active ? "A return request is already open for this item." : "",
            requestId: (active || past)?.id || null, requestNumber: (active || past)?.return_request_number || null,
          });
        }
      }
      res.json({ items, policy: { windowDays: RETURN_WINDOW_DAYS || null, reasons: RETURN_REASONS, maxImages: MAX_IMAGES, maxImageBytes: MAX_IMAGE_BYTES, fertilizerNotice: FERTILIZER_NOTICE } });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/store/returns/images", customerAuth, imageLimiter, async (req, res) => {
    const match = String(req.body.dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return res.status(400).json({ error: "Only JPG, PNG and WEBP images are allowed" });
    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return res.status(400).json({ error: `Each image must be ${MAX_IMAGE_BYTES / 1024 / 1024} MB or smaller` });
    // Verify real file signature, not just the claimed MIME type.
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp = buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    const valid = { "image/jpeg": isJpeg, "image/png": isPng, "image/webp": isWebp }[match[1]];
    if (!valid) return res.status(400).json({ error: "That file is not a valid image" });
    const filePath = `${req.customer.accountId}/${crypto.randomUUID()}.${IMAGE_TYPES[match[1]]}`;
    const { error } = await db.storage.from(EVIDENCE_BUCKET).upload(filePath, buffer, { contentType: match[1], upsert: false });
    if (error) return res.status(500).json({ error: `Image upload failed: ${error.message}` });
    const [url] = await signImages([filePath]);
    res.status(201).json({ path: filePath, url });
  });

  app.post("/api/store/returns", customerAuth, submitLimiter, async (req, res) => {
    try {
      const orderId = text(req.body.orderId, 80);
      const productId = text(req.body.productId, 80);
      const reason = text(req.body.reason, 40);
      const description = text(req.body.description, 2000);
      const additionalInfo = text(req.body.additionalInfo, 2000);
      if (!RETURN_REASONS[reason]) return res.status(400).json({ error: "Please choose a reason for the return" });
      if (description.length < 10) return res.status(400).json({ error: "Please describe the issue in at least 10 characters" });
      const imagePaths = Array.isArray(req.body.imagePaths) ? [...new Set(req.body.imagePaths.map(String))] : [];
      if (!imagePaths.length) return res.status(400).json({ error: "Please upload at least one photo of the product" });
      if (imagePaths.length > MAX_IMAGES) return res.status(400).json({ error: `You can upload up to ${MAX_IMAGES} images` });
      const pathPattern = new RegExp(`^${req.customer.accountId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`);
      if (!imagePaths.every((p) => pathPattern.test(p))) return res.status(400).json({ error: "One or more uploaded images are invalid" });
      const { data: stored, error: listError } = await db.storage.from(EVIDENCE_BUCKET).list(req.customer.accountId, { limit: 1000 });
      if (listError) throw listError;
      const storedNames = new Set(stored.map((f) => f.name));
      if (!imagePaths.every((p) => storedNames.has(p.split("/")[1]))) return res.status(400).json({ error: "One or more uploaded images could not be found. Please upload them again." });

      const order = await findOwnedOrder(req.customer, orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });
      const item = orderItems(order).find((i) => String(i.id) === productId);
      if (!item) return res.status(400).json({ error: "That product is not part of this order" });
      const product = (await productsById([productId])).get(productId);
      const productCheck = productReturnability(product);
      if (!productCheck.ok) return res.status(403).json({ error: productCheck.reason, code: productCheck.code });
      const orderCheck = orderReturnability(order);
      if (!orderCheck.ok) return res.status(403).json({ error: orderCheck.reason, code: orderCheck.code });

      const { data, error } = await db.rpc("create_return_request", { p: {
        user_id: req.customer.accountId, order_id: order.id, order_item_id: itemKey(order.id, productId), product_id: productId,
        product_name: product.name, product_category: product.category, product_image: product.image || "",
        customer_name: order.name || req.customer.name || "", customer_email: order.email || req.customer.email || "",
        reason, description, additional_info: additionalInfo, image_paths: imagePaths,
      } });
      if (error) {
        if (error.code === "23505") return res.status(409).json({ error: "A return request is already open for this item." });
        throw error;
      }
      res.status(201).json({ ok: true, request: await presentRequest(data), message: "Your return request has been submitted successfully. Our team will review your request and update its status shortly." });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get("/api/store/returns", customerAuth, async (req, res) => {
    const { data, error } = await db.from("return_requests").select("*").eq("user_id", req.customer.accountId).order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(await Promise.all(data.map((row) => presentRequest(row))));
  });
  app.get("/api/store/returns/:id", customerAuth, async (req, res) => {
    if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return res.status(404).json({ error: "Return request not found" });
    const { data, error } = await db.from("return_requests").select("*").eq("id", req.params.id).eq("user_id", req.customer.accountId).limit(1);
    if (error) return res.status(500).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: "Return request not found" });
    const { data: history } = await db.from("return_status_history").select("*").eq("return_request_id", data[0].id).order("created_at");
    res.json(await presentRequest(data[0], { history: history || [] }));
  });
  // Requests are immutable for customers: no PUT/PATCH/DELETE routes exist by design.

  app.get("/api/store/notifications", customerAuth, async (req, res) => {
    const { data, error } = await db.from("notifications").select("*").eq("account_id", req.customer.accountId).order("created_at", { ascending: false }).limit(30);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ unread: data.filter((n) => !n.read).length, notifications: data.map((n) => ({ id: n.id, title: n.title, body: n.body, refId: n.ref_id, read: n.read, createdAt: n.created_at })) });
  });
  app.post("/api/store/notifications/read", customerAuth, async (req, res) => {
    const { error } = await db.from("notifications").update({ read: true }).eq("account_id", req.customer.accountId).eq("read", false);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  });

  /* ---------------- admin ---------------- */
  const SORTS = { created_at: "created_at", status: "status", customer_name: "customer_name", product_name: "product_name", return_request_number: "return_request_number", order_id: "order_id" };
  app.get("/api/returns", adminAuth, async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const sort = SORTS[req.query.sort] || "created_at";
    let query = db.from("return_requests").select("*", { count: "exact" });
    if (STATUS_LABELS[req.query.status]) query = query.eq("status", req.query.status);
    const q = text(req.query.q, 80).replace(/[,()*]/g, " ").trim();
    if (q) {
      const term = `%${likeEscape(q)}%`;
      query = query.or(["return_request_number", "order_id", "customer_name", "customer_email", "product_name"].map((c) => `${c}.ilike.${term}`).join(","));
    }
    query = query.order(sort, { ascending: req.query.dir === "asc" }).range((page - 1) * pageSize, page * pageSize - 1);
    const [{ data, error, count }, counts] = await Promise.all([query, db.from("return_requests").select("status")]);
    if (error) return res.status(500).json({ error: error.message });
    const statusCounts = {};
    for (const row of counts.data || []) statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    res.json({
      total: count || 0, page, pageSize, statusCounts,
      requests: data.map((r) => ({ id: r.id, number: r.return_request_number, orderId: r.order_id, customerName: r.customer_name, customerEmail: r.customer_email, productName: r.product_name, productCategory: r.product_category, createdAt: r.created_at, reason: r.reason, reasonLabel: RETURN_REASONS[r.reason] || r.reason, status: r.status, statusLabel: statusLabel(r.status) })),
    });
  });

  app.get("/api/returns/:id", adminAuth, async (req, res) => {
    if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return res.status(404).json({ error: "Return request not found" });
    const { data, error } = await db.from("return_requests").select("*").eq("id", req.params.id).limit(1);
    if (error) return res.status(500).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: "Return request not found" });
    const row = data[0];
    const [{ data: history }, { data: orders }, products] = await Promise.all([
      db.from("return_status_history").select("*").eq("return_request_id", row.id).order("created_at"),
      db.from("orders").select("*").eq("id", row.order_id).limit(1),
      productsById([row.product_id]),
    ]);
    const order = orders?.[0];
    const check = productReturnability(products.get(row.product_id));
    const base = await presentRequest(row);
    res.json({
      ...base,
      customer: { name: row.customer_name, email: row.customer_email, phone: order?.phone || "", address: order?.address || "" },
      order: order ? { id: order.id, status: order.status, createdAt: order.created_at, total: Number(order.total) || 0 } : null,
      returnable: check.ok, nonReturnableReason: check.ok ? "" : check.reason, approvalNoteRequired: APPROVAL_NOTE_REQUIRED,
      reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at,
      history: (history || []).map((h) => ({ from: h.from_status, to: h.to_status, toLabel: statusLabel(h.to_status), note: h.note, by: h.actor, at: h.created_at })),
    });
  });

  const ACTIONS = {
    "start-review": { from: ["pending_review"], to: "under_review", title: "Your return request is under review", body: (r) => `Our team has started reviewing return request ${r.return_request_number}.` },
    approve: { from: ["pending_review", "under_review"], to: "approved", title: "Your return request was approved", body: (r) => `Return request ${r.return_request_number} has been approved. Our team will contact you with the next steps. Approval does not mean a refund has been issued.` },
    reject: { from: ["pending_review", "under_review"], to: "rejected", title: "Your return request was rejected", body: (r) => `Return request ${r.return_request_number} could not be approved. See the reason in your Returns & Refunds section.` },
    complete: { from: ["approved"], to: "completed", title: "Your return is complete", body: (r) => `Return request ${r.return_request_number} has been marked as completed.` },
  };
  app.post("/api/returns/:id/:action", adminAuth, async (req, res) => {
    const action = ACTIONS[req.params.action];
    if (!action || !/^[0-9a-f-]{36}$/.test(req.params.id)) return res.status(404).json({ error: "Not found" });
    try {
      const { data: found, error: findError } = await db.from("return_requests").select("*").eq("id", req.params.id).limit(1);
      if (findError) throw findError;
      if (!found.length) return res.status(404).json({ error: "Return request not found" });
      const row = found[0];
      const note = text(req.body.note, 2000);
      if (action.to === "approved") {
        const check = productReturnability((await productsById([row.product_id])).get(row.product_id));
        if (!check.ok) return res.status(409).json({ error: `This return cannot be approved. ${check.reason}`, code: check.code });
        if (APPROVAL_NOTE_REQUIRED && !note) return res.status(400).json({ error: "A review note is required to approve a return" });
      }
      if (action.to === "rejected" && note.length < 5) return res.status(400).json({ error: "Please enter a rejection reason (at least 5 characters)" });
      const { data, error } = await db.rpc("transition_return_request", {
        p_id: row.id, p_from: action.from, p_to: action.to, p_actor: req.admin?.username || "admin", p_note: action.to === "rejected" ? "" : note,
        p_rejection: action.to === "rejected" ? note : "", p_title: action.title, p_body: action.body(row) + (action.to === "rejected" ? ` Reason: ${note}` : ""),
      });
      if (error) {
        if (/NOT_FOUND/.test(error.message)) return res.status(404).json({ error: "Return request not found" });
        if (/BAD_STATE/.test(error.message)) return res.status(409).json({ error: "This request has already moved on. Please refresh and try again." });
        throw error;
      }
      res.json({ ok: true, request: await presentRequest(data) });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
};

module.exports.productReturnability = productReturnability;
module.exports.orderReturnability = orderReturnability;
module.exports.isFertilizer = isFertilizer;
