/* ══════════════════════════════════════════════
   dashboard.js — Dashboard stats, recent txns,
                  and alert modals (Out of Stock
                  + Low Stock Alerts)
   Clean design: no inline alert clutter.
   Alerts live inside clickable stat cards that
   pop a focused modal when clicked.
══════════════════════════════════════════════ */

function renderDashboard() {
  const dateStr    = today();
  const todaySales = transactions.filter(t => t.date === dateStr).reduce((s, t) => s + t.total, 0);
  const itemIds    = [...new Set(inventory.map(i => i.id))];
  const totalItems = itemIds.length;

  // ── Compute alert groups once ──────────────────────────────────────────
  const outIds  = [];   // completely out of stock
  const lowIds  = [];   // qty > 0 but at/below reorder level

  itemIds.forEach(id => {
    const batches  = inventory.filter(i => i.id === id);
    const totalQty = batches.reduce((s, i) => s + i.qty, 0);
    const ref      = batches[0];
    const name     = ref?.name || id;
    const reorder  = ref?.reorder || 0;

    if (totalQty === 0) {
      outIds.push({ id, name, unit: ref?.unit || "" });
    } else if (reorder > 0 && totalQty <= reorder) {
      lowIds.push({ id, name, qty: totalQty, reorder, unit: ref?.unit || "" });
    }
  });

  // ── Stat cards (all 4 clickable) ──────────────────────────────────────
  const outBadge = outIds.length  > 0 ? `<span class="dash-badge dash-badge-red">${outIds.length}</span>`  : "";
  const lowBadge = lowIds.length  > 0 ? `<span class="dash-badge dash-badge-warn">${lowIds.length}</span>` : "";

  document.getElementById("statsGrid").innerHTML = `
    <div class="stat-card dash-clickable" onclick="navigate('transactions')" title="View today's transactions">
      <div class="stat-icon stat-icon-green">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green-dark)" stroke-width="2">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
      </div>
      <div style="flex:1">
        <div class="stat-value">₱${todaySales.toFixed(2)}</div>
        <div class="stat-label">Today's Sales</div>
      </div>
      <svg class="dash-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>

    <div class="stat-card dash-clickable" onclick="navigate('inventory')" title="View inventory">
      <div class="stat-icon stat-icon-teal">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--teal-dark)" stroke-width="2">
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>
      </div>
      <div style="flex:1">
        <div class="stat-value">${totalItems}</div>
        <div class="stat-label">Total Items</div>
      </div>
      <svg class="dash-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>

    <div class="stat-card dash-clickable ${outIds.length > 0 ? "dash-card-alert-red" : ""}"
         onclick="openStockAlertModal('out')" title="View out-of-stock items">
      <div class="stat-icon stat-icon-red">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <div style="flex:1">
        <div class="stat-value" style="${outIds.length > 0 ? "color:var(--danger)" : ""}">${outIds.length}</div>
        <div class="stat-label">Out of Stock ${outBadge}</div>
      </div>
      <svg class="dash-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>

    <div class="stat-card dash-clickable ${lowIds.length > 0 ? "dash-card-alert-warn" : ""}"
         onclick="openStockAlertModal('low')" title="View low-stock items">
      <div class="stat-icon stat-icon-warn">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div style="flex:1">
        <div class="stat-value" style="${lowIds.length > 0 ? "color:var(--warn)" : ""}">${lowIds.length}</div>
        <div class="stat-label">Low Stock ${lowBadge}</div>
      </div>
      <svg class="dash-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>`;

  // ── Recent transactions ────────────────────────────────────────────────
  const recentEl = document.getElementById("recentTxns");
  const recent   = [...transactions].reverse().slice(0, 5);
  if (recent.length === 0) {
    recentEl.innerHTML = `<li style="color:var(--text-soft);font-size:13px;padding:8px 0">No transactions yet.</li>`;
  } else {
    recentEl.innerHTML = recent.map(t => {
      // Show product names (e.g. "Paracetamol ×10, Vitamin C ×2") instead of
      // the raw TXN code — much easier to read at a glance while managing the store.
      const itemSummary = t.items.map(i => `${escapeHtml(i.name)} ×${i.qty}`).join(", ");
      return `
        <li class="recent-item">
          <div style="min-width:0">
            <div class="recent-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px">${itemSummary}</div>
            <div class="recent-meta">${t.id} · ${t.date}${t.time ? " · " + t.time : ""} · ${t.cashier}</div>
          </div>
          <div class="recent-amount">₱${t.total.toFixed(2)}</div>
        </li>`;
    }).join("");
  }

  // Store computed data for the modal to reference
  window._dashOutIds  = outIds;
  window._dashLowIds  = lowIds;
}

