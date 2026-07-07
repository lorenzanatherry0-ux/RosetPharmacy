/* ══════════════════════════════════════════════
   adjustment.js — Quick Stock Adjustment
   ──────────────────────────────────────────────
   Purpose: let a pharmacist/manager nudge the
   stock count up or down without going through
   a full Restock modal.  Use cases:
     • Customer returned an item
     • Mis-count found during stock check
     • Damaged/spoiled unit removal
   No mandatory reason required — just type an
   optional note, hit + or –, done.
══════════════════════════════════════════════ */

/* ── POPULATE FILTER + RENDER ON NAVIGATE ── */
function initAdjustmentPage() {
  // Fill category dropdown
  const sel = document.getElementById("adjCatFilter");
  if (sel && sel.options.length <= 1) {
    CATEGORIES.forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
  }
  document.getElementById("adjSearch").value = "";
  renderAdjustmentGrid();
}

/* ── RENDER CARDS ── */
function renderAdjustmentGrid() {
  const q   = (document.getElementById("adjSearch")?.value || "").toLowerCase();
  const cat = document.getElementById("adjCatFilter")?.value || "";

  // One card per unique item ID (aggregated across batches)
  const itemIds = [...new Set(inventory.map(i => i.id))].filter(id => {
    const batches = inventory.filter(i => i.id === id);
    const ref     = batches[0];
    if (cat && ref.category !== cat) return false;
    if (q && !ref.name.toLowerCase().includes(q) && !id.toLowerCase().includes(q)) return false;
    return true;
  });

  const grid = document.getElementById("adjGrid");
  if (!grid) return;

  if (itemIds.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-soft);font-size:14px">No items found.</div>`;
    return;
  }

  grid.innerHTML = itemIds.map(id => {
    const batches  = inventory.filter(i => i.id === id).sort((a, b) => a.batchNo - b.batchNo);
    const ref      = batches[0];
    const totalQty = batches.reduce((s, i) => s + i.qty, 0);
    const isOut    = totalQty === 0;
    const isLow    = !isOut && ref.reorder > 0 && totalQty <= ref.reorder;

    const qtyColor = isOut  ? "var(--danger)"
                   : isLow  ? "var(--warn)"
                   : "var(--green-dark)";
    const statusTag = isOut
      ? `<span class="tag tag-red" style="font-size:10px">Out</span>`
      : isLow
        ? `<span class="tag tag-warn" style="font-size:10px">Low</span>`
        : `<span class="tag tag-green" style="font-size:10px">In Stock</span>`;

    return `
      <div class="adj-card" id="adjCard_${id}">
        <div class="adj-card-top">
          <div style="min-width:0">
            <div class="adj-item-name">${escapeHtml(ref.name)}</div>
            <div class="adj-item-meta">
              <span class="mono" style="font-size:11px">${id}</span>
              <span class="tag tag-teal" style="font-size:10px">${ref.category}</span>
              ${statusTag}
            </div>
          </div>
          <div class="adj-qty-block">
            <div class="adj-qty-val" style="color:${qtyColor}">${totalQty}</div>
            <div class="adj-qty-unit">${ref.unit}</div>
          </div>
        </div>

        <div class="adj-controls">
          <div class="adj-stepper">
            <button class="adj-btn adj-btn-minus" onclick="adjStep('${id}', -1)">−</button>
            <input type="number" class="adj-input" id="adjQty_${id}" value="1" min="1" max="9999"/>
            <button class="adj-btn adj-btn-plus"  onclick="adjStep('${id}', +1)">+</button>
          </div>
          <input type="text" class="adj-note" id="adjNote_${id}"
            placeholder="Note (optional)…" maxlength="120"/>
        </div>

        <div class="adj-actions">
          <button class="adj-apply-btn adj-apply-remove" onclick="applyAdjustment('${id}', 'remove')"
            title="Remove from stock (spoilage, damage, correction)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Remove
          </button>
          <button class="adj-apply-btn adj-apply-add" onclick="applyAdjustment('${id}', 'add')"
            title="Add to stock (return, found stock, correction)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add
          </button>
        </div>
      </div>`;
  }).join("");
}

/* ── STEPPER: typing a qty directly into the input ── */
function adjStep(id, delta) {
  const input = document.getElementById(`adjQty_${id}`);
  if (!input) return;
  const current = parseInt(input.value) || 1;
  input.value = Math.max(1, current + delta);
}

/* ── APPLY ADJUSTMENT ── */
async function applyAdjustment(id, direction) {
  const qtyInput  = document.getElementById(`adjQty_${id}`);
  const noteInput = document.getElementById(`adjNote_${id}`);
  const qty       = parseInt(qtyInput?.value) || 0;
  const note      = (noteInput?.value || "").trim();

  if (qty <= 0) { toast("warn", "Quantity must be at least 1."); return; }

  const batches   = inventory.filter(i => i.id === id).sort((a, b) => a.batchNo - b.batchNo);
  if (batches.length === 0) { toast("error", "Item not found."); return; }

  const itemName  = batches[0].name;
  const totalQty  = batches.reduce((s, i) => s + i.qty, 0);
  const dateStr   = today();
  const autoNote  = note || (direction === "add" ? "Stock adjustment — added" : "Stock adjustment — removed");

  if (direction === "remove") {
    if (qty > totalQty) {
      toast("error", `Cannot remove ${qty}. Only ${totalQty} ${batches[0].unit}(s) in stock.`);
      return;
    }
    // FIFO deduct
    let remaining = qty;
    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(b.qty, remaining);
      b.qty     -= take;
      remaining -= take;
      await sbUpsertInventoryItem(b).catch(() => {});
    }
  } else {
    // Add to the most recent batch (last one — keeps FIFO clean)
    const lastBatch = batches[batches.length - 1];
    lastBatch.qty  += qty;
    await sbUpsertInventoryItem(lastBatch).catch(() => {});
  }

  // Stock log entry
  const logId    = "LOG" + String(stockLog.length + 1).padStart(3, "0");
  const logEntry = {
    id: logId, date: dateStr,
    itemId: id, itemName,
    type:    direction === "add" ? "IN" : "OUT",
    qty,
    remarks: autoNote,
    by:      currentUser.name,
  };
  stockLog.push(logEntry);
  await sbInsertStockLog(logEntry).catch(() => {});

  // Reset card inputs
  if (qtyInput)  qtyInput.value  = "1";
  if (noteInput) noteInput.value = "";

  // Flash feedback on the card
  const card = document.getElementById(`adjCard_${id}`);
  if (card) {
    card.classList.add(direction === "add" ? "adj-flash-add" : "adj-flash-remove");
    setTimeout(() => card.classList.remove("adj-flash-add", "adj-flash-remove"), 700);
  }

  toast("success",
    direction === "add"
      ? `+${qty} added to ${itemName}`
      : `−${qty} removed from ${itemName}`
  );

  // Re-render this card and refresh dashboard counts
  renderAdjustmentGrid();
  renderDashboard();
  renderInventory();
}
