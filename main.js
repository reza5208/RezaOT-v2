// ====================== main.js - Improved Full Version ======================

// Firebase Config (dari code asal anda)
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

let allRecords = [];
let currentMonthKey = "";
let destinations = ["KLIA Cargo", "KLIA Penumpang", "Subang Skypark", "Penang", "Johor", "Ipoh", "Melaka", "Kuantan", "Langkawi"];

// ==================== LOAD & SAVE ====================
function loadData() {
  const saved = localStorage.getItem(`rezaOT_${currentMonthKey}`);
  if (saved) allRecords = JSON.parse(saved);
  
  // Load dari Firebase
  db.ref(`users/default/${currentMonthKey}`).once('value', (snapshot) => {
    const data = snapshot.val();
    if (data && data.records) {
      allRecords = data.records;
      saveToLocal();
    }
    renderReport();
  }).catch(() => renderReport());
}

function saveToLocal() {
  localStorage.setItem(`rezaOT_${currentMonthKey}`, JSON.stringify(allRecords));
}

function saveToFirebase() {
  db.ref(`users/default/${currentMonthKey}`).set({
    records: allRecords,
    lastUpdated: new Date().toISOString()
  });
}

// ==================== RENDER REPORT ====================
function renderReport() {
  const tbody = document.querySelector("#reportTable tbody");
  const noRecordsMsg = document.getElementById("noRecordsMessage");
  let totalOT = 0;

  tbody.innerHTML = "";

  if (allRecords.length === 0) {
    noRecordsMsg.style.display = "block";
    document.getElementById("totalOT").textContent = "0.00";
    return;
  }

  noRecordsMsg.style.display = "none";

  allRecords.forEach((rec, index) => {
    const ot = calculateOT(rec.clockIn, rec.clockOut, rec.isWeekend, rec.isKLIA);
    totalOT += ot;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.date}</td>
      <td>${rec.destination}</td>
      <td>${rec.clockIn}</td>
      <td>${rec.clockOut}</td>
      <td><strong>${ot.toFixed(2)}</strong></td>
      <td class="print-only"></td>
      <td class="print-only"></td>
      <td>
        <button onclick="editRecord(${index})" class="edit-btn">Edit</button>
        <button onclick="deleteRecord(${index})" class="delete-btn">Padam</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("totalOT").textContent = totalOT.toFixed(2);
}

// ==================== OT CALCULATION ====================
function calculateOT(clockIn, clockOut, isWeekend, isKLIA) {
  if (!clockIn || !clockOut) return 0;

  let start = new Date(`1970-01-01T${clockIn}`);
  let end = new Date(`1970-01-01T${clockOut}`);
  if (end < start) end.setDate(end.getDate() + 1);

  let hours = (end - start) / (1000 * 60 * 60);
  let otHours = Math.max(0, hours - 8);

  let rate = isWeekend ? 2.0 : 1.5;
  if (isKLIA) rate = 2.0;

  return Math.round(otHours * rate * 10) / 10;
}

// ==================== SIMPAN KEHADIRAN ====================
document.getElementById("clockForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const date = document.getElementById("date").value;
  const clockIn = document.getElementById("clockIn").value;
  const clockOut = document.getElementById("clockOut").value;
  const destination = document.getElementById("destination").value;

  if (!date || !clockIn || !clockOut || !destination) {
    alert("❌ Sila isi semua maklumat yang diperlukan!");
    return;
  }

  const isWeekend = [0, 6].includes(new Date(date).getDay());
  const isKLIA = destination.toLowerCase().includes("klia");

  allRecords.push({
    date: date,
    clockIn: clockIn,
    clockOut: clockOut,
    destination: destination,
    isWeekend: isWeekend,
    isKLIA: isKLIA
  });

  saveToLocal();
  saveToFirebase();
  renderReport();
  alert("✅ Kehadiran berjaya disimpan!");
  this.reset();
});

// ==================== MANAGE DESTINASI ====================
document.getElementById("toggleManageBtn").addEventListener("click", () => {
  const panel = document.getElementById("manageDestinations");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
});

document.getElementById("addTripButton").addEventListener("click", () => {
  const newDest = document.getElementById("newTrip").value.trim();
  if (newDest && !destinations.includes(newDest)) {
    destinations.push(newDest);
    updateDestinationSelect();
    document.getElementById("newTrip").value = "";
    alert("✅ Destinasi baru ditambah!");
  }
});

function updateDestinationSelect() {
  const select = document.getElementById("destination");
  select.innerHTML = '<option value="">-- Pilih Destinasi --</option>';
  destinations.forEach(dest => {
    const opt = document.createElement("option");
    opt.value = dest;
    opt.textContent = dest;
    select.appendChild(opt);
  });
}

// ==================== EDIT & DELETE ====================
window.deleteRecord = function(index) {
  if (confirm("Padam rekod ini?")) {
    allRecords.splice(index, 1);
    saveToLocal();
    saveToFirebase();
    renderReport();
  }
};

window.editRecord = function(index) {
  const rec = allRecords[index];
  document.getElementById("date").value = rec.date;
  document.getElementById("clockIn").value = rec.clockIn;
  document.getElementById("clockOut").value = rec.clockOut;
  document.getElementById("destination").value = rec.destination;
  
  allRecords.splice(index, 1);
  saveToLocal();
  saveToFirebase();
  renderReport();
  alert("✏️ Data dipindahkan ke form. Sila tekan Simpan semula.");
};

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", () => {
  // Set default month
  const now = new Date();
  currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById("monthYear").value = currentMonthKey;
  document.getElementById("currentMonth").textContent = currentMonthKey;

  updateDestinationSelect();
  loadData();

  console.log("✅ RezaOT Improved - Semua sistem siap!");
});
