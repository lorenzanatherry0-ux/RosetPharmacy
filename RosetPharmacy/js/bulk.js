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
/* nextItemCode() is defined globally in state.js.
   We wrap it here to also pass any codes already in the current bulk
   batch so intra-batch rows don't collide with each other. */
function nextItemCodeForBatch() {
  const batchCodes = bulkRows.map(r => {
    const el = document.getElementById(`bCode_${r}`);
    return el ? el.value.trim().toUpperCase() : "";
  }).filter(Boolean);
  return nextItemCode(batchCodes);
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
  bulkAddRow();   // start with ONE clean row — user adds more as needed
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
  const cols = ["#", "Item Code", "Name *", "Category", "Qty", "Unit", "Price ₱", "Cost ₱", "Reorder Lvl", ""];
  return cols.map((c, i) => `<th style="${_thStyle(i === 0 || i === 9)}">${c}</th>`).join("");
}

function _restockHeaders() {
  const cols = ["#", "Item Name *", "Item Code (auto)", "Qty to Add *", "Supplier / Remarks", ""];
  return cols.map((c, i) => `<th style="${_thStyle(i === 0 || i === 5)}">${c}</th>`).join("");
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
    const code = nextItemCodeForBatch();
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
    <td style="padding:4px"><input id="bCost_${rid}"   class="bulk-cell" type="number" min="0" step="0.01" placeholder="0.00"  oninput="onBulkInput(${rid})" style="width:78px;text-align:right"/></td>
    <td style="padding:4px"><input id="bReorder_${rid}" class="bulk-cell" type="number" min="0" placeholder="0" oninput="onBulkInput(${rid})" style="width:66px;text-align:right"/></td>
    <td style="padding:4px 8px;text-align:center">${_deleteBtn(rid)}</td>`;
}

function _restockRowHtml(rid) {
  // Build a datalist of all known item names for this row
  const opts = [...new Map(inventory.map(i => [i.id, i])).values()]
    .map(i => `<option value="${escapeHtml(i.name)}" data-id="${i.id}">`)
    .join("");

  return `
    <td style="padding:6px 8px;text-align:center;font-size:12px;color:var(--text-soft);font-weight:600">${bulkRows.length}</td>

    <!-- Item Name — editable/searchable (primary field) -->
    <td style="padding:4px">
      <input id="bName_${rid}" class="bulk-cell" type="text"
        list="bNameList_${rid}"
        placeholder="Start typing name…"
        autocomplete="off"
        oninput="onRestockNameInput(${rid})"
        style="width:210px;font-weight:500"/>
      <datalist id="bNameList_${rid}">${opts}</datalist>
    </td>

    <!-- Item Code — auto-filled read-only (for identification) -->
    <td style="padding:4px">
      <input id="bCode_${rid}" class="bulk-cell" type="text"
        readonly placeholder="(auto)"
        style="width:90px;background:#f3f6f5;color:var(--text-mid);font-family:monospace;font-size:12px;font-weight:700;letter-spacing:.4px"/>
    </td>

    <td style="padding:4px"><input id="bQty_${rid}"     class="bulk-cell" type="number" min="1" placeholder="0"                  oninput="onBulkInput(${rid})" style="width:80px;text-align:right"/></td>
    <td style="padding:4px"><input id="bRemarks_${rid}" class="bulk-cell" type="text"   placeholder="e.g. Supplier X, Lot A1"                                    style="width:200px"/></td>
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

/* ── Restock: auto-fill Item Code + details when a name is typed/picked ── */
function onRestockNameInput(rid) {
  const typed  = (document.getElementById(`bName_${rid}`)?.value || "").trim();
  const codeEl = document.getElementById(`bCode_${rid}`);
  const nameEl = document.getElementById(`bName_${rid}`);

  if (!typed) {
    if (codeEl) { codeEl.value = ""; codeEl.style.color = ""; }
    if (nameEl) { nameEl.style.color = ""; }
    onBulkInput(rid);
    return;
  }

  // Case-insensitive exact match first, then startsWith for fast typing
  const match =
    inventory.find(i => i.name.toLowerCase() === typed.toLowerCase()) ||
    inventory.find(i => i.name.toLowerCase().startsWith(typed.toLowerCase()));

  if (match) {
    if (codeEl) {
      codeEl.value      = match.id;
      codeEl.style.color = "var(--teal-dark)";
    }
    if (nameEl) nameEl.style.color = "var(--text)";
  } else {
    if (codeEl) {
      codeEl.value      = "";
      codeEl.style.color = "";
    }
    if (nameEl) nameEl.style.color = "var(--danger)";
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
  const nameVal = (document.getElementById(`bName_${rid}`)?.value || "").trim();
  const codeVal = (document.getElementById(`bCode_${rid}`)?.value || "").trim().toUpperCase();

  return {
    // In restock mode the code is auto-filled from the name lookup.
    // In new-items mode the code is manually typed.
    code   : codeVal,
    name   : nameVal,
    cat    : (document.getElementById(`bCat_${rid}`)?.value     || CATEGORIES[0]),
    qty    : parseInt(document.getElementById(`bQty_${rid}`)?.value)    || 0,
    unit   : (document.getElementById(`bUnit_${rid}`)?.value    || "").trim(),
    price  : parseFloat(document.getElementById(`bPrice_${rid}`)?.value) || 0,
    cost   : parseFloat(document.getElementById(`bCost_${rid}`)?.value)  || 0,
    reorder: parseInt(document.getElementById(`bReorder_${rid}`)?.value) || 0,
    remarks: (document.getElementById(`bRemarks_${rid}`)?.value || "").trim(),
  };
}

function isRowEmpty(rid) {
  const v = getRowValues(rid);
  if (bulkMode === "restock")
    return !v.name && v.qty === 0;
  return !v.name && !v.unit && v.qty === 0 && v.price === 0;
}

function isRowValid(rid) {
  const v = getRowValues(rid);
  if (bulkMode === "restock") {
    // Name must have resolved to a known item (code auto-filled)
    const exists = v.code && inventory.find(i => i.id === v.code);
    return !!v.name && !!exists && v.qty > 0;
  }
  // New items: only the name is required — everything else (code, unit,
  // price, cost, reorder, quantity) can be filled in or adjusted later.
  return !!v.name;
}

function validateBulkRow(rid) {
  const tr = document.getElementById(`bulkRow_${rid}`);
  if (!tr) return;
  if (isRowEmpty(rid)) { tr.style.background = ""; _clearRowErrors(rid); return; }

  const v = getRowValues(rid);
  let fields;

  if (bulkMode === "restock") {
    const exists = v.code && inventory.find(i => i.id === v.code);
    fields = [
      { id: `bName_${rid}`,   ok: !!v.name && !!exists },
      { id: `bQty_${rid}`,    ok: v.qty > 0 },
    ];
  } else {
    fields = [
      { id: `bName_${rid}`,   ok: !!v.name },
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
  ["bCode","bName","bUnit","bQty","bPrice","bCost"].forEach(prefix => {
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

    if (bulkMode === "restock") {
      if (v.qty <= 0) errors.push(`${label}: Quantity must be > 0.`);
    }

    if (bulkMode === "new") {
      if (!v.name) errors.push(`${label}: Name is required.`);
      if (v.code && inventory.find(i => i.id === v.code))    errors.push(`${label}: Code "${v.code}" already exists. Use Restock mode to add stock.`);
      if (v.code && codesInBatch.includes(v.code))            errors.push(`${label}: Duplicate code "${v.code}" in this batch.`);
    } else {
      if (!v.name) errors.push(`${label}: Item name is required — start typing to search.`);
      const exists = v.code && inventory.find(i => i.id === v.code);
      if (v.name && !exists) errors.push(`${label}: "${v.name}" not found — pick a suggestion from the dropdown.`);
      if (codesInBatch.filter(c => c === v.code).length >= 1)
        errors.push(`${label}: "${v.name}" appears more than once. Combine into one row or save separately.`);
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
      if (!v.code) v.code = nextItemCode(codesInBatch);
      const newItem = {
        id: v.code, name: v.name, category: v.cat, qty: v.qty,
        unit: v.unit, price: v.price, cost: v.cost, reorder: v.reorder,
        dateAdded: today(), batchNo: 1
      };
      inventory.push(newItem);

      if (v.qty > 0) {
        const logEntry = {
          id: "LOG" + String(stockLog.length + 1).padStart(3, "0"),
          date: today(), itemId: v.code, itemName: v.name,
          type: "IN", qty: v.qty, remarks: "Bulk new-item entry", by: currentUser.name
        };
        stockLog.push(logEntry);
        await sbInsertStockLog(logEntry).catch(() => {});
      }

      // Supabase sync
      await sbUpsertInventoryItem(newItem).catch(() => {});

    } else {
      // RESTOCK: add as new FIFO batch
      const existing = inventory.filter(i => i.id === v.code);
      const maxBatch = existing.reduce((m, i) => Math.max(m, i.batchNo), 0);
      const ref      = existing[0];

      const newBatch = {
        id: ref.id, name: ref.name, category: ref.category, unit: ref.unit,
        price: ref.price, cost: ref.cost ?? 0,
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
   Accepted format (new items) — only "name" is required,
   everything else can be left blank and filled in later:
     name,category,qty,unit,price,cost,reorder,code
   Accepted format (restock):
     name,qty,remarks
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
  const startIdx = /^code|^item|^name/i.test(lines[0]) ? 1 : 0;
  const dataLines = lines.slice(startIdx);

  if (dataLines.length === 0) { toast("warn", "No data rows found."); return; }

  // Clear current rows
  bulkRows         = [];
  bulkRowIdCounter = 0;
  document.getElementById("bulkTableBody").innerHTML = "";

  let imported = 0;
  dataLines.forEach(line => {
    const cells = _parseCsvLine(line);
    if (cells.length < 1 || !cells.some(c => c.trim())) return;  // skip fully blank lines

    const rid = ++bulkRowIdCounter;
    bulkRows.push(rid);
    const tbody = document.getElementById("bulkTableBody");
    const tr    = document.createElement("tr");
    tr.id       = `bulkRow_${rid}`;
    tr.style.cssText = "transition:background .15s";

    if (bulkMode === "restock") {
      // name, qty, remarks (all optional except name)
      const [name="", qty="", ...rest] = cells;
      tr.innerHTML = _restockRowHtml(rid);
      tbody.appendChild(tr);
      _setVal(`bName_${rid}`,    name.trim());
      _setVal(`bQty_${rid}`,     qty.trim());
      _setVal(`bRemarks_${rid}`, rest.join(",").trim());
      // Trigger the name lookup so the Code field auto-fills
      onRestockNameInput(rid);
    } else {
      // Only "name" is required — a single-column paste of item names
      // (copied straight from another system) works fine here.
      // Full format: name, category, qty, unit, price, cost, reorder, code
      const [name="", cat="", qty="", unit="", price="", cost="", reorder="", code=""] = cells;
      const autoCode = code.trim().toUpperCase() || nextItemCodeForBatch();
      tr.innerHTML = _newItemRowHtml(rid, autoCode);
      tbody.appendChild(tr);
      _setVal(`bCode_${rid}`,    autoCode);
      _setVal(`bName_${rid}`,    name.trim());
      if (CATEGORIES.includes(cat.trim())) _setVal(`bCat_${rid}`, cat.trim());
      _setVal(`bQty_${rid}`,     qty.trim());
      _setVal(`bUnit_${rid}`,    unit.trim());
      _setVal(`bPrice_${rid}`,   price.trim());
      _setVal(`bCost_${rid}`,    cost.trim());
      _setVal(`bReorder_${rid}`, reorder.trim());
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
    csv = "name,qty,remarks\n\"Paracetamol 500mg\",100,\"Supplier ABC Lot 1\"\n\"Amoxicillin 500mg\",200,\"Monthly delivery\"\n";
  } else {
    csv = "name,category,qty,unit,price,cost,reorder,code\n\"Aspirin 100mg\",\"Generics\",150,tablet,4.50,2.70,30,\n\"Vitamin D3 1000IU\",\"Self Care\",80,capsule,12.00,7.00,20,\n\"Cotton Buds (Box)\",\"Medical Supplies\",,,,,,\n";
  }
  const a   = document.createElement("a");
  a.href    = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download= bulkMode === "restock" ? "restock_template.csv" : "new_items_template.csv";
  a.click();
}
