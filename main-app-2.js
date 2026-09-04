function toggleManageSection() {
  const section = document.getElementById("manageDestinations");
  if (!section) return;
  section.style.display = section.style.display === "none" ? "block" : "none";
}

function handleMonthChange() {
  const monthInput = document.getElementById("monthYear");
  if (!monthInput || !monthInput.value) return;

  const intended = monthInput.value;
  const partsIn = intended.split("-");
  if (partsIn.length < 2) return;
  const year = partsIn[0];
  const month = partsIn[1];
  const mi = parseInt(month, 10) - 1;
  if (mi < 0 || mi > 11) return;
  const newKey = monthNames[mi] + " " + year;
  if (newKey === currentMonthKey) return;

  if (!confirm("Tukar ke " + newKey + "?\nData bulan semasa sudah disimpan.")) {
    restoreMonthInput(monthInput, currentMonthKey);
    return;
  }

  currentMonthKey = newKey;
  monthInput.value = intended;
  setTimeout(function () { monthInput.value = intended; }, 0);

  const currentMonthEl = document.getElementById("currentMonth");
  if (currentMonthEl) currentMonthEl.textContent = currentMonthKey;
  stopFirebaseListener();
  loadFromLocalStorage();
  if (typeof lastLocalSaveAt !== "undefined") lastLocalSaveAt = 0;
  updateReport();
  loadTrips();
  startFirebaseListener();
  showToast("Bulan: " + currentMonthKey);
}

function restoreMonthInput(monthInput, key) {
  if (!monthInput || !key) return;
  const parts = key.split(" ");
  if (parts.length < 2) return;
  const idx = monthNames.indexOf(parts[0]);
  if (idx < 0) return;
  const val = parts[1] + "-" + String(idx + 1).padStart(2, "0");
  monthInput.value = val;
  setTimeout(function () { monthInput.value = val; }, 0);
}

function handleDestinationChange() {
  const dest = document.getElementById("destination");
  const field = document.getElementById("airwayBillField");
  if (!dest || !field) return;
  field.style.display = dest.value.toLowerCase().includes("klia cargo") ? "block" : "none";
}

function handleAddTrip() {
  const input = document.getElementById("newTrip");
  if (!input) return;
  const name = input.value.trim();
  if (!name) { showToast("Masukkan nama destinasi"); return; }
  if (trips.includes(name)) { showToast("Destinasi sudah wujud"); return; }
  trips.push(name);
  saveToLocalStorage();
  loadTrips();
  input.value = "";
  showToast("Destinasi ditambah");
}

function findAwbDuplicate(awb) {
  if (!awb) return null;
  const needle = String(awb).trim().toLowerCase();
  for (const d of Object.keys(dailyRecords || {})) {
    const tripsArr = (dailyRecords[d] && dailyRecords[d].trips) || [];
    for (const t of tripsArr) {
      const m = String(t).match(/\(([^)]+)\)/);
      if (m && m[1].trim().toLowerCase() === needle) return { date: d, trip: t };
    }
  }
  return null;
}

function handleClockFormSubmit(e) {
  e.preventDefault();
  const date = document.getElementById("date").value;
  const clockIn = document.getElementById("clockIn").value;
  const clockOut = document.getElementById("clockOut").value;
  if (!date || !clockIn || !clockOut) { showToast("Sila isi semua medan."); return; }
  if (dailyRecords[date] && (dailyRecords[date].clock_in || dailyRecords[date].clock_out)) {
    if (!confirm("Rekod untuk " + date + " sudah wujud. Tulis ganti?")) return;
  }
  if (!dailyRecords[date]) dailyRecords[date] = { clock_in: clockIn, clock_out: clockOut, trips: [] };
  else { dailyRecords[date].clock_in = clockIn; dailyRecords[date].clock_out = clockOut; }
  const upl = document.getElementById("unpaidLeaveCheck");
  dailyRecords[date].unpaid = !!(upl && upl.checked);
  saveToLocalStorage();
  updateReport();
  try {
    document.querySelectorAll("#reportTable tbody tr").forEach(function (r) {
      var cell = r.querySelector("td.tarikh");
      if (!cell) return;
      var txt = cell.textContent || "";
      var rev = date.split("-").reverse().join("/");
      if (txt.indexOf(date) >= 0 || txt.indexOf(rev) >= 0) {
        r.classList.add("flash-save");
        setTimeout(function () { r.classList.remove("flash-save"); }, 1500);
      }
    });
  } catch (e) {}
  showToast(dailyRecords[date].unpaid ? "Kehadiran UPL disimpan (OT = 0)" : "Kehadiran berjaya disimpan!");
}

