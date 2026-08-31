// utils.js
function getCurrentMonthYear() {
  const date = new Date();
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function getMonthName(month) {
  return monthNames[parseInt(month, 10) - 1] || "Unknown";
}

function loadTrips() {
  const destinationDropdown = document.getElementById("destination");
  if (!destinationDropdown) return;

  destinationDropdown.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Pilih Destinasi --";
  destinationDropdown.appendChild(placeholder);

  trips.forEach((trip) => {
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
    const li = document.createElement("li");
    li.style.color = "#888";
    li.textContent = "Tiada destinasi. Tambah baru di atas.";
    tripList.appendChild(li);
    return;
  }

  trips.forEach((trip, index) => {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.textContent = trip;

    const btn = document.createElement("button");
    btn.className = "delete-trip-btn";
    btn.dataset.index = String(index);
    btn.textContent = "Padam";

    li.appendChild(span);
    li.appendChild(btn);
    tripList.appendChild(li);
  });

  document.querySelectorAll(".delete-trip-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const index = parseInt(this.dataset.index, 10);
      if (confirm("Padam destinasi ini?")) {
        trips.splice(index, 1);
        if (typeof saveToLocalStorage === "function") {
          saveToLocalStorage();
        } else {
          localStorage.setItem("trips", JSON.stringify(trips));
        }
        loadTrips();
      }
    });
  });
}

function formatDateForPDF(date) {
  if (!date) return "";
  const parts = date.split("-");
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  return day.padStart(2, "0") + "/" + month.padStart(2, "0") + "/" + year.slice(-2);
}

function formatTime(time) {
  return time ? time : "—";
}

// ==================== OT LOGIC ====================
function calculateOT(clockIn, clockOut, date, recordTrips) {
  if (!clockIn || !clockOut) return 0;
  if (!recordTrips) recordTrips = [];

  function toMinutes(time) {
    var parts = time.split(":");
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  var start = toMinutes(clockIn);
  var end = toMinutes(clockOut);
  if (end < start) end += 1440;

  var hasKLIACargo = recordTrips.some(function (t) {
    return typeof t === "string" && t.toLowerCase().includes("klia cargo");
  });

  var day = new Date(date + "T00:00:00").getDay();
  var isHoliday = typeof isPublicHoliday === "function" && isPublicHoliday(date);

  var otMinutes = 0;

  // Cuti umum / Ahad = OT penuh (jam kerja sebenar)
  if (isHoliday || day === 0) {
    otMinutes = end - start;
  } else if (hasKLIACargo) {
    // KLIA Cargo: tiada OT hari biasa & Sabtu
    otMinutes = 0;
  } else if (day === 6) {
    // Sabtu: OT selepas 14:00
    otMinutes = Math.max(end - Math.max(start, 840), 0);
  } else {
    // Isnin–Jumaat: OT selepas 17:00
    otMinutes = Math.max(end - Math.max(start, 1020), 0);
  }

  return Math.round((otMinutes / 60) * 100) / 100;
}
