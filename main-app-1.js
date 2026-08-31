// main-app.js - RezaOT v18.1 (Complete + safe Firebase merge)
// Restored base — v18 features via v18-features.js

const firebaseConfig = {
  apiKey: "AIzaSyAIxHsCJYkJ05MflQnGTibGlCNru-dEPPs",
  authDomain: "reza-ot.firebaseapp.com",
  databaseURL: "https://reza-ot-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "reza-ot",
  storageBucket: "reza-ot.firebasestorage.app",
  messagingSenderId: "882084129955",
  appId: "1:882084129955:web:6556807195973a093ce316"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let trips = [];
let currentMonthKey = "";
let dailyRecords = {};

function showToast(message, duration = 2500) {
  const el = document.getElementById("toast");
  if (!el) { alert(message); return; }
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

function setNowTime(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.value = getCurrentTimeString();
    showToast("Masa dikemaskini");
  }
}

const OFFLINE_QUEUE_KEY = "rezaot_offline_queue";
function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]"); }
  catch (e) { return []; }
}
function enqueueOfflineWrite(payload) {
  const q = getOfflineQueue();
  q.push({ ...payload, queuedAt: new Date().toISOString() });
  const byPath = {};
  q.forEach((item) => { byPath[item.path] = item; });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(Object.values(byPath)));
}
function clearOfflineQueueItem(path) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(getOfflineQueue().filter((i) => i.path !== path)));
}
async function flushOfflineQueue() {
  if (!navigator.onLine) return;
  const q = getOfflineQueue();
  if (!q.length) return;
  for (const item of q) {
    try {
      await db.ref(item.path).set(item.data);
      clearOfflineQueueItem(item.path);
    } catch (err) {
      console.warn("Offline queue flush failed:", err);
      setSyncStatus("offline");
      return;
    }
  }
  setSyncStatus("online");
  showToast("Data offline berjaya disync");
}

let firebaseRef = null;
let syncingFromFirebase = false;
let lastLocalSaveAt = 0;
let firebaseReady = false;

function getFirebasePath() {
  return `users/default/${currentMonthKey}`;
}

function loadFromLocalStorage() {
  const savedTrips = localStorage.getItem("trips");
  trips = savedTrips ? JSON.parse(savedTrips) : [...defaultTrips];
  const savedRecords = localStorage.getItem(`dailyRecords_${currentMonthKey}`);
  dailyRecords = savedRecords ? JSON.parse(savedRecords) : {};
}

function persistLocalOnly() {
  localStorage.setItem("trips", JSON.stringify(trips));
  localStorage.setItem(`dailyRecords_${currentMonthKey}`, JSON.stringify(dailyRecords));
}

function saveToLocalStorage() {
  lastLocalSaveAt = Date.now();
  persistLocalOnly();
  saveToFirebase();
}

function saveToFirebase() {
  if (syncingFromFirebase) return;
  if (!currentMonthKey) return;
  const path = getFirebasePath();
  const payload = {
    dailyRecords, trips,
    lastUpdated: new Date().toISOString(),
    deviceId: getDeviceId()
  };
  if (!navigator.onLine) {
    enqueueOfflineWrite({ path, data: payload });
    setSyncStatus("offline");
    return;
  }
  setSyncStatus("syncing");
  db.ref(path).set(payload).then(() => {
    clearOfflineQueueItem(path);
    setSyncStatus("online");
    firebaseReady = true;
  }).catch((err) => {
    console.error("Firebase save error:", err);
    enqueueOfflineWrite({ path, data: payload });
    const msg = String(err && err.message ? err.message : err);
    setSyncStatus(msg.includes("permission") ? "denied" : "offline");
  });
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
  const el = document.getElementById("syncStatus");
  if (!el) return;
  el.className = "no-print sync-status";
  if (state === "online") { el.classList.add("sync-on"); el.textContent = "● Sync on"; }
  else if (state === "offline") { el.classList.add("sync-off"); el.textContent = "● Offline (queue)"; }
  else if (state === "denied") { el.classList.add("sync-denied"); el.textContent = "● Permission denied"; }
  else { el.classList.add("sync-syncing"); el.textContent = "● Syncing…"; }
}

function stopFirebaseListener() {
  if (firebaseRef) { firebaseRef.off(); firebaseRef = null; }
}

