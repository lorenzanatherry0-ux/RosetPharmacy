/* ══════════════════════════════════════════════
   pos.js — POS: grid, cart, discount, checkout,
            daily summary panel
══════════════════════════════════════════════ */

/* ── FIFO WEIGHTED PRICE ──────────────────────
   A sale can span more than one batch (e.g. 30 units left in the
   oldest/cheaper batch, 20 more pulled from the next batch at a higher
   price). The cart previously charged the ENTIRE quantity at the oldest
   batch's price, undercharging for any units that actually come out of a
   pricier batch. This computes the correct weighted-average unit price for
   the requested quantity, walking batches in FIFO order — matching exactly
   what checkout() will deduct. ─────────────────────────────────────────── */
function computeFifoUnitPrice(id, qty) {
  const batches = inventory.filter(i => i.id === id && i.qty > 0).sort((a, b) => a.batchNo - b.batchNo);
  let remaining = qty, cost = 0;
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(b.qty, remaining);
    cost      += take * b.price;
    remaining -= take;
  }
  // If qty exceeds total available stock, price the shortfall at the last
  // known batch price rather than silently undercounting.
  if (remaining > 0 && batches.length > 0) cost += remaining * batches[batches.length - 1].price;
  return qty > 0 ? cost / qty : (batches[0]?.price || 0);
}

/* Same FIFO walk as above, but for the item's CAPITAL COST rather than its
   selling price. Used to calculate profit at checkout time — never shown
   on the POS screen itself, only stored on the transaction for later
   display in Transaction History. */
function computeFifoUnitCost(id, qty) {
  const batches = inventory.filter(i => i.id === id && i.qty > 0).sort((a, b) => a.batchNo - b.batchNo);
  let remaining = qty, totalCost = 0;
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(b.qty, remaining);
    totalCost += take * (b.cost ?? 0);
    remaining -= take;
  }
  if (remaining > 0 && batches.length > 0) totalCost += remaining * (batches[batches.length - 1].cost ?? 0);
  return qty > 0 ? totalCost / qty : (batches[0]?.cost ?? 0);
}

/* ── PRODUCT LOOKUP (search-driven) ─────────── */
function renderPosGrid() {
  const q   = (document.getElementById("posSearch")?.value || "").trim();
  const cat = document.getElementById("posCatFilter")?.value || "";

  const grid      = document.getElementById("posGrid");
  const idleState = document.getElementById("posIdleState");
  if (!grid) return;

  // If nothing typed and no category filter, show idle state
  if (!q && !cat) {
    grid.innerHTML   = "";
    grid.style.display = "none";
    if (idleState) idleState.style.display = "flex";
    return;
  }

  if (idleState) idleState.style.display = "none";
  grid.style.display = "block";

  // Group inventory by item id
  const grouped = {};
  inventory.forEach(i => {
    if (!grouped[i.id]) {
      grouped[i.id] = { id: i.id, name: i.name, category: i.category, unit: i.unit, reorder: i.reorder, totalQty: 0, batches: [] };
    }
    grouped[i.id].totalQty += i.qty;
    grouped[i.id].batches.push(i);
  });

  const ql = q.toLowerCase();
  const items = Object.values(grouped).filter(i =>
    (!q   || i.name.toLowerCase().includes(ql) || i.id.toLowerCase().includes(ql)) &&
    (!cat || i.category === cat)
  );

  if (items.length === 0) {
    grid.innerHTML = `<div class="pos-no-results">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <span>No medicines found for "<strong>${q || cat}</strong>"</span>
    </div>`;
    return;
  }

  grid.innerHTML = items.map(i => {
    const oos         = i.totalQty === 0;
    const isLow       = i.totalQty <= i.reorder && i.totalQty > 0;
    const oldestBatch = i.batches.sort((a, b) => a.batchNo - b.batchNo).find(b => b.qty > 0);
    const price       = oldestBatch ? oldestBatch.price : (i.batches[0]?.price || 0);
    const stockLabel  = oos ? `<span class="lookup-stock empty">⛔ Out of stock</span>`
                      : isLow ? `<span class="lookup-stock low">⚠ ${i.totalQty} ${i.unit}s left</span>`
                      : `<span class="lookup-stock ok">${i.totalQty} ${i.unit}s in stock</span>`;

    return `<div class="lookup-row${oos ? " oos" : ""}">
      <div class="lookup-info">
        <div class="lookup-name">${escapeHtml(i.name)}</div>
        <div class="lookup-meta">
          <span class="lookup-code">${i.id}</span>
          <span class="tag tag-teal" style="font-size:10px;padding:2px 7px">${i.category}</span>
        </div>
      </div>
      <div class="lookup-stock-block">
        ${stockLabel}
        <div class="lookup-price">₱${price.toFixed(2)}<span class="lookup-unit">/${i.unit}</span></div>
      </div>
      ${oos ? `<div class="lookup-add-disabled">Out of Stock</div>` : `
      <div class="lookup-add-wrap">
        <input type="number" id="lookupQty_${i.id}" class="lookup-qty-input" min="1" max="${i.totalQty}" value="1" placeholder="1"/>
        <button class="lookup-add-btn" onclick="addToCartWithQty('${i.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add
        </button>
      </div>`}
    </div>`;
  }).join("");
}

