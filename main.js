// main.js - Versi Lengkap (Edit Rekod + PDF Cantik)
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

// ==================== LOCAL STORAGE & FIREBASE ====================
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

function saveToFirebase() {
  db.ref(`users/default/${currentMonthKey}`).update({
    dailyRecords: dailyRecords,
    trips: trips,
    lastUpdated: new Date().toISOString()
  }).catch(err => console.error("Firebase save error:", err));
}

function loadDataFromFirebase() {
  db.ref(`users/default/${currentMonthKey}`).once('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      if (data.dailyRecords) dailyRecords = data.dailyRecords;
      if (data.trips) trips = data.trips;
    }
    saveToLocalStorage();
    updateReport();
    loadTrips();
  }).catch(err => {
    console.error("Firebase load error:", err);
    updateReport();
    loadTrips();
  });
}

// ==================== INIT ====================
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
  document.getElementById("exportPDF").addEventListener("click", exportToPDF);
}

// ==================== HANDLERS (sama) ====================
function toggleManageSection() { /* ... sama seperti sekarang */ }
function handleMonthChange() { /* ... sama */ }
function handleDestinationChange() { /* ... sama */ }
function handleAddTrip() { /* ... sama */ }
function handleClockFormSubmit(e) { /* ... sama */ }
function handleTripFormSubmit(e) { /* ... sama */ }

function deleteRecord(date) {
  if (confirm(`Padam rekod untuk ${date}?`)) {
    delete dailyRecords[date];
    saveToLocalStorage();
    updateReport();
  }
}

// ==================== EDIT REKOD ====================
function editRecord(date) {
  const rec = dailyRecords[date];
  if (!rec) return;

  const newCin = prompt("Clock-In (HH:MM):", rec.clock_in || "");
  const newCout = prompt("Clock-Out (HH:MM):", rec.clock_out || "");
  let newTripsStr = prompt("Destinasi (pisah dengan koma):", (rec.trips || []).join(", "));

  if (newCin !== null) rec.clock_in = newCin;
  if (newCout !== null) rec.clock_out = newCout;
  if (newTripsStr !== null) {
    rec.trips = newTripsStr.split(",").map(t => t.trim()).filter(t => t);
  }

  saveToLocalStorage();
  updateReport();
  alert(`Rekod untuk ${date} telah dikemaskini!`);
}

// ==================== UPDATE REPORT (Edit + Padam) ====================
function updateReport() {
  let totalOT = 0;
  const tbody = document.querySelector("#reportTable tbody");
  tbody.innerHTML = "";

  const hasData = Object.keys(dailyRecords).length > 0;
  document.getElementById("noRecordsMessage").style.display = hasData ? "none" : "block";

  Object.keys(dailyRecords).sort().forEach(date => {
    const rec = dailyRecords[date] || {};
    const tripList = Array.isArray(rec.trips) ? rec.trips : [];

    const ot = calculateOT(rec.clock_in || "", rec.clock_out || "", date, tripList);
    totalOT += ot;

    const tr = document.createElement("tr");

    const day = new Date(date).getDay();
    if (day === 6) tr.classList.add('saturday');
    if (day === 0) tr.classList.add('sunday');

    tr.innerHTML = `
      <td>${formatDateForPDF(date)}</td>
      <td>${tripList.join(", ") || "—"}</td>
      <td>${formatTime(rec.clock_in)}</td>
      <td>${formatTime(rec.clock_out)}</td>
      <td>${ot.toFixed(2)}</td>
      <td class="print-only"></td>
      <td class="print-only"></td>
    `;

    const td = document.createElement("td");
    td.innerHTML = `
      <button class="edit-btn" onclick="editRecord('${date}')">Edit</button>
      <button class="delete-btn" onclick="deleteRecord('${date}')">Padam</button>
    `;
    tr.appendChild(td);
    tbody.appendChild(tr);
  });

  document.getElementById("totalOT").textContent = totalOT.toFixed(2);
}

// ==================== PDF EXPORT CANTIK ====================
function exportToPDF() {
  const element = document.querySelector(".container");
  const opt = {
    margin: [10, 10, 10, 10],
    filename: `RezaOT_Laporan_${currentMonthKey}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(element).save();
}

// ==================== EXPORT & IMPORT ====================
function exportData() { /* kod anda yang sedia ada */ }
function importData(e) { /* kod anda yang sedia ada */ }
