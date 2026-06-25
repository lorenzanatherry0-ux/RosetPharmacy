/* ══════════════════════════════════════════════
   state.js — Shared application state & data
══════════════════════════════════════════════ */

const USERS = [
  { id: 1, username: "manager",    password: "roset123", role: "manager",    name: "Maria Santos"  },
  { id: 2, username: "pharmacist", password: "pharm123", role: "pharmacist", name: "Juan dela Cruz" },
];

const CATEGORIES = [
  "Prescription", "OTC Medicine", "Vitamins & Supplements",
  "Personal Care", "Medical Supplies", "Herbal"
];

/* ── INVENTORY ── */
let inventory = [
  { id:"MED001", name:"Amoxicillin 500mg",    category:"Prescription",           qty:150, unit:"capsule", price:12.50, expiry:"2026-08-01", dateAdded:"2026-01-10", batchNo:1 },
  { id:"MED002", name:"Paracetamol 500mg",    category:"OTC Medicine",           qty:320, unit:"tablet",  price:3.25,  expiry:"2027-01-15", dateAdded:"2026-01-10", batchNo:1 },
  { id:"MED003", name:"Vitamin C 500mg",      category:"Vitamins & Supplements", qty:200, unit:"tablet",  price:8.00,  expiry:"2026-12-30", dateAdded:"2026-01-15", batchNo:1 },
  { id:"MED004", name:"Biogesic 500mg",       category:"OTC Medicine",           qty:180, unit:"tablet",  price:5.50,  expiry:"2027-03-20", dateAdded:"2026-01-15", batchNo:1 },
  { id:"MED005", name:"Cetirizine 10mg",      category:"Prescription",           qty:90,  unit:"tablet",  price:9.75,  expiry:"2026-06-10", dateAdded:"2026-02-01", batchNo:1 },
  { id:"MED006", name:"Lagundi 600mg",        category:"Herbal",                 qty:75,  unit:"capsule", price:7.00,  expiry:"2026-09-15", dateAdded:"2026-02-01", batchNo:1 },
  { id:"MED007", name:"Multivitamins Adult",  category:"Vitamins & Supplements", qty:110, unit:"tablet",  price:6.50,  expiry:"2027-02-28", dateAdded:"2026-02-10", batchNo:1 },
  { id:"MED008", name:"Alcohol 70% 500mL",   category:"Personal Care",          qty:18,  unit:"bottle",  price:55.00, expiry:"2028-01-01", dateAdded:"2026-02-10", batchNo:1 },
  { id:"MED009", name:"Surgical Mask (Box)", category:"Medical Supplies",       qty:6,   unit:"box",     price:120.00,expiry:"2030-01-01",  dateAdded:"2026-03-01", batchNo:1 },
  { id:"MED010", name:"Omeprazole 20mg",      category:"Prescription",           qty:25,  unit:"capsule", price:14.00, expiry:"2026-05-01", dateAdded:"2026-03-01", batchNo:1 },
];

/* ── TRANSACTIONS ── */
let transactions = [
  {
    id:"TXN001", date:"2026-03-08", time:"09:14 AM",
    items:[{name:"Paracetamol 500mg", qty:10, price:3.25}],
    subtotal:32.50, discountPct:0, discAmt:0, total:32.50,
    cashTendered:50, change:17.50, cashier:"Juan dela Cruz", paymentMethod:"Cash"
  },
  {
    id:"TXN002", date:"2026-03-09", time:"02:31 PM",
    items:[{name:"Vitamin C 500mg",qty:5,price:8.00},{name:"Amoxicillin 500mg",qty:10,price:12.50}],
    subtotal:165.00, discountPct:0, discAmt:0, total:165.00,
    cashTendered:200, change:35.00, cashier:"Maria Santos", paymentMethod:"Cash"
  },
];

/* ── STOCK LOG ── */
let stockLog = [
  { id:"LOG001", date:"2026-03-01", itemId:"MED001", itemName:"Amoxicillin 500mg",  type:"IN",  qty:100, remarks:"Restock from supplier", by:"Maria Santos"  },
  { id:"LOG002", date:"2026-03-05", itemId:"MED002", itemName:"Paracetamol 500mg",  type:"IN",  qty:200, remarks:"Monthly delivery",       by:"Maria Santos"  },
  { id:"LOG003", date:"2026-03-08", itemId:"MED002", itemName:"Paracetamol 500mg",  type:"OUT", qty:10,  remarks:"POS Sale #TXN001",        by:"Juan dela Cruz"},
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
