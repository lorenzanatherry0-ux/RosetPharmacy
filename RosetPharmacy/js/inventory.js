/* ══════════════════════════════════════════════
   inventory.js — Inventory management, FIFO batches
══════════════════════════════════════════════ */

/* ── RENDER TABLE ─────────────────────────── */
function renderInventory() {
  const q   = (document.getElementById("invSearch")?.value || "").toLowerCase();
  const cat = document.getElementById("invCatFilter")?.value || "";

  let rows = inventory.filter(i =>
    (!q   || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)) &&
    (!cat || i.category === cat)
  );

  rows.sort((a, b) => a.id.localeCompare(b.id) || a.batchNo - b.batchNo);

  const tbody = document.getElementById("inventoryTable");
  if (!tbody) return;
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-soft)">No items found.</td></tr>`;
    return;
  }

  let prevId = null;
  tbody.innerHTML = rows.map((i, idx) => {
    const isOut      = i.qty === 0;
    const rowClass   = isOut ? "critical-stock" : "";

    let status = `<span class="tag tag-green">In Stock</span>`;
    if (isOut) status = `<span class="tag tag-red">Out of Stock</span>`;

    const itemBatches = inventory.filter(x => x.id === i.id).sort((a, b) => a.batchNo - b.batchNo);
    const isOldest    = itemBatches.find(b => b.qty > 0)?.batchNo === i.batchNo;
    const fifoBadge   = isOldest
      ? `<span class="tag tag-teal" style="font-size:10px">▶ Next Out</span>`
      : `<span class="tag tag-gray" style="font-size:10px">Batch #${i.batchNo}</span>`;

    const isSameGroup = i.id === prevId;
    const borderTop   = (!isSameGroup && idx > 0) ? "border-top:2px solid var(--border)" : "";
    prevId = i.id;

    return `<tr class="${rowClass}" style="${borderTop}">
      <td><span class="mono" style="font-size:12px">${i.id}</span></td>
      <td style="font-weight:600">${escapeHtml(i.name)}${isSameGroup ? ` <span style="font-size:11px;color:var(--text-soft)">(batch)</span>` : ""}</td>
      <td><span class="tag tag-teal">${i.category}</span></td>
      <td style="font-weight:700;${isOut ? "color:var(--danger)" : ""}">${i.qty}</td>
      <td>${i.unit}</td>
      <td style="font-weight:600">₱${i.price.toFixed(2)}</td>
      <td style="font-size:12px;color:var(--text-soft)">${i.dateAdded || "—"}</td>
      <td>${fifoBadge}</td>
      <td>${status}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="openEditItemModal('${i.id}', ${i.batchNo})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDeleteItem('${i.id}', ${i.batchNo})">Del</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

/* ── OPEN MODALS ──────────────────────────── */
function openAddItemModal() {
  document.getElementById("itemModalTitle").textContent = "Add New Item";
  document.getElementById("editItemId").value = "";

  // Auto-generate the next sequential item code so the manager never
  // has to think about it — just keep adding items and codes increment.
  const autoCode = nextItemCode();
  ["fItemName", "fItemQty", "fItemUnit", "fItemPrice", "fItemCost", "fItemReorder"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const codeEl = document.getElementById("fItemCode");
  if (codeEl) {
    codeEl.value    = autoCode;
    codeEl.readOnly = false;   // editable in case the manager wants a custom code
  }
  document.getElementById("newBatchRow")?.classList.add("hidden");
  openModal("itemModal");
}

function openEditItemModal(id, batchNo) {
  const item = inventory.find(i => i.id === id && i.batchNo === batchNo);
  if (!item) return;

  document.getElementById("itemModalTitle").textContent  = "Edit Item Batch";
  document.getElementById("editItemId").value            = `${id}::${batchNo}`;
  document.getElementById("fItemCode").value             = item.id;
  document.getElementById("fItemCode").readOnly          = true;
  document.getElementById("fItemName").value             = item.name;
  document.getElementById("fItemQty").value              = item.qty;
  document.getElementById("fItemUnit").value             = item.unit;
  document.getElementById("fItemPrice").value            = item.price;
  document.getElementById("fItemCost").value             = item.cost ?? "";
  document.getElementById("fItemCat").value              = item.category;
  document.getElementById("fItemReorder").value          = item.reorder ?? "";

  const nb = document.getElementById("newBatchRow");
  if (nb) {
    nb.classList.remove("hidden");
    document.getElementById("isNewStockBatch").checked = false;
  }
  openModal("itemModal");
}

/* ── SAVE ITEM ────────────────────────────── */
async function saveItem() {
  const editRowKey  = document.getElementById("editItemId").value;
  let   code        = document.getElementById("fItemCode").value.trim();
  const name        = document.getElementById("fItemName").value.trim();
  const cat         = document.getElementById("fItemCat").value;
  const qty         = parseInt(document.getElementById("fItemQty").value)    || 0;
  const unit        = document.getElementById("fItemUnit").value.trim();
  const price       = parseFloat(document.getElementById("fItemPrice").value) || 0;
  const cost        = parseFloat(document.getElementById("fItemCost").value)  || 0;
  const reorder     = parseInt(document.getElementById("fItemReorder").value) || 0;
  const isNewBatch  = document.getElementById("isNewStockBatch")?.checked;

  // Only the item name is truly required — everything else (code, unit,
  // price, cost, reorder level, quantity) can be filled in or adjusted
  // later. This makes it easy to bulk-copy a plain item list from another
  // system and clean up the details afterward.
  if (!name) { toast("error", "Item name is required."); return; }
  if (!editRowKey && !code) code = nextItemCode();

  if (!editRowKey) {
    if (inventory.find(i => i.id === code)) { toast("error", "Item code already exists. Use Restock to add more stock."); return; }
    const newItem = { id: code, name, category: cat, qty, unit, price, cost, reorder, dateAdded: today(), batchNo: 1 };
    inventory.push(newItem);
    await sbUpsertInventoryItem(newItem).catch(() => {});
    if (qty > 0) {
      const logId = "LOG" + String(stockLog.length + 1).padStart(3, "0");
      const logEntry = { id: logId, date: today(), itemId: code, itemName: name, type: "IN", qty, remarks: "Initial stock entry", by: currentUser.name };
      stockLog.push(logEntry);
      await sbInsertStockLog(logEntry).catch(() => {});
    }
    toast("success", "Item added successfully.");
  } else {
    const [editId, editBatch] = editRowKey.split("::");
    const batchNum = parseInt(editBatch);

    if (isNewBatch) {
      const existing = inventory.filter(i => i.id === editId);
      const maxBatch = existing.reduce((m, i) => Math.max(m, i.batchNo), 0);
      const newBatch = { id: editId, name, category: cat, qty, unit, price, cost, reorder, dateAdded: today(), batchNo: maxBatch + 1 };
      inventory.push(newBatch);
      const logId = "LOG" + String(stockLog.length + 1).padStart(3, "0");
      const logEntry = { id: logId, date: today(), itemId: editId, itemName: name, type: "IN", qty, remarks: `New stock batch #${maxBatch + 1}`, by: currentUser.name };
      stockLog.push(logEntry);
      await sbUpsertInventoryItem(newBatch).catch(() => {});
      await sbInsertStockLog(logEntry).catch(() => {});
      toast("success", `New stock batch added for ${name}.`);
    } else {
      const idx = inventory.findIndex(i => i.id === editId && i.batchNo === batchNum);
      if (idx > -1) {
        inventory[idx] = { ...inventory[idx], name, category: cat, unit, price, cost, reorder };
        await sbUpsertInventoryItem(inventory[idx]).catch(() => {});
        toast("success", "Item details updated. Quantity unchanged.");
      }
    }
  }

  closeModal("itemModal");
  renderInventory();
  renderPosGrid();
  renderDashboard();
  populateStockItemSelect();
}

/* ── DELETE ───────────────────────────────── */
function confirmDeleteItem(id, batchNo) {
  const item = inventory.find(i => i.id === id && i.batchNo === batchNo);
  document.getElementById("confirmMsg").textContent = `Delete batch #${batchNo} of "${item?.name}" (Qty: ${item?.qty})? This cannot be undone.`;
  document.getElementById("confirmOkBtn").onclick = () => { deleteItem(id, batchNo); closeModal("confirmModal"); };
  openModal("confirmModal");
}

async function deleteItem(id, batchNo) {
  inventory = inventory.filter(i => !(i.id === id && i.batchNo === batchNo));
  await sbDeleteInventoryBatch(id, batchNo).catch(() => {});
  renderInventory();
  renderPosGrid();
  renderDashboard();
  toast("success", "Item batch deleted.");
}
