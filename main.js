// main.js - RezaOT v2 (Complete + multi-device Firebase sync)

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
  if (!el) {
    alert(message);
    return;
  }
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

// ==================== FIREBASE MULTI-DEVICE SYNC ====================
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
  persistLocalOnly();
  if (!syncingFromFirebase) {
    saveToFirebase();
  }
}

function saveToFirebase() {
  if (!currentMonthKey || syncingFromFirebase) return;

  lastLocalSaveAt = Date.now();
  const payload = {
    dailyRecords: dailyRecords,
    trips: trips,
    lastUpdated: new Date().toISOString(),
    deviceId: getDeviceId()
  };

  db.ref(getFirebasePath()).update(payload)
    .then(() => {
      firebaseReady = true;
      setSyncStatus("online");
    })
    .catch((err) => {
      console.error("Firebase save error:", err);
      const msg = String(err && err.message ? err.message : err);
      if (msg.includes("permission_denied") || msg.includes("PERMISSION_DENIED")) {
        setSyncStatus("denied");
        showToast("Firebase locked — data simpan local sahaja. Buka rules untuk multi-device.", 4000);
      } else {
        setSyncStatus("offline");
      }
    });
}

function getDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = "dev-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("deviceId", id);
  }
  return id;
}

function setSyncStatus(state) {
  const el = document.getElementById("syncStatus");
  if (!el) return;
  const map = {
    online: { text: "● Sync ON", cls: "sync-on" },
    offline: { text: "● Offline", cls: "sync-off" },
    denied: { text: "● Sync OFF (rules)", cls: "sync-denied" },
    syncing: { text: "● Syncing…", cls: "sync-syncing" }
  };
  const s = map[state] || map.offline;
  el.textContent = s.text;
  el.className = "sync-status " + s.cls;
}

function stopFirebaseListener() {
  if (firebaseRef) {
    firebaseRef.off("value");
    firebaseRef = null;
  }
}

function startFirebaseListener() {
  if (!currentMonthKey) return;

  stopFirebaseListener();
  setSyncStatus("syncing");

  firebaseRef = db.ref(getFirebasePath());
  firebaseRef.on(
    "value",
    (snapshot) => {
      const data = snapshot.val();
      firebaseReady = true;

      if (!data) {
        setSyncStatus("online");
        if (Object.keys(dailyRecords).length > 0 || trips.length > 0) {
          saveToFirebase();
        }
        return;
      }

      const remoteTs = data.lastUpdated ? Date.parse(data.lastUpdated) : 0;
      if (remoteTs && lastLocalSaveAt && remoteTs < lastLocalSaveAt - 500) {
        setSyncStatus("online");
        return;
      }

      if (data.deviceId && data.deviceId === getDeviceId() && Date.now() - lastLocalSaveAt < 2000) {
        setSyncStatus("online");
        return;
      }

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
    },
    (err) => {
      console.error("Firebase listener error:", err);
      const msg = String(err && err.message ? err.message : err);
      if (msg.includes("permission_denied") || msg.includes("PERMISSION_DENIED")) {
        setSyncStatus("denied");
        showToast("Firebase permission denied. Buka Realtime Database rules.", 4000);
      } else {
        setSyncStatus("offline");
      }
      updateReport();
      loadTrips();
    }
  );
}

function loadDataFromFirebase() {
  startFirebaseListener();
}

