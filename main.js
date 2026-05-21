// main.js - Full Upgraded + Excel Export (Compact 1 Sheet)

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

// GLOBAL STATE
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
  db.ref(`users/default/${currentMonthKey}`).update({
    dailyRecords: dailyRecords,
    trips: trips,
    lastUpdated: new Date().toISOString()
  }).catch(err => console.error(err));
}

function loadDataFromFirebase() {
  db.ref(`users/default/${currentMonthKey}`).once('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      dailyRecords = data.dailyRecords || dailyRecords;
      trips = data.trips || trips;
    }
    saveToLocalStorage();
    updateReport();
    loadTrips();
  }).catch(err => {
    console.error(err);
    updateReport();
    loadTrips();
  });
}

// ==================== INITIALIZE ====================
document.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  currentMonthKey = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  
  document.getElementById("monthYear").value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById("currentMonth").textContent = currentMonthKey;
  document.getElementById("date").value = now.toISOString().split("T")[0];
  document.getElementById("supervisorName").textContent = localStorage.getItem("supervisorName") || "Talib";

  loadFromLocalStorage();
  loadDataFromFirebase();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById("monthYear").addEventListener("change", handleMonthChange);
  document.getElementById("destination").addEventListener("change", handleDestinationChange);
  document.getElementById("addTripButton").addEventListener("click", handleAddTrip);
  document.getElementById("clockForm").addEventListener("submit", handleClockFormSubmit);
  document.getElementById("tripForm").addEventListener("submit", handleTripFormSubmit);
  document.getElementById("toggleManageBtn").addEventListener("click", toggleManageSection);
  document.getElementById("exportDataBtn").addEventListener("click", exportData);
  document.getElementById("importDataInput").addEventListener("change", importData);
  document.getElementById("printButton").addEventListener("click", () => window.print());
  
  // Excel Export Button
  const excelBtn = document.getElementById("exportExcelBtn");
  if (excelBtn) excelBtn.addEventListener("click", exportToExcel);
}

// ==================== TOGGLE & HANDLERS ====================
function toggleManageSection() { ... }   // (sama seperti ori kau)

function handleMonthChange() { ... }     // (sama)
function handleDestinationChange() { ... } // (sama)
function handleAddTrip() { ... }         // (sama)
function handleClockFormSubmit(e) { ... } // (sama)
function handleTripFormSubmit(e) { ... } // (sama)
function deleteRecord(date) { ... }      // (sama)

// ==================== UPDATE REPORT ====================
function updateReport() { ... }          // (sama seperti ori kau)

// ==================== NEW: EXPORT TO EXCEL ====================
function exportToExcel() {
    if (Object.keys(dailyRecords).length === 0) {
        alert("Tiada data untuk dieksport!");
        return;
    }

    const wb = XLSX.utils.book_new();
    const data = [];

    // Header
    data.push([
        "Tarikh", "Hari", "Destinasi", "AWB",
        "Clock In", "Clock Out", "OT (Jam)",
        "Signature Anda", "Signature Penyelia"
    ]);

    let totalOT = 0;
    let kliaCargoDays = 0;
    let totalAWB = 0;

    Object.keys(dailyRecords).sort().forEach(date => {
        const rec = dailyRecords[date];
        const ot = calculateOT(rec.clock_in, rec.clock_out, date, rec.trips || []);
        totalOT += ot;

        const dateObj = new Date(date);
        const dayName = dateObj.toLocaleDateString('ms-MY', { weekday: 'long' });

        if (rec.trips && rec.trips.length > 0) {
            rec.trips.forEach(trip => {
                let dest = trip;
                let awb = "-";
                if (trip.includes("KLIA Cargo")) {
                    kliaCargoDays++;
                    const match = trip.match(/\((.+?)\)/);
                    if (match) awb = match[1];
                }
                if (awb !== "-") totalAWB++;

                data.push([
                    formatDateForPDF ? formatDateForPDF(date) : date,
                    dayName,
                    dest,
                    awb,
                    rec.clock_in || "-",
                    rec.clock_out || "-",
                    ot.toFixed(2),
                    "", ""
                ]);
            });
        } else {
            data.push([
                formatDateForPDF ? formatDateForPDF(date) : date,
                dayName,
                "—",
                "-",
                rec.clock_in || "-",
                rec.clock_out || "-",
                ot.toFixed(2),
                "", ""
            ]);
        }
    });

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Summary di bawah table
    const summaryRow = data.length + 2;
    XLSX.utils.sheet_add_aoa(ws, [
        ["Ringkasan Bulan", ""],
        ["Total OT Keseluruhan", totalOT.toFixed(2) + " jam"],
        ["Total Hari KLIA Cargo", kliaCargoDays + " hari"],
        ["Total AWB", totalAWB]
    ], { origin: summaryRow });

    XLSX.utils.book_append_sheet(wb, ws, "Laporan OT Bulanan");

    const fileName = `RezaOT_${currentMonthKey.replace(" ", "_")}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// Export & Import JSON (backup)
function exportData() { ... }   // (sama seperti ori)
function importData(e) { ... }  // (sama seperti ori)
