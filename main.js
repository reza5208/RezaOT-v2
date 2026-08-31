// main.js - RezaOT v2 (Complete + multi-device Firebase sync)
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
      if (data.dailyRecords) dailyRecords = data.dailyRecords;
      if (data.trips && Array.isArray(data.trips)) trips = data.trips;
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

function toggleManageSection() {
  const section = document.getElementById("manageDestinations");
  if (!section) return;
  section.style.display = section.style.display === "none" ? "block" : "none";
}

function handleMonthChange() {
  const monthInput = document.getElementById("monthYear");
  if (!monthInput || !monthInput.value) return;
  const [year, month] = monthInput.value.split("-");
  const newKey = `${monthNames[parseInt(month, 10) - 1]} ${year}`;
  if (newKey === currentMonthKey) return;
  if (!confirm(`Tukar ke ${newKey}?\nData bulan semasa sudah disimpan.`)) {
    const parts = currentMonthKey.split(" ");
    const mi = monthNames.indexOf(parts[0]);
    if (mi >= 0) monthInput.value = `${parts[1]}-${String(mi + 1).padStart(2, "0")}`;
    return;
  }
  currentMonthKey = newKey;
  const currentMonthEl = document.getElementById("currentMonth");
  if (currentMonthEl) currentMonthEl.textContent = currentMonthKey;
  stopFirebaseListener();
  loadFromLocalStorage();
  updateReport();
  loadTrips();
  startFirebaseListener();
}

function handleDestinationChange() {
  const dest = document.getElementById("destination");
  const field = document.getElementById("airwayBillField");
  if (!dest || !field) return;
  field.style.display = dest.value.toLowerCase().includes("klia cargo") ? "block" : "none";
}

function handleAddTrip() {
  const input = document.getElementById("newTrip");
  if (!input) return;
  const name = input.value.trim();
  if (!name) { showToast("Masukkan nama destinasi"); return; }
  if (trips.includes(name)) { showToast("Destinasi sudah wujud"); return; }
  trips.push(name);
  saveToLocalStorage();
  loadTrips();
  input.value = "";
  showToast("Destinasi ditambah");
}

function handleClockFormSubmit(e) {
  e.preventDefault();
  const date = document.getElementById("date").value;
  const clockIn = document.getElementById("clockIn").value;
  const clockOut = document.getElementById("clockOut").value;
  if (!date || !clockIn || !clockOut) { showToast("Sila isi semua medan."); return; }
  if (dailyRecords[date] && (dailyRecords[date].clock_in || dailyRecords[date].clock_out)) {
    if (!confirm(`Rekod untuk ${date} sudah wujud. Tulis ganti?`)) return;
  }
  if (!dailyRecords[date]) dailyRecords[date] = { clock_in: clockIn, clock_out: clockOut, trips: [] };
  else { dailyRecords[date].clock_in = clockIn; dailyRecords[date].clock_out = clockOut; }
  saveToLocalStorage();
  updateReport();
  showToast("Kehadiran berjaya disimpan!");
}

function handleTripFormSubmit(e) {
  e.preventDefault();
  const date = document.getElementById("date").value;
  const destination = document.getElementById("destination").value;
  const awbInput = document.getElementById("airwayBill");
  const awb = awbInput ? awbInput.value.trim() : "";
  if (!date) { showToast("Sila pilih tarikh dahulu."); return; }
  if (!destination) { showToast("Sila pilih destinasi."); return; }
  if (!dailyRecords[date]) dailyRecords[date] = { clock_in: "", clock_out: "", trips: [] };
  if (!Array.isArray(dailyRecords[date].trips)) dailyRecords[date].trips = [];
  let tripName = destination;
  if (destination.toLowerCase().includes("klia cargo") && awb) tripName = `KLIA Cargo (${awb})`;
  dailyRecords[date].trips.push(tripName);
  saveToLocalStorage();
  updateReport();
  document.getElementById("destination").value = "";
  if (awbInput) awbInput.value = "";
  document.getElementById("airwayBillField").style.display = "none";
  showToast("Trip berjaya ditambah!");
}

function deleteRecord(date) {
  if (!confirm(`Padam rekod untuk ${date}?`)) return;
  delete dailyRecords[date];
  saveToLocalStorage();
  updateReport();
  showToast("Rekod dipadam");
}

function deleteTrip(date, tripIndex) {
  const rec = dailyRecords[date];
  if (!rec || !Array.isArray(rec.trips)) return;
  if (!confirm(`Padam trip "${rec.trips[tripIndex]}"?`)) return;
  rec.trips.splice(tripIndex, 1);
  saveToLocalStorage();
  updateReport();
  showToast("Trip dipadam");
}