/* ── ADD TO CART WITH QTY ─────────────────── */
function addToCartWithQty(id) {
  const qtyEl    = document.getElementById(`lookupQty_${id}`);
  const qty      = parseInt(qtyEl?.value) || 1;
  const batches  = inventory.filter(i => i.id === id && i.qty > 0).sort((a, b) => a.batchNo - b.batchNo);
  const totalAvail = inventory.filter(i => i.id === id).reduce((s, i) => s + i.qty, 0);

  if (batches.length === 0 || totalAvail === 0) { toast("warn", "Out of stock."); return; }
  if (qty <= 0) { toast("warn", "Quantity must be at least 1."); return; }

  const oldest  = batches[0];
  const existing = cart.find(c => c.id === id);

  if (existing) {
    const newQty = existing.qty + qty;
    if (newQty > totalAvail) { toast("warn", `Only ${totalAvail} in stock. Cart already has ${existing.qty}.`); return; }
    existing.qty   = newQty;
    existing.price = computeFifoUnitPrice(id, newQty);
    existing.cost  = computeFifoUnitCost(id, newQty);
  } else {
    if (qty > totalAvail) { toast("warn", `Only ${totalAvail} in stock.`); return; }
    cart.push({ id: oldest.id, name: oldest.name, price: computeFifoUnitPrice(id, qty), cost: computeFifoUnitCost(id, qty), qty });
  }

  if (qtyEl) qtyEl.value = 1;
  renderCart();
  toast("success", `Added ${qty}× ${oldest.name} to cart.`);
}


function addToCart(id) {
  // Pull from oldest batch first
  const batches    = inventory.filter(i => i.id === id && i.qty > 0).sort((a, b) => a.batchNo - b.batchNo);
  const totalAvail = inventory.filter(i => i.id === id).reduce((s, i) => s + i.qty, 0);

  if (batches.length === 0 || totalAvail === 0) { toast("warn", "Out of stock."); return; }

  const oldest  = batches[0];
  const existing = cart.find(c => c.id === id);

  if (existing) {
    if (existing.qty >= totalAvail) { toast("warn", "Not enough stock available."); return; }
    existing.qty++;
    existing.price = computeFifoUnitPrice(id, existing.qty);
    existing.cost  = computeFifoUnitCost(id, existing.qty);
  } else {
    cart.push({ id: oldest.id, name: oldest.name, price: computeFifoUnitPrice(id, 1), cost: computeFifoUnitCost(id, 1), qty: 1 });
  }
  renderCart();
}

function updateCartQty(id, delta) {
  const totalAvail = inventory.filter(i => i.id === id).reduce((s, i) => s + i.qty, 0);
  const ci = cart.find(c => c.id === id);
  if (!ci) return;
  ci.qty += delta;
  if (ci.qty <= 0)          { cart = cart.filter(c => c.id !== id); }
  else {
    if (ci.qty > totalAvail) { ci.qty = totalAvail; toast("warn", "Max stock reached."); }
    ci.price = computeFifoUnitPrice(id, ci.qty);
    ci.cost  = computeFifoUnitCost(id, ci.qty);
  }
  renderCart();
}

