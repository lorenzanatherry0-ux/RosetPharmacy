/* ══════════════════════════════════════════════
   adjustment.js — Stock Adjustment (table view)
   ──────────────────────────────────────────────
   Table with all items. Search narrows rows.
   Each row has: Item Code | Name | Current Qty
                 | + [adj input] - | New Qty
   One Save button commits all pending changes.
══════════════════════════════════════════════ */

/* Pending adjustments: { itemId: delta (+ or -) } */
let _adjPending = {};

function initAdjustmentPage() {
  // Fill category filter
  const sel = document.getElementById("adjCatFilter");
  if (sel && sel.options.length <= 1) {
    CATEGORIES.forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
  }
  _adjPending = {};
  document.getElementById("adjSearch").value = "";
  if (sel) sel.value = "";
  renderAdjustmentTable();
}

/* ── RENDER TABLE ── */
function renderAdjustmentTable() {
  const q   = (document.getElementById("adjSearch")?.value || "").toLowerCase();
  const cat = document.getElementById("adjCatFilter")?.value || "";

  // One row per unique item ID
  const itemIds = [...new Set(inventory.map(i => i.id))].filter(id => {
    const ref = inventory.find(i => i.id === id);
    if (!ref) return false;
    if (cat && ref.category !== cat) return false;
    if (q && !ref.name.toLowerCase().includes(q) && !id.toLowerCase().includes(q)) return false;
    return true;
  });

  const tbody = document.getElementById("adjTableBody");
  if (!tbody) return;

  if (itemIds.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-soft);font-size:13px">No items found.</td></tr>`;
    return;
  }

  tbody.innerHTML = itemIds.map(id => {
    const batches  = inventory.filter(i => i.id === id).sort((a, b) => a.batchNo - b.batchNo);
    const ref      = batches[0];
    const currentQty = batches.reduce((s, i) => s + i.qty, 0);
    const pending    = _adjPending[id] || 0;
    const newQty     = Math.max(0, currentQty + pending);

    const qtyColor   = currentQty === 0 ? "var(--danger)"
                     : (ref.reorder > 0 && currentQty <= ref.reorder) ? "var(--warn)"
                     : "var(--text)";

    const newColor   = pending === 0 ? "var(--text-soft)"
                     : pending > 0  ? "var(--green-dark)"
                     : "var(--danger)";

    const pendingTag = pending === 0 ? ""
      : `<span style="font-size:11px;font-weight:700;color:${pending>0?"var(--green-dark)":"var(--danger)"}">
           ${pending > 0 ? "+" : ""}${pending}
         </span>`;

    return `<tr class="adj-row" id="adjRow_${id}">
      <td class="adj-td-code"><span class="mono">${id}</span></td>
      <td class="adj-td-name">${escapeHtml(ref.name)}</td>
      <td class="adj-td-qty" style="color:${qtyColor}">${currentQty} <span style="font-size:11px;color:var(--text-soft)">${ref.unit}</span></td>
      <td class="adj-td-ctrl">
        <div class="adj-stepper-row">
          <button class="adj-btn adj-btn-minus" onclick="adjDelta('${id}', -1)">−</button>
          <input  class="adj-num-input" id="adjInput_${id}"
                  type="number" value="${pending === 0 ? "" : pending}"
                  placeholder="0"
                  oninput="adjInputChange('${id}', this.value)"/>
          <button class="adj-btn adj-btn-plus"  onclick="adjDelta('${id}', +1)">+</button>
        </div>
      </td>
      <td class="adj-td-new" style="color:${newColor};font-weight:700">
        ${pending !== 0 ? newQty : `<span style="color:var(--text-soft)">—</span>`}
        ${pendingTag}
      </td>
    </tr>`;
  }).join("");
}

/* ── DELTA via +/- buttons ── */
function adjDelta(id, delta) {
  const batches    = inventory.filter(i => i.id === id);
  const currentQty = batches.reduce((s, i) => s + i.qty, 0);
  const prev       = _adjPending[id] || 0;
  const next       = prev + delta;

  // Don't allow removing more than what's in stock
  if (currentQty + next < 0) return;

  if (next === 0) delete _adjPending[id];
  else            _adjPending[id] = next;

  _refreshRow(id);
  _updateSaveBtn();
}

