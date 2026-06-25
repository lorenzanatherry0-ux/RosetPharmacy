/* ══════════════════════════════════════════════
   report.js — Inventory & Sales Reports
   Date-range filterable reports for manager view
══════════════════════════════════════════════ */

/* ── INIT ── */
function initReports() {
  // Default date range: first day of current month → today
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const todayStr = today();
  document.getElementById("rptFrom").value = first;
  document.getElementById("rptTo").value   = todayStr;
  renderReports();
}

/* ── QUICK PRESETS ── */
function setReportPreset(preset) {
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

  document.getElementById("rptFrom").value = from;
  document.getElementById("rptTo").value   = to;

  // Highlight active preset
  document.querySelectorAll(".rpt-preset-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.preset === preset)
  );
  renderReports();
}

/* ── MAIN RENDER ── */
function renderReports() {
  const from = document.getElementById("rptFrom").value;
  const to   = document.getElementById("rptTo").value;
  if (!from || !to) return;

  const tab = document.querySelector(".rpt-tab-btn.active")?.dataset.tab || "sales";
  if (tab === "sales")     renderSalesReport(from, to);
  else if (tab === "inventory") renderInventoryReport(from, to);
  else if (tab === "movement")  renderMovementReport(from, to);

  // Update range label
  document.getElementById("rptRangeLabel").textContent =
    `${formatDisplayDate(from)} — ${formatDisplayDate(to)}`;
}

function switchReportTab(tab) {
  document.querySelectorAll(".rpt-tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === tab)
  );
  document.querySelectorAll(".rpt-panel").forEach(p =>
    p.classList.toggle("active", p.dataset.panel === tab)
  );
  renderReports();
}

