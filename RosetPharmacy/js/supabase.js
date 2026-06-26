/* ══════════════════════════════════════════════
   supabase.js — Supabase integration
   Syncs: inventory, transactions, stock_log
   
   SETUP:
   1. Create a Supabase project at https://supabase.com
   2. Run the SQL schema below in your Supabase SQL Editor
   3. Replace SUPABASE_URL and SUPABASE_ANON_KEY below
══════════════════════════════════════════════

-- SUPABASE SQL SCHEMA (run this once):

create table if not exists inventory (
  id          text not null,
  batch_no    int  not null,
  name        text not null,
  category    text not null,
  qty         int  not null default 0,
  unit        text not null,
  price       numeric(10,2) not null default 0,
  expiry      date,
  reorder     int  not null default 0,
  date_added  date,
  primary key (id, batch_no)
);

create table if not exists transactions (
  id              text primary key,
  date            date not null,
  time            text,
  items           jsonb not null default '[]',
  subtotal        numeric(10,2) not null,
  discount_pct    numeric(5,2)  not null default 0,
  disc_amt        numeric(10,2) not null default 0,
  total           numeric(10,2) not null,
  cash_tendered   numeric(10,2),
  change          numeric(10,2),
  cashier         text not null,
  payment_method  text not null
);

create table if not exists stock_log (
  id         text primary key,
  date       date not null,
  item_id    text not null,
  item_name  text not null,
  type       text not null check (type in ('IN','OUT')),
  qty        int  not null,
  remarks    text,
  by_user    text not null
);

-- Enable Row Level Security and allow the anon key full access.
-- NOTE: this matches the app's CURRENT auth model (client-side role
-- check only, no Supabase Auth) — anyone with the anon key can read/write
-- these tables. This is fine for an internal/single-location pharmacy on a
-- private link, but if you ever expose this publicly, migrate to Supabase
-- Auth and replace these policies with auth.uid()-scoped ones.
alter table inventory    enable row level security;
alter table transactions enable row level security;
alter table stock_log    enable row level security;

create policy "anon_full_access_inventory"    on inventory    for all using (true) with check (true);
create policy "anon_full_access_transactions" on transactions for all using (true) with check (true);
create policy "anon_full_access_stock_log"    on stock_log    for all using (true) with check (true);

*/

/* ══ CONFIGURATION — fill these in ══ */
const SUPABASE_URL      = "https://exouewpedvxqlhcdltjw.supabase.co";   // e.g. "https://xyzxyz.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4b3Vld3BlZHZ4cWxoY2RsdGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTk5NjcsImV4cCI6MjA5Nzk3NTk2N30.leaM3D0hlbc3z5mth5GOYxScwCPiuRh_7jLvaOO3SmQ";   // your project's anon/public key

/* ══════════════════════════════════════════════
   CORE FETCH HELPER
══════════════════════════════════════════════ */
let _sbConfigured = false;

function _sbReady() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  _sbConfigured = true;
  return true;
}

async function sbFetch(path, opts = {}) {
  if (!_sbReady()) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey":        SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type":  "application/json",
      "Prefer":        opts.prefer || "return=minimal",
      ...opts.headers,
    },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[Supabase]", res.status, err);
    return null;
  }
  if (res.status === 204) return true;
  return res.json().catch(() => null);
}

/* ══════════════════════════════════════════════
   SHAPE CONVERTERS  (JS model ↔ DB columns)
══════════════════════════════════════════════ */
function toDbInventory(item) {
  return {
    id:         item.id,
    batch_no:   item.batchNo,
    name:       item.name,
    category:   item.category,
    qty:        item.qty,
    unit:       item.unit,
    price:      item.price,
    expiry:     item.expiry || null,
    reorder:    item.reorder || 0,
    date_added: item.dateAdded || null,
  };
}

function fromDbInventory(row) {
  return {
    id:        row.id,
    batchNo:   row.batch_no,
    name:      row.name,
    category:  row.category,
    qty:       row.qty,
    unit:      row.unit,
    price:     parseFloat(row.price),
    expiry:    row.expiry,
    reorder:   row.reorder || 0,
    dateAdded: row.date_added,
  };
}

function toDbTransaction(t) {
  return {
    id:             t.id,
    date:           t.date,
    time:           t.time || null,
    items:          JSON.stringify(t.items),
    subtotal:       t.subtotal,
    discount_pct:   t.discountPct || 0,
    disc_amt:       t.discAmt || 0,
    total:          t.total,
    cash_tendered:  t.cashTendered || null,
    change:         t.change || null,
    cashier:        t.cashier,
    payment_method: t.paymentMethod,
  };
}

function fromDbTransaction(row) {
  return {
    id:            row.id,
    date:          row.date,
    time:          row.time,
    items:         typeof row.items === "string" ? JSON.parse(row.items) : row.items,
    subtotal:      parseFloat(row.subtotal),
    discountPct:   parseFloat(row.discount_pct),
    discAmt:       parseFloat(row.disc_amt),
    total:         parseFloat(row.total),
    cashTendered:  row.cash_tendered ? parseFloat(row.cash_tendered) : null,
    change:        row.change ? parseFloat(row.change) : null,
    cashier:       row.cashier,
    paymentMethod: row.payment_method,
  };
}

function toDbStockLog(l) {
  return {
    id:        l.id,
    date:      l.date,
    item_id:   l.itemId,
    item_name: l.itemName,
    type:      l.type,
    qty:       l.qty,
    remarks:   l.remarks || "",
    by_user:   l.by,
  };
}

