// utils.js
function loadTrips() {
  const destinationDropdown = document.getElementById("destination");
  if (!destinationDropdown) return;

  destinationDropdown.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = (window.RezaOT_i18n && RezaOT_i18n.t("selectDest")) || "-- Pilih Destinasi --";
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
    li.textContent = window.rezaotT ? rezaotT("noDestinations", "Tiada destinasi. Tambah baru di atas.") : "Tiada destinasi. Tambah baru di atas.";
    tripList.appendChild(li);
    return;
  }

  trips.forEach((trip, index) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = trip;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = window.rezaotT ? rezaotT("btnDelete", "Padam") : "Padam";
    btn.dataset.index = String(index);
    btn.addEventListener("click", function () {
      const index = parseInt(this.dataset.index, 10);
      if (Number.isNaN(index)) return;
      try {
        trips.splice(index, 1);
        if (window.RezaOT_sync) RezaOT_sync.tripsChanged();
        else saveToLocalStorage();
        loadTrips();
        showToast(window.rezaotT ? rezaotT("destinationDeleted", "Destinasi dipadam") : "Destinasi dipadam");
      } catch (error) { loadTrips(); showToast(error.message); }
    });
    li.appendChild(span);
    li.appendChild(btn);
    tripList.appendChild(li);
  });
}

function formatDateForPDF(date) {
  if (!date) return "";
  const parts = date.split("-");
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  const yy = String(year).slice(-2);
  return day + "/" + month + "/" + yy;
}

function formatTime(time) {
  if (!time) return "-";
  return time;
}

function calculateOT(clockIn, clockOut, date, recordTrips, calculationSettings) {
  if (!RezaOT_isValidDate(date) || !RezaOT_isValidTime(clockIn) || !RezaOT_isValidTime(clockOut)) return 0;
  const inM = timeToMinutes(clockIn);
  let outM = timeToMinutes(clockOut);
  if (outM === inM) return 0;
  if (outM < inM) outM += 24 * 60;
  const calculation = calculationSettings || getRecordCalculationSettings(date);
  const day = new Date(date + "T00:00:00").getDay();
  const isHol = isPublicHoliday(date, calculation);
  const settings = validateOtSettings(calculation.otSettings || getOtSettings());
  if (day === 0 || isHol) {
    const salary = calculation.salarySettings || {};
    const rest = Number(salary.restBreakHours);
    const breakH = Number.isFinite(rest) && rest >= 0 && rest <= 24 ? rest : 0;
    return Math.round(Math.max(0, (outM - inM) / 60 - breakH) * 100) / 100;
  }
  const hasKlia = Array.isArray(recordTrips) && recordTrips.some(function (trip) {
    return String(trip).toLowerCase().includes("klia cargo");
  });
  if (hasKlia) return 0;
  const start = Math.max(inM, timeToMinutes(day === 6 ? settings.saturdayAfter : settings.weekdayAfter));
  return Math.round(Math.max(0, outM - start) / 60 * 100) / 100;
}

function RezaOT_recordOT(date, record, calculationSettings) {
  if (!record || record.unpaid || record.annual) return 0;
  return calculateOT(record.clock_in, record.clock_out, date, record.trips, calculationSettings);
}

function getLocalDateString(d) {
  const x = d || new Date();
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function getCurrentTimeString() {
  const now = new Date();
  return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}

function showToast(message, duration = 2500) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function () { el.hidden = true; }, duration);
}
