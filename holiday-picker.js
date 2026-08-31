// holiday-picker.js — pilih cuti company ambil (katalog kekal dalam constants.js)
(function () {
  "use strict";

  function updateHolidayBadge() {
    const dateInput = document.getElementById("date");
    const badge = document.getElementById("holidayBadge");
    if (!dateInput || !badge) return;
    const d = dateInput.value;
    if (!d || typeof isCatalogHoliday !== "function" || !isCatalogHoliday(d)) {
      badge.hidden = true;
      badge.textContent = "";
      badge.classList.remove("holiday-badge-off");
      return;
    }
    badge.hidden = false;
    const name = typeof getHolidayName === "function" ? getHolidayName(d) : d;
    if (typeof isPublicHoliday === "function" && isPublicHoliday(d)) {
      badge.classList.remove("holiday-badge-off");
      badge.textContent = "🏖 Cuti (diambil): " + name;
    } else {
      badge.classList.add("holiday-badge-off");
      badge.textContent = "📅 Public holiday (company tidak ambil): " + name;
    }
  }

  function openHolidayPicker() {
    const panel = document.getElementById("holidayPickerPanel");
    if (!panel) return;
    renderHolidayPicker();
    const show = panel.style.display === "none" || !panel.style.display;
    panel.style.display = show ? "block" : "none";
  }

  function renderHolidayPicker() {
    const list = document.getElementById("holidayPickerList");
    const yearSel = document.getElementById("holidayPickerYear");
    if (!list || typeof getAllHolidayDates !== "function") return;

    const map = getObservedHolidaysMap();
    const allDates = getAllHolidayDates();
    const years = [];
    allDates.forEach(function (d) {
      const y = d.slice(0, 4);
      if (years.indexOf(y) === -1) years.push(y);
    });
    years.sort();

    if (yearSel && yearSel.options.length === 0) {
      years.forEach(function (y) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSel.appendChild(opt);
      });
      const nowY = String(new Date().getFullYear());
      yearSel.value = years.indexOf(nowY) >= 0 ? nowY : years[years.length - 1];
    }

    const year = yearSel ? yearSel.value : String(new Date().getFullYear());
    const filtered = allDates.filter(function (d) { return d.indexOf(year) === 0; });

    list.innerHTML = "";
    if (filtered.length === 0) {
      const li = document.createElement("li");
      li.style.color = "#888";
      li.textContent = "Tiada cuti untuk tahun ini.";
      list.appendChild(li);
      return;
    }

    filtered.forEach(function (dateStr) {
      const li = document.createElement("li");
      li.className = "holiday-pick-item";

      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = map[dateStr] !== false;
      cb.addEventListener("change", function () {
        setHolidayObserved(dateStr, this.checked);
        updateHolidayBadge();
        if (typeof updateReport === "function") updateReport();
        if (typeof showToast === "function") {
          showToast(
            (this.checked ? "Cuti diambil: " : "Cuti tidak diambil: ") + getHolidayName(dateStr)
          );
        }
      });

      const span = document.createElement("span");
      const parts = dateStr.split("-");
      span.textContent = parts[2] + "/" + parts[1] + "/" + parts[0] + " — " + getHolidayName(dateStr);

      label.appendChild(cb);
      label.appendChild(span);
      li.appendChild(label);
      list.appendChild(li);
    });
  }

  function selectAllHolidays(observed) {
    const yearSel = document.getElementById("holidayPickerYear");
    const year = yearSel ? yearSel.value : String(new Date().getFullYear());
    const map = getObservedHolidaysMap();
    getAllHolidayDates().forEach(function (d) {
      if (d.indexOf(year) === 0) map[d] = !!observed;
    });
    saveObservedHolidaysMap(map);
    renderHolidayPicker();
    updateHolidayBadge();
    if (typeof updateReport === "function") updateReport();
    if (typeof showToast === "function") {
      showToast(observed ? "Semua cuti tahun ini: diambil" : "Semua cuti tahun ini: tidak diambil");
    }
  }

  window.updateHolidayBadge = updateHolidayBadge;

  function wire() {
    const dateInput = document.getElementById("date");
    if (dateInput) {
      dateInput.addEventListener("change", updateHolidayBadge);
      dateInput.addEventListener("input", updateHolidayBadge);
    }

    const holidayBtn = document.getElementById("holidayPickerBtn");
    if (holidayBtn) holidayBtn.addEventListener("click", openHolidayPicker);

    const holidayYear = document.getElementById("holidayPickerYear");
    if (holidayYear) holidayYear.addEventListener("change", renderHolidayPicker);

    const holAllOn = document.getElementById("holidaySelectAll");
    if (holAllOn) holAllOn.addEventListener("click", function () { selectAllHolidays(true); });
    const holAllOff = document.getElementById("holidaySelectNone");
    if (holAllOff) holAllOff.addEventListener("click", function () { selectAllHolidays(false); });

    updateHolidayBadge();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