function fromDbStockLog(row) {
  return {
    id:       row.id,
    date:     row.date,
    itemId:   row.item_id,
    itemName: row.item_name,
    type:     row.type,
    qty:      row.qty,
    remarks:  row.remarks,
    by:       row.by_user,
  };
}

/* ══════════════════════════════════════════════
   LOAD ALL DATA FROM SUPABASE
   Called once on initApp() if configured.
══════════════════════════════════════════════ */
async function sbLoadAll() {
  if (!_sbReady()) return false;
  try {
    showSbStatus("loading");

    const [invRows, txnRows, logRows] = await Promise.all([
      sbFetch("inventory?order=id.asc,batch_no.asc",    { prefer: "return=representation" }),
      sbFetch("transactions?order=date.asc,id.asc",      { prefer: "return=representation" }),
      sbFetch("stock_log?order=date.asc,id.asc",         { prefer: "return=representation" }),
    ]);

    if (invRows)  inventory     = invRows.map(fromDbInventory);
    if (txnRows)  transactions  = txnRows.map(fromDbTransaction);
    if (logRows)  stockLog      = logRows.map(fromDbStockLog);

    showSbStatus("ok");

    // Guard: if Supabase is reachable but its tables are completely empty
    // (e.g. first-ever connection before any sync), warn instead of silently
    // running the POS with a blank inventory.
    if (invRows && invRows.length === 0) {
      setTimeout(() => toast("warn", "Connected to Supabase, but inventory table is empty. Use the DB status chip (sidebar) to push your local data via Full Sync."), 500);
    }

    return true;
  } catch (e) {
    console.error("[Supabase] loadAll error:", e);
    showSbStatus("error");
    return false;
  }
}

/* ══════════════════════════════════════════════
   UPSERT INVENTORY BATCH
══════════════════════════════════════════════ */
async function sbUpsertInventoryBatch(items) {
  if (!_sbReady()) return;
  // items = array of inventory objects
  const rows = (Array.isArray(items) ? items : [items]).map(toDbInventory);
  await sbFetch("inventory", {
    method:  "POST",
    body:    JSON.stringify(rows),
    prefer:  "resolution=merge-duplicates,return=minimal",
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
  });
}

async function sbUpsertInventoryItem(item) {
  return sbUpsertInventoryBatch([item]);
}

async function sbDeleteInventoryBatch(id, batchNo) {
  if (!_sbReady()) return;
  await sbFetch(`inventory?id=eq.${encodeURIComponent(id)}&batch_no=eq.${batchNo}`, {
    method: "DELETE",
  });
}

/* ══════════════════════════════════════════════
   UPSERT / DELETE TRANSACTIONS
══════════════════════════════════════════════ */
async function sbInsertTransaction(txn) {
  if (!_sbReady()) return;
  await sbFetch("transactions", {
    method: "POST",
    body:   JSON.stringify(toDbTransaction(txn)),
    prefer: "return=minimal",
  });
}

/* ══════════════════════════════════════════════
   UPSERT STOCK LOG
══════════════════════════════════════════════ */
async function sbInsertStockLog(log) {
  if (!_sbReady()) return;
  await sbFetch("stock_log", {
    method: "POST",
    body:   JSON.stringify(toDbStockLog(log)),
    prefer: "return=minimal",
  });
}

/* ══════════════════════════════════════════════
   FULL SYNC — push entire local state to Supabase
   Useful for first-time setup or after offline edits
══════════════════════════════════════════════ */
async function sbFullSync() {
  if (!_sbReady()) {
    toast("warn", "Supabase not configured. See supabase.js for setup instructions.");
    return;
  }
  try {
    showSbStatus("syncing");

    // Upsert all inventory
    if (inventory.length > 0) {
      await sbFetch("inventory", {
        method:  "POST",
        body:    JSON.stringify(inventory.map(toDbInventory)),
        headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
      });
    }

    // Upsert all transactions
    if (transactions.length > 0) {
      await sbFetch("transactions", {
        method:  "POST",
        body:    JSON.stringify(transactions.map(toDbTransaction)),
        headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
      });
    }

    // Upsert all stock log
    if (stockLog.length > 0) {
      await sbFetch("stock_log", {
        method:  "POST",
        body:    JSON.stringify(stockLog.map(toDbStockLog)),
        headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
      });
    }

    showSbStatus("ok");
    toast("success", "Full sync to Supabase complete!");
  } catch (e) {
    console.error("[Supabase] fullSync error:", e);
    showSbStatus("error");
    toast("error", "Sync failed. Check console for details.");
  }
}

/* ══════════════════════════════════════════════
   STATUS INDICATOR (small chip in sidebar footer)
══════════════════════════════════════════════ */
function showSbStatus(state) {
  const el = document.getElementById("sbStatusChip");
  if (!el) return;
  const map = {
    loading: { icon: "⏳", text: "Connecting…",  cls: "" },
    syncing: { icon: "🔄", text: "Syncing…",      cls: "" },
    ok:      { icon: "🟢", text: "DB Connected",  cls: "ok" },
    error:   { icon: "🔴", text: "DB Error",       cls: "err" },
    off:     { icon: "⚪", text: "Local Mode",     cls: "" },
  };
  const s = map[state] || map.off;
  el.innerHTML  = `${s.icon} <span>${s.text}</span>`;
  el.dataset.state = s.cls;
}

/* ══════════════════════════════════════════════
   INIT — called at app startup
══════════════════════════════════════════════ */
async function sbInit() {
  const el = document.getElementById("sbStatusChip");
  if (!_sbReady()) {
    if (el) showSbStatus("off");
    return false;  // gracefully fall back to local mode
  }
  return await sbLoadAll();
}
