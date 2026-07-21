/* ══════════════════════════════════════════════
   stocklog.js — Stock movements log, transactions,
                 and unified Restock modal
══════════════════════════════════════════════ */

/* ── STOCK LOG ────────────────────────────── */
function renderStockLog() {
  const q    = (document.getElementById("logSearch")?.value || "").toLowerCase();
  const type = document.getElementById("logTypeFilter")?.value || "";

  const logs = [...stockLog].reverse().filter(l =>
    (!q    || l.itemName.toLowerCase().includes(q) || l.id.toLowerCase().includes(q) || l.remarks.toLowerCase().includes(q)) &&
    (!type || l.type === type)
  );

  const tbody = document.getElementById("stockLogTable");
  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-soft)">No entries found.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(l => `
    <tr>
      <td><span class="mono" style="font-size:12px">${l.id}</span></td>
      <td>${l.date}</td>
      <td><span class="mono" style="font-size:12px">${l.itemId}</span></td>
      <td style="font-weight:500">${escapeHtml(l.itemName)}</td>
      <td><span class="tag ${l.type === "IN" ? "tag-green" : "tag-red"}">${l.type === "IN" ? "↑ IN" : "↓ OUT"}</span></td>
      <td style="font-weight:700">${l.qty}</td>
      <td style="color:var(--text-mid);font-size:12.5px">${escapeHtml(l.remarks)}</td>
      <td>${l.by}</td>
    </tr>`).join("");
}

/* ══════════════════════════════════════════════
   UNIFIED RESTOCK MODAL
   • Stock IN  — type item code → autofills name/unit/category/price
                 → edit price if needed → qty → live total shown
   • Stock OUT — same code lookup, no price/total shown
══════════════════════════════════════════════ */

function openStockModal() {
  // Reset all fields
  document.getElementById("fStockDate").value    = today();
  document.getElementById("fStockType").value    = "IN";
  document.getElementById("fStockCode").value    = "";
  document.getElementById("fStockName").value    = "";
  document.getElementById("fStockUnit").value    = "";
  document.getElementById("fStockQty").value     = "";
  document.getElementById("fStockPrice").value   = "";
  document.getElementById("fStockCost").value    = "";
  document.getElementById("fStockRemarks").value = "";

  // Reset UI state
  _stockSetStatus("idle");
  _stockUpdateTypeUI("IN");

  // Build datalist for item-name autocomplete (search is name-driven)
  _buildStockNameDatalist();

  openModal("stockModal");
}

/* Populate datalist with all known item names (search is now driven by
   Item Name — Item Code remains visible as a read-only identifier next to
   it, but is no longer what the cashier/manager types to find an item). */
function _buildStockNameDatalist() {
  const dl = document.getElementById("stockNameList");
  if (!dl) return;
  const seen = new Set();
  dl.innerHTML = "";
  inventory.forEach(it => {
    if (!seen.has(it.id)) {
      seen.add(it.id);
      const o = document.createElement("option");
      o.value = it.name;
      o.label = it.id;
      dl.appendChild(o);
    }
  });
}

/* Called on every keystroke in the Item Name field (now the primary
   search/edit field for restocking — Item Code is auto-filled and kept
   read-only purely for identification). */
function onStockNameInput(raw) {
  const typed  = raw.trim();
  const nameEl = document.getElementById("fStockName");
  if (nameEl) nameEl.value = raw;

  // Clear computed fields first
  document.getElementById("fStockCode").value = "";
  document.getElementById("fStockUnit").value = "";
  _stockComputeTotal();

  if (!typed) { _stockSetStatus("idle"); return; }

  // Match by exact name (case-insensitive) — the datalist suggests exact
  // names, so once the cashier picks/types a real name this resolves to
  // exactly one item, the same way code-matching used to.
  const match = inventory.find(i => i.name.toLowerCase() === typed.toLowerCase());
  if (!match) {
    _stockSetStatus("notfound");
    return;
  }

  // Autofill
  document.getElementById("fStockCode").value = match.id;
  document.getElementById("fStockUnit").value = match.unit;

  // Pre-fill price/cost only if empty (let user change it)
  const priceEl = document.getElementById("fStockPrice");
  if (priceEl && !priceEl.value) priceEl.value = match.price.toFixed(2);
  const costEl = document.getElementById("fStockCost");
  if (costEl && !costEl.value) costEl.value = (match.cost ?? 0).toFixed(2);

  _stockSetStatus("found", match);
  _stockComputeTotal();
}

/* Status indicator: idle | found | notfound */
function _stockSetStatus(state, match) {
  const icon    = document.getElementById("fStockNameIcon");
  const banner  = document.getElementById("fStockInfoBanner");
  const priceRow = document.getElementById("fStockPriceRow");
  const totalBox = document.getElementById("fStockTotalBox");

  if (state === "idle") {
    if (icon) icon.textContent = "";
    if (banner) banner.style.display = "none";
    _stockComputeTotal();
    return;
  }

  if (state === "notfound") {
    if (icon) icon.textContent = "❓";
    if (banner) {
      banner.style.display = "";
      banner.style.background  = "var(--danger-light)";
      banner.style.borderColor = "var(--danger)";
      banner.style.color       = "var(--danger)";
      banner.textContent = "No item with that name found in inventory. Use “Add Item” to create a new item first.";
    }
    if (totalBox) totalBox.style.display = "none";
    return;
  }

  // found
  if (icon) icon.textContent = "✅";
  const totalQty = inventory.filter(i => i.id === match.id).reduce((s, i) => s + i.qty, 0);
  if (banner) {
    banner.style.display    = "";
    banner.style.background  = "var(--teal-light)";
    banner.style.borderColor = "var(--teal)";
    banner.style.color       = "var(--teal-dark)";
    banner.innerHTML = `📦 <strong>${match.unit}</strong> &nbsp;·&nbsp; ${match.category} &nbsp;·&nbsp; Current stock: <strong>${totalQty} ${match.unit}(s)</strong>`;
  }
}

/* Show/hide price+total depending on IN vs OUT */
function onStockTypeChange() {
  const type = document.getElementById("fStockType")?.value;
  _stockUpdateTypeUI(type);
  _stockComputeTotal();
}

function _stockUpdateTypeUI(type) {
  const priceRow  = document.getElementById("fStockPriceRow");
  const costRow   = document.getElementById("fStockCostRow");
  const totalBox  = document.getElementById("fStockTotalBox");
  const qtyLabel  = document.getElementById("fStockQtyLabel");

  if (type === "OUT") {
    if (priceRow)  priceRow.style.display  = "none";
    if (costRow)   costRow.style.display   = "none";
    if (totalBox)  totalBox.style.display  = "none";
    if (qtyLabel)  qtyLabel.textContent    = "Quantity to Remove";
  } else {
    if (priceRow)  priceRow.style.display  = "";
    if (costRow)   costRow.style.display   = "";
    if (qtyLabel)  qtyLabel.textContent    = "Quantity Received";
    _stockComputeTotal();
  }
}

/* Live total = qty × price */
function _stockComputeTotal() {
  const type  = document.getElementById("fStockType")?.value;
  const box   = document.getElementById("fStockTotalBox");
  if (type !== "IN") { if (box) box.style.display = "none"; return; }

  const qty   = parseFloat(document.getElementById("fStockQty")?.value)   || 0;
  const price = parseFloat(document.getElementById("fStockPrice")?.value) || 0;
  const unit  = document.getElementById("fStockUnit")?.value || "unit";
  const total = qty * price;

  const formula = document.getElementById("fStockFormula");
  const amt     = document.getElementById("fStockTotalAmt");

  if (qty > 0 && price > 0) {
    if (box)     box.style.display = "";
    if (formula) formula.textContent = `${qty} ${unit}(s)  ×  ₱${price.toFixed(2)}`;
    if (amt)     amt.textContent    = `₱${total.toFixed(2)}`;
  } else {
    if (box) box.style.display = "none";
  }
}

/* Save the movement */
async function saveStockMovement() {
  const type    = document.getElementById("fStockType").value;
  const date    = document.getElementById("fStockDate").value;
  const code    = (document.getElementById("fStockCode")?.value || "").trim().toUpperCase();
  const qty     = parseInt(document.getElementById("fStockQty").value) || 0;
  const remarks = document.getElementById("fStockRemarks").value.trim();

  if (!code)     { toast("error", "Please select a valid item by name first."); return; }
  if (qty <= 0)  { toast("error", "Quantity must be greater than 0."); return; }

  const itemBatches = inventory.filter(i => i.id === code).sort((a, b) => a.batchNo - b.batchNo);
  if (itemBatches.length === 0) { toast("error", `Item "${code}" not found.`); return; }

  if (type === "OUT") {
    const totalQty = itemBatches.reduce((s, i) => s + i.qty, 0);
    if (qty > totalQty) { toast("error", `Cannot remove ${qty}. Only ${totalQty} in stock.`); return; }
    let remaining = qty;
    itemBatches.forEach(b => {
      if (remaining <= 0) return;
      const deduct = Math.min(b.qty, remaining);
      b.qty       -= deduct;
      remaining   -= deduct;
    });
  } else {
    // Stock IN — new FIFO batch with potentially updated price/cost
    const newPrice  = parseFloat(document.getElementById("fStockPrice")?.value) || itemBatches[0].price;
    const newCost   = parseFloat(document.getElementById("fStockCost")?.value);
    const maxBatch  = itemBatches.reduce((m, i) => Math.max(m, i.batchNo), 0);
    const ref       = itemBatches[0];

    const newBatch = {
      id: ref.id, name: ref.name, category: ref.category, unit: ref.unit,
      price: newPrice, cost: !isNaN(newCost) ? newCost : (ref.cost ?? 0),
      qty, dateAdded: date, batchNo: maxBatch + 1
    };
    inventory.push(newBatch);
    await sbUpsertInventoryItem(newBatch).catch(() => {});
  }

  const finalRemarks = remarks || (type === "IN" ? "Restock delivery" : "Manual stock out");
  const logEntry = {
    id: "LOG" + String(stockLog.length + 1).padStart(3, "0"),
    date, itemId: code, itemName: itemBatches[0].name,
    type, qty, remarks: finalRemarks, by: currentUser.name
  };
  stockLog.push(logEntry);
  await sbInsertStockLog(logEntry).catch(() => {});

  closeModal("stockModal");
  renderStockLog();
  renderInventory();
  renderPosGrid();
  renderDashboard();
  toast("success", `Stock ${type} recorded for ${itemBatches[0].name}.`);
}

/* ── TRANSACTIONS ─────────────────────────────────────────
   Daily-reset view: by default this only shows the selected date's
   transactions (defaults to "today" on login — see initTransactionsView()
   in auth.js). A date picker lets the manager pull up any previous day,
   and "All Dates" clears the filter to show full history.
   Profit is shown ONLY here — never on the POS screen. ───────────────── */
function renderTransactions() {
  const q          = (document.getElementById("txnSearch")?.value || "").toLowerCase();
  const dateFilter = document.getElementById("txnDateFilter")?.value || "";

  let txns = [...transactions].reverse();
  if (dateFilter) txns = txns.filter(t => t.date === dateFilter);
  txns = txns.filter(t =>
    !q ||
    t.id.toLowerCase().includes(q) ||
    t.cashier.toLowerCase().includes(q) ||
    t.paymentMethod.toLowerCase().includes(q) ||
    t.items.some(i => i.name.toLowerCase().includes(q))
  );

  // Summary strip for the current filtered view (revenue + profit)
  const sumEl = document.getElementById("txnSummary");
  if (sumEl) {
    const rev    = txns.reduce((s, t) => s + t.total, 0);
    const profit = txns.reduce((s, t) => s + (t.profit ?? 0), 0);
    sumEl.innerHTML = txns.length === 0 ? "" : `
      <span><strong>${txns.length}</strong> transaction${txns.length !== 1 ? "s" : ""}</span>
      <span>Revenue: <strong style="color:var(--green-dark)">₱${rev.toFixed(2)}</strong></span>
      <span>Profit: <strong style="color:var(--teal-dark)">₱${profit.toFixed(2)}</strong></span>`;
  }

  const tbody = document.getElementById("transactionTable");
  if (!tbody) return;

  if (txns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-soft)">No transactions ${dateFilter ? "for " + formatDisplayDate(dateFilter) : "yet"}.</td></tr>`;
    return;
  }

  tbody.innerHTML = txns.map(t => {
    const discTag = t.discountPct > 0 ? `<span class="tag tag-warn" style="font-size:10px;margin-left:4px">${t.discountPct}% off</span>` : "";
    const profit  = t.profit ?? 0;
    return `<tr>
      <td><span class="mono" style="font-size:12px;font-weight:600">${t.id}</span></td>
      <td>${t.date}${t.time ? `<br><span style="font-size:11px;color:var(--text-soft)">${t.time}</span>` : ""}</td>
      <td style="font-size:12.5px;color:var(--text-mid)">${t.items.map(i => `${escapeHtml(i.name)} ×${i.qty}`).join(", ")}</td>
      <td style="font-weight:700;color:var(--green-dark)">₱${t.total.toFixed(2)}${discTag}</td>
      <td style="font-weight:700;color:var(--teal-dark)">₱${profit.toFixed(2)}</td>
      <td><span class="tag tag-teal">${t.paymentMethod}</span></td>
      <td>${t.cashier}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="viewTransaction('${t.id}')">View</button></td>
    </tr>`;
  }).join("");
}

/* Date-picker controls for the Transaction History page */
function onTxnDateInputChange() {
  const el = document.getElementById("txnDateFilter");
  if (el) el.dataset.userCleared = el.value ? "0" : "1";
  renderTransactions();
}
function setTxnDateToday() {
  const el = document.getElementById("txnDateFilter");
  if (el) { el.value = today(); delete el.dataset.userCleared; }
  renderTransactions();
}
function clearTxnDateFilter() {
  const el = document.getElementById("txnDateFilter");
  if (el) { el.value = ""; el.dataset.userCleared = "1"; }
  renderTransactions();
}