/* ── RENDER CART ──────────────────────────── */
function renderCart() {
  const el          = document.getElementById("cartItems");
  const checkoutBtn = document.getElementById("checkoutBtn");
  if (!el) return;

  if (cart.length === 0) {
    el.innerHTML = `<div class="cart-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
      </svg>
      <p>No items yet.<br>Tap a product to add.</p>
    </div>`;
    if (checkoutBtn) checkoutBtn.disabled = true;
    ["cartSubtotal","cartTotal","discountAmount","changeAmount"].forEach(id => {
      const el2 = document.getElementById(id);
      if (el2) el2.textContent = id === "discountAmount" ? "-₱0.00" : "₱0.00";
    });
    const dispEl = document.getElementById("cartTotalDisplay");
    if (dispEl) dispEl.textContent = "0.00";
    return;
  }

  el.innerHTML = cart.map(c => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(c.name)}</div>
        <div class="cart-item-price">₱${c.price.toFixed(2)} each</div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="updateCartQty('${c.id}', -1)">−</button>
        <span class="qty-val">${c.qty}</span>
        <button class="qty-btn" onclick="updateCartQty('${c.id}', 1)">+</button>
      </div>
      <div class="cart-item-total">₱${(c.price * c.qty).toFixed(2)}</div>
      <button class="btn-remove" onclick="removeFromCart('${c.id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>`).join("");

  if (checkoutBtn) checkoutBtn.disabled = false;
  updateCartTotals();
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  renderCart();
}

/* ── DISCOUNT ─────────────────────────────── */
function setDiscType(type) {
  discountType = type;
  document.querySelectorAll(".disc-pill").forEach(p => p.classList.remove("active"));
  const pill = document.getElementById("pill" + type.charAt(0).toUpperCase() + type.slice(1));
  if (pill) pill.classList.add("active");

  const wrap = document.getElementById("discCustomWrap");
  if (type === "custom") { wrap.classList.remove("hidden"); }
  else                   { wrap.classList.add("hidden"); const dp = document.getElementById("discPct"); if (dp) dp.value = ""; }

  updateCartTotals();
}

function updateCartTotals() {
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);

  let pct = 0;
  if (discountType === "senior" || discountType === "pwd") pct = 20;
  else if (discountType === "custom") pct = Math.min(100, Math.max(0, parseFloat(document.getElementById("discPct")?.value) || 0));
  discountPct = pct;

  const discAmt = subtotal * (pct / 100);
  const total   = subtotal - discAmt;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("cartSubtotal",   `₱${subtotal.toFixed(2)}`);
  set("discountAmount", `-₱${discAmt.toFixed(2)}`);
  set("cartTotal",      `₱${total.toFixed(2)}`);
  set("cartTotalDisplay", total.toFixed(2));

  updateChange();
}

function updateChange() {
  const totalEl  = document.getElementById("cartTotal");
  const total    = parseFloat(totalEl?.textContent?.replace("₱", "")) || 0;
  const tendered = parseFloat(document.getElementById("cashTendered")?.value) || 0;
  const change   = tendered - total;
  const display  = document.getElementById("changeDisplay");
  const changeEl = document.getElementById("changeAmount");
  if (!changeEl) return;

  if (tendered === 0) {
    changeEl.textContent = "₱0.00";
    display?.classList.remove("insufficient");
    return;
  }
  if (change < 0) {
    changeEl.textContent = `-₱${Math.abs(change).toFixed(2)}`;
    display?.classList.add("insufficient");
  } else {
    changeEl.textContent = `₱${change.toFixed(2)}`;
    display?.classList.remove("insufficient");
  }
}

/* ── CLEAR CART ───────────────────────────── */
function clearCart() {
  cart        = [];
  discountType = "none";
  discountPct  = 0;

  document.querySelectorAll(".disc-pill").forEach(p => p.classList.remove("active"));
  document.getElementById("pillNone")?.classList.add("active");
  document.getElementById("discCustomWrap")?.classList.add("hidden");
  const ct = document.getElementById("cashTendered");
  if (ct) ct.value = "";

  renderCart();
}

