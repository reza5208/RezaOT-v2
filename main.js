// main.js - Improved & Stable Version
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
      if (data.dailyRecords) dailyRecords = data.dailyRecords;
      if (data.trips) trips = data.trips;
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
}

// Toggle Manage
function toggleManageSection() {
  const section = document.getElementById("manageDestinations");
  const btn = document.getElementById("toggleManageBtn");
  if (section.style.display === "none" || !section.style.display) {
    section.style.display = "block";
    btn.textContent = "Manage Destinasi ▲";
  } else {
    section.style.display = "none";
    btn.textContent = "Manage Destinasi ▼";
  }
}

// Handlers (simplified + stable)
function handleMonthChange() {
  const [year, month] = this.value.split("-");
  currentMonthKey = `${getMonthName(month)} ${year}`;
  document.getElementById("currentMonth").textContent = currentMonthKey;
  loadFromLocalStorage();
  loadDataFromFirebase();
}

function handleDestinationChange() {
  const field = document.getElementById("airwayBillField");
  field.style.display = this.value === "KLIA Cargo" ? "block" : "none";
  if (this.value !== "KLIA Cargo") document.getElementById("airwayBill").value = "";
}

function handleAddTrip() {
  const name = document.getElementById("newTrip").value.trim();
  if (!name) return alert("Sila isi nama destinasi");
  if (trips.includes(name)) return alert("Sudah wujud!");

  trips.push(name);
  saveToLocalStorage();
  loadTrips();
  document.getElementById("newTrip").value = "";
}

function handleClockFormSubmit(e) {
  e.preventDefault();
  const date = document.getElementById("date").value;
  const cin = document.getElementById("clockIn").value;
  const cout = document.getElementById("clockOut").value;

  if (cin && cout && cout <= cin) return alert("Clock Out mesti lewat!");

  if (!dailyRecords[date]) dailyRecords[date] = { trips: [], clock_in: "", clock_out: "" };
  dailyRecords[date].clock_in = cin;
  dailyRecords[date].clock_out = cout;

  saveToLocalStorage();
  updateReport();
}

function handleTripFormSubmit(e) {
  e.preventDefault();
  const dest = document.getElementById("destination").value;
  const awb = document.getElementById("airwayBill").value.trim();
  const date = document.getElementById("date").value;

  if (!dest) return alert("Pilih destinasi!");

  if (!dailyRecords[date]) dailyRecords[date] = { trips: [], clock_in: "", clock_out: "" };

  let entry = dest;
  if (dest === "KLIA Cargo") {
    if (!awb) return alert("Isi Airway Bill!");
    entry = `${dest} (${awb})`;
  }

  dailyRecords[date].trips.push(entry);
  saveToLocalStorage();
  updateReport();

  document.getElementById("destination").value = "";
  document.getElementById("airwayBill").value = "";
  document.getElementById("airwayBillField").style.display = "none";
}

function deleteRecord(date) {
  if (confirm(`Padam rekod ${date}?`)) {
    delete dailyRecords[date];
    saveToLocalStorage();
    updateReport();
  }
}

function updateReport() {
  let totalOT = 0;
  const tbody = document.querySelector("#reportTable tbody");
  tbody.innerHTML = "";

  const hasData = Object.keys(dailyRecords).length > 0;
  document.getElementById("noRecordsMessage").style.display = hasData ? "none" : "block";

  Object.keys(dailyRecords).sort().forEach(date => {
    const rec = dailyRecords[date];
    const ot = calculateOT(rec.clock_in, rec.clock_out, date, rec.trips);
    totalOT += ot;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateForPDF(date)}</td>
      <td>${rec.trips.join(", ") || "—"}</td>
      <td>${formatTime(rec.clock_in)}</td>
      <td>${formatTime(rec.clock_out)}</td>
      <td>${ot.toFixed(2)}</td>
      <td class="print-only"></td>
      <td class="print-only"></td>
    `;

    const td = document.createElement("td");
    const btn = document.createElement("button");
    btn.textContent = "Padam";
    btn.className = "delete-btn";
    btn.onclick = () => deleteRecord(date);
    td.appendChild(btn);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });

  document.getElementById("totalOT").textContent = totalOT.toFixed(2);
}

// Export & Import (sama)
function exportData() {
  const data = { dailyRecords, trips, month: currentMonthKey };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `RezaOT_${currentMonthKey}.json`;
  a.click();
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imp = JSON.parse(ev.target.result);
      if (imp.dailyRecords) dailyRecords = imp.dailyRecords;
      if (imp.trips) trips = imp.trips;
      saveToLocalStorage();
      updateReport();
      loadTrips();
      alert("Import berjaya!");
    } catch(err) { alert("Fail import rosak"); }
  };
  reader.readAsText(file);
}
