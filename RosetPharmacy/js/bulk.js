/* ══════════════════════════════════════════════
   bulk.js — Bulk Add + Restock (spreadsheet-style)
   
   Two modes:
   ① "New Items"  — add brand-new medicines to inventory
   ② "Restock"    — add stock to EXISTING items (batch IN)

   Both support:
   • Manual row entry
   • CSV paste / file upload
══════════════════════════════════════════════ */

let bulkRows         = [];
let bulkRowIdCounter = 0;
let bulkMode         = "new";   // "new" | "restock"

/* ══════════════════════════════════════════════
   AUTO-CODE GENERATOR
══════════════════════════════════════════════ */
function nextItemCode() {
  const existing = inventory.map(i => i.id)
    .filter(id => /^MED\d+$/.test(id))
    .map(id => parseInt(id.replace("MED", "")))
    .filter(n => !isNaN(n));
  bulkRows.forEach(r => {
    const el = document.getElementById(`bCode_${r}`);
    if (el && /^MED\d+$/.test(el.value.trim()))
      existing.push(parseInt(el.value.trim().replace("MED", "")));
  });
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return "MED" + String(max + 1).padStart(3, "0");
}

/* ══════════════════════════════════════════════
   OPEN MODAL
══════════════════════════════════════════════ */
function openBulkAddModal() {
  bulkMode = "new";
  _bulkReset();
  _updateModeUI();
  openModal("bulkAddModal");
}

function openBulkRestockModal() {
  bulkMode = "restock";
  _bulkReset();
  _updateModeUI();
  openModal("bulkAddModal");
}

function _bulkReset() {
  bulkRows         = [];
  bulkRowIdCounter = 0;
  document.getElementById("bulkTableBody").innerHTML = "";
  document.getElementById("bulkErrorBar").classList.add("hidden");
  _hideCsvPane();
  for (let i = 0; i < 5; i++) bulkAddRow();
  updateBulkCounts();
}

function setBulkMode(mode) {
  bulkMode = mode;
  _bulkReset();
  _updateModeUI();
}

function _updateModeUI() {
  const isRestock = bulkMode === "restock";

  // Tab pills
  document.querySelectorAll(".bulk-mode-tab").forEach(t =>
    t.classList.toggle("active", t.dataset.mode === bulkMode)
  );

  // Title + subtitle
  document.getElementById("bulkModalTitle").textContent =
    isRestock ? "Bulk Restock Existing Items" : "Bulk Add New Items";
  document.getElementById("bulkModalSub").textContent =
    isRestock
      ? "Enter item codes and quantities to replenish existing stock."
      : "Fill in rows below to add new medicines to inventory.";

  // Table header
  document.getElementById("bulkColHeaders").innerHTML = isRestock
    ? _restockHeaders()
    : _newItemHeaders();
}

function _newItemHeaders() {
  const cols = ["#", "Item Code *", "Name *", "Category", "Qty *", "Unit *", "Price ₱", "Expiry *", ""];
  return cols.map((c, i) => `<th style="${_thStyle(i === 0 || i === 8)}">${c}</th>`).join("");
}

function _restockHeaders() {
  const cols = ["#", "Item Code *", "Item Name (auto)", "Qty to Add *", "Expiry *", "Supplier / Remarks", ""];
  return cols.map((c, i) => `<th style="${_thStyle(i === 0 || i === 6)}">${c}</th>`).join("");
}

function _thStyle(narrow) {
  return `padding:10px 8px;background:var(--bg);border-bottom:1px solid var(--border);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-soft);white-space:nowrap;${narrow ? "width:36px;" : ""}`;
}

/* ══════════════════════════════════════════════
   ADD ROW
══════════════════════════════════════════════ */
function bulkAddRow() {
  const rid   = ++bulkRowIdCounter;
  bulkRows.push(rid);
  const tbody = document.getElementById("bulkTableBody");
  const tr    = document.createElement("tr");
  tr.id       = `bulkRow_${rid}`;
  tr.style.cssText = "transition:background .15s";

  if (bulkMode === "restock") {
    tr.innerHTML = _restockRowHtml(rid);
  } else {
    const code = nextItemCode();
    tr.innerHTML = _newItemRowHtml(rid, code);
  }

  tbody.appendChild(tr);
  _attachTabNav(tr);
  updateBulkCounts();
}

