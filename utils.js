// utils.js — shared helpers (v38)
function loadTrips() {
  const dest = document.getElementById("destination");
  const tripList = document.getElementById("tripList");
  if (!dest) return;
  dest.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = (window.RezaOT_i18n && RezaOT_i18n.t("selectDest")) || "-- Pilih Destinasi --";
  dest.appendChild(placeholder);
  (trips || []).forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    dest.appendChild(opt);
  });
  if (tripList) {
    tripList.innerHTML = "";
    (trips || []).forEach((t, i) => {
      const li = document.createElement("li");
      li.textContent = t + " ";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "×";
      btn.className = "trip-del-btn";
      btn.addEventListener("click", () => {
        if (!confirm("Padam destinasi \"" + t + "\"?")) return;
        trips.splice(i, 1);
        saveToLocalStorage();
        loadTrips();
      });
      li.appendChild(btn);
      tripList.appendChild(li);
    });
  }
}

function formatTime(t) {
  if (!t) return "-";
  return String(t).slice(0, 5);
}

function formatDateForPDF(dateStr) {
  if (!dateStr) return "-";
  const p = String(dateStr).split("-");
  if (p.length !== 3) return dateStr;
  return p[2] + "/" + p[1] + "/" + p[0];
}

function getLocalDateString(d) {
  const x = d || new Date();
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}

function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => { el.hidden = true; }, 2800);
}

function calculateOT(clockIn, clockOut, date, recordTrips) {
  if (!clockIn || !clockOut) return 0;
  const [hIn, mIn] = String(clockIn).split(":").map(Number);
  const [hOut, mOut] = String(clockOut).split(":").map(Number);
  if (Number.isNaN(hIn) || Number.isNaN(hOut)) return 0;
  let mins = (hOut * 60 + (mOut || 0)) - (hIn * 60 + (mIn || 0));
  if (mins <= 0) mins += 24 * 60;
  const totalHrs = mins / 60;
  const day = new Date(date + "T00:00:00").getDay();
  const isHol = typeof isPublicHoliday === "function" && isPublicHoliday(date);
  const settings = (typeof getOtSettings === "function") ? getOtSettings() : {};
  const weekdayStart = settings.weekdayOtStart || "17:00";
  const saturdayStart = settings.saturdayOtStart || "14:00";

  const hasKlia = (recordTrips || []).some((t) => String(t).toLowerCase().includes("klia cargo"));

  if (isHol || day === 0) return Math.round(totalHrs * 100) / 100;

  function startMins(s) {
    const [h, m] = String(s).split(":").map(Number);
    return h * 60 + (m || 0);
  }
  const outMins = hOut * 60 + (mOut || 0);
  let otStart = day === 6 ? startMins(saturdayStart) : startMins(weekdayStart);
  if (hasKlia && (day >= 1 && day <= 6)) return 0;
  if (outMins <= otStart) return 0;
  const ot = (outMins - Math.max(otStart, hIn * 60 + (mIn || 0))) / 60;
  return Math.max(0, Math.round(ot * 100) / 100);
}

function initDarkMode() {
  const btn = document.getElementById("darkModeBtn");
  const apply = () => {
    const dark = localStorage.getItem("darkMode") === "1";
    document.body.classList.toggle("dark", dark);
    if (btn) btn.textContent = dark ? "☀️" : "🌙";
  };
  apply();
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener("click", () => {
      const next = localStorage.getItem("darkMode") !== "1";
      localStorage.setItem("darkMode", next ? "1" : "0");
      apply();
    });
  }
}

function updateHolidayBadge() {
  const dateInput = document.getElementById("date");
  const badge = document.getElementById("holidayBadge");
  if (!dateInput || !badge) return;
  const d = dateInput.value;
  if (d && typeof isPublicHoliday === "function" && isPublicHoliday(d)) {
    badge.hidden = false;
    badge.classList.add("holiday-badge-on");
    badge.textContent = (typeof getHolidayName === "function" && getHolidayName(d)) || "Cuti";
  } else {
    badge.hidden = true;
    badge.classList.remove("holiday-badge-on");
    badge.textContent = "";
  }
}

function applyPrintAutoSize() {
  const table = document.getElementById("reportTable");
  if (!table) return;
  table.style.fontSize = "";
  const rows = table.querySelectorAll("tbody tr").length;
  if (rows > 20) table.style.fontSize = "9px";
  else if (rows > 14) table.style.fontSize = "10px";
  else if (rows > 10) table.style.fontSize = "11px";
}

function clearPrintAutoSize() {
  const table = document.getElementById("reportTable");
  if (table) table.style.fontSize = "";
}
