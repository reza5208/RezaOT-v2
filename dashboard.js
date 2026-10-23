// v71 workspace navigation and presentation. Record/payroll state stays in the core.
(function () {
  "use strict";
  const views = ["today", "records", "salary", "settings"];
  let active = "today", filter = "all", initialized = false;
  const scrollPositions = Object.create(null);
  const $ = id => document.getElementById(id);
  const words = {
    navToday:["Hari ini","Today"],navRecords:["Rekod","Records"],navSalary:["Gaji","Salary"],navSettings:["Tetapan","Settings"],
    personalWorkspace:["RUANG KERJA PERIBADI","YOUR PERSONAL WORKSPACE"],workspaceLabel:["RUANG KERJA","WORKSPACE"],localFirstNote:["Catatan anda, sentiasa bersama.","Your records. Always with you."],skipContent:["Terus ke kandungan","Skip to content"],toggleTheme:["Tukar tema","Switch theme"],
    holidayMenuClean:["Cuti company","Company holidays"],otMenuClean:["Tetapan OT","OT settings"],previousMonth:["Bulan sebelumnya","Previous month"],nextMonth:["Bulan berikutnya","Next month"],recentMonths:["Bulan tersimpan","Saved months"],
    dashboardHeading:["Setiap jam bermakna.","Make every hour count."],dashboardSubtitle:["Kerja tersusun. Perjalanan tercatat.","Your work, in order. Your journeys, recorded."],yourWorkspace:["Ruang anda","Made for your day"],monthlyOvertime:["OVERTIME BULAN INI","OVERTIME THIS MONTH"],hourShort:["jam","hrs"],heroNote:["Setiap usaha anda, diambil kira.","A little effort. All accounted for."],seeRecords:["Lihat rekod","View records"],dailyRecord:["CATATAN HARIAN","YOUR DAILY RECORD"],attendanceTitle:["Masa kerja anda","Your working hours"],recordType:["Jenis rekod","Record type"],workingDay:["Bekerja","Working"],annualShort:["Cuti tahunan","Annual leave"],unpaidShort:["Tanpa gaji","Unpaid leave"],nowClean:["Kini","Now"],saveAttendanceClean:["Simpan kehadiran","Save attendance"],usualDay:["Hari seperti biasa?","A regular day?"],quickPresetHint:["Simpan 08:00–17:00 untuk hari ini.","Save 08:00–17:00 for today."],onTheMove:["DALAM PERJALANAN","ON THE MOVE"],tripTitle:["Ke mana hari ini?","Where to today?"],tripHint:["Tambah destinasi dan AWB untuk tarikh yang dipilih.","Add a destination and AWB for the selected date."],awbClean:["Airway bill","Airway bill"],addTripClean:["Tambah trip","Add trip"],tripFooter:["Catatan kecil. Rekod yang lengkap.","Little details. A complete record."],recentActivity:["Catatan terkini","Recent activity"],seeAll:["Lihat semua","See all"],salaryPreviewLabel:["PERANCANGAN BULAN INI","PLAN YOUR MONTH"],salaryPreviewHeading:["Usaha anda. Dalam angka.","Your effort. In numbers."],salaryPreviewHint:["Semak pecahan gaji, OT dan pendapatan sampingan di satu tempat.","See salary, overtime and side income in one place."],seeSalary:["Lihat anggaran gaji","Explore salary estimate"],yourRecords:["REKOD ANDA","YOUR RECORDS"],recordsHeading:["Perjalanan dalam angka.","Every journey, accounted for."],recordsSubtitle:["Satu bulan. Semua catatan anda.","One month. All your records."],exportClean:["Eksport","Export"],pdfClean:["PDF A4","A4 PDF"],excelClean:["Excel","Excel"],printClean:["Cetak laporan","Print report"],searchRecords:["Cari rekod","Search records"],searchPlaceholder:["Cari destinasi, AWB atau tarikh","Search destination, AWB or date"],filterAll:["Semua","All"],filterLeave:["Cuti","Leave"],noSearchResults:["Tiada rekod yang sepadan.","No matching records."],clearFilters:["Kosongkan carian","Clear search"],salaryKicker:["HASIL USAHA ANDA","YOUR EFFORT, REWARDED"],salaryHeading:["Lebih jelas. Lebih terancang.","A clearer picture. A better plan."],salarySubtitle:["Anggaran untuk membantu anda merancang bulan ini.","An estimate to help you plan the month ahead."],preferencesKicker:["IKUT CARA ANDA","MAKE IT YOURS"],settingsHeading:["Ruang kerja, cara anda.","Your workspace. Your way."],settingsSubtitle:["Urus profil, pilihan dan salinan data anda.","Manage your profile, preferences and backups."],profileTitle:["Profil pekerja","Employee profile"],workPreferences:["Pilihan kerja","Work preferences"],otSettingsHint:["Masa mula OT hari biasa dan Sabtu","Weekday and Saturday OT start times"],holidaySettingsHint:["Pilih cuti yang diambil syarikat","Choose holidays observed by your company"],destinationSettingsHint:["Senarai destinasi yang kerap digunakan","Your frequently used destinations"],pinSettingsHint:["Kunci aplikasi pada peranti ini","Lock the app on this device"],yourData:["Data anda","Your data"],backupHint:["Simpan salinan semua bulan dan tetapan anda.","Keep a copy of every month and your settings."],backupClean:["Muat turun backup","Download backup"],importClean:["Import backup","Import backup"],displayPreferences:["Paparan & bahasa","Appearance & language"],displayHint:["Pilih paparan yang selesa untuk anda.","Choose what feels right for you."],changeLanguage:["Bahasa Melayu / English","English / Bahasa Melayu"],madeForYourDay:["Dibina untuk hari anda.","Made for your day."],noRecent:["Belum ada catatan. Mulakan dengan rekod harian anda.","No records yet. Start with your daily record."],matchingRecords:["rekod dipaparkan","records shown"],allRecordsExport:["Eksport merangkumi semua rekod bulan ini.","Exports include all records in this month."],morningGreeting:["SELAMAT PAGI, REZA","GOOD MORNING, REZA"],afternoonGreeting:["SELAMAT TENGAH HARI, REZA","GOOD AFTERNOON, REZA"],eveningGreeting:["SELAMAT PETANG, REZA","GOOD EVENING, REZA"],savingShort:["Menyimpan…","Saving…"],savedHere:["Catatan disimpan pada peranti ini.","Record saved on this device."],requiredDate:["Pilih tarikh dalam bulan laporan.","Choose a date in the report month."],requiredTimes:["Isi masa masuk dan keluar yang sah.","Enter valid clock-in and clock-out times."],requiredDestination:["Pilih destinasi untuk trip ini.","Choose a destination for this trip."],pinApp:["PIN app","App PIN"],sumDays:["Hari bekerja","Days worked"],sumTrips:["Jumlah trip","Total trips"],sumKlia:["Hari KLIA","KLIA days"],sumAwb:["Jumlah AWB","Total AWB"],noRecords:["Belum ada rekod untuk bulan ini.","No records in this month yet."]
  };
  const packs = { ms: {}, en: {} };
  Object.keys(words).forEach(key => { packs.ms[key] = words[key][0]; packs.en[key] = words[key][1]; });
  RezaOT_i18n.extend(packs);
  const t = key => RezaOT_i18n.t(key);
  const locale = () => RezaOT_i18n.getLang() === "en" ? "en-GB" : "ms-MY";
  function text(id, value) { if ($(id)) $(id).textContent = value; }
  function closePopover(id, buttonId, focus) {
    if ($(id)) $(id).hidden = true;
    if ($(buttonId)) { $(buttonId).setAttribute("aria-expanded", "false"); if (focus) $(buttonId).focus(); }
  }
  function togglePopover(id, buttonId) {
    const open = $(id).hidden;
    closePopover("monthPopover", "monthPickerBtn"); closePopover("reportExportMenu", "exportMenuBtn");
    $(id).hidden = !open; $(buttonId).setAttribute("aria-expanded", String(open));
    if (open) { const first = $(id).querySelector("input,button,select"); if (first) first.focus(); }
  }
  function navigate(name, options) {
    if (!views.includes(name)) name = "today";
    scrollPositions[active] = window.scrollY;
    active = name; document.body.dataset.view = name;
    for (const key of views) { const panel = $("view-" + key); if (panel) panel.hidden = key !== name; }
    document.querySelectorAll(".app-nav-link[data-view]").forEach(button => {
      if (button.dataset.view === name) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    text("activeViewLabel", t("nav" + name[0].toUpperCase() + name.slice(1)));
    closePopover("menuPanel", "menuToggleBtn"); closePopover("monthPopover", "monthPickerBtn"); closePopover("reportExportMenu", "exportMenuBtn");
    if (name === "salary" && $("salaryPanel")) { $("salaryPanel").style.display = "block"; RezaOT_salary.refresh(); }
    if (name === "records") applyFilters();
    history.replaceState(null, "", "#" + name);
    if (!(options && options.keepScroll)) window.scrollTo({ top: scrollPositions[name] || 0, behavior: "instant" });
    if (options && options.focusHeading) {
      const heading = $("view-" + name).querySelector("h1");
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
    document.dispatchEvent(new CustomEvent("rezaot-view", { detail: { view: name } }));
  }
  function paintTheme() {
    const button = $("darkModeBtn");
    if (button) {
      button.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-' + (document.body.classList.contains("dark") ? "sun" : "moon") + '"/></svg>';
      button.setAttribute("aria-label", t("toggleTheme"));
      button.setAttribute("aria-pressed", String(document.body.classList.contains("dark")));
    }
  }
  function renderRecent() {
    const host = $("recentRecords"); if (!host) return;
    host.replaceChildren();
    const dates = Object.keys(dailyRecords).sort().reverse().slice(0, 3);
    if (!dates.length) { const p = document.createElement("p"); p.className = "empty-recent"; p.textContent = t("noRecent"); host.appendChild(p); return; }
    for (const date of dates) {
      const record = dailyRecords[date]; if (!record) continue;
      const button = document.createElement("button"); button.type = "button"; button.className = "recent-row";
      const day = document.createElement("span"); day.className = "recent-date"; day.textContent = date.slice(8);
      const info = document.createElement("span"); info.className = "recent-info";
      const title = document.createElement("strong"); title.textContent = record.annual ? t("annualLeave") : record.unpaid ? t("unpaidLeave") : (record.trips || []).join(" · ") || t("attendanceTitle");
      const sub = document.createElement("small"); sub.textContent = new Intl.DateTimeFormat(locale(), { weekday: "long", month: "short", day: "numeric" }).format(new Date(date + "T12:00:00"));
      info.append(title, sub); const value = document.createElement("span"); value.className = "recent-ot"; value.textContent = RezaOT_recordOT(date, record).toFixed(2) + " " + t("hourShort");
      button.append(day, info, value); button.addEventListener("click", () => { navigate("today"); editRecord(date); }); host.appendChild(button);
    }
  }
  function applyFilters() {
    const query = ($("recordSearch") && $("recordSearch").value || "").trim().toLocaleLowerCase();
    let matches = 0; const dates = Object.keys(dailyRecords);
    for (const date of dates) {
      const record = dailyRecords[date]; if (!record) continue;
      const trips = (record.trips || []).join(" ");
      const matchType = filter === "all" || (filter === "leave" && (record.annual || record.unpaid)) || (filter === "klia" && trips.toLowerCase().includes("klia cargo"));
      const matchText = !query || (date + " " + formatDateForPDF(date) + " " + trips).toLocaleLowerCase().includes(query);
      const show = !!(matchType && matchText); if (show) matches++;
      document.querySelectorAll('#reportTable tbody tr[data-date="' + date + '"], #mobileCards [data-date="' + date + '"]').forEach(element => { element.toggleAttribute("data-screen-hidden", !show); });
    }
    if ($("noFilteredRecords")) $("noFilteredRecords").hidden = matches > 0 || !dates.length;
    text("filterStatus", (query || filter !== "all" ? matches + "/" + dates.length + " " + t("matchingRecords") + ". " : "") + t("allRecordsExport"));
    document.querySelectorAll("[data-filter]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.filter === filter)));
  }
  function render() {
    if (!window.__rezaotInited) return;
    text("displayMonth", currentMonthKey); text("heroMonth", currentMonthKey);
    text("workspaceDate", new Intl.DateTimeFormat(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()));
    const hour = new Date().getHours(); text("greeting", t(hour < 12 ? "morningGreeting" : hour < 17 ? "afternoonGreeting" : "eveningGreeting"));
    text("dashOT", $("totalOT") ? $("totalOT").textContent : "0.00");
    for (const [target, source] of [["dashDays", "sumDays"], ["dashTrips", "sumTrips"], ["dashKlia", "sumKlia"]]) text(target, $(source) ? $(source).textContent : "0");
    text("printSupervisorName", $("supervisorName") ? $("supervisorName").textContent : "Talib");
    text("activeViewLabel", t("nav" + active[0].toUpperCase() + active.slice(1)));
    renderRecent(); applyFilters(); paintTheme();
  }
  function wireFeedback() {
    for (const [id, key] of [["clockForm", "saveAttendanceClean"], ["tripForm", "addTripClean"]]) {
      const form = $(id); if (!form) continue;
      const button = form.querySelector('[type="submit"]');
      if (button) new MutationObserver(() => {
        const label = button.querySelector("span"); if (label) label.textContent = button.disabled ? t("savingShort") : t(key);
        button.setAttribute("aria-busy", String(button.disabled));
      }).observe(button, { attributes: true, attributeFilter: ["disabled"] });
      form.addEventListener("submit", event => {
        if (!form.checkValidity()) {
          event.preventDefault(); event.stopImmediatePropagation();
          const invalid = form.querySelector(":invalid"); if (invalid) {
            invalid.setAttribute("aria-invalid", "true"); invalid.focus();
            const error = invalid.id === "date" ? $("dateError") : invalid.id === "destination" ? $("destinationError") : $("timeError");
            if (error) { error.hidden = false; error.textContent = t(invalid.id === "date" ? "requiredDate" : invalid.id === "destination" ? "requiredDestination" : "requiredTimes"); invalid.setAttribute("aria-describedby", error.id); }
          }
        }
      }, true);
      form.addEventListener("input", event => { event.target.removeAttribute("aria-invalid"); form.querySelectorAll(".field-error").forEach(error => error.hidden = true); });
    }
    document.addEventListener("rezaot-saved", event => { text(event.detail && event.detail.kind === "trip" ? "tripFeedback" : "attendanceFeedback", t("savedHere")); });
  }
  function init() {
    if (initialized) return; initialized = true;
    document.querySelectorAll(".app-nav-link[data-view]").forEach(button => button.addEventListener("click", event => navigate(button.dataset.view, { focusHeading: event.detail === 0 })));
    document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.go)));
    $("monthPickerBtn").addEventListener("click", () => togglePopover("monthPopover", "monthPickerBtn"));
    $("exportMenuBtn").addEventListener("click", () => togglePopover("reportExportMenu", "exportMenuBtn"));
    for (const [id, direction] of [["monthPrev", -1], ["monthNext", 1]]) $(id).addEventListener("click", () => {
      const value = RezaOT_model.monthValue(currentMonthKey); const [year, month] = value.split("-").map(Number);
      const date = new Date(year, month - 1 + direction, 1);
      if (date.getFullYear() < 1900 || date.getFullYear() > 9999) return;
      $("monthYear").value = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
      Promise.resolve(handleMonthChange()).catch(error => showToast(error.message));
    });
    $("menuToggleBtn").addEventListener("click", () => { $("menuToggleBtn").setAttribute("aria-expanded", String(!$("menuPanel").hidden)); });
    $("holidayPickerBtn").addEventListener("click", () => navigate("settings"), true);
    $("holidayPickerBtn").addEventListener("click", () => {
      const panel = $("holidayPickerPanel");
      if (panel && panel.style.display !== "none") panel.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    $("openOtSettings").addEventListener("click", () => $("otSettingsBtn").click());
    $("openHolidaySettings").addEventListener("click", () => $("holidayPickerBtn").click());
    $("openPinSettings").addEventListener("click", () => $("pinSettingsBtn").click());
    $("settingsThemeBtn").addEventListener("click", () => $("darkModeBtn").click());
    $("settingsLangBtn").addEventListener("click", () => $("langToggleBtn").click());
    $("workingDayCheck").addEventListener("change", () => syncLeaveInputs());
    $("recordSearch").addEventListener("input", applyFilters);
    document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => { filter = button.dataset.filter; applyFilters(); }));
    $("clearFiltersBtn").addEventListener("click", () => { $("recordSearch").value = ""; filter = "all"; applyFilters(); $("recordSearch").focus(); });
    for (const id of ["printButton", "exportPdfBtn", "exportExcelBtn"]) $(id).addEventListener("click", () => closePopover("reportExportMenu", "exportMenuBtn"));
    document.addEventListener("click", event => {
      if (!event.target.closest(".month-control")) closePopover("monthPopover", "monthPickerBtn");
      if (!event.target.closest(".export-control")) closePopover("reportExportMenu", "exportMenuBtn");
    });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape" || document.body.classList.contains("modal-open")) return;
      for (const [panel, button] of [["menuPanel", "menuToggleBtn"], ["monthPopover", "monthPickerBtn"], ["reportExportMenu", "exportMenuBtn"]]) if (!$(panel).hidden) { closePopover(panel, button, true); event.preventDefault(); break; }
    });
    window.addEventListener("hashchange", () => navigate(location.hash.slice(1)));
    wireFeedback(); navigate(location.hash.slice(1) || "today", { keepScroll: true }); render();
  }
  window.RezaOT_dashboard = { init, navigate, showView: navigate, render, applyFilters, paintTheme, openExports: () => { navigate("records"); togglePopover("reportExportMenu", "exportMenuBtn"); } };
  document.addEventListener("rezaot-ready", init);
  document.addEventListener("rezaot-report", render);
  document.addEventListener("rezaot-language", render);
  document.addEventListener("rezaot-profile", render);
  document.addEventListener("rezaot-month", () => { closePopover("monthPopover", "monthPickerBtn"); render(); });
})();
