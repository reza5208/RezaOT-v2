// salary-estimator.js — RezaOT v64 (EPF bracket + payslip Sep 2026)
(function () {
  "use strict";

  var DEFAULTS = {
    basicSalary: 2905.76,
    hoursPerMonth: 208,
    kliaPerDay: 70,
    epfEmployeeRate: 0.11,
    epfEmployerRate: 0.13,
    weekdayMult: 1.5,
    restMult: 2.0,
    phMult: 2.0,
    uplDivisor: 30,
    socso: 23.75,
    eis: 9.50,
    skim: 35.65,
    restBreakHours: 0
  };

  var LIMITS = {
    basicSalary: [0, 100000000], hoursPerMonth: [0.01, 744], kliaPerDay: [0, 100000000],
    epfEmployeeRate: [0, 1], epfEmployerRate: [0, 1], weekdayMult: [0, 10],
    restMult: [0, 10], phMult: [0, 10], uplDivisor: [1, 366],
    socso: [0, 100000000], eis: [0, 100000000], skim: [0, 100000000], restBreakHours: [0, 24]
  };

  function validateSettings(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Tetapan gaji tidak sah.");
    var result = {};
    Object.keys(DEFAULTS).forEach(function (key) {
      var value = Object.prototype.hasOwnProperty.call(input, key) ? input[key] : DEFAULTS[key];
      var range = LIMITS[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < range[0] || value > range[1]) {
        throw new RangeError("Nilai " + key + " mesti " + range[0] + "–" + range[1] + ".");
      }
      result[key] = value;
    });
    result._v = 70;
    return result;
  }

  function loadSettings() {
    var validator = function (value) { try { validateSettings(value); return true; } catch (e) { return false; } };
    var value = typeof readCalculationSetting === "function"
      ? readCalculationSetting("salarySettings", DEFAULTS, validator) : DEFAULTS;
    return validateSettings(value);
  }

  function saveSettings(settings) {
    var valid = validateSettings(settings);
    writeCalculationSetting("salarySettings", valid);
    return valid;
  }

  function selectedMonthKey(records, extra) {
    if (extra && extra.monthKey) return extra.monthKey;
    if (typeof currentMonthKey !== "undefined" && currentMonthKey) return currentMonthKey;
    var date = Object.keys(records || {})[0];
    return date && typeof monthKeyForDate === "function" ? monthKeyForDate(date) : "";
  }

  function baseRate(s) {
    return s.basicSalary / s.hoursPerMonth;
  }

  function epfBracket(wage) {
    var w = Math.max(0, Number(wage) || 0);
    if (w === 0) return 0;
    var rem = w % 20;
    if (rem === 0) return w;
    return Math.ceil(w / 20) * 20;
  }

  function epfCeil(amount) {
    return Math.ceil(Number(amount) || 0);
  }

  function calcEpf(basic, kliaAllow, unpaidDeduction, s) {
    var wage = (Number(basic) || 0) + (Number(kliaAllow) || 0) - (Number(unpaidDeduction) || 0);
    if (wage < 0) wage = 0;
    var bracket = epfBracket(wage);
    var empRate = (s && s.epfEmployeeRate != null) ? Number(s.epfEmployeeRate) : 0.11;
    var erRate = (s && s.epfEmployerRate != null) ? Number(s.epfEmployerRate) : 0.13;
    return {
      wage: Math.round(wage * 100) / 100,
      bracket: bracket,
      employee: epfCeil(bracket * empRate),
      employer: epfCeil(bracket * erRate)
    };
  }

  function summarizeRecords(records, calculation) {
    var workDays = 0;
    var otWeekday = 0, otRest = 0, otPh = 0;
    var kliaDays = new Set();
    var susunCount = 0, palletsCount = 0;
    var unpaidDays = 0, annualDays = 0;
    Object.keys(records || {}).forEach(function (date) {
      var rec = records[date];
      if (!rec) return;
      var trips = Array.isArray(rec.trips) ? rec.trips : [];
      if (rec.annual) {
        annualDays += 1;
        return;
      }
      if (rec.unpaid) unpaidDays += 1;
      if (!rec.unpaid && (rec.clock_in || rec.clock_out || trips.length)) workDays++;
      var ot = RezaOT_recordOT(date, rec, calculation);
      var day = new Date(date + "T00:00:00").getDay();
      var hol = isPublicHoliday(date, calculation);
      if (hol) otPh += ot;
      else if (day === 0) otRest += ot;
      else otWeekday += ot;
      trips.forEach(function (t) {
        var str = String(t);
        if (str.toLowerCase().indexOf("klia cargo") >= 0) kliaDays.add(date);
      });
      if (Array.isArray(rec.sideJobs)) {
        rec.sideJobs.forEach(function (sj) {
          var ty = String((sj && sj.type) || "").toLowerCase();
          if (ty === "susun") susunCount++;
          else if (ty === "pallets") palletsCount++;
        });
      }
    });
    return {
      workDays: workDays,
      otWeekday: otWeekday,
      otRest: otRest,
      otPh: otPh,
      otTotal: otWeekday + otRest + otPh,
      kliaDays: kliaDays.size,
      unpaidDays: unpaidDays,
      annualDays: annualDays,
      susunCount: susunCount,
      palletsCount: palletsCount,
      sideSusun: susunCount * 100,
      sidePallets: palletsCount * 50,
      sideTotal: susunCount * 100 + palletsCount * 50
    };
  }

  function otMoney(summary, s) {
    var rate = baseRate(s);
    return {
      rate: rate,
      weekday: summary.otWeekday * rate * s.weekdayMult,
      rest: summary.otRest * rate * s.restMult,
      ph: summary.otPh * rate * s.phMult
    };
  }

  function countUnpaidDays(records) {
    var n = 0;
    Object.keys(records || {}).forEach(function (d) {
      if (records[d] && records[d].unpaid && !records[d].annual) n += 1;
    });
    return n;
  }

  function estimate(records, extra) {
    extra = extra || {};
    var calculation = getMonthCalculationSettings(selectedMonthKey(records, extra));
    var s = validateSettings(calculation.salarySettings);
    var summary = summarizeRecords(records || {}, calculation);
    var rates = otMoney(summary, s);
    var autoUpl = summary.unpaidDays || countUnpaidDays(records || {});
    var extraUpl = extra.unpaidDays == null ? 0 : Number(extra.unpaidDays);
    if (!Number.isFinite(extraUpl) || extraUpl < 0 || extraUpl > 31) throw new RangeError(text("salaryExtraUplRange", "UPL tambahan mesti 0–31 hari."));
    var unpaidDays = autoUpl + extraUpl;
    var dailyRate = s.basicSalary / (s.uplDivisor || 30);
    var unpaidDeduction = unpaidDays * dailyRate;

    var kliaAllow = summary.kliaDays * s.kliaPerDay;
    var otPay = rates.weekday + rates.rest + rates.ph;
    var gross = s.basicSalary + otPay + kliaAllow;

    var epf = calcEpf(s.basicSalary, kliaAllow, unpaidDeduction, s);

    var socso = (s.socso != null) ? Number(s.socso) : 23.75;
    var eis = (s.eis != null) ? Number(s.eis) : 9.50;
    var skim = (s.skim != null) ? Number(s.skim) : 35.65;

    var deductions = {
      unpaid: Math.round(unpaidDeduction * 100) / 100,
      unpaidDays: unpaidDays,
      autoUplDays: autoUpl,
      extraUplDays: extraUpl,
      annualDays: summary.annualDays || 0,
      epf: epf.employee,
      epfEmployer: epf.employer,
      epfWage: epf.wage,
      epfBracket: epf.bracket,
      socso: socso,
      eis: eis,
      skim: skim
    };
    var totalDeduct = deductions.unpaid + deductions.epf + deductions.socso + deductions.eis + deductions.skim;
    var net = gross - totalDeduct;

    return {
      settings: s,
      summary: summary,
      rates: rates,
      otPay: Math.round(otPay * 100) / 100,
      kliaAllow: kliaAllow,
      epf: epf,
      sideIncome: {
        susun: summary.susunCount || 0,
        pallets: summary.palletsCount || 0,
        susunRm: summary.sideSusun || 0,
        palletsRm: summary.sidePallets || 0,
        total: summary.sideTotal || 0
      },
      gross: Math.round(gross * 100) / 100,
      deductions: deductions,
      totalDeduct: Math.round(totalDeduct * 100) / 100,
      net: Math.round(net * 100) / 100,
      hourlyRate: Math.round(rates.rate * 10000) / 10000
    };
  }

  function row(label, value, cls) {
    var tr = document.createElement("tr");
    if (cls) tr.className = cls;
    var td1 = document.createElement("td");
    td1.textContent = label;
    var td2 = document.createElement("td");
    td2.textContent = typeof value === "number"
      ? (value < 0 ? "-RM " : "RM ") + Math.abs(value).toFixed(2)
      : String(value);
    td2.style.textAlign = "right";
    tr.appendChild(td1);
    tr.appendChild(td2);
    return tr;
  }

  function render(container, records, extra) {
    if (!container) return;
    var est = estimate(records, extra);
    container.innerHTML = "";

    var table = document.createElement("table");
    table.className = "salary-table";
    var tb = document.createElement("tbody");

    tb.appendChild(row(text("salaryBasic", "Gaji pokok"), est.settings.basicSalary));
    tb.appendChild(row(text("salaryHourlyRate", "Kadar sejam"), est.hourlyRate));
    tb.appendChild(row(text("salaryWeekdayOt", "OT Isnin–Sabtu") + " (" + est.summary.otWeekday.toFixed(2) + " " + text("salaryHoursAbbr", "j") + " × " + est.settings.weekdayMult + ")",
      Math.round(est.rates.weekday * 100) / 100));
    tb.appendChild(row(text("salarySundayOt", "OT Ahad") + " (" + est.summary.otRest.toFixed(2) + " " + text("salaryHoursAbbr", "j") + " × " + est.settings.restMult + ")",
      Math.round(est.rates.rest * 100) / 100));
    tb.appendChild(row(text("salaryHolidayOt", "OT cuti") + " (" + est.summary.otPh.toFixed(2) + " " + text("salaryHoursAbbr", "j") + " × " + est.settings.phMult + ")",
      Math.round(est.rates.ph * 100) / 100));
    tb.appendChild(row(text("salaryTotalOtPay", "Jumlah bayaran OT"), est.otPay));
    tb.appendChild(row(text("salaryKliaAllowance", "Allowance KLIA") + " (" + est.summary.kliaDays + " " + text("salaryDays", "hari") + " × RM" + est.settings.kliaPerDay + ")",
      est.kliaAllow));
    tb.appendChild(row("Gross", est.gross, "salary-total"));

    if (est.deductions.unpaidDays > 0) {
      tb.appendChild(row("UPL (" + est.deductions.unpaidDays + " " + text("salaryDays", "hari") + ")", -est.deductions.unpaid));
    }
    if (est.deductions.annualDays > 0) {
      tb.appendChild(row(text("salaryAnnualLeave", "Cuti tahunan / ANN") + " (" + est.deductions.annualDays + " " + text("salaryDays", "hari") + ")", text("salaryNoDeduction", "— (tiada potongan)")));
    }
    tb.appendChild(row(text("salaryEpfBase", "Asas EPF (pokok+KLIA−UPL)"), est.deductions.epfWage));
    tb.appendChild(row(text("salaryEpfBracket", "Bracket EPF (↑ RM20)"), est.deductions.epfBracket));
    tb.appendChild(row(text("salaryEpfEmployeeLabel", "EPF pekerja") + " (" + (est.settings.epfEmployeeRate * 100) + "%)", -est.deductions.epf));
    tb.appendChild(row(text("salaryEpfEmployerLabel", "EPF majikan") + " (" + (est.settings.epfEmployerRate * 100) + "%) — " + text("salaryInfo", "info"), est.deductions.epfEmployer));
    tb.appendChild(row("SOCSO", -est.deductions.socso));
    tb.appendChild(row("EIS", -est.deductions.eis));
    if (est.deductions.skim) tb.appendChild(row("Skim SKBBK", -est.deductions.skim));
    tb.appendChild(row(text("salaryTotalDeductions", "Jumlah potongan (pekerja)"), -est.totalDeduct));
    tb.appendChild(row(text("salaryEstimatedNet", "Anggaran bersih"), est.net, "salary-net"));

    table.appendChild(tb);
    container.appendChild(table);

    var side = est.sideIncome || { susun: 0, pallets: 0, susunRm: 0, palletsRm: 0, total: 0 };
    var sideTable = document.createElement("table");
    sideTable.className = "salary-table salary-side";
    var stb = document.createElement("tbody");
    var h = document.createElement("tr");
    h.className = "salary-side-head";
    var hd = document.createElement("td");
    hd.colSpan = 2;
    var strong = document.createElement("strong");
    strong.textContent = text("salarySideIncome", "Side income (bukan gaji)");
    hd.appendChild(strong);
    h.appendChild(hd);
    stb.appendChild(h);
    stb.appendChild(row("Susun (" + side.susun + " AWB × RM100)", side.susunRm));
    stb.appendChild(row("Pallets (" + side.pallets + " AWB × RM50)", side.palletsRm));
    stb.appendChild(row(text("salarySideTotal", "Jumlah side income"), side.total, "salary-side-total"));
    sideTable.appendChild(stb);
    container.appendChild(sideTable);

    var note = document.createElement("p");
    note.className = "salary-note";
    note.textContent = text("salaryFormulaNote", "EPF = ceil(% × bracket↑RM20) atas (pokok+KLIA−UPL), OT tidak masuk asas EPF. Side income berasingan daripada gaji.") +
      " " + text("salaryBreakHours", "Rehat Ahad/cuti (jam):") + " " + est.settings.restBreakHours;
    var snapshot = getMonthCalculationSettings(selectedMonthKey(records, extra));
    if (snapshot.capturedAt) note.textContent += " " + text("salarySnapshotNote", "Menggunakan tetapan bulan yang disimpan. Butang Kemas kini tetapan bulan ini menggantikannya dengan tetapan semasa.");
    container.appendChild(note);
  }

  function text(key, fallback) {
    var translated = window.RezaOT_i18n && RezaOT_i18n.t(key);
    return translated && translated !== key ? translated : fallback;
  }

  async function askNumber(label, value) {
    var answer = typeof rezaotPrompt === "function" ? await rezaotPrompt(label, String(value)) : prompt(label, value);
    if (answer === null) return null;
    if (!String(answer).trim()) throw new TypeError(text("invalidNumber", "Sila masukkan nombor yang sah."));
    var number = Number(answer);
    if (!Number.isFinite(number)) throw new TypeError(text("invalidNumber", "Sila masukkan nombor yang sah."));
    return number;
  }

  async function openSettings() {
    var settings = loadSettings();
    var fields = [
      ["basicSalary", text("salaryBasic", "Gaji pokok (RM)")],
      ["hoursPerMonth", text("salaryHours", "Jam sebulan (untuk kadar OT)")],
      ["kliaPerDay", text("salaryKlia", "Allowance KLIA per hari (RM)")],
      ["epfEmployeeRate", text("salaryEpfEmployee", "Kadar EPF pekerja (0.11 = 11%)")],
      ["epfEmployerRate", text("salaryEpfEmployer", "Kadar EPF majikan (0.13 = 13%)")],
      ["socso", "SOCSO (RM)"], ["eis", "EIS (RM)"], ["skim", "Skim SKBBK (RM)"],
      ["restBreakHours", text("salaryRestBreak", "Potong rehat Ahad/cuti (jam, 0=tiada)")]
    ];
    try {
      for (var i = 0; i < fields.length; i++) {
        var value = await askNumber(fields[i][1], settings[fields[i][0]]);
        if (value === null) return;
        settings[fields[i][0]] = value;
      }
      saveSettings(settings);
      showToast(text("salaryDefaultsSaved", "Tetapan gaji disimpan. Gunakan butang tetapan bulan untuk mengemas kini snapshot bulan ini."));
      if (typeof updateReport === "function") updateReport();
      refresh();
    } catch (error) { showToast(error.message, 5000); }
  }

  async function updateMonthSnapshot() {
    if (typeof currentMonthKey === "undefined" || !currentMonthKey) return;
    var msg = text("updateMonthSettingsConfirm", "Gunakan tetapan OT, gaji dan cuti semasa untuk bulan ini?") + "\n" + currentMonthKey;
    var accepted = typeof rezaotConfirm === "function" ? await rezaotConfirm(msg) : confirm(msg);
    if (!accepted) return;
    try {
      captureMonthSettings(currentMonthKey, { replace: true });
      if (typeof saveToLocalStorage === "function") saveToLocalStorage();
      if (typeof updateReport === "function") updateReport();
      refresh();
      showToast(text("monthSettingsUpdated", "Tetapan bulan dikemas kini."));
    } catch (error) { showToast(error.message, 5000); }
  }

  function refresh() {
    var panel = document.getElementById("salaryPanelBody");
    var extraEl = document.getElementById("salaryUnpaidDays");
    var hint = document.getElementById("salaryUplAutoHint");
    var auto = countUnpaidDays(typeof dailyRecords !== "undefined" ? dailyRecords : {});
    if (hint) hint.textContent = text("salaryUplRecords", "Rekod UPL:") + " " + auto + " " + text("salaryDays", "hari");
    if (panel && panel.offsetParent !== null) {
      try {
        render(panel, typeof dailyRecords !== "undefined" ? dailyRecords : {}, {
          unpaidDays: extraEl && extraEl.value !== "" ? Number(extraEl.value) : 0
        });
      } catch (error) { showToast(error.message, 5000); }
    }
  }

  function runUnitTest() {
    var s = { basicSalary: 2905.76, epfEmployeeRate: 0.11, epfEmployerRate: 0.13 };
    var upl = 96.86, klia = 1120, otPay = 866.14;
    var epf = calcEpf(s.basicSalary, klia, upl, s);
    var gross = s.basicSalary + otPay + klia;
    var totalDeduct = upl + epf.employee + 23.75 + 9.50 + 35.65;
    var net = Math.round((gross - totalDeduct) * 100) / 100;
    var ok = epf.wage === 3928.9 && epf.bracket === 3940 &&
      epf.employee === 434 && epf.employer === 513 && net === 4292.14;
    var report = { ok: ok, epf: epf, net: net };
    if (typeof console !== "undefined") {
      console.log(ok ? "salary unit test PASS" : "salary unit test FAIL", report);
    }
    return report;
  }

  document.addEventListener("rezaot-ready", function () {
    var toggle = document.getElementById("salaryToggleBtn");
    var panel = document.getElementById("salaryPanel");
    var settingsBtn = document.getElementById("salarySettingsBtn");
    var extraEl = document.getElementById("salaryUnpaidDays");
    if (toggle && panel) {
      toggle.addEventListener("click", function () {
        var open = panel.style.display !== "none";
        panel.style.display = open ? "none" : "block";
        if (!open) refresh();
      });
    }
    if (settingsBtn) settingsBtn.addEventListener("click", openSettings);
    if (extraEl) extraEl.addEventListener("change", refresh);
    var toolbar = document.querySelector(".salary-toolbar");
    if (toolbar && !document.getElementById("monthSettingsUpdateBtn")) {
      var snapshotBtn = document.createElement("button");
      snapshotBtn.id = "monthSettingsUpdateBtn";
      snapshotBtn.type = "button";
      snapshotBtn.className = "secondary-btn";
      snapshotBtn.setAttribute("data-i18n", "updateMonthSettings");
      snapshotBtn.textContent = text("updateMonthSettings", "Kemas kini tetapan bulan ini");
      snapshotBtn.addEventListener("click", updateMonthSnapshot);
      toolbar.appendChild(snapshotBtn);
    }
    if (extraEl) { extraEl.max = "31"; extraEl.min = "0"; }
    refresh();
  });

  document.addEventListener("rezaot-report", refresh);
  window.RezaOT_validateSalarySettings = validateSettings;
  window.RezaOT_salary = {
    estimate: estimate,
    render: render,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    validateSettings: validateSettings,
    summarizeRecords: summarizeRecords,
    openSettings: openSettings,
    refresh: refresh,
    calcEpf: calcEpf,
    epfBracket: epfBracket,
    runUnitTest: runUnitTest
  };
})();