function _newItemRowHtml(rid, code) {
  return `
    <td style="padding:6px 8px;text-align:center;font-size:12px;color:var(--text-soft);font-weight:600">${bulkRows.length}</td>
    <td style="padding:4px"><input id="bCode_${rid}"   class="bulk-cell" type="text"   value="${code}"  placeholder="MED0XX"   oninput="onBulkInput(${rid})" style="width:88px"/></td>
    <td style="padding:4px"><input id="bName_${rid}"   class="bulk-cell" type="text"   placeholder="Medicine name"              oninput="onBulkInput(${rid})" style="width:175px"/></td>
    <td style="padding:4px">
      <select id="bCat_${rid}" class="bulk-cell-select" style="width:138px">
        ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("")}
      </select>
    </td>
    <td style="padding:4px"><input id="bQty_${rid}"    class="bulk-cell" type="number" min="0" placeholder="0"    oninput="onBulkInput(${rid})" style="width:62px;text-align:right"/></td>
    <td style="padding:4px"><input id="bUnit_${rid}"   class="bulk-cell" type="text"   placeholder="tablet"       oninput="onBulkInput(${rid})" style="width:78px"/></td>
    <td style="padding:4px"><input id="bPrice_${rid}"  class="bulk-cell" type="number" min="0" step="0.01" placeholder="0.00"  oninput="onBulkInput(${rid})" style="width:78px;text-align:right"/></td>
    <td style="padding:4px"><input id="bExpiry_${rid}" class="bulk-cell" type="date"                               oninput="onBulkInput(${rid})" style="width:128px"/></td>
    <td style="padding:4px 8px;text-align:center">${_deleteBtn(rid)}</td>`;
}

function _restockRowHtml(rid) {
  return `
    <td style="padding:6px 8px;text-align:center;font-size:12px;color:var(--text-soft);font-weight:600">${bulkRows.length}</td>
    <td style="padding:4px">
      <input id="bCode_${rid}" class="bulk-cell" type="text" placeholder="MED001"
        oninput="onRestockCodeInput(${rid})" style="width:92px"/>
    </td>
    <td style="padding:4px">
      <input id="bName_${rid}" class="bulk-cell" type="text" placeholder="(auto-filled)"
        readonly style="width:180px;background:#f8fbfa;color:var(--text-mid);font-style:italic"/>
    </td>
    <td style="padding:4px"><input id="bQty_${rid}"    class="bulk-cell" type="number" min="1" placeholder="0"      oninput="onBulkInput(${rid})" style="width:80px;text-align:right"/></td>
    <td style="padding:4px"><input id="bExpiry_${rid}" class="bulk-cell" type="date"                                 oninput="onBulkInput(${rid})" style="width:136px"/></td>
    <td style="padding:4px"><input id="bRemarks_${rid}"class="bulk-cell" type="text"   placeholder="e.g. Supplier X, Lot A1"                       style="width:200px"/></td>
    <td style="padding:4px 8px;text-align:center">${_deleteBtn(rid)}</td>`;
}

function _deleteBtn(rid) {
  return `<button onclick="bulkDeleteRow(${rid})"
    style="background:none;border:none;cursor:pointer;color:var(--text-soft);padding:4px;border-radius:4px;transition:color .15s"
    onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-soft)'">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </button>`;
}

/* ── Restock: auto-fill item name when code is entered ── */
function onRestockCodeInput(rid) {
  const code  = (document.getElementById(`bCode_${rid}`)?.value || "").trim().toUpperCase();
  const nameEl = document.getElementById(`bName_${rid}`);
  const match  = inventory.find(i => i.id === code);
  if (nameEl) {
    nameEl.value      = match ? match.name : (code ? "⚠ Not found" : "");
    nameEl.style.color = match ? "var(--text-mid)" : "var(--danger)";
  }
  onBulkInput(rid);
}

/* ── Tab key: skip to same column in next row ── */
function _attachTabNav(tr) {
  const colCount = tr.querySelectorAll(".bulk-cell, .bulk-cell-select").length;
  tr.querySelectorAll(".bulk-cell, .bulk-cell-select").forEach(input => {
    input.addEventListener("keydown", e => {
      if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey) {
        const allInputs = [...document.querySelectorAll("#bulkTableBody .bulk-cell:not([readonly]), #bulkTableBody .bulk-cell-select")];
        const idx = allInputs.indexOf(input);
        if (idx > -1 && idx + colCount < allInputs.length) {
          e.preventDefault();
          allInputs[idx + colCount].focus();
        }
      }
    });
  });
}

function bulkAddRows(n) { for (let i = 0; i < n; i++) bulkAddRow(); }