/* ── CHECKOUT ─────────────────────────────── */
async function checkout() {
  if (cart.length === 0) return;

  // Payment method is always Cash — the payment-method selector was
  // removed per requirements (no GCash/Maya/Card/PhilHealth choice).
  const method   = "Cash";
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discAmt  = subtotal * (discountPct / 100);
  const total    = subtotal - discAmt;

  // Cash tendered must be manually typed by the cashier for every sale —
  // there is no auto-filled / quick-cash amount any more.
  const tendered = parseFloat(document.getElementById("cashTendered")?.value) || 0;
  if (tendered < total) { toast("error", "Please enter the cash amount received — it must be at least the total due."); return; }

  // Re-validate stock right before committing — inventory could have
  // changed (another sale, a stock-out) since items were added to cart.
  for (const ci of cart) {
    const avail = inventory.filter(i => i.id === ci.id).reduce((s, i) => s + i.qty, 0);
    if (ci.qty > avail) {
      toast("error", `${ci.name}: only ${avail} left in stock. Please update the cart.`);
      return;
    }
  }

  const txnId    = "TXN" + String(transactions.length + 1).padStart(3, "0");
  const dateStr  = today();
  const timeStr  = new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
  const change   = tendered - total;

  // FIFO deduct inventory
  const touchedBatches = [];
  const newLogEntries  = [];
  cart.forEach(ci => {
    let remaining = ci.qty;
    const batches = inventory.filter(i => i.id === ci.id && i.qty > 0).sort((a, b) => a.batchNo - b.batchNo);
    batches.forEach(b => {
      if (remaining <= 0) return;
      const deduct = Math.min(b.qty, remaining);
      b.qty    -= deduct;
      remaining -= deduct;
      touchedBatches.push(b);
      // Log each batch deduction
      const logId = "LOG" + String(stockLog.length + 1).padStart(3, "0");
      const logEntry = { id: logId, date: dateStr, itemId: ci.id, itemName: ci.name, type: "OUT", qty: deduct, remarks: `POS Sale #${txnId} (Batch #${b.batchNo})`, by: currentUser.name };
      stockLog.push(logEntry);
      newLogEntries.push(logEntry);
    });
  });

  // Cost of goods sold & profit — computed here for the receipt/history
  // record, but NEVER rendered anywhere on the POS screen itself.
  const totalCost = cart.reduce((s, c) => s + (c.cost || 0) * c.qty, 0);
  const profit    = total - totalCost;

  // Save transaction
  const txn = {
    id: txnId, date: dateStr, time: timeStr,
    items: cart.map(c => ({ name: c.name, qty: c.qty, price: c.price, cost: c.cost || 0 })),
    subtotal, discountPct, discAmt, total, cost: totalCost, profit,
    cashTendered: tendered, change,
    cashier: currentUser.name, paymentMethod: method
  };
  transactions.push(txn);

  // Persist to Supabase (if configured) — transaction, the deducted
  // inventory batches, and every stock-log entry created above. This was
  // previously missing entirely, meaning sales were never saved to the
  // database and would vanish on refresh/another device.
  await sbInsertTransaction(txn).catch(() => {});
  await Promise.all(touchedBatches.map(b => sbUpsertInventoryItem(b).catch(() => {})));
  await Promise.all(newLogEntries.map(l => sbInsertStockLog(l).catch(() => {})));

  showReceipt(txn);
  clearCart();
  renderPosGrid();
  renderDailyPanel();
  renderDashboard();
  renderInventory();
  renderStockLog();
  renderTransactions();

  toast("success", `Sale complete! Total: ₱${total.toFixed(2)}${change > 0 ? " · Change: ₱" + change.toFixed(2) : ""}`);
}

/* ── RECEIPT ──────────────────────────────── */
function buildReceiptHTML(t) {
  const discLabel = t.discountPct > 0
    ? (t.discountPct === 20 ? "Senior/PWD 20%" : `Custom ${t.discountPct}%`)
    : null;

  return `<div class="receipt">
    <div class="receipt-header">
      <img src="logo.jpg" alt="Roset Pharmacy" style="width:90px;height:90px;object-fit:contain;margin-bottom:6px;border-radius:8px"/>
      <h2 style="margin:0 0 2px">Roset Pharmacy</h2>
      <p>Malaking Pulo, Tanauan Batangas</p>
      <p style="margin-top:4px">${t.date}${t.time ? " · " + t.time : ""} · ${t.id}</p>
    </div>
    <hr class="receipt-divider"/>
    ${t.items.map(i => `
      <div class="receipt-row"><span>${escapeHtml(i.name)}</span><span>×${i.qty}</span></div>
      <div class="receipt-row" style="color:var(--text-soft)"><span></span><span>₱${(i.price * i.qty).toFixed(2)}</span></div>
    `).join("")}
    <hr class="receipt-divider"/>
    <div class="receipt-row"><span>Subtotal</span><span>₱${(t.subtotal || t.total).toFixed(2)}</span></div>
    ${discLabel ? `<div class="receipt-row" style="color:var(--danger)"><span>Discount (${discLabel})</span><span>-₱${(t.discAmt || 0).toFixed(2)}</span></div>` : ""}
    <div class="receipt-row receipt-total"><span>TOTAL</span><span>₱${t.total.toFixed(2)}</span></div>
    ${t.paymentMethod === "Cash" ? `
      <div class="receipt-row" style="margin-top:6px"><span>Cash Tendered</span><span>₱${(t.cashTendered || 0).toFixed(2)}</span></div>
      <div class="receipt-row" style="font-weight:700;color:var(--teal-dark)"><span>Change</span><span>₱${(t.change || 0).toFixed(2)}</span></div>
    ` : ""}
    <div class="receipt-row" style="margin-top:6px"><span>Payment</span><span>${t.paymentMethod}</span></div>
    <div class="receipt-row"><span>Cashier</span><span>${t.cashier}</span></div>
    <hr class="receipt-divider"/>
    <div class="receipt-footer">Thank you for your purchase!<br>Get well soon 💚</div>
  </div>`;
}