document.addEventListener("DOMContentLoaded", () => {
  initDarkMode();

  const now = new Date();
  currentMonthKey = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  const monthInput = document.getElementById("monthYear");
  if (monthInput) {
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  const currentMonthEl = document.getElementById("currentMonth");
  if (currentMonthEl) currentMonthEl.textContent = currentMonthKey;

  const dateInput = document.getElementById("date");
  if (dateInput) dateInput.value = now.toISOString().split("T")[0];

  // Default check-in 08:00, check-out 17:00
  const clockInInput = document.getElementById("clockIn");
  if (clockInInput && !clockInInput.value) clockInInput.value = "08:00";
  const clockOutInput = document.getElementById("clockOut");
  if (clockOutInput && !clockOutInput.value) clockOutInput.value = "17:00";

  const supervisorEl = document.getElementById("supervisorName");
  if (supervisorEl) {
    supervisorEl.textContent = localStorage.getItem("supervisorName") || "Talib";
  }

  loadFromLocalStorage();
  updateReport();
  loadTrips();
  setupEventListeners();
  startFirebaseListener();
});

function applyPrintAutoSize() {
  const rows = Object.keys(dailyRecords || {}).length;
  document.body.classList.remove("print-size-sm", "print-size-xs");
  if (rows > 22) {
    document.body.classList.add("print-size-xs");
  } else if (rows > 14) {
    document.body.classList.add("print-size-sm");
  }
}

function clearPrintAutoSize() {
  document.body.classList.remove("print-size-sm", "print-size-xs");
}

function handlePrint() {
  applyPrintAutoSize();
  setTimeout(() => window.print(), 50);
}

function setupEventListeners() {
  const monthYear = document.getElementById("monthYear");
  if (monthYear) monthYear.addEventListener("change", handleMonthChange);

  const destination = document.getElementById("destination");
  if (destination) destination.addEventListener("change", handleDestinationChange);

  const addTripBtn = document.getElementById("addTripButton");
  if (addTripBtn) addTripBtn.addEventListener("click", handleAddTrip);

  const clockForm = document.getElementById("clockForm");
  if (clockForm) clockForm.addEventListener("submit", handleClockFormSubmit);

  const tripForm = document.getElementById("tripForm");
  if (tripForm) tripForm.addEventListener("submit", handleTripFormSubmit);

  const toggleBtn = document.getElementById("toggleManageBtn");
  if (toggleBtn) toggleBtn.addEventListener("click", toggleManageSection);

  const exportDataBtn = document.getElementById("exportDataBtn");
  if (exportDataBtn) exportDataBtn.addEventListener("click", exportData);

  const importInput = document.getElementById("importDataInput");
  if (importInput) importInput.addEventListener("change", importData);

  const printBtn = document.getElementById("printButton");
  if (printBtn) printBtn.addEventListener("click", handlePrint);

  window.addEventListener("afterprint", clearPrintAutoSize);
  window.addEventListener("beforeprint", applyPrintAutoSize);

  const excelBtn = document.getElementById("exportExcelBtn");
  if (excelBtn) excelBtn.addEventListener("click", exportToExcel);

  const nowIn = document.getElementById("nowInBtn");
  if (nowIn) nowIn.addEventListener("click", () => setNowTime("clockIn"));

  const nowOut = document.getElementById("nowOutBtn");
  if (nowOut) nowOut.addEventListener("click", () => setNowTime("clockOut"));

  const darkBtn = document.getElementById("darkModeBtn");
  if (darkBtn) darkBtn.addEventListener("click", toggleDarkMode);
}

function toggleManageSection() {
  const section = document.getElementById("manageDestinations");
  if (!section) return;
  section.style.display = section.style.display === "none" ? "block" : "none";
}

function handleMonthChange() {
  const monthInput = document.getElementById("monthYear");
  if (!monthInput || !monthInput.value) return;

  stopFirebaseListener();

  const [year, month] = monthInput.value.split("-");
  currentMonthKey = `${getMonthName(month)} ${year}`;

  const currentMonthEl = document.getElementById("currentMonth");
  if (currentMonthEl) currentMonthEl.textContent = currentMonthKey;

  loadFromLocalStorage();
  updateReport();
  loadTrips();
  startFirebaseListener();
}

function handleDestinationChange() {
  const dest = document.getElementById("destination");
  const awbField = document.getElementById("airwayBillField");
  if (!dest || !awbField) return;

  const isKLIA = dest.value.toLowerCase().includes("klia cargo");
  awbField.style.display = isKLIA ? "block" : "none";

  if (!isKLIA) {
    const awbInput = document.getElementById("airwayBill");
    if (awbInput) awbInput.value = "";
  }
}

function handleAddTrip() {
  const input = document.getElementById("newTrip");
  if (!input) return;

  const name = input.value.trim();
  if (!name) {
    showToast("Sila masukkan nama destinasi.");
    return;
  }

  if (trips.includes(name)) {
    showToast("Destinasi ini sudah wujud.");
    return;
  }

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

  if (!date || !clockIn || !clockOut) {
    showToast("Sila isi semua medan (Tarikh, Clock-In, Clock-Out).");
    return;
  }

  if (dailyRecords[date] && (dailyRecords[date].clock_in || dailyRecords[date].clock_out)) {
    if (!confirm(`Rekod untuk ${date} sudah wujud. Tulis ganti?`)) return;
  }

  if (!dailyRecords[date]) {
    dailyRecords[date] = { clock_in: clockIn, clock_out: clockOut, trips: [] };
  } else {
    dailyRecords[date].clock_in = clockIn;
    dailyRecords[date].clock_out = clockOut;
  }

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

  if (!date) {
    showToast("Sila pilih tarikh dahulu.");
    return;
  }
  if (!destination) {
    showToast("Sila pilih destinasi.");
    return;
  }

  if (!dailyRecords[date]) {
    dailyRecords[date] = { clock_in: "", clock_out: "", trips: [] };
  }
  if (!Array.isArray(dailyRecords[date].trips)) {
    dailyRecords[date].trips = [];
  }

  let tripName = destination;
  if (destination.toLowerCase().includes("klia cargo") && awb) {
    tripName = `KLIA Cargo (${awb})`;
  }

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

  const name = rec.trips[tripIndex];
  if (!confirm(`Padam trip "${name}"?`)) return;

  rec.trips.splice(tripIndex, 1);
  saveToLocalStorage();
  updateReport();
  showToast("Trip dipadam");
}

function editRecord(date) {
  const rec = dailyRecords[date];
  if (!rec) return;

  document.getElementById("date").value = date;
  document.getElementById("clockIn").value = rec.clock_in || "";
  document.getElementById("clockOut").value = rec.clock_out || "";

  document.getElementById("clockForm").scrollIntoView({ behavior: "smooth" });
  showToast("Data dimuatkan. Klik Simpan Kehadiran untuk kemaskini.");
}

function updateSummary(totalOT) {
  let days = 0;
  let kliaDays = 0;
  let kliaTrips = 0;
  let awbCount = 0;
  let tripCount = 0;

  Object.keys(dailyRecords).forEach((date) => {
    const rec = dailyRecords[date];
    days++;
    const list = rec.trips || [];
    tripCount += list.length;

    let dayHasKlia = false;
    list.forEach((t) => {
      if (typeof t === "string" && t.toLowerCase().includes("klia cargo")) {
        dayHasKlia = true;
        kliaTrips++;
        if (/\(.+\)/.test(t)) awbCount++;
      }
    });
    if (dayHasKlia) kliaDays++;
  });

  const elDays = document.getElementById("sumDays");
  const elKlia = document.getElementById("sumKlia");
  const elAwb = document.getElementById("sumAwb");
  const elTrips = document.getElementById("sumTrips");

  if (elDays) elDays.textContent = String(days);
  if (elKlia) elKlia.textContent = String(kliaDays);
  if (elAwb) elAwb.textContent = String(awbCount);
  if (elTrips) elTrips.textContent = String(tripCount);

  const pOT = document.getElementById("printTotalOT");
  const pTrips = document.getElementById("printTotalTrips");
  const pKliaDays = document.getElementById("printKliaDays");
  const pKliaTrips = document.getElementById("printKliaTrips");
  const pAwb = document.getElementById("printAwb");

  if (pOT) pOT.textContent = (typeof totalOT === "number" ? totalOT : 0).toFixed(2);
  if (pTrips) pTrips.textContent = String(tripCount);
  if (pKliaDays) pKliaDays.textContent = String(kliaDays);
  if (pKliaTrips) pKliaTrips.textContent = String(kliaTrips);
  if (pAwb) pAwb.textContent = String(awbCount);
}

function updateReport() {
  const tbody = document.querySelector("#reportTable tbody");
  const noRecordsMsg = document.getElementById("noRecordsMessage");
  const totalOTEl = document.getElementById("totalOT");

  if (!tbody) return;

  tbody.innerHTML = "";
  let totalOT = 0;

  const dates = Object.keys(dailyRecords).sort();

  if (dates.length === 0) {
    if (noRecordsMsg) noRecordsMsg.style.display = "block";
    if (totalOTEl) totalOTEl.textContent = "0.00";
    updateSummary(0);
    return;
  }

  if (noRecordsMsg) noRecordsMsg.style.display = "none";

  dates.forEach((date) => {
    const rec = dailyRecords[date];
    const ot = calculateOT(rec.clock_in, rec.clock_out, date, rec.trips || []);
    totalOT += ot;

    const dateObj = new Date(date + "T00:00:00");
    const day = dateObj.getDay();

    const tr = document.createElement("tr");
    if (day === 6) tr.className = "saturday";
    if (day === 0) tr.className = "sunday";

    const tdDate = document.createElement("td");
    tdDate.textContent = formatDateForPDF(date);

    const dayNamesMs = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
    const tdDay = document.createElement("td");
    tdDay.textContent = dayNamesMs[day];

    const tdTrips = document.createElement("td");
    const tripList = rec.trips || [];
    if (tripList.length === 0) {
      tdTrips.textContent = "—";
    } else {
      tripList.forEach((trip, i) => {
        const row = document.createElement("div");
        row.className = "trip-item";

        const text = document.createElement("span");
        text.textContent = String(trip);

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

    const tdIn = document.createElement("td");
    tdIn.textContent = formatTime(rec.clock_in);

    const tdOut = document.createElement("td");
    tdOut.textContent = formatTime(rec.clock_out);

    const tdOT = document.createElement("td");
    const strong = document.createElement("strong");
    strong.textContent = ot.toFixed(2);
    tdOT.appendChild(strong);

    const tdSig1 = document.createElement("td");
    tdSig1.className = "print-only";
    const tdSig2 = document.createElement("td");
    tdSig2.className = "print-only";

    const tdActions = document.createElement("td");
    tdActions.className = "no-print";

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => editRecord(date));

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "Padam";
    delBtn.addEventListener("click", () => deleteRecord(date));

    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);

    tr.appendChild(tdDate);
    tr.appendChild(tdDay);
    tr.appendChild(tdTrips);
    tr.appendChild(tdIn);
    tr.appendChild(tdOut);
    tr.appendChild(tdOT);
    tr.appendChild(tdSig1);
    tr.appendChild(tdSig2);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });

  if (totalOTEl) totalOTEl.textContent = totalOT.toFixed(2);
  updateSummary(totalOT);
}

function exportToExcel() {
  if (Object.keys(dailyRecords).length === 0) {
    showToast("Tiada data untuk dieksport!");
    return;
  }

  const wb = XLSX.utils.book_new();
  const data = [];

  data.push([
    "Tarikh", "Hari", "Destinasi", "AWB",
    "Clock In", "Clock Out", "OT (Jam)",
    "Signature Anda", "Signature Penyelia"
  ]);

  let totalOT = 0;
  let kliaCargoDays = 0;
  let totalAWB = 0;

  Object.keys(dailyRecords).sort().forEach((date) => {
    const rec = dailyRecords[date];
    const ot = calculateOT(rec.clock_in, rec.clock_out, date, rec.trips || []);
    totalOT += ot;

    const dateObj = new Date(date + "T00:00:00");
    const dayName = dateObj.toLocaleDateString("ms-MY", { weekday: "long" });

    const hasKLIA = (rec.trips || []).some(
      (t) => typeof t === "string" && t.toLowerCase().includes("klia cargo")
    );
    if (hasKLIA) kliaCargoDays++;

    if (rec.trips && rec.trips.length > 0) {
      rec.trips.forEach((trip, index) => {
        let dest = trip;
        let awb = "-";

        if (trip.toLowerCase().includes("klia cargo")) {
          const match = trip.match(/\((.+?)\)/);
          if (match) {
            awb = match[1];
            totalAWB++;
          }
        }

        const otValue = index === 0 ? ot.toFixed(2) : "";

        data.push([
          formatDateForPDF(date), dayName, dest, awb,
          rec.clock_in || "-", rec.clock_out || "-", otValue, "", ""
        ]);
      });
    } else {
      data.push([
        formatDateForPDF(date), dayName, "—", "-",
        rec.clock_in || "-", rec.clock_out || "-", ot.toFixed(2), "", ""
      ]);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(data);

  const summaryRow = data.length + 2;
  XLSX.utils.sheet_add_aoa(ws, [
    ["Ringkasan Bulan", ""],
    ["Total OT Keseluruhan", totalOT.toFixed(2) + " jam"],
    ["Total Hari KLIA Cargo", kliaCargoDays + " hari"],
    ["Total AWB", totalAWB]
  ], { origin: summaryRow });

  ws["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 14 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 18 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Laporan OT Bulanan");
  XLSX.writeFile(wb, `RezaOT_${currentMonthKey.replace(/\s+/g, "_")}.xlsx`);
  showToast("Excel dieksport");
}

function exportData() {
  const payload = {
    month: currentMonthKey,
    dailyRecords: dailyRecords,
    trips: trips,
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
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

      saveToLocalStorage();
      updateReport();
      loadTrips();
      showToast("Data berjaya diimport!");
    } catch (err) {
      console.error(err);
      showToast("Fail JSON tidak sah.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}
