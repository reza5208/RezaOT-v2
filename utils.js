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
    li.textContent = "Tiada destinasi. Tambah baru di atas.";
    tripList.appendChild(li);
    return;
  }

  trips.forEach((trip, index) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = trip;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Padam";
    btn.dataset.index = String(index);
    btn.addEventListener("click", function () {
      const index = parseInt(this.dataset.index, 10);
      if (Number.isNaN(index)) return;
      trips.splice(index, 1);
      saveToLocalStorage();
      loadTrips();
      showToast("Destinasi dipadam");
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
  return `${day}/${month}/${year}`;
}

function formatTime(time) {
  if (!time) return "-";
  return time;
}

function calculateOT(clockIn, clockOut, date, recordTrips) {
  if (!clockIn || !clockOut) return 0;

  function toMinutes(time) {
    const p = String(time).split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1] || "0", 10);
  }

  const inM = toMinutes(clockIn);
  const outM = toMinutes(clockOut);
  if (outM <= inM) return 0;

  var hasKLIACargo = (recordTrips || []).some(function (t) {
    return String(t).toLowerCase().indexOf("klia cargo") >= 0;
  });

  const day = new Date(date + "T00:00:00").getDay();
  const isHol = typeof isPublicHoliday === "function" && isPublicHoliday(date);
  const settings = typeof getOtSettings === "function" ? getOtSettings() : { weekdayStart: "17:00", saturdayStart: "14:00" };

  if (day === 0 || isHol) {
    return Math.round(((outM - inM) / 60) * 100) / 100;
  }

  if (hasKLIACargo) return 0;

  let otStart;
  if (day === 6) otStart = toMinutes(settings.saturdayStart || "14:00");
  else otStart = toMinutes(settings.weekdayStart || "17:00");

  if (outM <= otStart) return 0;
  const start = Math.max(inM, otStart);
  return Math.round(((outM - start) / 60) * 100) / 100;
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