function editRecord(date) {
  const rec = dailyRecords[date];
  if (!rec) return;
  const dateInput = document.getElementById("date");
  const clockIn = document.getElementById("clockIn");
  const clockOut = document.getElementById("clockOut");
  if (dateInput) dateInput.value = date;
  if (clockIn) clockIn.value = rec.clock_in || "08:00";
  if (clockOut) clockOut.value = rec.clock_out || "17:00";
  updateHolidayBadge();
  showToast("Rekod dimuat ke form — simpan untuk kemaskini");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateSummary(totalOT) {
  const dates = Object.keys(dailyRecords).sort();
  let workDays = 0, kliaDays = 0, totalAwb = 0, totalTrips = 0, kliaTrips = 0;
  dates.forEach((date) => {
    const rec = dailyRecords[date];
    if (!rec) return;
    if (rec.clock_in || rec.clock_out || (rec.trips && rec.trips.length)) workDays++;
    const tripsArr = rec.trips || [];
    totalTrips += tripsArr.length;
    let hasKlia = false;
    tripsArr.forEach((t) => {
      if (String(t).toLowerCase().includes("klia cargo")) {
        hasKlia = true; kliaTrips++;
        if (/\(.+?\)/.test(t)) totalAwb++;
      }
    });
    if (hasKlia) kliaDays++;
  });
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("sumDays", workDays); set("sumKlia", kliaDays); set("sumAwb", totalAwb); set("sumTrips", totalTrips);
  set("printTotalOT", totalOT.toFixed(2)); set("printTotalTrips", totalTrips);
  set("printKliaDays", kliaDays); set("printKliaTrips", kliaTrips); set("printAwb", totalAwb);
}

function updateReport() {
  const tbody = document.querySelector("#reportTable tbody");
  const totalOTEl = document.getElementById("totalOT");
  const noMsg = document.getElementById("noRecordsMessage");
  if (!tbody) return;
  tbody.innerHTML = "";
  const dates = Object.keys(dailyRecords).sort();
  let totalOT = 0;
  if (dates.length === 0) {
    if (noMsg) noMsg.style.display = "block";
    if (totalOTEl) totalOTEl.textContent = "0.00";
    updateSummary(0);
    return;
  }
  if (noMsg) noMsg.style.display = "none";
  const dayNamesMs = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  dates.forEach((date) => {
    const rec = dailyRecords[date];
    if (!rec) return;
    const ot = calculateOT(rec.clock_in, rec.clock_out, date, rec.trips || []);
    totalOT += ot;
    const day = new Date(date + "T00:00:00").getDay();
    const holiday = isPublicHoliday(date);
    const tr = document.createElement("tr");
    if (day === 0) tr.classList.add("sunday");
    else if (day === 6) tr.classList.add("saturday");
    if (holiday) tr.classList.add("holiday");
    const tdDate = document.createElement("td");
    tdDate.className = "tarikh";
    tdDate.textContent = formatDateForPDF(date);
    const tdDay = document.createElement("td");
    tdDay.className = "hari";
    tdDay.textContent = holiday ? dayNamesMs[day] + " (Cuti)" : dayNamesMs[day];
    if (holiday) tdDay.title = getHolidayName(date);
    const tdTrips = document.createElement("td");
    const tripList = rec.trips || [];
    if (tripList.length === 0) tdTrips.textContent = "—";
    else {
      tripList.forEach((trip, i) => {
        const row = document.createElement("div");
        row.className = "trip-item";
        const text = document.createElement("span");
        text.className = "trip-text";
        text.textContent = String(trip);
        text.title = "Klik untuk edit";
        text.style.cursor = "pointer";
        text.addEventListener("click", () => editTrip(date, i));
        const del = document.createElement("button");
        del.type = "button";
        del.className = "trip-del-btn no-print";
        del.title = "Padam trip";
        del.textContent = "×";
        del.addEventListener("click", () => deleteTrip(date, i));
        row.appendChild(text);
        row.appendChild(del);
        tdTrips.appendChild(row);
      });
    }
    const tdIn = document.createElement("td"); tdIn.textContent = formatTime(rec.clock_in);
    const tdOut = document.createElement("td"); tdOut.textContent = formatTime(rec.clock_out);
    const tdOT = document.createElement("td");
    const strong = document.createElement("strong"); strong.textContent = ot.toFixed(2); tdOT.appendChild(strong);
    const tdSig1 = document.createElement("td"); tdSig1.className = "print-only";
    const tdSig2 = document.createElement("td"); tdSig2.className = "print-only";
    const tdActions = document.createElement("td"); tdActions.className = "no-print";
    const editBtn = document.createElement("button"); editBtn.className = "edit-btn"; editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => editRecord(date));
    const delBtn = document.createElement("button"); delBtn.className = "delete-btn"; delBtn.textContent = "Padam";
    delBtn.addEventListener("click", () => deleteRecord(date));
    tdActions.appendChild(editBtn); tdActions.appendChild(delBtn);
    [tdDate, tdDay, tdTrips, tdIn, tdOut, tdOT, tdSig1, tdSig2, tdActions].forEach((td) => tr.appendChild(td));
    tbody.appendChild(tr);
  });
  if (totalOTEl) totalOTEl.textContent = totalOT.toFixed(2);
  updateSummary(totalOT);
}

