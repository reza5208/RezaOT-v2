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
      badge.textContent = translated("holidayObserved", "🏖 Cuti (diambil): ") + name;
    } else {
      badge.classList.add("holiday-badge-off");
      badge.textContent = translated("holidayNotObserved", "📅 Cuti (company tidak ambil): ") + name;
    }
  }

  function openHolidayPicker() {
    const panel = document.getElementById("holidayPickerPanel");
    if (!panel) return;
    ensureCustomControls();
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

    if (yearSel) {
      const selected = yearSel.value || String(new Date().getFullYear());
      if (years.indexOf(selected) < 0) years.push(selected);
      if (years.indexOf(String(new Date().getFullYear())) < 0) years.push(String(new Date().getFullYear()));
      years.sort();
      yearSel.textContent = "";
      years.forEach(function (y) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSel.appendChild(opt);
      });
      yearSel.value = selected;
    }

    const year = yearSel ? yearSel.value : String(new Date().getFullYear());
    const filtered = allDates.filter(function (d) { return d.indexOf(year) === 0; });

    list.innerHTML = "";
    if (filtered.length === 0) {
      const li = document.createElement("li");
      li.style.color = "#888";
      li.textContent = translated("holidayNoneForYear", "Tiada cuti untuk tahun ini.");
      list.appendChild(li);
      return;
    }

    filtered.forEach(function (dateStr) {
      const li = document.createElement("li");
      li.className = "holiday-pick-item";

      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = map[dateStr] === true;
      cb.addEventListener("change", function () {
        setHolidayObserved(dateStr, this.checked);
        updateHolidayBadge();
        if (typeof updateReport === "function") updateReport();
        if (typeof showToast === "function") {
          showToast(
            (this.checked ? translated("holidaySelected", "Cuti diambil: ") : translated("holidayUnselected", "Cuti tidak diambil: ")) + getHolidayName(dateStr)
          );
        }
      });

      const span = document.createElement("span");
      const parts = dateStr.split("-");
      span.textContent = parts[2] + "/" + parts[1] + "/" + parts[0] + " — " + getHolidayName(dateStr, true);

      label.appendChild(cb);
      label.appendChild(span);
      li.appendChild(label);
      if (Object.prototype.hasOwnProperty.call(getCustomHolidaysMap(), dateStr)) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "secondary-btn";
        remove.textContent = translated("removeCustomHoliday", "Padam cuti tersuai");
        remove.addEventListener("click", async function () {
          const message = translated("removeCustomHolidayConfirm", "Padam cuti company ini?") + " " + dateStr;
          const accepted = typeof rezaotConfirm === "function" ? await rezaotConfirm(message) : confirm(message);
          if (!accepted) return;
          try {
            removeCustomHoliday(dateStr);
            renderHolidayPicker();
            if (typeof updateReport === "function") updateReport();
            updateHolidayBadge();
          } catch (error) { showToast(error.message); }
        });
        li.appendChild(remove);
      }
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
      showToast(observed ? translated("holidayAllSelected", "Semua cuti tahun ini: diambil") : translated("holidayAllUnselected", "Semua cuti tahun ini: tidak diambil"));
    }
  }

  function translated(key, fallback) {
    const text = window.RezaOT_i18n && RezaOT_i18n.t(key);
    return text && text !== key ? text : fallback;
  }

  function ensureCustomControls() {
    const panel = document.getElementById("holidayPickerPanel");
    if (!panel || document.getElementById("customHolidayForm")) return;
    const notice = document.createElement("p");
    notice.className = "holiday-picker-hint";
    notice.setAttribute("data-i18n", "holidayCatalogNotice");
    notice.textContent = translated("holidayCatalogNotice", "Katalog lama belum disahkan dengan kalendar rasmi. Semak tarikh company; tambah atau betulkan cuti di bawah. Tetapan bulan yang telah disimpan hanya berubah melalui Kemas kini tetapan bulan ini.");
    panel.insertBefore(notice, panel.querySelector(".holiday-picker-toolbar"));
    const form = document.createElement("form");
    form.id = "customHolidayForm";
    form.className = "form-grid";
    const dateLabel = document.createElement("label");
    const dateCaption = document.createElement("span");
    dateCaption.setAttribute("data-i18n", "customHolidayDate");
    dateCaption.textContent = translated("customHolidayDate", "Tarikh cuti company:");
    dateLabel.appendChild(dateCaption);
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.id = "customHolidayDate";
    dateInput.required = true;
    dateLabel.appendChild(dateInput);
    const nameLabel = document.createElement("label");
    const nameCaption = document.createElement("span");
    nameCaption.setAttribute("data-i18n", "customHolidayName");
    nameCaption.textContent = translated("customHolidayName", "Nama cuti:");
    nameLabel.appendChild(nameCaption);
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.id = "customHolidayName";
    nameInput.maxLength = 200;
    nameInput.required = true;
    nameLabel.appendChild(nameInput);
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.setAttribute("data-i18n", "addCustomHoliday");
    submit.textContent = translated("addCustomHoliday", "Tambah / betulkan cuti company");
    form.appendChild(dateLabel);
    form.appendChild(nameLabel);
    form.appendChild(submit);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      try {
        addCustomHoliday(dateInput.value, nameInput.value, true);
        const year = document.getElementById("holidayPickerYear");
        if (year && !Array.from(year.options).some(function (option) { return option.value === dateInput.value.slice(0, 4); })) {
          const option = document.createElement("option");
          option.value = option.textContent = dateInput.value.slice(0, 4);
          year.appendChild(option);
        }
        if (year) year.value = dateInput.value.slice(0, 4);
        renderHolidayPicker();
        updateHolidayBadge();
        if (typeof updateReport === "function") updateReport();
        showToast(translated("customHolidaySaved", "Cuti company disimpan. Kemas kini tetapan bulan jika bulan itu mempunyai snapshot."));
        nameInput.value = "";
      } catch (error) { showToast(error.message, 5000); }
    });
    panel.insertBefore(form, document.getElementById("holidayPickerList"));
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

  document.addEventListener("rezaot-report", function () {
    const panel = document.getElementById("holidayPickerPanel");
    if (panel && panel.style.display !== "none") renderHolidayPicker();
  });
  document.addEventListener("rezaot-ready", function () {
    wire();
    ensureCustomControls();
  });
})();
