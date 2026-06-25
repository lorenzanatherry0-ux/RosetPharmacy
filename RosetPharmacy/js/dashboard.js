/* ══════════════════════════════════════════════
   dashboard.js — Dashboard stats and alerts
══════════════════════════════════════════════ */

function renderDashboard() {
  const dateStr    = today();
  const todaySales = transactions.filter(t => t.date === dateStr).reduce((s, t) => s + t.total, 0);
  const totalItems = [...new Set(inventory.map(i => i.id))].length;
  const outOfStock = [...new Set(inventory.map(i => i.id))].filter(id =>
    inventory.filter(i => i.id === id).reduce((s, i) => s + i.qty, 0) === 0
  ).length;

  /* ── Stat cards ── */
  document.getElementById("statsGrid").innerHTML = `
    <div class="stat-card">
      <div class="stat-icon stat-icon-green">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green-dark)" stroke-width="2">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
      </div>
      <div><div class="stat-value">₱${todaySales.toFixed(2)}</div><div class="stat-label">Today's Sales</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-teal">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--teal-dark)" stroke-width="2">
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>
      </div>
      <div><div class="stat-value">${totalItems}</div><div class="stat-label">Total Items</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-red">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <div><div class="stat-value">${outOfStock}</div><div class="stat-label">Out of Stock</div></div>
    </div>`;

  /* ── Recent transactions ── */
  const recentEl = document.getElementById("recentTxns");
  const recent   = [...transactions].reverse().slice(0, 5);
  if (recent.length === 0) {
    recentEl.innerHTML = `<li style="color:var(--text-soft);font-size:13px">No transactions yet.</li>`;
  } else {
    recentEl.innerHTML = recent.map(t => `
      <li class="recent-item">
        <div>
          <div class="recent-name">${t.id}</div>
          <div class="recent-meta">${t.date}${t.time ? " · " + t.time : ""} · ${t.cashier} · ${t.paymentMethod}</div>
        </div>
        <div class="recent-amount">₱${t.total.toFixed(2)}</div>
      </li>`).join("");
  }

  /* ── Alerts ── */
  const alertsEl = document.getElementById("alertsBox");
  const alerts   = [];

  // Group inventory by id
  const itemIds = [...new Set(inventory.map(i => i.id))];
  itemIds.forEach(id => {
    const batches  = inventory.filter(i => i.id === id);
    const totalQty = batches.reduce((s, i) => s + i.qty, 0);
    const name     = batches[0]?.name    || id;

    if (totalQty === 0) alerts.push({ critical: true,  text: `<strong>${name}</strong> is out of stock` });

    batches.forEach(b => {
      const diff = Math.ceil((new Date(b.expiry) - new Date()) / (1000 * 60 * 60 * 24));
      if (diff <= 0)        alerts.push({ critical: true,  text: `<strong>${name}</strong> batch #${b.batchNo} has expired!` });
      else if (diff <= 30)  alerts.push({ critical: false, text: `<strong>${name}</strong> batch #${b.batchNo} expires in ${diff} day${diff !== 1 ? "s" : ""}` });
    });
  });

  if (alerts.length === 0) {
    alertsEl.innerHTML = `<div style="color:var(--text-soft);font-size:13px;padding:8px 0">✅ No active alerts.</div>`;
  } else {
    alertsEl.innerHTML = alerts.slice(0, 6).map(a => `
      <div class="alert-item ${a.critical ? "critical" : ""}">
        <span style="font-size:16px">${a.critical ? "🔴" : "⚠️"}</span>
        <span class="alert-text">${a.text}</span>
      </div>`).join("");
  }
}
