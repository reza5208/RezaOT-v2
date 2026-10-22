// RezaOT core: local storage is available independently of cloud startup.
const firebaseConfig = {
  apiKey: "AIzaSyAIxHsCJYkJ05MflQnGTibGlCNru-dEPPs",
  authDomain: "reza-ot.firebaseapp.com",
  databaseURL: "https://reza-ot-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "reza-ot",
  storageBucket: "reza-ot.firebasestorage.app",
  messagingSenderId: "882084129955",
  appId: "1:882084129955:web:6556807195973a093ce316"
};
let db = null;
let trips = [];
let currentMonthKey = "";
let dailyRecords = {};
let firebaseRef = null;
let syncingFromFirebase = false;
let lastLocalSaveAt = 0;
let firebaseReady = false;
const OFFLINE_QUEUE_KEY = "rezaot_offline_queue";

window.RezaOT_state = {};
Object.defineProperties(window.RezaOT_state, {
  db: { get: function () { return db; }, set: function (v) { db = v; } },
  trips: { get: function () { return trips; }, set: function (v) { trips = v; } },
  currentMonthKey: { get: function () { return currentMonthKey; }, set: function (v) { currentMonthKey = v; } },
  dailyRecords: { get: function () { return dailyRecords; }, set: function (v) { dailyRecords = v; } }
});

function ensureDatabase() {
  const config = window.REZAOT_CONFIG || {};
  if (config.requireAuth && (!window.RezaOT_auth || !RezaOT_auth.canSync())) return null;
  if (db) return db;
  if (!window.firebase || typeof firebase.database !== "function") return null;
  try {
    if (!firebase.apps.length) firebase.initializeApp(config.firebaseConfig || firebaseConfig);
    if (config.requireAuth && (!firebase.auth || !firebase.auth().currentUser)) return null;
    db = firebase.database();
    return db;
  } catch (error) {
    console.warn("Cloud initialization unavailable:", error.message);
    return null;
  }
}

function showToast(message, duration = 2500) {
  const el = document.getElementById("toast");
  if (!el) { console.warn(message); return; }
  el.textContent = message;
  el.hidden = false;
  el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => { el.hidden = true; }, 300);
  }, duration);
}

