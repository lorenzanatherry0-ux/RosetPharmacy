/* ══════════════════════════════════════════════
   state.js — Shared application state & data
══════════════════════════════════════════════ */

const USERS = [
  { id: 1, username: "manager",    password: "roset123", role: "manager",    name: "Marjorie Portuguese" },
  { id: 2, username: "pharmacist", password: "pharm123", role: "pharmacist", name: "Analyn"              },
];

/* Updated category set (replaces the previous pharmacy-only list).
   NOTE: category is stored as a plain text column in Supabase (no DB enum/
   check-constraint exists on it), so changing this list does NOT require a
   schema migration — existing rows simply keep whatever string they had.
   Any item whose stored category is no longer in this list will just show
   up un-tagged in category filters until it's re-edited. */
const CATEGORIES = [
  "Branded", "Generics", "Self Care", "Glass Shelf",
  "Diapers", "Milk", "Refrigerator", "Medical Supplies"
];

/* ── INVENTORY ──
   Each item now also carries a `cost` (acquisition/capital cost per unit).
   This is what makes per-transaction PROFIT calculation possible — profit
   is only ever (price - cost) and is shown in Transaction History only,
   never on the POS selling screen. Seed costs below are demo estimates. */
let inventory = [
  { id:"MED001", name:"Amoxicillin 500mg",    category:"Generics",         qty:150, unit:"capsule", price:12.50, cost:7.80,  expiry:"2026-08-01", dateAdded:"2026-01-10", batchNo:1, reorder:40 },
  { id:"MED002", name:"Paracetamol 500mg",    category:"Generics",         qty:320, unit:"tablet",  price:3.25,  cost:1.60,  expiry:"2027-01-15", dateAdded:"2026-01-10", batchNo:1, reorder:80 },
  { id:"MED003", name:"Vitamin C 500mg",      category:"Self Care",        qty:200, unit:"tablet",  price:8.00,  cost:4.50,  expiry:"2026-12-30", dateAdded:"2026-01-15", batchNo:1, reorder:50 },
  { id:"MED004", name:"Biogesic 500mg",       category:"Branded",          qty:180, unit:"tablet",  price:5.50,  cost:3.20,  expiry:"2027-03-20", dateAdded:"2026-01-15", batchNo:1, reorder:50 },
  { id:"MED005", name:"Cetirizine 10mg",      category:"Branded",          qty:90,  unit:"tablet",  price:9.75,  cost:5.90,  expiry:"2026-06-10", dateAdded:"2026-02-01", batchNo:1, reorder:30 },
  { id:"MED006", name:"Lagundi 600mg",        category:"Generics",         qty:75,  unit:"capsule", price:7.00,  cost:4.10,  expiry:"2026-09-15", dateAdded:"2026-02-01", batchNo:1, reorder:20 },
  { id:"MED007", name:"Multivitamins Adult",  category:"Self Care",        qty:110, unit:"tablet",  price:6.50,  cost:3.75,  expiry:"2027-02-28", dateAdded:"2026-02-10", batchNo:1, reorder:30 },
  { id:"MED008", name:"Alcohol 70% 500mL",   category:"Self Care",         qty:18,  unit:"bottle",  price:55.00, cost:34.00, expiry:"2028-01-01", dateAdded:"2026-02-10", batchNo:1, reorder:15 },
  { id:"MED009", name:"Surgical Mask (Box)", category:"Medical Supplies",  qty:6,   unit:"box",     price:120.00,cost:78.00, expiry:"2030-01-01",  dateAdded:"2026-03-01", batchNo:1, reorder:10 },
  { id:"MED010", name:"Omeprazole 20mg",      category:"Generics",         qty:25,  unit:"capsule", price:14.00, cost:8.60,  expiry:"2026-05-01", dateAdded:"2026-03-01", batchNo:1, reorder:20 },
];

/* ── TRANSACTIONS ──
   Each line item now also carries `cost` (the cost basis at time of sale)
   so that `profit` for the whole transaction can be computed and stored.
   Profit = total (after discount) − total cost of goods sold. This is only
   ever surfaced in Transaction History, never on the POS screen. */
