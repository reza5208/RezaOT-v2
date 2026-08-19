// main.js - RezaOT v2 (Complete + Excel Fix + XSS-safe)

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

// ==================== GLOBAL STATE ====================
let trips = [];
let currentMonthKey = "";
let dailyRecords = {};

// ==================== LOCAL STORAGE ====================
function loadFromLocalStorage() {
  const savedTrips = localStorage.getItem("trips");
  trips = savedTrips ? JSON.parse(savedTrips) : [...defaultTrips];

  const savedRecords = localStorage.getItem(`dailyRecords_${currentMonthKey}`);
  dailyRecords = savedRecords ? JSON.parse(savedRecords) : {};
}

function saveToLocalStorage() {
  localStorage.setItem("trips", JSON.stringify(trips));
  localStorage.setItem(`dailyRecords_${currentMonthKey}`, JSON.stringify(dailyRecords));
  saveToFirebase();
}

// ==================== FIREBASE ====================
function saveToFirebase() {
  if (!currentMonthKey) return;
  db.ref(`users/default/${currentMonthKey}`).update({
    dailyRecords: dailyRecords,
    trips: trips,
    lastUpdated: new Date().toISOString()
  }).catch(err => console.error("Firebase save error:", err));
}

function loadDataFromFirebase() {
  if (!currentMonthKey) return;
  db.ref(`users/default/${currentMonthKey}`).once("value")
    .then((snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.dailyRecords) dailyRecords = data.dailyRecords;
        if (data.trips) trips = data.trips;
      }
      saveToLocalStorage();
      updateReport();
      loadTrips();
    })
    .catch((err) => {
      console.error("Firebase load error:", err);
      updateReport();
      loadTrips();
    });
}

// ==================== INITIALIZE ====================
document.addEventListener("DOMContentLoaded", () => {
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

  const supervisorEl = document.getElementById("supervisorName");
  if (supervisorEl) {
    supervisorEl.textContent = localStorage.getItem("supervisorName") || "Talib";
  }

  loadFromLocalStorage();
  loadDataFromFirebase();
  setupEventListeners();
});

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
  if (printBtn) printBtn.addEventListener("click", () => window.print());

  const excelBtn = document.getElementById("exportExcelBtn");
  if (excelBtn) excelBtn.addEventListener("click", exportToExcel);
}

// ==================== TOGGLE & HANDLERS ====================
function toggleManageSection() {
  const section = document.getElementById("manageDestinations");
  if (!section) return;
  section.style.display = section.style.display === "none" ? "block" : "none";
}

function handleMonthChange() {
  const monthInput = document.getElementById("monthYear");
  if (!monthInput || !monthInput.value) return;

  const [year, month] = monthInput.value.split("-");
  currentMonthKey = `${getMonthName(month)} ${year}`;

  const currentMonthEl = document.getElementById("currentMonth");
  if (currentMonthEl) currentMonthEl.textContent = currentMonthKey;

  loadFromLocalStorage();
  loadDataFromFirebase();
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
    alert("Sila masukkan nama destinasi.");
    return;
  }

  if (trips.includes(name)) {
    alert("Destinasi ini sudah wujud.");
    return;
  }

  trips.push(name);
  saveToLocalStorage();
  loadTrips();
  input.value = "";
}

function handleClockFormSubmit(e) {
  e.preventDefault();

  const date = document.getElementById("date").value;
  const clockIn = document.getElementById("clockIn").value;
  const clockOut = document.getElementById("clockOut").value;

  if (!date || !clockIn || !clockOut) {
    alert("Sila isi semua medan (Tarikh, Clock-In, Clock-Out).");
    return;
  }

  if (!dailyRecords[date]) {
    dailyRecords[date] = { clock_in: clockIn, clock_out: clockOut, trips: [] };
  } else {
    dailyRecords[date].clock_in = clockIn;
    dailyRecords[date].clock_out = clockOut;
  }

  saveToLocalStorage();
  updateReport();
  alert("Kehadiran berjaya disimpan!");
}