function initDarkMode() {
  const saved = localStorage.getItem("darkMode") === "1";
  document.body.classList.toggle("dark", saved);
  const btn = document.getElementById("darkModeBtn");
  if (btn) btn.textContent = saved ? "☀️" : "🌙";
}
function toggleDarkMode() {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", isDark ? "1" : "0");
  const btn = document.getElementById("darkModeBtn");
  if (btn) btn.textContent = isDark ? "☀️" : "🌙";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = isDark ? "#1e2229" : "#007bff";
}
function getCurrentTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}
function getLocalDateString(d) {
  const x = d || new Date();
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}
function setNowTime(inputId) {
  const input = document.getElementById(inputId);
  if (input) { input.value = getCurrentTimeString(); showToast("Masa dikemaskini"); }
}
function getOfflineQueue() {
  return RezaOT_storage.read(OFFLINE_QUEUE_KEY, [], function (q) {
    if (!Array.isArray(q) || q.some(function (v) { return !v || typeof v.path !== "string" || !v.data; })) throw new Error("Queue tidak sah");
    return q.map(function (item) {
      if (item.revision) return item;
      return Object.assign({}, item, { revision: "legacy:" + item.path + ":" + (item.queuedAt || item.data.lastUpdated || "initial") });
    });
  });
}
function enqueueOfflineWrite(payload) {
  const q = getOfflineQueue().filter(function (item) { return item.path !== payload.path; });
  const revision = payload.revision || getDeviceId() + ":" + Date.now() + ":" + Math.random().toString(36).slice(2);
  q.push({ path: payload.path, data: RezaOT_storage.clone(payload.data), revision: revision, queuedAt: new Date().toISOString() });
  RezaOT_storage.write(OFFLINE_QUEUE_KEY, q);
  return revision;
}
function clearOfflineQueueItem(path, revision) {
  RezaOT_storage.write(OFFLINE_QUEUE_KEY, getOfflineQueue().filter(function (item) {
    return item.path !== path || (revision != null && item.revision !== revision);
  }));
}
function flushOfflineQueue() {
  return window.RezaOT_sync ? RezaOT_sync.flush() : Promise.resolve(false);
}
function getFirebaseRoot() {
  const config = window.REZAOT_CONFIG || {};
  if (config.requireAuth) {
    if (!window.RezaOT_auth || !RezaOT_auth.canSync()) return null;
    const user = window.firebase && firebase.auth && firebase.auth().currentUser;
    if (user && typeof RezaOT_auth.uid === "function" && RezaOT_auth.uid() !== user.uid) return null;
    return user ? "users/" + user.uid : null;
  }
  return "users/default";
}
function getFirebasePath() {
  const root = getFirebaseRoot();
  return root ? root + "/" + currentMonthKey : null;
}
function loadFromLocalStorage() {
  trips = RezaOT_storage.read("trips", defaultTrips, function (value) {
    return RezaOT_model.validateDestinations(value);
  });
  dailyRecords = RezaOT_storage.read("dailyRecords_" + currentMonthKey, {}, function (value) {
    return RezaOT_model.validateRecords(value, currentMonthKey);
  });
}
function persistLocalOnly() {
  RezaOT_storage.transaction([["trips", trips], ["dailyRecords_" + currentMonthKey, dailyRecords]]);
}
function saveToLocalStorage() {
  if (typeof captureMonthSettings === "function") captureMonthSettings(currentMonthKey, { replace: false });
  lastLocalSaveAt = Date.now();
  // The sync layer commits the month and its durable queue revision atomically.
  if (!window.RezaOT_sync) persistLocalOnly();
  const saved = saveToFirebase();
  if (window.RezaOT_sync) RezaOT_sync.tripsChanged();
  return saved;
}
function saveToFirebase() {
  // Every user save is durably queued before network work, even during snapshot application.
  return window.RezaOT_sync ? RezaOT_sync.saveMonth() : Promise.resolve(false);
}
function getDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("deviceId", id);
  }
  return id;
}
function setSyncStatus(state) {
  window.__rezaotSyncState = state;
  const el = document.getElementById("syncStatus");
  if (!el) return;
  el.className = "no-print sync-status";
  const labels = {
    online: ["sync-on", (window.rezaotT ? rezaotT("syncOnline", "● Sync on") : "● Sync on")],
    offline: ["sync-off", (window.rezaotT ? rezaotT("syncOffline", "● Offline — perubahan disimpan lokal") : "● Offline — perubahan disimpan lokal")],
    pending: ["sync-syncing", (window.rezaotT ? rezaotT("syncPending", "● Menunggu sync") : "● Menunggu sync")],
    denied: ["sync-denied", (window.rezaotT ? rezaotT("syncDenied", "● Akses cloud ditolak — data lokal dikekalkan") : "● Akses cloud ditolak — data lokal dikekalkan")],
    unavailable: ["sync-off", (window.rezaotT ? rezaotT("syncUnavailable", "● Mod lokal — cloud belum tersedia") : "● Mod lokal — cloud belum tersedia")],
    auth: ["sync-denied", (window.rezaotT ? rezaotT("syncAuth", "● Log masuk diperlukan untuk sync") : "● Log masuk diperlukan untuk sync")],
    conflict: ["sync-denied", (window.rezaotT ? rezaotT("syncConflict", "● Konflik disimpan dalam backup pemulihan") : "● Konflik disimpan dalam backup pemulihan")],
    syncing: ["sync-syncing", (window.rezaotT ? rezaotT("syncSyncing", "● Syncing…") : "● Syncing…")]
  };
  const label = labels[state] || labels.pending;
  el.classList.add(label[0]);
  el.textContent = label[1];
  el.setAttribute("role", "status");
}
function stopFirebaseListener() {
  if (window.RezaOT_sync) RezaOT_sync.stopMonth();
  else if (firebaseRef) { firebaseRef.off(); firebaseRef = null; }
}
function startFirebaseListener() {
  return window.RezaOT_sync ? RezaOT_sync.startMonth() : Promise.resolve(false);
}

function applyPrintAutoSize() {
  const tbody = document.querySelector("#reportTable tbody");
  if (!tbody) return;
  const rows = tbody.querySelectorAll("tr").length;
  document.body.classList.remove("print-size-sm", "print-size-xs", "print-size-xxs");
  // Target: 1 page A4 even with ~31 workdays
  if (rows > 26) document.body.classList.add("print-size-xxs");
  else if (rows > 18) document.body.classList.add("print-size-xs");
  else if (rows > 12) document.body.classList.add("print-size-sm");
}
function clearPrintAutoSize() {
  document.body.classList.remove("print-size-sm", "print-size-xs", "print-size-xxs");
}

function updateHolidayBadge() {
  const dateInput = document.getElementById("date");
  const badge = document.getElementById("holidayBadge");
  if (!dateInput || !badge) return;
  const d = dateInput.value;
  if (d && isPublicHoliday(d)) {
    badge.hidden = false;
    badge.classList.add("holiday-badge-on");
    badge.textContent = "🏖 Cuti: " + getHolidayName(d);
  } else {
    badge.hidden = true;
    badge.classList.remove("holiday-badge-on");
    badge.textContent = "";
  }
}