/* ══════════════════════════════════════════════
   SALES REPORT
══════════════════════════════════════════════ */
function renderSalesReport(from, to) {
  const filtered = transactions.filter(t => t.date >= from && t.date <= to);

  // ── KPI row ──
  const totalRevenue = filtered.reduce((s, t) => s + t.total, 0);
  const totalTxns    = filtered.length;
  const totalDisc    = filtered.reduce((s, t) => s + (t.discAmt || 0), 0);
  const avgTxn       = totalTxns > 0 ? totalRevenue / totalTxns : 0;
  const cashTxns     = filtered.filter(t => t.paymentMethod === "Cash").length;
  const gcashTxns    = filtered.filter(t => t.paymentMethod === "GCash").length;
  const cardTxns     = filtered.filter(t => t.paymentMethod === "Card").length;

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

  // ── Payment method breakdown ──
  document.getElementById("rptPaymentBreakdown").innerHTML = `
    <div class="rpt-breakdown-row">
      <span class="rpt-bk-label"><span class="rpt-dot rpt-dot-teal"></span>Cash</span>
      <span class="rpt-bk-count">${cashTxns} txns</span>
      <span class="rpt-bk-amt">₱${filtered.filter(t=>t.paymentMethod==="Cash").reduce((s,t)=>s+t.total,0).toFixed(2)}</span>
    </div>
    <div class="rpt-breakdown-row">
      <span class="rpt-bk-label"><span class="rpt-dot rpt-dot-blue"></span>GCash</span>
      <span class="rpt-bk-count">${gcashTxns} txns</span>
      <span class="rpt-bk-amt">₱${filtered.filter(t=>t.paymentMethod==="GCash").reduce((s,t)=>s+t.total,0).toFixed(2)}</span>
    </div>
    <div class="rpt-breakdown-row">
      <span class="rpt-bk-label"><span class="rpt-dot rpt-dot-purple"></span>Card</span>
      <span class="rpt-bk-count">${cardTxns} txns</span>
      <span class="rpt-bk-amt">₱${filtered.filter(t=>t.paymentMethod==="Card").reduce((s,t)=>s+t.total,0).toFixed(2)}</span>
    </div>`;

  // ── Daily sales table ──
  const byDay = {};
  filtered.forEach(t => {
    if (!byDay[t.date]) byDay[t.date] = { revenue: 0, txns: 0 };
    byDay[t.date].revenue += t.total;
    byDay[t.date].txns    += 1;
  });
  const dayRows = Object.keys(byDay).sort().reverse();

  const dailyTbody = document.getElementById("rptDailySalesTbl");
  if (dayRows.length === 0) {
    dailyTbody.innerHTML = `<tr><td colspan="4" class="rpt-empty">No sales in this period.</td></tr>`;
  } else {
    dailyTbody.innerHTML = dayRows.map(d => `
      <tr>
        <td>${formatDisplayDate(d)}</td>
        <td>${byDay[d].txns}</td>
        <td style="font-weight:700;color:var(--green-dark)">₱${byDay[d].revenue.toFixed(2)}</td>
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

  // ── Transaction list ──
  const txnTbody = document.getElementById("rptTxnListTbl");
  const sortedTxns = [...filtered].reverse();
  if (sortedTxns.length === 0) {
    txnTbody.innerHTML = `<tr><td colspan="7" class="rpt-empty">No transactions in this date range.</td></tr>`;
  } else {
    txnTbody.innerHTML = sortedTxns.map(t => `
      <tr>
        <td><span class="mono" style="font-size:12px">${t.id}</span></td>
        <td>${t.date}${t.time ? `<span style="display:block;font-size:11px;color:var(--text-soft)">${t.time}</span>` : ""}</td>
        <td style="font-size:12px;color:var(--text-mid);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.items.map(i=>`${i.name}×${i.qty}`).join(", ")}</td>
        <td><span class="tag tag-teal" style="font-size:11px">${t.paymentMethod}</span></td>
        <td>${t.discountPct > 0 ? `<span class="tag tag-warn" style="font-size:11px">${t.discountPct}%</span>` : "—"}</td>
        <td style="font-weight:700;color:var(--green-dark)">₱${t.total.toFixed(2)}</td>
        <td style="font-size:12px;color:var(--text-soft)">${t.cashier}</td>
      </tr>`).join("");
  }
}

/* ══════════════════════════════════════════════
   INVENTORY REPORT
══════════════════════════════════════════════ */
function renderInventoryReport(from, to) {
  // Show current snapshot; "date range" filters items added within range
  const addedInRange = inventory.filter(i => i.dateAdded >= from && i.dateAdded <= to);
  const allIds       = [...new Set(inventory.map(i => i.id))];

  // Category breakdown
  const byCat = {};
  allIds.forEach(id => {
    const batches  = inventory.filter(i => i.id === id);
    const cat      = batches[0].category;
    const totalQty = batches.reduce((s, i) => s + i.qty, 0);
    const value    = batches.reduce((s, i) => s + i.qty * i.price, 0);
    if (!byCat[cat]) byCat[cat] = { items: 0, qty: 0, value: 0 };
    byCat[cat].items += 1;
    byCat[cat].qty   += totalQty;
    byCat[cat].value += value;
  });

  const totalValue = Object.values(byCat).reduce((s, c) => s + c.value, 0);
  const totalQtyAll = Object.values(byCat).reduce((s, c) => s + c.qty, 0);
  const lowIds  = allIds.filter(id => {
    const b = inventory.filter(i => i.id === id);
    const q = b.reduce((s,i)=>s+i.qty,0);
    return q > 0 && q <= (b[0]?.reorder || 0);
  });
  const outIds  = allIds.filter(id => inventory.filter(i=>i.id===id).reduce((s,i)=>s+i.qty,0) === 0);

  // Expiry alerts
  const expSoon = inventory.filter(i => {
    const d = Math.ceil((new Date(i.expiry) - new Date()) / 86400000);
    return d > 0 && d <= 90;
  });
  const expired = inventory.filter(i => new Date(i.expiry) < new Date());

  document.getElementById("rptInvKpi").innerHTML = `
    <div class="rpt-kpi-card rpt-kpi-teal">
      <div class="rpt-kpi-icon">📦</div>
      <div class="rpt-kpi-val">${allIds.length}</div>
      <div class="rpt-kpi-lbl">Unique Items</div>
    </div>
    <div class="rpt-kpi-card">
      <div class="rpt-kpi-icon">🔢</div>
      <div class="rpt-kpi-val">${totalQtyAll.toLocaleString()}</div>
      <div class="rpt-kpi-lbl">Total Units in Stock</div>
    </div>
    <div class="rpt-kpi-card rpt-kpi-green">
      <div class="rpt-kpi-icon">₱</div>
      <div class="rpt-kpi-val">₱${totalValue.toFixed(2)}</div>
      <div class="rpt-kpi-lbl">Total Inventory Value</div>
    </div>
    <div class="rpt-kpi-card rpt-kpi-warn">
      <div class="rpt-kpi-icon">⚠️</div>
      <div class="rpt-kpi-val">${lowIds.length + outIds.length}</div>
      <div class="rpt-kpi-lbl">Low / Out of Stock</div>
    </div>`;

  // Category table
  const catTbody = document.getElementById("rptCatTbl");
  catTbody.innerHTML = Object.entries(byCat)
    .sort((a,b) => b[1].value - a[1].value)
    .map(([cat, d]) => `
      <tr>
        <td><span class="tag tag-teal">${cat}</span></td>
        <td style="text-align:right">${d.items}</td>
        <td style="text-align:right">${d.qty.toLocaleString()}</td>
        <td style="text-align:right;font-weight:700;color:var(--green-dark)">₱${d.value.toFixed(2)}</td>
        <td style="text-align:right;color:var(--text-soft)">
          ${totalValue > 0 ? ((d.value/totalValue)*100).toFixed(1) : 0}%
        </td>
      </tr>`).join("") || `<tr><td colspan="5" class="rpt-empty">No data.</td></tr>`;

  // Full item table (current snapshot)
  const invTbody = document.getElementById("rptInvItemsTbl");
  const sortedInv = allIds.map(id => {
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
  }).sort((a,b) => a.id.localeCompare(b.id));

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
  }).join("") || `<tr><td colspan="8" class="rpt-empty">No items found.</td></tr>`;

  // Items added in range
  const addedTbody = document.getElementById("rptAddedItemsTbl");
  const addedIds = [...new Set(addedInRange.map(i => i.id))];
  if (addedIds.length === 0) {
    addedTbody.innerHTML = `<tr><td colspan="5" class="rpt-empty">No items added in this period.</td></tr>`;
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
   STOCK MOVEMENT REPORT
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