function handleTripFormSubmit(e) {
  e.preventDefault();
  const date = document.getElementById("date").value;
  const destination = document.getElementById("destination").value;
  const awbInput = document.getElementById("airwayBill");
  const awb = awbInput ? awbInput.value.trim() : "";
  if (!date) { showToast("Sila pilih tarikh dahulu."); return; }
  if (!destination) { showToast("Sila pilih destinasi."); return; }
  if (destination.toLowerCase().includes("klia cargo") && awb) {
    const dup = findAwbDuplicate(awb);
    if (dup && !confirm('AWB "' + awb + '" sudah wujud pada ' + dup.date + ".\nTambah juga?")) return;
  }
  if (!dailyRecords[date]) dailyRecords[date] = { clock_in: "", clock_out: "", trips: [] };
  if (!Array.isArray(dailyRecords[date].trips)) dailyRecords[date].trips = [];
  let tripName = destination;
  if (destination.toLowerCase().includes("klia cargo") && awb) tripName = "KLIA Cargo (" + awb + ")";
  dailyRecords[date].trips.push(tripName);
  const upl = document.getElementById("unpaidLeaveCheck");
  if (upl && upl.checked) dailyRecords[date].unpaid = true;
  saveToLocalStorage();
  updateReport();
  document.getElementById("destination").value = "";
  if (awbInput) awbInput.value = "";
  const af = document.getElementById("airwayBillField");
  if (af) af.style.display = "none";
  showToast("Trip berjaya ditambah!");
}

function deleteRecord(date) {
  const rec = dailyRecords[date];
  const n = rec && Array.isArray(rec.trips) ? rec.trips.length : 0;
  if (!confirm("Padam rekod " + date + "?\nTrip: " + n + " · In: " + ((rec && rec.clock_in) || "-") + " · Out: " + ((rec && rec.clock_out) || "-"))) return;
  delete dailyRecords[date];
  saveToLocalStorage();
  updateReport();
  showToast("Rekod dipadam");
}

function deleteTrip(date, tripIndex) {
  const rec = dailyRecords[date];
  if (!rec || !Array.isArray(rec.trips) || !rec.trips[tripIndex]) return;
  const name = String(rec.trips[tripIndex]);
  if (!confirm("Padam trip pada " + date + "?\n\"" + name + "\"\nBaki trip hari ini: " + (rec.trips.length - 1))) return;
  rec.trips.splice(tripIndex, 1);
  saveToLocalStorage();
  updateReport();
  showToast("Trip dipadam");
}