/* ── DIRECT INPUT ── */
function adjInputChange(id, raw) {
  const val        = parseInt(raw);
  const batches    = inventory.filter(i => i.id === id);
  const currentQty = batches.reduce((s, i) => s + i.qty, 0);

  if (isNaN(val) || val === 0) {
    delete _adjPending[id];
  } else {
    // Clamp: can't remove more than stock
    const clamped = Math.max(-currentQty, val);
    _adjPending[id] = clamped;
  }
  _refreshRow(id);
  _updateSaveBtn();
}

/* ── Refresh a single row in-place (fast, no full re-render) ── */
function _refreshRow(id) {
  const batches    = inventory.filter(i => i.id === id).sort((a, b) => a.batchNo - b.batchNo);
  const ref        = batches[0];
  const currentQty = batches.reduce((s, i) => s + i.qty, 0);
  const pending    = _adjPending[id] || 0;
  const newQty     = Math.max(0, currentQty + pending);

  const newCell  = document.querySelector(`#adjRow_${id} .adj-td-new`);
  const qtyCell  = document.querySelector(`#adjRow_${id} .adj-td-qty`);
  const input    = document.getElementById(`adjInput_${id}`);

  if (input && document.activeElement !== input) {
    input.value = pending === 0 ? "" : pending;
  }

  const newColor = pending === 0 ? "var(--text-soft)"
                 : pending > 0  ? "var(--green-dark)"
                 : "var(--danger)";

  const pendingTag = pending === 0 ? ""
    : `<span style="font-size:11px;font-weight:700;color:${pending>0?"var(--green-dark)":"var(--danger)"}">
         ${pending > 0 ? "+" : ""}${pending}
       </span>`;

  if (newCell) {
    newCell.style.color      = newColor;
    newCell.style.fontWeight = pending !== 0 ? "700" : "400";
    newCell.innerHTML = pending !== 0
      ? `${newQty} ${pendingTag}`
      : `<span style="color:var(--text-soft)">—</span>`;
  }

  // Highlight the row if it has a pending change
  const row = document.getElementById(`adjRow_${id}`);
  if (row) row.classList.toggle("adj-row-pending", pending !== 0);
}

/* ── Update Save button badge ── */
function _updateSaveBtn() {
  const count  = Object.keys(_adjPending).length;
  const btn    = document.getElementById("adjSaveBtn");
  const badge  = document.getElementById("adjSaveBadge");
  if (!btn) return;
  btn.disabled = count === 0;
  if (badge) badge.textContent = count > 0 ? `${count} change${count>1?"s":""}` : "";
}

/* ── SAVE ALL ── */
async function saveAllAdjustments() {
  const entries = Object.entries(_adjPending);
  if (entries.length === 0) return;

  const dateStr = today();
  let saved = 0;

  for (const [id, delta] of entries) {
    const batches    = inventory.filter(i => i.id === id).sort((a, b) => a.batchNo - b.batchNo);
    if (batches.length === 0) continue;
    const itemName   = batches[0].name;
    const currentQty = batches.reduce((s, i) => s + i.qty, 0);

    if (delta < 0) {
      // FIFO remove
      let remaining = Math.abs(delta);
      for (const b of batches) {
        if (remaining <= 0) break;
        const take = Math.min(b.qty, remaining);
        b.qty     -= take;
        remaining -= take;
        await sbUpsertInventoryItem(b).catch(() => {});
      }
    } else {
      // Add to last batch
      const last = batches[batches.length - 1];
      last.qty  += delta;
      await sbUpsertInventoryItem(last).catch(() => {});
    }

    // Stock log
    const logId = "LOG" + String(stockLog.length + 1).padStart(3, "0");
    stockLog.push({
      id: logId, date: dateStr,
      itemId: id, itemName,
      type:    delta > 0 ? "IN" : "OUT",
      qty:     Math.abs(delta),
      remarks: "Stock adjustment",
      by:      currentUser.name,
    });
    await sbInsertStockLog(stockLog[stockLog.length - 1]).catch(() => {});
    saved++;
  }

  _adjPending = {};
  toast("success", `${saved} adjustment${saved > 1 ? "s" : ""} saved.`);
  renderAdjustmentTable();
  _updateSaveBtn();
  renderDashboard();
  renderInventory();
}