function exportToExcel() {
  const data = [["Tarikh", "Hari", "Destinasi", "AWB", "Clock-In", "Clock-Out", "OT (Jam)", "T/T Pekerja", "T/T Ketua"]];
  const dayNamesMs = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  let totalOT = 0, kliaCargoDays = 0, totalAWB = 0;
  Object.keys(dailyRecords).sort().forEach((date) => {
    const rec = dailyRecords[date];
    const day = new Date(date + "T00:00:00").getDay();
    const dayName = dayNamesMs[day] + (isPublicHoliday(date) ? " (Cuti)" : "");
    const ot = calculateOT(rec.clock_in, rec.clock_out, date, rec.trips || []);
    totalOT += ot;
    let hasKlia = false;
    (rec.trips || []).forEach((t) => { if (String(t).toLowerCase().includes("klia cargo")) hasKlia = true; });
    if (hasKlia) kliaCargoDays++;
    if (rec.trips && rec.trips.length > 0) {
      rec.trips.forEach((trip, index) => {
        let dest = trip, awb = "-";
        if (String(trip).toLowerCase().includes("klia cargo")) {
          const match = String(trip).match(/\((.+?)\)/);
          if (match) { awb = match[1]; totalAWB++; }
        }
        data.push([formatDateForPDF(date), dayName, dest, awb, rec.clock_in || "-", rec.clock_out || "-", index === 0 ? ot.toFixed(2) : "", "", ""]);
      });
    } else {
      data.push([formatDateForPDF(date), dayName, "—", "-", rec.clock_in || "-", rec.clock_out || "-", ot.toFixed(2), "", ""]);
    }
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.sheet_add_aoa(ws, [["Ringkasan Bulan", ""], ["Total OT", totalOT.toFixed(2) + " jam"], ["Hari KLIA", kliaCargoDays], ["Total AWB", totalAWB]], { origin: data.length + 2 });
  XLSX.utils.book_append_sheet(wb, ws, "Laporan OT Bulanan");
  XLSX.writeFile(wb, `RezaOT_${currentMonthKey.replace(/\s+/g, "_")}.xlsx`);
  showToast("Excel dieksport");
}

function exportData() {
  const payload = { month: currentMonthKey, dailyRecords, trips, otSettings: getOtSettings(), exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `RezaOT_backup_${currentMonthKey.replace(/\s+/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Backup dieksport");
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const data = JSON.parse(event.target.result);
      if (data.dailyRecords) dailyRecords = data.dailyRecords;
      if (data.trips) trips = data.trips;
      if (data.otSettings) saveOtSettings(data.otSettings);
      saveToLocalStorage();
      updateReport();
      loadTrips();
      showToast("Data berjaya diimport!");
    } catch (err) {
      showToast("Fail JSON tidak sah.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

document.addEventListener("DOMContentLoaded", () => {
  initDarkMode();
  const now = new Date();
  currentMonthKey = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const monthInput = document.getElementById("monthYear");
  if (monthInput) monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthEl = document.getElementById("currentMonth");
  if (currentMonthEl) currentMonthEl.textContent = currentMonthKey;
  const dateInput = document.getElementById("date");
  if (dateInput) dateInput.value = now.toISOString().split("T")[0];
  const clockInInput = document.getElementById("clockIn");
  if (clockInInput && !clockInInput.value) clockInInput.value = "08:00";
  const clockOutInput = document.getElementById("clockOut");
  if (clockOutInput && !clockOutInput.value) clockOutInput.value = "17:00";
  const supervisorEl = document.getElementById("supervisorName");
  if (supervisorEl) supervisorEl.textContent = localStorage.getItem("supervisorName") || "Talib";
  loadFromLocalStorage();
  updateReport();
  loadTrips();
  setupEventListeners();
  updateHolidayBadge();
  startFirebaseListener();
  if (!navigator.onLine) setSyncStatus("offline");
});