/* ══════════════════════════════════════════════
   STOCK ALERT MODAL
   mode = "out" → Out of Stock list
   mode = "low" → Low Stock list
══════════════════════════════════════════════ */
function openStockAlertModal(mode) {
  const isOut = mode === "out";
  const items = isOut ? (window._dashOutIds || []) : (window._dashLowIds || []);

  document.getElementById("stockAlertModalTitle").textContent =
    isOut ? "Out of Stock Items" : "Low Stock Items";
  document.getElementById("stockAlertModalSub").textContent =
    isOut
      ? `${items.length} item${items.length !== 1 ? "s" : ""} currently have zero stock`
      : `${items.length} item${items.length !== 1 ? "s" : ""} at or below their reorder level`;

  const body = document.getElementById("stockAlertModalBody");

  if (items.length === 0) {
    body.innerHTML = `
      <div style="text-align:center;padding:40px 24px;color:var(--text-soft)">
        <div style="font-size:36px;margin-bottom:12px">${isOut ? "✅" : "✅"}</div>
        <div style="font-size:14px;font-weight:600">${isOut ? "All items are in stock!" : "No items below reorder level!"}</div>
      </div>`;
  } else if (isOut) {
    body.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--bg)">
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text-soft);border-bottom:1px solid var(--border)">Item Code</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text-soft);border-bottom:1px solid var(--border)">Item Name</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text-soft);border-bottom:1px solid var(--border)">Unit</th>
            <th style="padding:10px 16px;text-align:center;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text-soft);border-bottom:1px solid var(--border)">Action</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(it => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:11px 16px"><span class="mono" style="font-size:12px;color:var(--text-mid)">${it.id}</span></td>
              <td style="padding:11px 16px;font-weight:600;color:var(--text)">${escapeHtml(it.name)}</td>
              <td style="padding:11px 16px;color:var(--text-soft)">${it.unit}</td>
              <td style="padding:11px 16px;text-align:center">
                <button class="btn btn-ghost btn-sm" onclick="closeModal('stockAlertModal');openStockModal()">
                  + Restock
                </button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  } else {
    body.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--bg)">
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text-soft);border-bottom:1px solid var(--border)">Item Code</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text-soft);border-bottom:1px solid var(--border)">Item Name</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text-soft);border-bottom:1px solid var(--border)">Current Stock</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text-soft);border-bottom:1px solid var(--border)">Reorder Level</th>
            <th style="padding:10px 16px;text-align:center;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text-soft);border-bottom:1px solid var(--border)">Action</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(it => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:11px 16px"><span class="mono" style="font-size:12px;color:var(--text-mid)">${it.id}</span></td>
              <td style="padding:11px 16px;font-weight:600;color:var(--text)">${escapeHtml(it.name)}</td>
              <td style="padding:11px 16px;text-align:right;font-weight:700;color:var(--warn)">${it.qty} ${it.unit}</td>
              <td style="padding:11px 16px;text-align:right;color:var(--text-soft)">${it.reorder}</td>
              <td style="padding:11px 16px;text-align:center">
                <button class="btn btn-ghost btn-sm" onclick="closeModal('stockAlertModal');openStockModal()">
                  + Restock
                </button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  }

  openModal("stockAlertModal");
}