/* ══════════════════════════════════════════════
   DELETE / CLEAR
══════════════════════════════════════════════ */
function bulkDeleteRow(rid) {
  bulkRows = bulkRows.filter(r => r !== rid);
  document.getElementById(`bulkRow_${rid}`)?.remove();
  bulkRows.forEach((r, idx) => {
    const cell = document.querySelector(`#bulkRow_${r} td:first-child`);
    if (cell) cell.textContent = idx + 1;
  });
  updateBulkCounts();
}

function bulkClearAll() { _bulkReset(); }

/* ══════════════════════════════════════════════
   INPUT HANDLER & VALIDATION
══════════════════════════════════════════════ */
function onBulkInput(rid) {
  validateBulkRow(rid);
  updateBulkCounts();
}

function getRowValues(rid) {
  return {
    code   : (document.getElementById(`bCode_${rid}`)?.value    || "").trim().toUpperCase(),
    name   : (document.getElementById(`bName_${rid}`)?.value    || "").trim(),
    cat    : (document.getElementById(`bCat_${rid}`)?.value     || CATEGORIES[0]),
    qty    : parseInt(document.getElementById(`bQty_${rid}`)?.value)    || 0,
    unit   : (document.getElementById(`bUnit_${rid}`)?.value    || "").trim(),
    price  : parseFloat(document.getElementById(`bPrice_${rid}`)?.value) || 0,
    expiry : (document.getElementById(`bExpiry_${rid}`)?.value  || ""),
    remarks: (document.getElementById(`bRemarks_${rid}`)?.value || "").trim(),
  };
}

function isRowEmpty(rid) {
  const v = getRowValues(rid);
  if (bulkMode === "restock")
    return !v.code && v.qty === 0;
  return !v.name && !v.unit && !v.expiry && v.qty === 0 && v.price === 0;
}

function isRowValid(rid) {
  const v = getRowValues(rid);
  if (bulkMode === "restock") {
    const exists = inventory.find(i => i.id === v.code);
    return !!v.code && !!exists && v.qty > 0 && !!v.expiry;
  }
  return !!v.code && !!v.name && !!v.unit && !!v.expiry && v.qty > 0;
}

function validateBulkRow(rid) {
  const tr = document.getElementById(`bulkRow_${rid}`);
  if (!tr) return;
  if (isRowEmpty(rid)) { tr.style.background = ""; _clearRowErrors(rid); return; }

  const v = getRowValues(rid);
  let fields;

  if (bulkMode === "restock") {
    const exists = inventory.find(i => i.id === v.code);
    fields = [
      { id: `bCode_${rid}`,   ok: !!v.code && !!exists },
      { id: `bQty_${rid}`,    ok: v.qty > 0 },
      { id: `bExpiry_${rid}`, ok: !!v.expiry },
    ];
  } else {
    fields = [
      { id: `bCode_${rid}`,   ok: !!v.code },
      { id: `bName_${rid}`,   ok: !!v.name },
      { id: `bUnit_${rid}`,   ok: !!v.unit },
      { id: `bExpiry_${rid}`, ok: !!v.expiry },
      { id: `bQty_${rid}`,    ok: v.qty > 0 },
    ];
  }

  let allOk = true;
  fields.forEach(f => {
    const el = document.getElementById(f.id);
    if (!el) return;
    if (!f.ok) { el.style.borderColor = "var(--danger)"; el.style.background = "var(--danger-light)"; allOk = false; }
    else        { el.style.borderColor = ""; el.style.background = ""; }
  });
  tr.style.background = allOk ? "rgba(91,191,78,0.05)" : "rgba(224,82,82,0.04)";
}

function _clearRowErrors(rid) {
  ["bCode","bName","bUnit","bExpiry","bQty","bPrice"].forEach(prefix => {
    const el = document.getElementById(`${prefix}_${rid}`);
    if (el) { el.style.borderColor = ""; el.style.background = ""; }
  });
}

/* ══════════════════════════════════════════════
   COUNT DISPLAY
══════════════════════════════════════════════ */
function updateBulkCounts() {
  const total    = bulkRows.length;
  const nonEmpty = bulkRows.filter(r => !isRowEmpty(r)).length;
  const valid    = bulkRows.filter(r => !isRowEmpty(r) && isRowValid(r)).length;
  const countEl  = document.getElementById("bulkRowCount");
  const validEl  = document.getElementById("bulkValidCount");
  if (countEl) countEl.textContent  = `${total} row${total !== 1 ? "s" : ""}`;
  if (validEl) validEl.textContent  = nonEmpty > 0 ? `${valid} / ${nonEmpty} ready to save` : "";
}

