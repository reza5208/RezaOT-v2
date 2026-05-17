// utils.js

function getCurrentMonthYear() {
  const date = new Date();
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function getMonthName(month) {
  return monthNames[parseInt(month) - 1] || "Unknown";
}

// Load & Render Destination Dropdown
function loadTrips() {
  const destinationDropdown = document.getElementById("destination");
  if (!destinationDropdown) return;

  destinationDropdown.innerHTML = '<option value="">-- Pilih Destinasi --</option>';

  trips.forEach(trip => {
    const option = document.createElement("option");
    option.value = trip;
    option.textContent = trip;
    destinationDropdown.appendChild(option);
  });

  renderTripList();
}

function renderTripList() {
  const tripList = document.getElementById("tripList");
  if (!tripList) return;
  tripList.innerHTML = "";

  if (trips.length === 0) {
    tripList.innerHTML = `<li style="color:#888">Tiada destinasi. Tambah baru di atas.</li>`;
    return;
  }

  trips.forEach((trip, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${trip}</span>
      <button class="delete-trip-btn" data-index="${index}">Padam</button>
    `;
    tripList.appendChild(li);
  });

  // Delete button listener
  document.querySelectorAll(".delete-trip-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      const index = parseInt(this.dataset.index);
      if (confirm(`Padam "${trips[index]}"?`)) {
        trips.splice(index, 1);
        localStorage.setItem("trips", JSON.stringify(trips));
        loadTrips();
      }
    });
  });
}

// Format functions
function formatDateForPDF(date) {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${day.padStart(2,'0')}/${month.padStart(2,'0')}/${year.slice(-2)}`;
}

function formatTime(time) {
  return time ? time : "—";
}

// Calculate OT
function calculateOT(clockIn, clockOut, date, recordTrips = []) {
  if (!clockIn || !clockOut) return 0;

  const toMinutes = t => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  let start = toMinutes(clockIn);
  let end = toMinutes(clockOut);
  if (end < start) end += 1440;   // overnight

  const hasKLIACargo = recordTrips.some(t => 
    typeof t === "string" && t.toLowerCase().includes("klia cargo")
  );

  const day = new Date(date).getDay();

  if (hasKLIACargo && day !== 0) return 0; // Tiada OT kecuali Ahad

  let otMinutes = 0;
  if (day === 0) {                    // Ahad
    otMinutes = end - start;
  } else if (day === 6) {             // Sabtu
    otMinutes = Math.max(end - Math.max(start, 840), 0); // 14:00 = 840 min
  } else {                            // Hari biasa
    otMinutes = Math.max(end - Math.max(start, 1020), 0); // 17:00 = 1020 min
  }

  return Math.round(otMinutes / 60 * 100) / 100;
}
