/* ══════════════════════════════════════════════
   auth.js — Login, logout, app init, navigation
══════════════════════════════════════════════ */

function setRoleTab(r) {
  selectedRoleTab = r;
  document.querySelectorAll(".role-tab").forEach(t =>
    t.classList.toggle("active", t.textContent.trim().toLowerCase() === r)
  );
}

function doLogin() {
  const u    = document.getElementById("loginUsername").value.trim();
  const p    = document.getElementById("loginPassword").value;
  const user = USERS.find(x => x.username === u && x.password === p);

  if (!user) { showLoginError("Invalid username or password."); return; }
  if (user.role !== selectedRoleTab) {
    showLoginError(`This account is a ${user.role}. Please select the correct role tab.`);
    return;
  }

  currentUser = user;
  document.getElementById("loginError").classList.add("hidden");
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  initApp();
}

function showLoginError(msg) {
  document.getElementById("loginErrorMsg").textContent = msg;
  document.getElementById("loginError").classList.remove("hidden");
}

function doLogout() {
  currentUser = null;
  cart        = [];
  document.getElementById("app").classList.add("hidden");
  document.getElementById("loginPage").classList.remove("hidden");
  document.getElementById("loginUsername").value = "";
  document.getElementById("loginPassword").value = "";
}

async function initApp() {
  // User UI
  document.getElementById("userName").textContent      = currentUser.name;
  document.getElementById("userRoleLabel").textContent = currentUser.role;
  document.getElementById("userAvatar").textContent    = currentUser.name[0];
  document.getElementById("sidebarRole").textContent   = currentUser.role === "manager" ? "👑 Manager" : "💊 Pharmacist";

  // Show/hide manager-only nav items
  document.querySelectorAll(".manager-only").forEach(el =>
    el.classList.toggle("hidden", currentUser.role !== "manager")
  );

  // Date displays
  const now = new Date();
  document.getElementById("dashDate").textContent = now.toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  document.getElementById("cartDate").textContent = now.toLocaleString("en-PH", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });

  // ── Supabase: load data from DB (falls back gracefully if not configured) ──
  const sbLoaded = await sbInit();
  if (!sbLoaded) {
    // Running in local mode — seed data from state.js is already in place
    showSbStatus("off");
  }

  populateCatDropdowns();
  renderDashboard();
  renderPosGrid();
  renderDailyPanel();
  renderInventory();
  renderStockLog();
  renderTransactions();

  navigate("dashboard");
}

function navigate(page) {
  // Hide all pages
  document.querySelectorAll(".page").forEach(p => {
    p.classList.remove("active");
    if (p.id === "pos-page") p.style.display = "";
  });
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  const targetId = page === "pos" ? "pos-page" : page;
  const target   = document.getElementById(targetId);
  if (target) {
    if (page === "pos") { target.style.display = "flex"; target.classList.add("active"); }
    else                { target.classList.add("active"); }
  }

  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add("active");

  // Init report page fresh each time it's opened
  if (page === "reports") initReports();
}

/* ── Keyboard nav on login ── */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginUsername")?.addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("loginPassword").focus();
  });
  document.getElementById("loginPassword")?.addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });

  // Close modals on overlay click
  document.querySelectorAll(".modal-overlay").forEach(o => {
    o.addEventListener("click", function(e) {
      if (e.target === this) this.classList.add("hidden");
    });
  });
});