function showReceipt(txn) {
  document.getElementById("receiptBody").innerHTML = buildReceiptHTML(txn);
  openModal("receiptModal");
}

function viewTransaction(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  document.getElementById("viewTxnTitle").textContent = `Transaction — ${t.id}`;
  document.getElementById("viewTxnBody").innerHTML    = buildReceiptHTML(t);
  openModal("viewTxnModal");
}

/* ── DAILY PANEL ──────────────────────────── */
function toggleDailyPanel() {
  dailyPanelOpen = !dailyPanelOpen;
  const body    = document.getElementById("dailyPanelBody");
  const chevron = document.getElementById("dailyChevron");
  if (body)    body.style.display        = dailyPanelOpen ? "block" : "none";
  if (chevron) chevron.style.transform   = dailyPanelOpen ? "" : "rotate(180deg)";
}

function renderDailyPanel() {
  const dateStr    = today();
  const todayTxns  = [...transactions].filter(t => t.date === dateStr).reverse();
  const totalSales = todayTxns.reduce((s, t) => s + t.total, 0);
  const totalDisc  = todayTxns.reduce((s, t) => s + (t.discAmt || 0), 0);
  const txnCount   = todayTxns.length;
  const avgSale    = txnCount > 0 ? totalSales / txnCount : 0;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set("dailyTxnBadge", `${txnCount} sale${txnCount !== 1 ? "s" : ""}`);

  const mini = document.getElementById("dailyMiniStats");
  if (mini) mini.innerHTML = `
    <span style="font-size:13px;font-weight:700;color:var(--green-dark)">₱${totalSales.toFixed(2)}</span>
    <span style="font-size:11px;color:var(--text-soft)">today</span>`;

  const dl = document.getElementById("dailyDateLabel");
  if (dl) dl.textContent = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const sr = document.getElementById("dailyStatRow");
  if (sr) sr.innerHTML = `
    <div class="daily-stat"><div class="daily-stat-val" style="color:var(--green-dark)">₱${totalSales.toFixed(2)}</div><div class="daily-stat-lbl">Total Sales</div></div>
    <div class="daily-stat"><div class="daily-stat-val">${txnCount}</div><div class="daily-stat-lbl">Transactions</div></div>
    <div class="daily-stat"><div class="daily-stat-val" style="color:var(--teal-dark)">₱${avgSale.toFixed(2)}</div><div class="daily-stat-lbl">Avg. Sale</div></div>
    <div class="daily-stat"><div class="daily-stat-val" style="color:var(--danger)">₱${totalDisc.toFixed(2)}</div><div class="daily-stat-lbl">Discounts</div></div>`;

  const list = document.getElementById("dailyTxnList");
  if (!list) return;
  if (todayTxns.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-soft);font-size:13px">No transactions yet today.</div>`;
    return;
  }
  list.innerHTML = todayTxns.map(t => {
    const summary  = t.items.map(i => `${i.name} ×${i.qty}`).join(", ");
    const discTag  = t.discountPct > 0 ? `<span class="tag tag-warn" style="font-size:10px;padding:1px 6px;margin-left:4px">${t.discountPct}% off</span>` : "";
    return `<div class="daily-txn-row" onclick="viewTransaction('${t.id}')">
      <span class="daily-txn-id">${t.id}</span>
      <span class="daily-txn-items">${summary}${discTag}</span>
      <span class="daily-txn-method">${t.paymentMethod}</span>
      <span class="daily-txn-time">${t.time || ""}</span>
      <span class="daily-txn-amt">₱${t.total.toFixed(2)}</span>
    </div>`;
  }).join("");
}