function editRecord(date) {
  const rec = dailyRecords[date];
  if (!rec) return;
  const dateInput = document.getElementById("date");
  const clockIn = document.getElementById("clockIn");
  const clockOut = document.getElementById("clockOut");
  const uplEl = document.getElementById("unpaidLeaveCheck");
  if (dateInput) dateInput.value = date;
  if (clockIn) clockIn.value = rec.clock_in || "08:00";
  if (clockOut) clockOut.value = rec.clock_out || "17:00";
  if (uplEl) uplEl.checked = !!rec.unpaid;
  updateHolidayBadge();
  showToast("Rekod dimuat ke form — simpan untuk kemaskini");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateSummary(totalOT) {
  const dates = Object.keys(dailyRecords).sort();
  let workDays = 0, kliaDays = 0, totalAwb = 0, totalTrips = 0, kliaTrips = 0;
  dates.forEach((date) => {
    const rec = dailyRecords[date];
    if (!rec) return;
    if (rec.clock_in || rec.clock_out || (rec.trips && rec.trips.length)) workDays++;
    const tripsArr = rec.trips || [];
    totalTrips += tripsArr.length;
    let hasKlia = false;
    tripsArr.forEach((t) => {
      if (String(t).toLowerCase().includes("klia cargo")) {
        hasKlia = true; kliaTrips++;
        if (/\(.+?\)/.test(t)) totalAwb++;
      }
    });
    if (hasKlia) kliaDays++;
  });
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("sumDays", workDays); set("sumKlia", kliaDays); set("sumAwb", totalAwb); set("sumTrips", totalTrips);
  set("printTotalOT", totalOT.toFixed(2)); set("printTotalTrips", totalTrips);
  set("printKliaDays", kliaDays); set("printKliaTrips", kliaTrips); set("printAwb", totalAwb);
}

function updateReport() {
  const tbody = document.querySelector("#reportTable tbody");
  const totalOTEl = document.getElementById("totalOT");
  const noMsg = document.getElementById("noRecordsMessage");
  if (!tbody) return;
  tbody.innerHTML = "";
  const dates = Object.keys(dailyRecords).sort();
  let totalOT = 0;
  if (dates.length === 0) {
    if (noMsg) noMsg.style.display = "block";
    if (totalOTEl) totalOTEl.textContent = "0.00";
    updateSummary(0);
    return;
  }
  if (noMsg) noMsg.style.display = "none";
  const dayNamesMs = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  dates.forEach((date) => {
    const rec = dailyRecords[date];
    if (!rec) return;
    let ot = calculateOT(rec.clock_in, rec.clock_out, date, rec.trips || []);
    if (rec.unpaid) ot = 0;
    totalOT += ot;
    const day = new Date(date + "T00:00:00").getDay();
    const holiday = isPublicHoliday(date);
    const tr = document.createElement("tr");
    if (day === 0) tr.classList.add("sunday");
    else if (day === 6) tr.classList.add("saturday");
    if (holiday) tr.classList.add("holiday");
    if (rec.unpaid) tr.classList.add("upl-row");
    const tdDate = document.createElement("td");
    tdDate.className = "tarikh";
    tdDate.textContent = formatDateForPDF(date);
    const tdDay = document.createElement("td");
    tdDay.className = "hari";
    let dayLabel = holiday ? dayNamesMs[day] + " (Cuti)" : dayNamesMs[day];
    tdDay.textContent = dayLabel;
    if (holiday) tdDay.title = getHolidayName(date);
    if (rec.unpaid) {
      const badge = document.createElement("span");
      badge.className = "upl-badge no-print";
      badge.textContent = "UPL";
      badge.title = "Cuti tanpa gaji";
      tdDay.appendChild(document.createTextNode(" "));
      tdDay.appendChild(badge);
    }
    const tdTrips = document.createElement("td");
    const tripList = rec.trips || [];
    if (tripList.length === 0) tdTrips.textContent = "—";
    else {
      tripList.forEach((trip, i) => {
        const row = document.createElement("div");
        row.className = "trip-item";
        const text = document.createElement("span");
        text.className = "trip-text";
        text.textContent = String(trip);
        text.title = "Klik untuk edit";
        text.style.cursor = "pointer";
        text.addEventListener("click", () => editTrip(date, i));
        const del = document.createElement("button");
        del.type = "button";
        del.className = "trip-del-btn no-print";
        del.title = "Padam trip";
        del.textContent = "×";
        del.addEventListener("click", () => deleteTrip(date, i));
        row.appendChild(text);
        row.appendChild(del);
        tdTrips.appendChild(row);
      });
    }
    const tdIn = document.createElement("td"); tdIn.textContent = formatTime(rec.clock_in);
    const tdOut = document.createElement("td"); tdOut.textContent = formatTime(rec.clock_out);
    const tdOT = document.createElement("td");
    const strong = document.createElement("strong"); strong.textContent = ot.toFixed(2); tdOT.appendChild(strong);
    const tdSig1 = document.createElement("td"); tdSig1.className = "print-only";
    const tdSig2 = document.createElement("td"); tdSig2.className = "print-only";
    const tdActions = document.createElement("td"); tdActions.className = "no-print";
    const tEdit = (window.RezaOT_i18n && RezaOT_i18n.t("btnEdit")) || "Edit";
    const tDel = (window.RezaOT_i18n && RezaOT_i18n.t("btnDelete")) || "Padam";
    const editBtn = document.createElement("button"); editBtn.className = "edit-btn"; editBtn.textContent = tEdit;
    editBtn.addEventListener("click", () => editRecord(date));
    const delBtn = document.createElement("button"); delBtn.className = "delete-btn"; delBtn.textContent = tDel;
    delBtn.addEventListener("click", () => deleteRecord(date));
    tdActions.appendChild(editBtn); tdActions.appendChild(delBtn);
    [tdDate, tdDay, tdTrips, tdIn, tdOut, tdOT, tdSig1, tdSig2, tdActions].forEach((td) => tr.appendChild(td));
    tbody.appendChild(tr);
  });
  if (totalOTEl) totalOTEl.textContent = totalOT.toFixed(2);
  updateSummary(totalOT);
}

function exportToExcel() {
  const data = [["Tarikh", "Hari", "Destinasi", "AWB", "Clock-In", "Clock-Out", "OT (Jam)", "T/T Pekerja", "T/T Ketua"]];
  const dayNamesMs = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  let totalOT = 0, kliaCargoDays = 0, totalAWB = 0;
  Object.keys(dailyRecords).sort().forEach((date) => {
    const rec = dailyRecords[date];
    const day = new Date(date + "T00:00:00").getDay();
    const dayName = dayNamesMs[day]
      + (isPublicHoliday(date) ? " (Cuti)" : "")
      + (rec.unpaid ? " (UPL)" : "");
    let ot = calculateOT(rec.clock_in, rec.clock_out, date, rec.trips || []);
    if (rec.unpaid) ot = 0;
    totalOT += ot;
    let hasKlia = false;
    (rec.trips || []).forEach((t) => { if (String(t).toLowerCase().includes("klia cargo")) hasKlia = true; });
    if (hasKlia) kliaCargoDays++;
    if (rec.trips && rec.trips.length > 0) {
      rec.trips.forEach((trip, index) => {
        let dest = trip, awb = "-";
        if (String(trip).toLowerCase().includes("klia cargo")) {
          const match = String(trip).match(/\((.+?)\)/);
          if (match) { awb = match[1]; totalAWB++; }
        }
        data.push([formatDateForPDF(date), dayName, dest, awb, rec.clock_in || "-", rec.clock_out || "-", index === 0 ? ot.toFixed(2) : "", "", ""]);
      });
    } else {
      data.push([formatDateForPDF(date), dayName, "—", "-", rec.clock_in || "-", rec.clock_out || "-", ot.toFixed(2), "", ""]);
    }
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.sheet_add_aoa(ws, [["Ringkasan Bulan", ""], ["Total OT", totalOT.toFixed(2) + " jam"], ["Hari KLIA", kliaCargoDays], ["Total AWB", totalAWB]], { origin: data.length + 2 });
  XLSX.utils.book_append_sheet(wb, ws, "Laporan OT Bulanan");
  XLSX.writeFile(wb, `RezaOT_${currentMonthKey.replace(/\s+/g, "_")}.xlsx`);
  showToast("Excel dieksport");
}

function exportData() {
  const payload = { month: currentMonthKey, dailyRecords, trips, otSettings: getOtSettings(), exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `RezaOT_backup_${currentMonthKey.replace(/\s+/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Backup dieksport");
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const data = JSON.parse(event.target.result);
      if (data.dailyRecords) dailyRecords = data.dailyRecords;
      if (data.trips) trips = data.trips;
      if (data.otSettings) saveOtSettings(data.otSettings);
      saveToLocalStorage();
      updateReport();
      loadTrips();
      showToast("Data berjaya diimport!");
    } catch (err) {
      showToast("Fail JSON tidak sah.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function rezaotInitApp() {
  if (window.__rezaotInited) return;
  window.__rezaotInited = true;
  initDarkMode();
  const now = new Date();
  currentMonthKey = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const monthInput = document.getElementById("monthYear");
  if (monthInput) monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthEl = document.getElementById("currentMonth");
  if (currentMonthEl) currentMonthEl.textContent = currentMonthKey;
  const dateInput = document.getElementById("date");
  if (dateInput) {
    dateInput.value = (typeof getLocalDateString === "function")
      ? getLocalDateString(now)
      : (now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0"));
  }
  const clockInInput = document.getElementById("clockIn");
  if (clockInInput && !clockInInput.value) clockInInput.value = "08:00";
  const clockOutInput = document.getElementById("clockOut");
  if (clockOutInput && !clockOutInput.value) clockOutInput.value = "17:00";
  const supervisorEl = document.getElementById("supervisorName");
  if (supervisorEl) supervisorEl.textContent = localStorage.getItem("supervisorName") || "Talib";
  loadFromLocalStorage();
  if (typeof lastLocalSaveAt !== "undefined") lastLocalSaveAt = 0;
  updateReport();
  loadTrips();
  setupEventListeners();
  updateHolidayBadge();
  startFirebaseListener();
  if (!navigator.onLine) setSyncStatus("offline");
}

document.addEventListener("rezaot-ready", rezaotInitApp);
