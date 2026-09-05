// salary-estimator.js — RezaOT v43 (Sabtu OT = weekday, bukan Ahad)
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
    phMult: 3.0
  };

  function loadSettings() {
    try {
      var raw = localStorage.getItem("salarySettings");
      if (raw) {
        var p = JSON.parse(raw);
        return Object.assign({}, DEFAULTS, p);
      }
    } catch (e) {}
    return Object.assign({}, DEFAULTS);
  }

  function saveSettings(s) {
    localStorage.setItem("salarySettings", JSON.stringify(s));
  }

  function baseRate(s) {
    return s.basicSalary / s.hoursPerMonth;
  }

  function summarizeRecords(records) {
    var workDays = 0;
    var otWeekday = 0, otRest = 0, otPh = 0;
    var kliaDays = new Set();
    Object.keys(records || {}).forEach(function (date) {
      var rec = records[date];
      if (!rec) return;
      var trips = rec.trips || [];
      if (rec.clock_in || rec.clock_out || trips.length) workDays++;
      var ot = (typeof calculateOT === "function")
        ? calculateOT(rec.clock_in, rec.clock_out, date, trips) : 0;
      if (rec.unpaid) ot = 0;
      var day = new Date(date + "T00:00:00").getDay();
      var hol = typeof isPublicHoliday === "function" && isPublicHoliday(date);
      // Ahad (0) = rest day ×2; Sabtu (6) = working day OT ×1.5 (lepas 14:00);
      // cuti umum = PH ×3
      if (hol) otPh += ot;
      else if (day === 0) otRest += ot;
      else otWeekday += ot; // Isnin–Sabtu
      trips.forEach(function (t) {
        if (String(t).toLowerCase().indexOf("klia cargo") >= 0) kliaDays.add(date);
      });
    });
    return {
      workDays: workDays,
      otWeekday: otWeekday,
      otRest: otRest,
      otPh: otPh,
      otTotal: otWeekday + otRest + otPh,
      kliaDays: kliaDays.size
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
      if (records[d] && records[d].unpaid) n += 1;
    });
    return n;
  }

  function estimate(records, extra) {
    extra = extra || {};
    var s = loadSettings();
    var summary = summarizeRecords(records || {});
    var rates = otMoney(summary, s);
    var autoUpl = countUnpaidDays(records || {});
    var extraUpl = Number(extra.unpaidDays) || 0;
    var unpaidDays = autoUpl + extraUpl;
    var dailyRate = s.basicSalary / 26;
    var unpaidDeduction = unpaidDays * dailyRate;

    var kliaAllow = summary.kliaDays * s.kliaPerDay;
    var otPay = rates.weekday + rates.rest + rates.ph;
    var gross = s.basicSalary + otPay + kliaAllow;

    var epfBase = s.basicSalary + kliaAllow;
    var epfEmployee = epfBase * s.epfEmployeeRate;
    var socso = 19.75;
    var eis = 5.80;
    var skim = 0;

    try {
      var raw = localStorage.getItem("salarySettings");
      if (raw) {
        var p = JSON.parse(raw);
        if (p.socso != null) socso = Number(p.socso);
        if (p.eis != null) eis = Number(p.eis);
        if (p.skim != null) skim = Number(p.skim);
      }
    } catch (e) {}

    var deductions = {
      unpaid: Math.round(unpaidDeduction * 100) / 100,
      unpaidDays: unpaidDays,
      autoUplDays: autoUpl,
      extraUplDays: extraUpl,
      epf: Math.round(epfEmployee * 100) / 100,
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

    tb.appendChild(row("Gaji pokok", est.settings.basicSalary));
    tb.appendChild(row("Kadar sejam", est.hourlyRate));
    tb.appendChild(row("OT Isnin–Sabtu (" + est.summary.otWeekday.toFixed(2) + " j × " + est.settings.weekdayMult + ")",
      Math.round(est.rates.weekday * 100) / 100));
    tb.appendChild(row("OT Ahad (" + est.summary.otRest.toFixed(2) + " j × " + est.settings.restMult + ")",
      Math.round(est.rates.rest * 100) / 100));
    tb.appendChild(row("OT cuti (" + est.summary.otPh.toFixed(2) + " j × " + est.settings.phMult + ")",
      Math.round(est.rates.ph * 100) / 100));
    tb.appendChild(row("Jumlah OT pay", est.otPay));
    tb.appendChild(row("Allowance KLIA (" + est.summary.kliaDays + " hari × RM" + est.settings.kliaPerDay + ")",
      est.kliaAllow));
    tb.appendChild(row("Gross", est.gross, "salary-total"));

    if (est.deductions.unpaidDays > 0) {
      tb.appendChild(row("UPL (" + est.deductions.unpaidDays + " hari)", -est.deductions.unpaid));
    }
    tb.appendChild(row("EPF pekerja (" + (est.settings.epfEmployeeRate * 100) + "%)", -est.deductions.epf));
    tb.appendChild(row("SOCSO", -est.deductions.socso));
    tb.appendChild(row("EIS", -est.deductions.eis));
    if (est.deductions.skim) tb.appendChild(row("Skim", -est.deductions.skim));
    tb.appendChild(row("Jumlah potongan", -est.totalDeduct));
    tb.appendChild(row("Anggaran bersih", est.net, "salary-net"));

    table.appendChild(tb);
    container.appendChild(table);

    var note = document.createElement("p");
    note.className = "salary-note";
    note.textContent = "Anggaran sahaja. Saturday OT = ×1.5 (selepas jam mula OT Sabtu). Ahad = ×2. Cuti umum = ×3.";
    container.appendChild(note);
  }

  function openSettings() {
    var s = loadSettings();
    var b = prompt("Gaji pokok (RM):", s.basicSalary);
    if (b === null) return;
    var h = prompt("Jam sebulan (untuk kadar OT):", s.hoursPerMonth);
    if (h === null) return;
    var k = prompt("Allowance KLIA per hari (RM):", s.kliaPerDay);
    if (k === null) return;
    s.basicSalary = parseFloat(b) || s.basicSalary;
    s.hoursPerMonth = parseFloat(h) || s.hoursPerMonth;
    s.kliaPerDay = parseFloat(k) || s.kliaPerDay;
    saveSettings(s);
    if (typeof showToast === "function") showToast("Tetapan gaji disimpan");
    var panel = document.getElementById("salaryPanelBody");
    var extraEl = document.getElementById("salaryUnpaidDays");
    if (panel) render(panel, typeof dailyRecords !== "undefined" ? dailyRecords : {}, {
      unpaidDays: extraEl ? parseFloat(extraEl.value) || 0 : 0
    });
  }

  function refresh() {
    var panel = document.getElementById("salaryPanelBody");
    var extraEl = document.getElementById("salaryUnpaidDays");
    var hint = document.getElementById("salaryUplAutoHint");
    var auto = countUnpaidDays(typeof dailyRecords !== "undefined" ? dailyRecords : {});
    if (hint) hint.textContent = "Rekod UPL: " + auto + " hari";
    if (panel && panel.offsetParent !== null) {
      render(panel, typeof dailyRecords !== "undefined" ? dailyRecords : {}, {
        unpaidDays: extraEl ? parseFloat(extraEl.value) || 0 : 0
      });
    }
  }

  document.addEventListener("rezaot-ready", function () {
    var toggle = document.getElementById("salaryToggleBtn");
    var panel = document.getElementById("salaryPanel");
    var body = document.getElementById("salaryPanelBody");
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
    var orig = window.updateReport;
    if (typeof orig === "function") {
      window.updateReport = function () {
        orig.apply(this, arguments);
        refresh();
      };
    }
  });

  window.RezaOT_salary = { estimate: estimate, render: render, loadSettings: loadSettings, refresh: refresh };
})();