async function quickSaveToday() {
  if (window.__quickSaving) return false;
  window.__quickSaving = true;
  try {
    const now = new Date(), date = getLocalDateString(now);
    const month = monthNames[now.getMonth()] + " " + now.getFullYear();
    if (month !== currentMonthKey) selectMonth(month);
    const snapshot = JSON.stringify(dailyRecords[date] || null);
    if (dailyRecords[date] && !(await rezaotConfirm(rezaotT("confirmQuickSave", "Rekod hari ini sudah wujud. Tulis ganti 08:00–17:00?")))) return false;
    if (currentMonthKey !== month || snapshot !== JSON.stringify(dailyRecords[date] || null)) {
      showToast(rezaotT("recordChanged", "Bulan atau rekod telah berubah. Sila cuba semula.")); return false;
    }
    if (!dailyRecords[date]) dailyRecords[date] = { clock_in: "", clock_out: "", trips: [] };
    Object.assign(dailyRecords[date], { clock_in: "08:00", clock_out: "17:00", unpaid: false, annual: false });
    captureMonthSettings(month);
    document.getElementById("date").value = date;
    document.getElementById("clockIn").value = "08:00";
    document.getElementById("clockOut").value = "17:00";
    document.getElementById("unpaidLeaveCheck").checked = false;
    document.getElementById("annualLeaveCheck").checked = false;
    syncLeaveInputs(); updateHolidayBadge();
    saveToLocalStorage(); updateReport();
    showToast(rezaotT("toastToday", "Hari ini disimpan (08:00–17:00)"));
    return true;
  } finally { window.__quickSaving = false; }
}

async function openOtSettings() {
  const settings = getOtSettings();
  const weekday = await rezaotPrompt(rezaotT("weekdayOtPrompt", "OT Isnin–Jumaat bermula selepas (HH:MM):"), settings.weekdayAfter);
  if (weekday === null) return;
  const saturday = await rezaotPrompt(rezaotT("saturdayOtPrompt", "OT Sabtu bermula selepas (HH:MM):"), settings.saturdayAfter);
  if (saturday === null) return;
  try {
    saveOtSettings(validateOtSettings({ weekdayAfter: weekday.trim(), saturdayAfter: saturday.trim() }));
    updateReport();
    showToast(rezaotT("otSettingsSaved", "Tetapan OT disimpan. Kemas kini tetapan bulan jika mahu guna untuk rekod sedia ada."));
  } catch (error) { showToast(error.message); }
}
function setupEventListeners() {
  if (window.__rezaotListeners) return;
  window.__rezaotListeners = true;
  function bind(id, event, callback) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, function (e) {
      try { Promise.resolve(callback(e)).catch(function (error) { console.error(error); showToast(error.message); }); }
      catch (error) { console.error(error); showToast(error.message); }
    });
  }
  bind("darkModeBtn", "click", () => toggleDarkMode());
  bind("nowInBtn", "click", () => setNowTime("clockIn"));
  bind("nowOutBtn", "click", () => setNowTime("clockOut"));
  bind("clockForm", "submit", e => handleClockFormSubmit(e));
  bind("tripForm", "submit", e => handleTripFormSubmit(e));
  bind("destination", "change", () => handleDestinationChange());
  bind("addTripButton", "click", () => handleAddTrip());
  bind("toggleManageBtn", "click", () => toggleManageSection());
  bind("monthYear", "change", () => handleMonthChange());
  bind("exportExcelBtn", "click", () => exportToExcel());
  bind("exportDataBtn", "click", () => exportData());
  bind("exportRecoveryBtn", "click", () => {
    const entries = RezaOT_storage.recoveryEntries();
    if (!entries.length) { showToast(rezaotT("noRecovery", "Tiada salinan pemulihan.")); return; }
    const payload = { schemaVersion: 1, kind: "rezaot-recovery", exportedAt: new Date().toISOString(), entries };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "RezaOT_recovery_" + getLocalDateString() + ".json";
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  bind("importDataInput", "change", e => importData(e));
  bind("supervisorName", "click", () => editSupervisorName());
  bind("supervisorName", "keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); return editSupervisorName(); } });
  const supervisor = document.getElementById("supervisorName");
  if (supervisor) { supervisor.tabIndex = 0; supervisor.setAttribute("role", "button"); supervisor.style.cursor = "pointer"; }
  bind("quickSaveTodayBtn", "click", () => quickSaveToday());
  bind("otSettingsBtn", "click", () => openOtSettings());
}
