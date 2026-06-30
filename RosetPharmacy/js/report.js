/* ══════════════════════════════════════════════
   report.js — Reports, organized into categories
   ──────────────────────────────────────────────
   Redesign goals (per requirements):
   • Reports are grouped into separate categories (cards/folders), not all
     dumped on screen at once.
   • Nothing renders by default — a report only appears after the user
     clicks "Generate Report" for that category.
   • Categories: POS Detail Report (Daily Sales), Sales Report Summary
     (Per Day), Inventory Report (with category filter/sort), and Stock
     Movement Report.
══════════════════════════════════════════════ */

let currentReportCategory = null;

/* ── INIT — always lands on the category picker, nothing pre-rendered ── */
function initReports() {
  closeReportCategory();

  // Populate the Inventory Report's category filter from the live list
  const catSel = document.getElementById("invCatReportFilter");
  if (catSel && catSel.options.length <= 1) {
    CATEGORIES.forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c;
      catSel.appendChild(o);
    });
  }

  // Sensible defaults for each category's date controls, set ahead of time
  // so the user doesn't have to fill them in before their first Generate.
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const todayStr = today();

  setVal("posdetailDate", todayStr);
  setVal("rptFrom", first);
  setVal("rptTo", todayStr);
  setVal("invFrom", first);
  setVal("invTo", todayStr);
  setVal("moveFrom", first);
  setVal("moveTo", todayStr);

  highlightPreset("salessummary", "month");
}

function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

/* ══════════════════════════════════════════════
   CATEGORY NAVIGATION (folder/card UI)
══════════════════════════════════════════════ */
function openReportCategory(cat) {
  currentReportCategory = cat;

  document.getElementById("rptCatGrid").classList.add("hidden");
  document.getElementById("rptDetailView").classList.remove("hidden");
  document.getElementById("rptPrintBtn").classList.add("hidden");

  // Show only this category's controls bar
  document.querySelectorAll(".rpt-controls-bar").forEach(el =>
    el.classList.toggle("hidden", el.dataset.controls !== cat)
  );

  // Hide every report panel and show the "not generated yet" empty state
  document.querySelectorAll(".rpt-panel").forEach(p => p.classList.remove("active"));
  document.getElementById("rptEmptyState").classList.remove("hidden");

  document.getElementById("rptDetailTitle").textContent = REPORT_LABELS[cat]?.title || "Report";
  document.getElementById("rptDetailSub").textContent   = REPORT_LABELS[cat]?.sub   || "";
}

function closeReportCategory() {
  currentReportCategory = null;
  document.getElementById("rptCatGrid").classList.remove("hidden");
  document.getElementById("rptDetailView").classList.add("hidden");
}

const REPORT_LABELS = {
  posdetail:     { title: "POS Detail Report",     sub: "Daily Sales — full transaction journal for one selected day" },
  salessummary:  { title: "Sales Report Summary",  sub: "Per Day — aggregated totals across a date range" },
  inventory:     { title: "Inventory Report",      sub: "Stock levels & value — filter / sort / generate per category" },
  movement:      { title: "Stock Movement Report", sub: "Stock in / out activity log over a date range" },
};

/* ── GENERATE (only entry point that actually renders a report) ── */
function generateReport() {
  if (!currentReportCategory) return;

  if (currentReportCategory === "posdetail") {
    const date = document.getElementById("posdetailDate").value;
    if (!date) { toast("warn", "Pick a date first."); return; }
    renderPosDetailReport(date);
  } else if (currentReportCategory === "salessummary") {
    const from = document.getElementById("rptFrom").value;
    const to   = document.getElementById("rptTo").value;
    if (!from || !to) { toast("warn", "Pick a date range first."); return; }
    renderSalesSummaryReport(from, to);
  } else if (currentReportCategory === "inventory") {
    const from = document.getElementById("invFrom").value;
    const to   = document.getElementById("invTo").value;
    const cat  = document.getElementById("invCatReportFilter")?.value || "";
    const sort = document.getElementById("invSortBy")?.value || "value";
    renderInventoryReport(from, to, cat, sort);
  } else if (currentReportCategory === "movement") {
    const from = document.getElementById("moveFrom").value;
    const to   = document.getElementById("moveTo").value;
    if (!from || !to) { toast("warn", "Pick a date range first."); return; }
    renderMovementReport(from, to);
  }

  document.getElementById("rptEmptyState").classList.add("hidden");
  document.querySelectorAll(".rpt-panel").forEach(p =>
    p.classList.toggle("active", p.dataset.panel === currentReportCategory)
  );
  document.getElementById("rptPrintBtn").classList.remove("hidden");
}