function startFirebaseListener() {
  stopFirebaseListener();
  if (!currentMonthKey) return;
  const path = getFirebasePath();
  firebaseRef = db.ref(path);
  setSyncStatus("syncing");
  firebaseRef.on("value", (snap) => {
    firebaseReady = true;
    const data = snap.val();
    if (!data) { setSyncStatus("online"); return; }
    const remoteTs = data.lastUpdated ? Date.parse(data.lastUpdated) : 0;
    if (remoteTs && lastLocalSaveAt && remoteTs < lastLocalSaveAt - 500) { setSyncStatus("online"); return; }
    if (data.deviceId && data.deviceId === getDeviceId() && Date.now() - lastLocalSaveAt < 2000) { setSyncStatus("online"); return; }
    syncingFromFirebase = true;
    try {
      // JANGAN overwrite data penuh dengan objek kosong / kurang rekod
      if (data.dailyRecords && typeof data.dailyRecords === "object") {
        const remoteCount = Object.keys(data.dailyRecords).length;
        const localCount = Object.keys(dailyRecords || {}).length;
        if (remoteCount === 0 && localCount > 0) {
          setTimeout(() => { syncingFromFirebase = false; saveToFirebase(); }, 300);
          setSyncStatus("online");
          return;
        }
        if (remoteCount > 0) {
          const merged = { ...dailyRecords, ...data.dailyRecords };
          dailyRecords = merged;
        }
      }
      if (data.trips && Array.isArray(data.trips) && data.trips.length) {
        const set = new Set([...(trips || []), ...data.trips]);
        trips = Array.from(set);
      }
      persistLocalOnly();
      updateReport();
      loadTrips();
      setSyncStatus("online");
    } finally {
      setTimeout(() => { syncingFromFirebase = false; }, 300);
    }
  }, (err) => {
    console.error("Firebase listener error:", err);
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes("permission")) {
      setSyncStatus("denied");
      showToast("Firebase permission denied. Buka Realtime Database rules.", 4000);
    } else setSyncStatus("offline");
    updateReport();
    loadTrips();
  });
  flushOfflineQueue();
}

function applyPrintAutoSize() {
  const tbody = document.querySelector("#reportTable tbody");
  if (!tbody) return;
  const rows = tbody.querySelectorAll("tr").length;
  const table = document.getElementById("reportTable");
  if (!table) return;
  table.classList.remove("print-compact", "print-tiny");
  if (rows > 22) table.classList.add("print-tiny");
  else if (rows > 14) table.classList.add("print-compact");
}
function clearPrintAutoSize() {
  const table = document.getElementById("reportTable");
  if (table) table.classList.remove("print-compact", "print-tiny");
}
function handlePrint() {
  applyPrintAutoSize();
  window.print();
  setTimeout(clearPrintAutoSize, 1000);
}

