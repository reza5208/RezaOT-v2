// utils.js
function getCurrentMonthYear() {
  const date = new Date();
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function getMonthName(month) {
  return monthNames[parseInt(month, 10) - 1] || "Unknown";
}

/** Escape HTML special chars (defense-in-depth) */
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """)
    .replace(/'/g, "&#39;");
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
      if (confirm(`Padam "${trips[index]}"?`)) {
        trips.splice(index, 1);
        // Sync full storage + Firebase if available
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
  const [year, month, day] = date.split("-");
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year.slice(-2)}`;
}

function formatTime(time) {
  return time ? time : "—";
}

// ==================== OT LOGIC ====================
function calculateOT(clockIn, clockOut, date, recordTrips = []) {
  if (!clockIn || !clockOut) return 0;

  const toMinutes = (time) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  let start = toMinutes(clockIn);
  let end = toMinutes(clockOut);
  if (end < start) end += 1440;

  const hasKLIACargo = recordTrips.some(
    (t) => typeof t === "string" && t.toLowerCase().includes("klia cargo")
  );

  // Consistent local date parse (avoid UTC shift)
  const day = new Date(date + "T00:00:00").getDay();

  let otMinutes = 0;

  if (hasKLIACargo && day !== 0) {
    otMinutes = 0;
  } else if (day === 0) {
    otMinutes = end - start;
  } else if (day === 6) {
    otMinutes = Math.max(end - Math.max(start, 840), 0); // 14:00
  } else {
    otMinutes = Math.max(end - Math.max(start, 1020), 0); // 17:00
  }

  return Math.round((otMinutes / 60) * 100) / 100;
}