/* ── QUICK PRESETS (Sales Summary + Inventory + Movement all reuse this) ── */
function setReportPreset(scope, preset) {
  const now = new Date();
  let from, to = today();

  if (preset === "today") {
    from = today();
  } else if (preset === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    from = d.toISOString().split("T")[0];
  } else if (preset === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  } else if (preset === "last-month") {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
    to   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
  } else if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    from = new Date(now.getFullYear(), q * 3, 1).toISOString().split("T")[0];
  } else if (preset === "year") {
    from = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
  }

  const prefix = { salessummary: "rpt", inventory: "inv", movement: "move" }[scope];
  setVal(`${prefix}From`, from);
  setVal(`${prefix}To`, to);
  highlightPreset(scope, preset);
}

function highlightPreset(scope, preset) {
  document.querySelectorAll(`.rpt-preset-btn[data-scope="${scope}"]`).forEach(b =>
    b.classList.toggle("active", b.dataset.preset === preset)
  );
}

/* ══════════════════════════════════════════════
   1) POS DETAIL REPORT (Daily Sales) — single day
══════════════════════════════════════════════ */
function renderPosDetailReport(date) {
  const dayTxns = transactions.filter(t => t.date === date);

  const revenue  = dayTxns.reduce((s, t) => s + t.total, 0);
  const profit   = dayTxns.reduce((s, t) => s + (t.profit ?? 0), 0);
  const discount = dayTxns.reduce((s, t) => s + (t.discAmt || 0), 0);
  const count    = dayTxns.length;

  document.getElementById("posdetailKpi").innerHTML = `
    <div class="rpt-kpi-card rpt-kpi-green">
      <div class="rpt-kpi-icon">₱</div>
      <div class="rpt-kpi-val">₱${revenue.toFixed(2)}</div>
      <div class="rpt-kpi-lbl">Total Revenue</div>
    </div>
    <div class="rpt-kpi-card">
      <div class="rpt-kpi-icon">🧾</div>
      <div class="rpt-kpi-val">${count}</div>
      <div class="rpt-kpi-lbl">Transactions</div>
    </div>
    <div class="rpt-kpi-card rpt-kpi-teal">
      <div class="rpt-kpi-icon">📈</div>
      <div class="rpt-kpi-val">₱${profit.toFixed(2)}</div>
      <div class="rpt-kpi-lbl">Profit</div>
    </div>
    <div class="rpt-kpi-card rpt-kpi-warn">
      <div class="rpt-kpi-icon">🏷</div>
      <div class="rpt-kpi-val">₱${discount.toFixed(2)}</div>
      <div class="rpt-kpi-lbl">Discounts Given</div>
    </div>`;

  document.getElementById("posdetailDateLabel").textContent = formatDisplayDate(date);

  const tbody = document.getElementById("posdetailTbl");
  const sorted = [...dayTxns].reverse();
  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="rpt-empty">No transactions on ${formatDisplayDate(date)}.</td></tr>`;
    return;
  }
  tbody.innerHTML = sorted.map(t => `
    <tr>
      <td><span class="mono" style="font-size:12px">${t.id}</span></td>
      <td>${t.time || "—"}</td>
      <td style="font-size:12px;color:var(--text-mid);max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.items.map(i=>`${i.name}×${i.qty}`).join(", ")}</td>
      <td><span class="tag tag-teal" style="font-size:11px">${t.paymentMethod}</span></td>
      <td>${t.discountPct > 0 ? `<span class="tag tag-warn" style="font-size:11px">${t.discountPct}%</span>` : "—"}</td>
      <td style="font-weight:700;color:var(--green-dark)">₱${t.total.toFixed(2)}</td>
      <td style="font-weight:700;color:var(--teal-dark)">₱${(t.profit ?? 0).toFixed(2)}</td>
      <td style="font-size:12px;color:var(--text-soft)">${t.cashier}</td>
    </tr>`).join("");
}

/* ══════════════════════════════════════════════
   2) SALES REPORT SUMMARY (Per Day) — date range
══════════════════════════════════════════════ */
function renderSalesSummaryReport(from, to) {
  const filtered = transactions.filter(t => t.date >= from && t.date <= to);

  const totalRevenue = filtered.reduce((s, t) => s + t.total, 0);
  const totalTxns    = filtered.length;
  const totalDisc    = filtered.reduce((s, t) => s + (t.discAmt || 0), 0);
  const avgTxn       = totalTxns > 0 ? totalRevenue / totalTxns : 0;

  document.getElementById("rptSalesKpi").innerHTML = `
    <div class="rpt-kpi-card rpt-kpi-green">
      <div class="rpt-kpi-icon">₱</div>
      <div class="rpt-kpi-val">₱${totalRevenue.toFixed(2)}</div>
      <div class="rpt-kpi-lbl">Total Revenue</div>
    </div>
    <div class="rpt-kpi-card">
      <div class="rpt-kpi-icon">🧾</div>
      <div class="rpt-kpi-val">${totalTxns}</div>
      <div class="rpt-kpi-lbl">Transactions</div>
    </div>
    <div class="rpt-kpi-card">
      <div class="rpt-kpi-icon">📊</div>
      <div class="rpt-kpi-val">₱${avgTxn.toFixed(2)}</div>
      <div class="rpt-kpi-lbl">Avg. per Transaction</div>
    </div>
    <div class="rpt-kpi-card rpt-kpi-warn">
      <div class="rpt-kpi-icon">🏷</div>
      <div class="rpt-kpi-val">₱${totalDisc.toFixed(2)}</div>
      <div class="rpt-kpi-lbl">Total Discounts Given</div>
    </div>`;

  // ── Payment method breakdown — built dynamically from whatever payment
  // methods actually appear in the data (the POS itself now only ever
  // produces "Cash", but historical/synced data may have other methods).
  const methods = {};
  filtered.forEach(t => {
    const m = t.paymentMethod || "Cash";
    if (!methods[m]) methods[m] = { count: 0, total: 0 };
    methods[m].count += 1;
    methods[m].total += t.total;
  });
  const dotClasses = ["rpt-dot-teal", "rpt-dot-blue", "rpt-dot-purple"];
  const methodEntries = Object.entries(methods).sort((a, b) => b[1].total - a[1].total);
  document.getElementById("rptPaymentBreakdown").innerHTML = methodEntries.length === 0
    ? `<div class="rpt-empty" style="padding:24px">No sales in this period.</div>`
    : methodEntries.map(([name, d], idx) => `
    <div class="rpt-breakdown-row">
      <span class="rpt-bk-label"><span class="rpt-dot ${dotClasses[idx % dotClasses.length]}"></span>${name}</span>
      <span class="rpt-bk-count">${d.count} txns</span>
      <span class="rpt-bk-amt">₱${d.total.toFixed(2)}</span>
    </div>`).join("");

  // ── Daily sales table ──
  const byDay = {};
  filtered.forEach(t => {
    if (!byDay[t.date]) byDay[t.date] = { revenue: 0, txns: 0, profit: 0 };
    byDay[t.date].revenue += t.total;
    byDay[t.date].txns    += 1;
    byDay[t.date].profit  += (t.profit ?? 0);
  });
  const dayRows = Object.keys(byDay).sort().reverse();

  const dailyTbody = document.getElementById("rptDailySalesTbl");
  if (dayRows.length === 0) {
    dailyTbody.innerHTML = `<tr><td colspan="5" class="rpt-empty">No sales in this period.</td></tr>`;
  } else {
    dailyTbody.innerHTML = dayRows.map(d => `
      <tr>
        <td>${formatDisplayDate(d)}</td>
        <td>${byDay[d].txns}</td>
        <td style="font-weight:700;color:var(--green-dark)">₱${byDay[d].revenue.toFixed(2)}</td>
        <td style="color:var(--teal-dark);font-weight:600">₱${byDay[d].profit.toFixed(2)}</td>
        <td style="color:var(--text-soft)">₱${(byDay[d].revenue/byDay[d].txns).toFixed(2)}</td>
      </tr>`).join("");
  }

  // ── Top-selling items ──
  const itemSales = {};
  filtered.forEach(t => {
    t.items.forEach(i => {
      if (!itemSales[i.name]) itemSales[i.name] = { qty: 0, revenue: 0 };
      itemSales[i.name].qty     += i.qty;
      itemSales[i.name].revenue += i.qty * i.price;
    });
  });
  const topItems = Object.entries(itemSales)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10);

  const topTbody = document.getElementById("rptTopItemsTbl");
  if (topItems.length === 0) {
    topTbody.innerHTML = `<tr><td colspan="4" class="rpt-empty">No sales data.</td></tr>`;
  } else {
    topTbody.innerHTML = topItems.map(([name, d], idx) => `
      <tr>
        <td><span class="rpt-rank ${idx < 3 ? "rpt-rank-top" : ""}">#${idx+1}</span></td>
        <td style="font-weight:500">${name}</td>
        <td style="text-align:right">${d.qty}</td>
        <td style="text-align:right;font-weight:700;color:var(--green-dark)">₱${d.revenue.toFixed(2)}</td>
      </tr>`).join("");
  }
}

/* ══════════════════════════════════════════════
   3) INVENTORY REPORT — category filter + sort + per-category generate
══════════════════════════════════════════════ */
function renderInventoryReport(from, to, catFilter, sortBy) {
  const addedInRange = inventory.filter(i => i.dateAdded >= from && i.dateAdded <= to && (!catFilter || i.category === catFilter));
  const allIdsAll    = [...new Set(inventory.map(i => i.id))];
  const allIds       = catFilter
    ? allIdsAll.filter(id => inventory.find(i => i.id === id)?.category === catFilter)
    : allIdsAll;

  // Category breakdown (always computed across ALL categories, regardless
  // of the filter, so the user can still see the full category split —
  // the filter narrows the snapshot/added-items tables below instead)
  const byCat = {};
  allIdsAll.forEach(id => {
    const batches  = inventory.filter(i => i.id === id);
    const cat      = batches[0].category;
    const totalQty = batches.reduce((s, i) => s + i.qty, 0);
    const value    = batches.reduce((s, i) => s + i.qty * i.price, 0);
    if (!byCat[cat]) byCat[cat] = { items: 0, qty: 0, value: 0 };
    byCat[cat].items += 1;
    byCat[cat].qty   += totalQty;
    byCat[cat].value += value;
  });

  const totalValueAll = Object.values(byCat).reduce((s, c) => s + c.value, 0);
  const totalQtyScoped = allIds.reduce((s, id) => s + inventory.filter(i=>i.id===id).reduce((s2,i)=>s2+i.qty,0), 0);
  const totalValueScoped = allIds.reduce((s, id) => s + inventory.filter(i=>i.id===id).reduce((s2,i)=>s2+i.qty*i.price,0), 0);
  const lowIds  = allIds.filter(id => {
    const b = inventory.filter(i => i.id === id);
    const q = b.reduce((s,i)=>s+i.qty,0);
    return q > 0 && q <= (b[0]?.reorder || 0);
  });
  const outIds  = allIds.filter(id => inventory.filter(i=>i.id===id).reduce((s,i)=>s+i.qty,0) === 0);

  document.getElementById("rptInvKpi").innerHTML = `
    <div class="rpt-kpi-card rpt-kpi-teal">
      <div class="rpt-kpi-icon">📦</div>
      <div class="rpt-kpi-val">${allIds.length}</div>
      <div class="rpt-kpi-lbl">${catFilter ? `Items in "${catFilter}"` : "Unique Items"}</div>
    </div>
    <div class="rpt-kpi-card">
      <div class="rpt-kpi-icon">🔢</div>
      <div class="rpt-kpi-val">${totalQtyScoped.toLocaleString()}</div>
      <div class="rpt-kpi-lbl">Total Units in Stock</div>
    </div>
    <div class="rpt-kpi-card rpt-kpi-green">
      <div class="rpt-kpi-icon">₱</div>
      <div class="rpt-kpi-val">₱${totalValueScoped.toFixed(2)}</div>
      <div class="rpt-kpi-lbl">Inventory Value</div>
    </div>
    <div class="rpt-kpi-card rpt-kpi-warn">
      <div class="rpt-kpi-icon">⚠️</div>
      <div class="rpt-kpi-val">${lowIds.length + outIds.length}</div>
      <div class="rpt-kpi-lbl">Low / Out of Stock</div>
    </div>`;

  // Category table — sortable by Value (desc) or by Category name (A→Z)
  const catTbody = document.getElementById("rptCatTbl");
  let catEntries = Object.entries(byCat);
  catEntries = sortBy === "name"
    ? catEntries.sort((a, b) => a[0].localeCompare(b[0]))
    : catEntries.sort((a, b) => b[1].value - a[1].value);

  catTbody.innerHTML = catEntries.map(([cat, d]) => `
      <tr class="${cat === catFilter ? "low-stock" : ""}">
        <td><span class="tag tag-teal">${cat}</span></td>
        <td style="text-align:right">${d.items}</td>
        <td style="text-align:right">${d.qty.toLocaleString()}</td>
        <td style="text-align:right;font-weight:700;color:var(--green-dark)">₱${d.value.toFixed(2)}</td>
        <td style="text-align:right;color:var(--text-soft)">
          ${totalValueAll > 0 ? ((d.value/totalValueAll)*100).toFixed(1) : 0}%
        </td>
      </tr>`).join("") || `<tr><td colspan="5" class="rpt-empty">No data.</td></tr>`;

  // Full item table (current snapshot, respecting the category filter)
  const invTbody = document.getElementById("rptInvItemsTbl");
  let sortedInv = allIds.map(id => {
    const batches  = inventory.filter(i => i.id === id).sort((a,b)=>a.batchNo-b.batchNo);
    const totalQty = batches.reduce((s,i)=>s+i.qty,0);
    const value    = batches.reduce((s,i)=>s+i.qty*i.price,0);
    const ref      = batches[0];
    const reorder  = ref.reorder || 0;
    const isLow    = totalQty > 0 && totalQty <= reorder;
    const isOut    = totalQty === 0;
    const nearExp  = batches.some(b => {
      const d = Math.ceil((new Date(b.expiry)-new Date())/86400000);
      return d <= 90 && d > 0;
    });
    const hasExp   = batches.some(b => new Date(b.expiry) < new Date());
    return { id, ref, batches, totalQty, value, isLow, isOut, nearExp, hasExp };
  });
  sortedInv = sortBy === "name"
    ? sortedInv.sort((a,b) => a.ref.category.localeCompare(b.ref.category) || a.id.localeCompare(b.id))
    : sortedInv.sort((a,b) => b.value - a.value);

  invTbody.innerHTML = sortedInv.map(item => {
    const statusTag = item.isOut
      ? `<span class="tag tag-red">Out</span>`
      : item.isLow
        ? `<span class="tag tag-warn">Low</span>`
        : `<span class="tag tag-green">OK</span>`;
    const expTag = item.hasExp
      ? `<span class="tag tag-red">Expired</span>`
      : item.nearExp
        ? `<span class="tag tag-warn">Expiring Soon</span>`
        : "";
    return `<tr class="${item.isOut ? "critical-stock" : item.isLow ? "low-stock" : ""}">
      <td><span class="mono" style="font-size:12px">${item.id}</span></td>
      <td style="font-weight:600">${item.ref.name}</td>
      <td><span class="tag tag-teal" style="font-size:11px">${item.ref.category}</span></td>
      <td style="text-align:right;font-weight:700;${item.isOut?"color:var(--danger)":item.isLow?"color:var(--warn)":""}">${item.totalQty}</td>
      <td style="text-align:right">₱${item.ref.price.toFixed(2)}</td>
      <td style="text-align:right;font-weight:600;color:var(--green-dark)">₱${item.value.toFixed(2)}</td>
      <td style="text-align:right;color:var(--text-soft)">${item.ref.reorder}</td>
      <td>${statusTag} ${expTag}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="8" class="rpt-empty">No items found${catFilter ? ` in "${catFilter}"` : ""}.</td></tr>`;

  // Items added in range (also respects the category filter)
  const addedTbody = document.getElementById("rptAddedItemsTbl");
  if (addedInRange.length === 0) {
    addedTbody.innerHTML = `<tr><td colspan="5" class="rpt-empty">No items added in this period${catFilter ? ` for "${catFilter}"` : ""}.</td></tr>`;
  } else {
    addedTbody.innerHTML = addedInRange
      .sort((a,b) => b.dateAdded.localeCompare(a.dateAdded))
      .map(i => `
        <tr>
          <td><span class="mono" style="font-size:12px">${i.id}</span></td>
          <td style="font-weight:500">${i.name}</td>
          <td>${i.dateAdded}</td>
          <td style="text-align:right">${i.qty} ${i.unit}</td>
          <td><span class="tag tag-teal" style="font-size:11px">Batch #${i.batchNo}</span></td>
        </tr>`).join("");
  }
}

/* ══════════════════════════════════════════════
   4) STOCK MOVEMENT REPORT
══════════════════════════════════════════════ */
function renderMovementReport(from, to) {
  const logs = stockLog.filter(l => l.date >= from && l.date <= to);

  const totalIn  = logs.filter(l => l.type === "IN").reduce((s,l) => s+l.qty, 0);
  const totalOut = logs.filter(l => l.type === "OUT").reduce((s,l) => s+l.qty, 0);
  const inCount  = logs.filter(l => l.type === "IN").length;
  const outCount = logs.filter(l => l.type === "OUT").length;

  document.getElementById("rptMoveKpi").innerHTML = `
    <div class="rpt-kpi-card rpt-kpi-green">
      <div class="rpt-kpi-icon">↑</div>
      <div class="rpt-kpi-val">${totalIn.toLocaleString()}</div>
      <div class="rpt-kpi-lbl">Units In (${inCount} entries)</div>
    </div>
    <div class="rpt-kpi-card rpt-kpi-red">
      <div class="rpt-kpi-icon">↓</div>
      <div class="rpt-kpi-val">${totalOut.toLocaleString()}</div>
      <div class="rpt-kpi-lbl">Units Out (${outCount} entries)</div>
    </div>
    <div class="rpt-kpi-card">
      <div class="rpt-kpi-icon">Δ</div>
      <div class="rpt-kpi-val" style="color:${totalIn-totalOut>=0?"var(--green-dark)":"var(--danger)"}">${totalIn-totalOut>=0?"+":""}${(totalIn-totalOut).toLocaleString()}</div>
      <div class="rpt-kpi-lbl">Net Change</div>
    </div>
    <div class="rpt-kpi-card">
      <div class="rpt-kpi-icon">📝</div>
      <div class="rpt-kpi-val">${logs.length}</div>
      <div class="rpt-kpi-lbl">Total Log Entries</div>
    </div>`;

  // Per-item movement summary
  const byItem = {};
  logs.forEach(l => {
    if (!byItem[l.itemId]) byItem[l.itemId] = { name: l.itemName, in: 0, out: 0 };
    if (l.type === "IN")  byItem[l.itemId].in  += l.qty;
    else                  byItem[l.itemId].out += l.qty;
  });

  const itemSummTbody = document.getElementById("rptMoveItemTbl");
  const itemSummRows  = Object.entries(byItem).sort((a,b) => (b[1].in+b[1].out)-(a[1].in+a[1].out));
  if (itemSummRows.length === 0) {
    itemSummTbody.innerHTML = `<tr><td colspan="5" class="rpt-empty">No movements in this period.</td></tr>`;
  } else {
    itemSummTbody.innerHTML = itemSummRows.map(([id, d]) => `
      <tr>
        <td><span class="mono" style="font-size:12px">${id}</span></td>
        <td style="font-weight:500">${d.name}</td>
        <td style="text-align:right;font-weight:600;color:var(--green-dark)">+${d.in}</td>
        <td style="text-align:right;font-weight:600;color:var(--danger)">−${d.out}</td>
        <td style="text-align:right;font-weight:700;color:${d.in-d.out>=0?"var(--green-dark)":"var(--danger)"}">${d.in-d.out>=0?"+":""}${d.in-d.out}</td>
      </tr>`).join("");
  }

  // Full log table
  const logTbody = document.getElementById("rptFullLogTbl");
  const sortedLogs = [...logs].reverse();
  if (sortedLogs.length === 0) {
    logTbody.innerHTML = `<tr><td colspan="7" class="rpt-empty">No stock movement entries in this period.</td></tr>`;
  } else {
    logTbody.innerHTML = sortedLogs.map(l => `
      <tr>
        <td><span class="mono" style="font-size:12px">${l.id}</span></td>
        <td>${l.date}</td>
        <td><span class="mono" style="font-size:12px">${l.itemId}</span></td>
        <td style="font-weight:500">${l.itemName}</td>
        <td><span class="tag ${l.type==="IN"?"tag-green":"tag-red"}" style="font-size:11px">${l.type==="IN"?"↑ IN":"↓ OUT"}</span></td>
        <td style="text-align:right;font-weight:700">${l.qty}</td>
        <td style="font-size:12px;color:var(--text-mid)">${l.remarks}</td>
      </tr>`).join("");
  }
}

/* ── PRINT / EXPORT ── */
function printReport() {
  window.print();
}

/* ── HELPERS ── */
function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}