function handleExportPdf() {
  applyPrintAutoSize();
  const el = document.querySelector(".container");
  if (!el || typeof html2pdf === "undefined") {
    showToast("PDF library belum load — cuba Cetak");
    handlePrint();
    return;
  }
  showToast("Menjana PDF…");
  document.body.classList.add("pdf-export");
  html2pdf().set({
    margin: [8, 8, 8, 8],
    filename: `RezaOT_${currentMonthKey.replace(/\s+/g, "_")}.pdf`,
    image: { type: "jpeg", quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  }).from(el).save().then(() => {
    document.body.classList.remove("pdf-export");
    clearPrintAutoSize();
    showToast("PDF dimuat turun");
  }).catch((err) => {
    console.error(err);
    document.body.classList.remove("pdf-export");
    showToast("Gagal jana PDF — cuba Cetak");
  });
}

function updateHolidayBadge() {
  const dateInput = document.getElementById("date");
  const badge = document.getElementById("holidayBadge");
  if (!dateInput || !badge) return;
  const d = dateInput.value;
  if (d && isPublicHoliday(d)) {
    badge.hidden = false;
    badge.textContent = "🏖 Cuti: " + getHolidayName(d);
  } else {
    badge.hidden = true;
    badge.textContent = "";
  }
}

function editSupervisorName() {
  const el = document.getElementById("supervisorName");
  if (!el) return;
  const next = prompt("Nama ketua:", el.textContent.trim() || "Talib");
  if (next === null) return;
  const name = next.trim() || "Talib";
  el.textContent = name;
  localStorage.setItem("supervisorName", name);
  showToast("Nama ketua dikemaskini");
}

function quickSaveToday() {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const dateInput = document.getElementById("date");
  const clockIn = document.getElementById("clockIn");
  const clockOut = document.getElementById("clockOut");
  if (dateInput) dateInput.value = dateStr;
  if (clockIn) clockIn.value = "08:00";
  if (clockOut) clockOut.value = "17:00";
  updateHolidayBadge();
  if (dailyRecords[dateStr] && (dailyRecords[dateStr].clock_in || dailyRecords[dateStr].clock_out)) {
    if (!confirm(`Rekod ${dateStr} sudah wujud. Tulis ganti 08:00–17:00?`)) return;
  }
  if (!dailyRecords[dateStr]) dailyRecords[dateStr] = { clock_in: "08:00", clock_out: "17:00", trips: [] };
  else { dailyRecords[dateStr].clock_in = "08:00"; dailyRecords[dateStr].clock_out = "17:00"; }
  saveToLocalStorage();
  updateReport();
  showToast("Hari ini disimpan (08:00–17:00)");
}

function editTrip(date, tripIndex) {
  const rec = dailyRecords[date];
  if (!rec || !Array.isArray(rec.trips) || !rec.trips[tripIndex]) return;
  const next = prompt("Edit trip:", String(rec.trips[tripIndex]));
  if (next === null) return;
  const trimmed = next.trim();
  if (!trimmed) { showToast("Nama trip tidak boleh kosong"); return; }
  rec.trips[tripIndex] = trimmed;
  saveToLocalStorage();
  updateReport();
  showToast("Trip dikemaskini");
}

function openOtSettings() {
  const s = getOtSettings();
  const weekday = prompt("OT Isnin–Jumaat bermula selepas (HH:MM):", s.weekdayAfter);
  if (weekday === null) return;
  const saturday = prompt("OT Sabtu bermula selepas (HH:MM):", s.saturdayAfter);
  if (saturday === null) return;
  const w = weekday.trim() || "17:00";
  const sa = saturday.trim() || "14:00";
  if (!/^\d{1,2}:\d{2}$/.test(w) || !/^\d{1,2}:\d{2}$/.test(sa)) {
    showToast("Format masa tidak sah. Guna HH:MM");
    return;
  }
  saveOtSettings({ weekdayAfter: w, saturdayAfter: sa });
  updateReport();
  showToast(`OT rules: Isnin–Jumaat lepas ${w}, Sabtu lepas ${sa}`);
}

function setupEventListeners() {
  const darkBtn = document.getElementById("darkModeBtn");
  if (darkBtn) darkBtn.addEventListener("click", toggleDarkMode);
  const nowIn = document.getElementById("nowInBtn");
  if (nowIn) nowIn.addEventListener("click", () => setNowTime("clockIn"));
  const nowOut = document.getElementById("nowOutBtn");
  if (nowOut) nowOut.addEventListener("click", () => setNowTime("clockOut"));
  const clockForm = document.getElementById("clockForm");
  if (clockForm) clockForm.addEventListener("submit", handleClockFormSubmit);
  const tripForm = document.getElementById("tripForm");
  if (tripForm) tripForm.addEventListener("submit", handleTripFormSubmit);
  const dest = document.getElementById("destination");
  if (dest) dest.addEventListener("change", handleDestinationChange);
  const addTripBtn = document.getElementById("addTripButton");
  if (addTripBtn) addTripBtn.addEventListener("click", handleAddTrip);
  const toggleManage = document.getElementById("toggleManageBtn");
  if (toggleManage) toggleManage.addEventListener("click", toggleManageSection);
  const monthYear = document.getElementById("monthYear");
  if (monthYear) monthYear.addEventListener("change", handleMonthChange);
  const printBtn = document.getElementById("printButton");
  if (printBtn) printBtn.addEventListener("click", handlePrint);
  const pdfBtn = document.getElementById("exportPdfBtn");
  if (pdfBtn) pdfBtn.addEventListener("click", handleExportPdf);
  const excelBtn = document.getElementById("exportExcelBtn");
  if (excelBtn) excelBtn.addEventListener("click", exportToExcel);
  const exportBtn = document.getElementById("exportDataBtn");
  if (exportBtn) exportBtn.addEventListener("click", exportData);
  const importInput = document.getElementById("importDataInput");
  if (importInput) importInput.addEventListener("change", importData);
  const dateInput = document.getElementById("date");
  if (dateInput) dateInput.addEventListener("change", updateHolidayBadge);
  const supervisorEl = document.getElementById("supervisorName");
  if (supervisorEl) {
    supervisorEl.style.cursor = "pointer";
    supervisorEl.title = "Klik untuk edit nama ketua";
    supervisorEl.addEventListener("click", editSupervisorName);
  }
  const quickBtn = document.getElementById("quickSaveTodayBtn");
  if (quickBtn) quickBtn.addEventListener("click", quickSaveToday);
  const settingsBtn = document.getElementById("otSettingsBtn");
  if (settingsBtn) settingsBtn.addEventListener("click", openOtSettings);
  window.addEventListener("online", () => {
    setSyncStatus("syncing");
    flushOfflineQueue().then(() => startFirebaseListener());
  });
  window.addEventListener("offline", () => setSyncStatus("offline"));
}