/* ══════════════════════════════════════════════
   SAVE ALL
══════════════════════════════════════════════ */
async function saveBulkItems() {
  const errorBar = document.getElementById("bulkErrorBar");
  errorBar.classList.add("hidden");

  const toSave = bulkRows.filter(r => !isRowEmpty(r));
  if (toSave.length === 0) { toast("warn", "No items to save. Fill in at least one row."); return; }

  const errors        = [];
  const codesInBatch  = [];

  toSave.forEach((rid, i) => {
    validateBulkRow(rid);
    const v = getRowValues(rid);
    const label = `Row ${i + 1}`;

    if (!v.code)    errors.push(`${label}: Item code is required.`);
    if (!v.expiry)  errors.push(`${label}: Expiry date is required.`);
    if (v.qty <= 0) errors.push(`${label}: Quantity must be > 0.`);

    if (bulkMode === "new") {
      if (!v.name) errors.push(`${label}: Name is required.`);
      if (!v.unit) errors.push(`${label}: Unit is required.`);
      if (inventory.find(i => i.id === v.code))        errors.push(`${label}: Code "${v.code}" already exists. Use Restock mode to add stock.`);
      if (codesInBatch.includes(v.code))               errors.push(`${label}: Duplicate code "${v.code}" in this batch.`);
    } else {
      const exists = inventory.find(i => i.id === v.code);
      if (!exists) errors.push(`${label}: Code "${v.code}" not found in inventory.`);
      if (codesInBatch.filter(c => c === v.code).length >= 1)
        errors.push(`${label}: "${v.code}" appears more than once. Combine into one row or save separately.`);
    }
    codesInBatch.push(v.code);
  });

  if (errors.length > 0) {
    errorBar.innerHTML = `<strong>⚠ Please fix the following errors:</strong><br>`
      + errors.slice(0, 6).map(e => `• ${e}`).join("<br>")
      + (errors.length > 6 ? `<br>…and ${errors.length - 6} more.` : "");
    errorBar.classList.remove("hidden");
    return;
  }

  const saved = [];

  for (const rid of toSave) {
    const v = getRowValues(rid);

    if (bulkMode === "new") {
      const newItem = {
        id: v.code, name: v.name, category: v.cat, qty: v.qty,
        unit: v.unit, price: v.price, expiry: v.expiry,
        dateAdded: today(), batchNo: 1
      };
      inventory.push(newItem);

      const logEntry = {
        id: "LOG" + String(stockLog.length + 1).padStart(3, "0"),
        date: today(), itemId: v.code, itemName: v.name,
        type: "IN", qty: v.qty, remarks: "Bulk new-item entry", by: currentUser.name
      };
      stockLog.push(logEntry);

      // Supabase sync
      await sbUpsertInventoryItem(newItem).catch(() => {});
      await sbInsertStockLog(logEntry).catch(() => {});

    } else {
      // RESTOCK: add as new FIFO batch
      const existing = inventory.filter(i => i.id === v.code);
      const maxBatch = existing.reduce((m, i) => Math.max(m, i.batchNo), 0);
      const ref      = existing[0];

      const newBatch = {
        id: ref.id, name: ref.name, category: ref.category, unit: ref.unit,
        price: ref.price, expiry: v.expiry,
        qty: v.qty, dateAdded: today(), batchNo: maxBatch + 1
      };
      inventory.push(newBatch);

      const logEntry = {
        id: "LOG" + String(stockLog.length + 1).padStart(3, "0"),
        date: today(), itemId: v.code, itemName: ref.name,
        type: "IN", qty: v.qty,
        remarks: v.remarks || `Bulk restock — batch #${maxBatch + 1}`,
        by: currentUser.name
      };
      stockLog.push(logEntry);

      // Supabase sync
      await sbUpsertInventoryItem(newBatch).catch(() => {});
      await sbInsertStockLog(logEntry).catch(() => {});
    }

    saved.push(v);
  }

  closeModal("bulkAddModal");
  renderInventory();
  renderPosGrid();
  renderDashboard();
  renderStockLog();
  populateStockItemSelect();

  const action = bulkMode === "restock" ? "restocked" : "added";
  toast("success", `${saved.length} item${saved.length !== 1 ? "s" : ""} ${action} successfully!`);
}