function handleTripFormSubmit(e) {
  e.preventDefault();

  const date = document.getElementById("date").value;
  const destination = document.getElementById("destination").value;
  const awbInput = document.getElementById("airwayBill");
  const awb = awbInput ? awbInput.value.trim() : "";

  if (!date) {
    alert("Sila pilih tarikh dahulu.");
    return;
  }
  if (!destination) {
    alert("Sila pilih destinasi.");
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

  alert("Trip berjaya ditambah!");
}

function deleteRecord(date) {
  if (!confirm(`Padam rekod untuk ${date}?`)) return;

  delete dailyRecords[date];
  saveToLocalStorage();
  updateReport();
}

function editRecord(date) {
  const rec = dailyRecords[date];
  if (!rec) return;

  document.getElementById("date").value = date;
  document.getElementById("clockIn").value = rec.clock_in || "";
  document.getElementById("clockOut").value = rec.clock_out || "";

  document.getElementById("clockForm").scrollIntoView({ behavior: "smooth" });
  alert("Data dimuatkan ke form. Klik Simpan Kehadiran untuk kemaskini.");
}

// ==================== UPDATE REPORT (XSS-safe) ====================
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

    // Tarikh
    const tdDate = document.createElement("td");
    tdDate.textContent = formatDateForPDF(date);

    // Destinasi (safe — each trip as text + <br>)
    const tdTrips = document.createElement("td");
    const tripList = rec.trips || [];
    if (tripList.length === 0) {
      tdTrips.textContent = "—";
    } else {
      tripList.forEach((trip, i) => {
        if (i > 0) tdTrips.appendChild(document.createElement("br"));
        tdTrips.appendChild(document.createTextNode(String(trip)));
      });
    }

    // Clock in / out
    const tdIn = document.createElement("td");
    tdIn.textContent = formatTime(rec.clock_in);

    const tdOut = document.createElement("td");
    tdOut.textContent = formatTime(rec.clock_out);

    // OT
    const tdOT = document.createElement("td");
    const strong = document.createElement("strong");
    strong.textContent = ot.toFixed(2);
    tdOT.appendChild(strong);

    // Signature columns (print only)
    const tdSig1 = document.createElement("td");
    tdSig1.className = "print-only";
    const tdSig2 = document.createElement("td");
    tdSig2.className = "print-only";

    // Actions (no-print) — use addEventListener, not inline onclick
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
}

// ==================== EXPORT TO EXCEL (FIXED) ====================
function exportToExcel() {
  if (Object.keys(dailyRecords).length === 0) {
    alert("Tiada data untuk dieksport!");
    return;
  }

  const wb = XLSX.utils.book_new();
  const data = [];

  data.push([
    "Tarikh",
    "Hari",
    "Destinasi",
    "AWB",
    "Clock In",
    "Clock Out",
    "OT (Jam)",
    "Signature Anda",
    "Signature Penyelia"
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
          formatDateForPDF(date),
          dayName,
          dest,
          awb,
          rec.clock_in || "-",
          rec.clock_out || "-",
          otValue,
          "",
          ""
        ]);
      });
    } else {
      data.push([
        formatDateForPDF(date),
        dayName,
        "—",
        "-",
        rec.clock_in || "-",
        rec.clock_out || "-",
        ot.toFixed(2),
        "",
        ""
      ]);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(data);

  const summaryRow = data.length + 2;
  XLSX.utils.sheet_add_aoa(
    ws,
    [
      ["Ringkasan Bulan", ""],
      ["Total OT Keseluruhan", totalOT.toFixed(2) + " jam"],
      ["Total Hari KLIA Cargo", kliaCargoDays + " hari"],
      ["Total AWB", totalAWB]
    ],
    { origin: summaryRow }
  );

  ws["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 28 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
    { wch: 18 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Laporan OT Bulanan");

  const fileName = `RezaOT_${currentMonthKey.replace(/\s+/g, "_")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ==================== EXPORT / IMPORT JSON ====================
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
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const data = JSON.parse(event.target.result);

      if (data.dailyRecords) {
        dailyRecords = data.dailyRecords;
      }
      if (data.trips) {
        trips = data.trips;
      }

      saveToLocalStorage();
      updateReport();
      loadTrips();
      alert("Data berjaya diimport!");
    } catch (err) {
      console.error(err);
      alert("Fail JSON tidak sah. Sila cuba lagi.");
    }
  };
  reader.readAsText(file);

  e.target.value = "";
}