let transactions = [
  {
    id:"TXN001", date:"2026-03-08", time:"09:14 AM",
    items:[{name:"Paracetamol 500mg", qty:10, price:3.25, cost:1.60}],
    subtotal:32.50, discountPct:0, discAmt:0, total:32.50,
    cost:16.00, profit:16.50,
    cashTendered:50, change:17.50, cashier:"Analyn", paymentMethod:"Cash"
  },
  {
    id:"TXN002", date:"2026-03-09", time:"02:31 PM",
    items:[{name:"Vitamin C 500mg",qty:5,price:8.00,cost:4.50},{name:"Amoxicillin 500mg",qty:10,price:12.50,cost:7.80}],
    subtotal:165.00, discountPct:0, discAmt:0, total:165.00,
    cost:100.50, profit:64.50,
    cashTendered:200, change:35.00, cashier:"Marjorie Portuguese", paymentMethod:"Cash"
  },
];

/* ── STOCK LOG ── */
let stockLog = [
  { id:"LOG001", date:"2026-03-01", itemId:"MED001", itemName:"Amoxicillin 500mg",  type:"IN",  qty:100, remarks:"Restock from supplier", by:"Marjorie Portuguese"  },
  { id:"LOG002", date:"2026-03-05", itemId:"MED002", itemName:"Paracetamol 500mg",  type:"IN",  qty:200, remarks:"Monthly delivery",       by:"Marjorie Portuguese"  },
  { id:"LOG003", date:"2026-03-08", itemId:"MED002", itemName:"Paracetamol 500mg",  type:"OUT", qty:10,  remarks:"POS Sale #TXN001",        by:"Analyn"},
];

/* ── SESSION STATE ── */
let cart            = [];
let currentUser     = null;
let selectedRoleTab = "manager";
let discountType    = "none";   // none | senior | pwd | custom
let discountPct     = 0;
let dailyPanelOpen  = true;

/* ── UTILITIES ── */
function today() {
  return new Date().toISOString().split("T")[0];
}

/* Escape user-supplied text before inserting into innerHTML, to prevent
   stored-XSS via item names, remarks, supplier notes, CSV imports, etc. */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toast(type, msg) {
  const wrap = document.getElementById("toastWrap");
  const t    = document.createElement("div");
  t.className = `toast toast-${type}`;
  const icons = { success: "✓", error: "✕", warn: "⚠" };
  t.innerHTML = `<span>${icons[type] || "ℹ"}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.animation = "toastOut .3s ease forwards";
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

function openModal(id)  { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

/* ── AUTO ITEM CODE GENERATOR ──────────────────
   Finds the highest existing MED### number across
   all inventory and returns the next one in sequence.
   Used by openAddItemModal() (inventory.js) and the
   Bulk Add modal (bulk.js) so codes are always unique
   and continuous regardless of how items were added. */
function nextItemCode(extraCodes = []) {
  const existing = inventory.map(i => i.id)
    .concat(extraCodes)
    .filter(id => /^MED\d+$/.test(id))
    .map(id => parseInt(id.replace("MED", "")))
    .filter(n => !isNaN(n));
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return "MED" + String(max + 1).padStart(3, "0");
}

function populateCatDropdowns() {
  ["#posCatFilter", "#invCatFilter"].forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    const current = el.value;
    while (el.options.length > 1) el.remove(1);
    CATEGORIES.forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c;
      el.appendChild(o);
    });
    el.value = current;
  });
  const fCat = document.getElementById("fItemCat");
  if (fCat) {
    fCat.innerHTML = "";
    CATEGORIES.forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c;
      fCat.appendChild(o);
    });
  }
  populateStockItemSelect();
}

function populateStockItemSelect() {
  const sel = document.getElementById("fStockItem");
  if (!sel) return;
  // Deduplicate by id
  const seen = new Set();
  sel.innerHTML = "";
  inventory.forEach(it => {
    if (!seen.has(it.id)) {
      seen.add(it.id);
      const o = document.createElement("option");
      o.value = it.id;
      o.textContent = `${it.id} — ${it.name}`;
      sel.appendChild(o);
    }
  });
}