/* ══════════════════════════════════════════════
   CSV IMPORT
   Accepted format (new items):
     code,name,category,qty,unit,price,reorder,expiry
   Accepted format (restock):
     code,qty,expiry,remarks
══════════════════════════════════════════════ */
function _showCsvPane() {
  document.getElementById("bulkCsvPane").classList.remove("hidden");
}
function _hideCsvPane() {
  const p = document.getElementById("bulkCsvPane");
  if (p) {
    p.classList.add("hidden");
    const ta = document.getElementById("bulkCsvText");
    const fi = document.getElementById("bulkCsvFile");
    if (ta) ta.value = "";
    if (fi) fi.value = "";
  }
}

function bulkImportCsvFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById("bulkCsvText").value = e.target.result;
  };
  reader.readAsText(file);
}

function applyBulkCsv() {
  const raw = (document.getElementById("bulkCsvText")?.value || "").trim();
  if (!raw) { toast("warn", "Paste or upload a CSV first."); return; }

  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  // Skip header row if first cell looks like a header
  const startIdx = /^code|^item/i.test(lines[0]) ? 1 : 0;
  const dataLines = lines.slice(startIdx);

  if (dataLines.length === 0) { toast("warn", "No data rows found."); return; }

  // Clear current rows
  bulkRows         = [];
  bulkRowIdCounter = 0;
  document.getElementById("bulkTableBody").innerHTML = "";

  let imported = 0;
  dataLines.forEach(line => {
    const cells = _parseCsvLine(line);
    if (cells.length < 2) return;  // skip blank/sparse

    const rid = ++bulkRowIdCounter;
    bulkRows.push(rid);
    const tbody = document.getElementById("bulkTableBody");
    const tr    = document.createElement("tr");
    tr.id       = `bulkRow_${rid}`;
    tr.style.cssText = "transition:background .15s";

    if (bulkMode === "restock") {
      // Expected: code, qty, expiry, remarks (optional)
      const [code="", qty="", expiry="", ...rest] = cells;
      tr.innerHTML = _restockRowHtml(rid);
      tbody.appendChild(tr);
      _setVal(`bCode_${rid}`,    code.trim().toUpperCase());
      _setVal(`bQty_${rid}`,     qty.trim());
      _setVal(`bExpiry_${rid}`,  expiry.trim());
      _setVal(`bRemarks_${rid}`, rest.join(",").trim());
      onRestockCodeInput(rid);
    } else {
      // Expected: code, name, category, qty, unit, price, expiry
      const [code="", name="", cat="", qty="", unit="", price="", expiry=""] = cells;
      const autoCode = code.trim().toUpperCase() || nextItemCode();
      tr.innerHTML = _newItemRowHtml(rid, autoCode);
      tbody.appendChild(tr);
      _setVal(`bCode_${rid}`,    autoCode);
      _setVal(`bName_${rid}`,    name.trim());
      if (CATEGORIES.includes(cat.trim())) _setVal(`bCat_${rid}`, cat.trim());
      _setVal(`bQty_${rid}`,     qty.trim());
      _setVal(`bUnit_${rid}`,    unit.trim());
      _setVal(`bPrice_${rid}`,   price.trim());
      _setVal(`bExpiry_${rid}`,  expiry.trim());
    }

    _attachTabNav(tr);
    validateBulkRow(rid);
    imported++;
  });

  _hideCsvPane();
  updateBulkCounts();
  toast("success", `${imported} row${imported !== 1 ? "s" : ""} imported from CSV.`);
}

function _setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

/* Handle quoted CSV cells */
function _parseCsvLine(line) {
  const result = [];
  let cur = "", inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === "," && !inQuote) { result.push(cur); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

/* ── CSV template download ── */
function downloadCsvTemplate() {
  let csv;
  if (bulkMode === "restock") {
    csv = "code,qty,expiry,remarks\nMED001,100,2027-12-31,\"Supplier ABC Lot 1\"\nMED002,200,2027-06-30,\"Monthly delivery\"\n";
  } else {
    csv = "code,name,category,qty,unit,price,expiry\nMED011,\"Aspirin 100mg\",\"OTC Medicine\",150,tablet,4.50,2027-12-31\nMED012,\"Vitamin D3 1000IU\",\"Vitamins & Supplements\",80,capsule,12.00,2027-08-01\n";
  }
  const a   = document.createElement("a");
  a.href    = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download= bulkMode === "restock" ? "restock_template.csv" : "new_items_template.csv";
  a.click();
}
