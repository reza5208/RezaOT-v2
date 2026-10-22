function appText(key, fallback) {
  if (window.RezaOT_i18n) { const text = RezaOT_i18n.t(key); if (text !== key) return text; }
  return fallback;
}
function appConfirm(message) { return typeof rezaotConfirm === "function" ? rezaotConfirm(message) : Promise.resolve(confirm(message)); }
function appPrompt(message, value) { return typeof rezaotPrompt === "function" ? rezaotPrompt(message, value) : Promise.resolve(prompt(message, value)); }
function toggleManageSection() {
  const section = document.getElementById("manageDestinations");
  if (section) section.style.display = section.style.display === "none" ? "block" : "none";
}
function updateDateBounds() {
  const date = document.getElementById("date");
  const month = RezaOT_model.monthValue(currentMonthKey);
  if (!date || !month) return;
  date.min = month + "-01";
  const [year, number] = month.split("-").map(Number);
  date.max = month + "-" + new Date(year, number, 0).getDate();
  if (!date.value || date.value.slice(0, 7) !== month) {
    const today = getLocalDateString(new Date());
    date.value = today.slice(0, 7) === month ? today : date.min;
  }
}
function syncLeaveInputs(changed) {
  const unpaid = document.getElementById("unpaidLeaveCheck");
  const annual = document.getElementById("annualLeaveCheck");
  if (changed === unpaid && unpaid.checked && annual) annual.checked = false;
  if (changed === annual && annual.checked && unpaid) unpaid.checked = false;
  const leave = !!(unpaid && unpaid.checked) || !!(annual && annual.checked);
  for (const id of ["clockIn", "clockOut"]) { const input = document.getElementById(id); if (input) input.required = !leave; }
}
function validActiveDate(date) {
  if (!RezaOT_model.validDate(date)) { showToast(appText("invalidDate", "Sila pilih tarikh yang sah.")); return false; }
  if (RezaOT_model.monthFromDate(date) !== currentMonthKey) {
    showToast(appText("wrongMonthDate", "Tarikh mesti dalam bulan laporan yang dipilih.")); return false;
  }
  return true;
}
function contextFor(date) { return { month: currentMonthKey, snapshot: JSON.stringify(dailyRecords[date] || null) }; }
function contextUnchanged(context, date) {
  if (context.month === currentMonthKey && context.snapshot === JSON.stringify(dailyRecords[date] || null)) return true;
  showToast(appText("recordChanged", "Bulan atau rekod telah berubah. Sila cuba semula.")); return false;
}
async function withFormLock(id, action) {
  const form = document.getElementById(id);
  if (form && form.__saving) return false;
  if (form) form.__saving = true;
  const submit = form && form.querySelector('[type="submit"]');
  if (submit) submit.disabled = true;
  try { return await action(); }
  catch (error) { console.error(error); showToast(error.message || appText("saveFailed", "Gagal menyimpan rekod.")); return false; }
  finally { if (form) form.__saving = false; if (submit) submit.disabled = false; }
}
function selectMonth(key) {
  RezaOT_model.validateMonthKey(key);
  stopFirebaseListener();
  currentMonthKey = key;
  const input = document.getElementById("monthYear");
  if (input) input.value = RezaOT_model.monthValue(key);
  const label = document.getElementById("currentMonth");
  if (label) label.textContent = key;
  loadFromLocalStorage();
  updateDateBounds();
  syncLeaveInputs();
  updateReport();
  loadTrips();
  updateHolidayBadge();
  startFirebaseListener();
  document.dispatchEvent(new Event("rezaot-month"));
}
async function handleMonthChange() {
  const input = document.getElementById("monthYear");
  if (!input || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(input.value)) return;
  const intended = input.value;
  const [year, month] = intended.split("-");
  const key = monthNames[Number(month) - 1] + " " + year;
  if (key === currentMonthKey) return;
  const old = currentMonthKey;
  if (!(await appConfirm(appText("switchMonth", "Tukar bulan ke") + " " + key + "?"))) { restoreMonthInput(input, currentMonthKey); return false; }
  if (currentMonthKey !== old || input.value !== intended) { restoreMonthInput(input, currentMonthKey); return false; }
  selectMonth(key);
  showToast(appText("monthLabel", "Bulan:") + " " + key);
  return true;
}
function restoreMonthInput(input, key) { if (input) input.value = RezaOT_model.monthValue(key); }
function handleDestinationChange() {
  const destination = document.getElementById("destination");
  const field = document.getElementById("airwayBillField");
  if (destination && field) field.style.display = destination.value.toLowerCase().includes("klia cargo") ? "block" : "none";
}
function handleAddTrip() {
  const input = document.getElementById("newTrip");
  if (!input) return;
  const name = input.value.trim();
  if (!name || name.length > 500) { showToast(appText("invalidDestination", "Masukkan nama destinasi yang sah.")); return false; }
  if (trips.some((trip) => trip.toLowerCase() === name.toLowerCase())) { showToast(appText("destinationExists", "Destinasi sudah wujud")); return false; }
  trips.push(name);
  if (window.RezaOT_sync) RezaOT_sync.tripsChanged();
  else saveToLocalStorage();
  loadTrips(); input.value = "";
  showToast(appText("destinationAdded", "Destinasi ditambah"));
  return true;
}
function findAwbDuplicate(awb) {
  const needle = RezaOT_model.normalizeAwb(awb);
  if (!needle) return null;
  for (const date of Object.keys(dailyRecords)) {
    for (const trip of dailyRecords[date].trips || []) if (RezaOT_model.normalizeAwb(RezaOT_model.extractAwb(trip)) === needle) return { date, trip };
  }
  return null;
}
async function handleClockFormSubmit(event) {
  if (event) event.preventDefault();
  return withFormLock("clockForm", async function () {
    const date = document.getElementById("date").value;
    if (!validActiveDate(date)) return false;
    const clockIn = document.getElementById("clockIn").value;
    const clockOut = document.getElementById("clockOut").value;
    const unpaid = !!document.getElementById("unpaidLeaveCheck").checked;
    const annual = !!document.getElementById("annualLeaveCheck").checked;
    if (unpaid && annual) { showToast(appText("oneLeaveType", "Pilih satu jenis cuti sahaja.")); return false; }
    if ((!unpaid && !annual && (!clockIn || !clockOut)) || (clockIn && !RezaOT_model.validTime(clockIn)) || (clockOut && !RezaOT_model.validTime(clockOut))) {
      showToast(appText("invalidAttendance", "Sila isi waktu kerja yang sah.")); return false;
    }
    const context = contextFor(date);
    if (dailyRecords[date] && !(await appConfirm(appText("overwriteRecord", "Rekod sudah wujud. Tulis ganti?") + "\n" + date))) return false;
    if (!contextUnchanged(context, date)) return false;
    const record = RezaOT_model.normalizeRecord(dailyRecords[date] || { trips: [] }, date);
    record.clock_in = clockIn; record.clock_out = clockOut;
    record.unpaid = unpaid; record.annual = annual;
    dailyRecords[date] = record;
    saveToLocalStorage(); updateReport(); syncLeaveInputs();
    showToast(annual ? appText("annualSaved", "ANN disimpan (OT = 0)") : unpaid ? appText("unpaidSaved", "UPL disimpan (OT = 0)") : appText("attendanceSaved", "Kehadiran berjaya disimpan!"));
    return true;
  });
}
async function handleTripFormSubmit(event) {
  if (event) event.preventDefault();
  return withFormLock("tripForm", async function () {
    const date = document.getElementById("date").value;
    const destinationInput = document.getElementById("destination");
    const destination = destinationInput.value.trim();
    const awbInput = document.getElementById("airwayBill");
    const awb = awbInput ? awbInput.value.trim() : "";
    const radio = document.querySelector('input[name="sideJob"]:checked');
    const sideJob = radio && ["susun", "pallets"].includes(radio.value) ? radio.value : "";
    if (!validActiveDate(date)) return false;
    if (!destination || destination.length > 500) { showToast(appText("pickDestination", "Sila pilih destinasi.")); return false; }
    const klia = destination.toLowerCase().includes("klia cargo");
    if (klia && (awb.length > 200 || /[()\r\n]/.test(awb) || (sideJob && !awb))) { showToast(appText("invalidAwb", "Masukkan AWB yang sah untuk side job.")); return false; }
    const context = contextFor(date);
    const duplicate = klia && awb ? findAwbDuplicate(awb) : null;
    if (duplicate && !(await appConfirm('AWB "' + awb + '" ' + appText("duplicateAwb", "sudah wujud pada") + " " + duplicate.date + ".\n" + appText("addAnyway", "Tambah juga?")))) return false;
    if (!contextUnchanged(context, date)) return false;
    const record = RezaOT_model.normalizeRecord(dailyRecords[date] || { trips: [] }, date);
    const label = klia && awb ? "KLIA Cargo (" + awb + ")" : destination;
    const effectiveSide = klia && awb ? sideJob : "";
    if (effectiveSide) for (const detail of record.tripDetails) if (RezaOT_model.normalizeAwb(detail.awb) === RezaOT_model.normalizeAwb(awb)) detail.sideJob = effectiveSide;
    record.tripDetails.push({ id: RezaOT_model.newId(), label, awb: klia ? awb : "", sideJob: effectiveSide });
    RezaOT_model.syncSideJobs(record);
    dailyRecords[date] = record;
    saveToLocalStorage(); updateReport();
    destinationInput.value = "";
    if (awbInput) awbInput.value = "";
    document.querySelectorAll('input[name="sideJob"]').forEach((input) => { input.checked = input.value === ""; });
    handleDestinationChange();
    showToast(appText("tripAdded", "Trip berjaya ditambah!"));
    return true;
  });
}
async function deleteRecord(date) {
  const record = dailyRecords[date];
  if (!record) return false;
  const context = contextFor(date);
  if (!(await appConfirm(appText("confirmDelRec", "Padam rekod ini?") + "\n" + date + "\nTrip: " + (record.trips || []).length))) return false;
  if (!contextUnchanged(context, date)) return false;
  delete dailyRecords[date]; saveToLocalStorage(); updateReport();
  showToast(appText("toastRecDel", "Rekod dipadam")); return true;
}
async function deleteTrip(date, tripIndex) {
  if (!dailyRecords[date]) return false;
  const record = RezaOT_model.normalizeRecord(dailyRecords[date], date);
  const detail = record.tripDetails[tripIndex];
  if (!detail) return false;
  const context = contextFor(date);
  if (!(await appConfirm(appText("confirmDelTrip", "Padam trip ini?") + "\n" + date + "\n" + record.trips[tripIndex]))) return false;
  if (!contextUnchanged(context, date)) return false;
  record.tripDetails.splice(tripIndex, 1); RezaOT_model.syncSideJobs(record);
  dailyRecords[date] = record; saveToLocalStorage(); updateReport();
  showToast(appText("toastTripDel", "Trip dipadam")); return true;
}
async function editTrip(date, tripIndex) {
  if (!dailyRecords[date]) return false;
  const record = RezaOT_model.normalizeRecord(dailyRecords[date], date);
  const detail = record.tripDetails[tripIndex];
  if (!detail) return false;
  const context = contextFor(date);
  const next = await appPrompt(appText("editTripPrompt", "Edit trip (tanda * = Susun, # = Pallets):"), record.trips[tripIndex]);
  if (next == null) return false;
  const label = RezaOT_model.cleanTripLabel(next);
  if (!label || label.length > 1000) { showToast(appText("invalidDestination", "Masukkan nama destinasi yang sah.")); return false; }
  if (!contextUnchanged(context, date)) return false;
  const awb = RezaOT_model.extractAwb(label);
  const type = awb ? RezaOT_model.markerType(next) : "";
  detail.label = label; detail.awb = awb; detail.sideJob = type;
  if (type) for (const other of record.tripDetails) if (RezaOT_model.normalizeAwb(other.awb) === RezaOT_model.normalizeAwb(awb)) other.sideJob = type;
  RezaOT_model.syncSideJobs(record); dailyRecords[date] = record;
  saveToLocalStorage(); updateReport(); showToast(appText("tripUpdated", "Trip dikemaskini")); return true;
}
function editRecord(date) {
  const record = dailyRecords[date]; if (!record) return;
  document.getElementById("date").value = date;
  document.getElementById("clockIn").value = record.clock_in || "";
  document.getElementById("clockOut").value = record.clock_out || "";
  document.getElementById("unpaidLeaveCheck").checked = !!record.unpaid;
  document.getElementById("annualLeaveCheck").checked = !!record.annual;
  syncLeaveInputs(); updateHolidayBadge();
  showToast(appText("recordLoaded", "Rekod dimuat ke borang — simpan untuk kemaskini"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateSummary(totalOT) {
  const dates = Object.keys(dailyRecords).sort();
  let workDays = 0, kliaDays = 0, totalAwb = 0, totalTrips = 0, kliaTrips = 0;
  dates.forEach((date) => {
    const rec = dailyRecords[date];
    if (!rec) return;
    if (!rec.unpaid && !rec.annual && (rec.clock_in || rec.clock_out || (rec.trips && rec.trips.length))) workDays++;
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
    document.dispatchEvent(new Event("rezaot-report"));
    return;
  }
  if (noMsg) noMsg.style.display = "none";
  const dayNamesMs = (window.RezaOT_i18n && RezaOT_i18n.t("days")) || ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  dates.forEach((date) => {
    const rec = dailyRecords[date];
    if (!rec) return;
    const ot = typeof RezaOT_recordOT === "function" ? RezaOT_recordOT(date, rec) : (rec.unpaid || rec.annual ? 0 : calculateOT(rec.clock_in, rec.clock_out, date, rec.trips || []));
    totalOT += ot;
    const day = new Date(date + "T00:00:00").getDay();
    const holiday = isPublicHoliday(date);
    const tr = document.createElement("tr");
    if (day === 0) tr.classList.add("sunday");
    else if (day === 6) tr.classList.add("saturday");
    if (holiday) tr.classList.add("holiday");
    if (rec.unpaid) tr.classList.add("upl-row");
    if (rec.annual) tr.classList.add("annual-row");
    const tdDate = document.createElement("td");
    tdDate.className = "tarikh";
    tdDate.textContent = formatDateForPDF(date);
    const tdDay = document.createElement("td");
    tdDay.className = "hari";
    let dayLabel = holiday ? dayNamesMs[day] + appText("holidaySuffix", " (Cuti)") : dayNamesMs[day];
    tdDay.textContent = dayLabel;
    if (holiday) tdDay.title = getHolidayName(date);
    if (rec.unpaid || rec.annual) {
      const badge = document.createElement("span");
      badge.className = "upl-badge no-print";
      badge.textContent = rec.annual ? "ANN" : "UPL";
      badge.title = rec.annual ? appText("annualLeave", "Cuti tahunan") : appText("unpaidLeave", "Cuti tanpa gaji");
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
        text.textContent = RezaOT_model.formatTrip(rec, i);
        text.title = appText("editTripHint", "Klik untuk edit trip");
        text.tabIndex = 0;
        text.setAttribute("role", "button");
        text.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); editTrip(date, i); } });
        text.style.cursor = "pointer";
        text.addEventListener("click", () => editTrip(date, i));
        const del = document.createElement("button");
        del.type = "button";
        del.className = "trip-del-btn no-print";
        del.title = appText("deleteTrip", "Padam trip");
        del.setAttribute("aria-label", del.title + ": " + RezaOT_model.formatTrip(rec, i));
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
  document.dispatchEvent(new Event("rezaot-report"));
}

function buildExcelData() {
  const dayNamesMs = (window.RezaOT_i18n && RezaOT_i18n.t("days")) || ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  const empName = "Khairul Reza";
  const empNo = "M-264";
  const dept = "WH3 Transport";
  const supervisor = (document.getElementById("supervisorName") && document.getElementById("supervisorName").textContent.trim()) || "Talib";

  const data = [];
  data.push([appText("excelTitle", "RezaOT — Laporan Trips & OT")]);
  data.push([appText("monthLabel", "Bulan:"), currentMonthKey || ""]);
  data.push([appText("nameLabel", "Nama:"), empName, appText("empNoLabel", "No. pekerja:"), empNo]);
  data.push([appText("deptLabel", "Jabatan:"), dept, appText("supervisorLabel", "Nama Ketua:"), supervisor]);
  data.push([]);
  data.push([appText("thDate", "Tarikh"), appText("thDay", "Hari"), appText("thDest", "Destinasi"), "AWB", "Trip", "Clock-In", "Clock-Out", appText("thOT", "OT (Jam)"), appText("thSig1", "T/T pekerja"), appText("thSig2", "T/T ketua")]);

  let totalOT = 0, workDays = 0, kliaCargoDays = 0, totalAWB = 0, totalTrips = 0;

  Object.keys(dailyRecords).sort().forEach((date) => {
    const rec = dailyRecords[date];
    if (!rec) return;
    const day = new Date(date + "T00:00:00").getDay();
    let dayName = dayNamesMs[day];
    if (typeof isPublicHoliday === "function" && isPublicHoliday(date)) dayName += appText("holidaySuffix", " (Cuti)");
    if (rec.unpaid) dayName += " (UPL)";
    if (rec.annual) dayName += " (ANN)";

    const ot = typeof RezaOT_recordOT === "function" ? RezaOT_recordOT(date, rec) : (rec.unpaid || rec.annual ? 0 : calculateOT(rec.clock_in, rec.clock_out, date, rec.trips || []));
    totalOT += ot;

    const tripsArr = Array.isArray(rec.trips) ? rec.trips : [];
    totalTrips += tripsArr.length;
    if (!rec.unpaid && !rec.annual && (rec.clock_in || rec.clock_out || tripsArr.length)) workDays++;

    const destNames = [];
    const awbs = [];
    let hasKlia = false;
    tripsArr.forEach((t, index) => {
      const s = RezaOT_model.formatTrip(rec, index);
      if (s.toLowerCase().indexOf("klia cargo") >= 0) {
        hasKlia = true;
        const m = s.match(/\((.+?)\)/);
        if (m) {
          awbs.push(m[1].trim());
          totalAWB++;
          const type = RezaOT_model.markerType(s);
          destNames.push("KLIA Cargo" + (type === "susun" ? " *" : type === "pallets" ? " #" : ""));
        } else {
          destNames.push(s);
        }
      } else {
        destNames.push(s);
      }
    });
    if (hasKlia) kliaCargoDays++;

    data.push([
      formatDateForPDF(date),
      dayName,
      destNames.length ? destNames.join(" · ") : "—",
      awbs.length ? awbs.join(", ") : "—",
      tripsArr.length,
      rec.clock_in || "—",
      rec.clock_out || "—",
      ot,
      "",
      ""
    ]);
  });

  data.push([]);
  data.push([appText("summary", "Ringkasan")]);
  data.push([appText("sumDays", "Hari Berkerja"), workDays]);
  data.push([appText("sumTrips", "Total Trip"), totalTrips]);
  data.push([appText("sumKlia", "Hari KLIA Cargo"), kliaCargoDays]);
  data.push([appText("sumAwb", "Total AWB"), totalAWB]);
  data.push([appText("thOT", "OT (Jam)"), totalOT]);

  return data;
}

async function exportToExcel() {
  if (window.__excelBusy) return false;
  window.__excelBusy = true;
  try {
    await window.loadExcelLib();
    const data = buildExcelData();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  const colCount = Math.max.apply(null, data.map(function (row) { return row.length; }));
  const cols = [];
  for (var c = 0; c < colCount; c++) {
    var maxLen = 8;
    for (var r = 0; r < data.length; r++) {
      var cell = data[r][c];
      if (cell == null || cell === "") continue;
      var len = String(cell).length;
      if (len > maxLen) maxLen = len;
    }
    var wch = Math.min(48, Math.max(6, maxLen + 2));
    cols.push({ wch: wch });
  }
  ws["!cols"] = cols;

  XLSX.utils.book_append_sheet(wb, ws, appText("excelSheet", "Laporan OT"));
  XLSX.writeFile(wb, "RezaOT_" + String(currentMonthKey || "report").replace(/\s+/g, "_") + ".xlsx");
  showToast(appText("excelExported", "Excel dieksport"));
  return true;
  } catch (error) { console.error(error); showToast(appText("excelFailed", "Gagal eksport Excel. Sila cuba lagi.")); return false; }
  finally { window.__excelBusy = false; }
}

function exportData() {
  try {
    const payload = RezaOT_backup.create();
    downloadBackup(payload, "RezaOT_backup_all_" + getLocalDateString(new Date()) + ".json");
    showToast(appText("backupExported", "Backup semua bulan dieksport"));
    return true;
  } catch (error) { console.error(error); showToast(error.message); return false; }
}
function downloadBackup(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importData(event) {
  const input = event.target;
  const file = input.files[0];
  input.value = "";
  if (!file || input.__importing) return false;
  input.__importing = true;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error(appText("backupTooLarge", "Fail backup melebihi 20 MB."));
    const raw = await file.text();
    const data = RezaOT_backup.parse(raw);
    const preview = RezaOT_backup.preview(data);
    const settingsCount = Object.keys(data.settings).length;
    const message = appText("importPreview", "Pratonton import") + "\n" + preview + "\n" + settingsCount + " " + appText("settingsCount", "tetapan") + "\n\n" + appText("importConflictHint", "Gabung mengekalkan tarikh lain; tarikh yang sama menggunakan rekod fail. Ganti menggantikan rekod dalam bulan yang disenaraikan sahaja. Salinan pemulihan akan disimpan sebelum import.");
    const mode = typeof rezaotChoose === "function" ? await rezaotChoose(message, [
      { value: "merge", label: appText("importMerge", "Gabung") },
      { value: "replace", label: appText("importReplace", "Ganti bulan disenaraikan") }
    ]) : ((await appConfirm(message + "\n" + appText("importReplaceConfirm", "Ganti bulan yang disenaraikan?"))) ? "replace" : null);
    if (!mode) return false;
    const result = RezaOT_backup.apply(data, mode);
    // Legacy single-month backups restore into their source month, never the unrelated active month.
    if (result.months.length === 1 && result.months[0] !== currentMonthKey) selectMonth(result.months[0]);
    else { loadFromLocalStorage(); updateDateBounds(); loadTrips(); updateReport(); }
    if (window.RezaOT_i18n) RezaOT_i18n.apply();
    initDarkMode(); updateHolidayBadge();
    const supervisor = document.getElementById("supervisorName");
    if (supervisor) supervisor.textContent = localStorage.getItem("supervisorName") || "Talib";
    showToast(appText("importSucceeded", "Import berjaya. Salinan pemulihan disimpan."));
    return true;
  } catch (error) { console.error(error); showToast(error.message || appText("invalidBackup", "Fail backup tidak sah.")); return false; }
  finally { input.__importing = false; }
}

function rezaotInitApp() {
  if (window.__rezaotInited) return;
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
  updateDateBounds();
  syncLeaveInputs();
  updateReport();
  loadTrips();
  setupEventListeners();
  for (const id of ["unpaidLeaveCheck", "annualLeaveCheck"]) {
    const input = document.getElementById(id);
    if (input) input.addEventListener("change", () => syncLeaveInputs(input));
  }
  updateHolidayBadge();
  window.__rezaotInited = true;
  startFirebaseListener();
  if (!navigator.onLine) setSyncStatus("offline");
}

// main.js calls rezaotInitApp once after required modules load, before publishing readiness.
