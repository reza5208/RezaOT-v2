// salary-estimator.js — RezaOT v37 (UPL auto from daily records)
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
      if (hol) otPh += ot;
      else if (day === 0) otRest += ot;
      else if (day === 6) otRest += ot;
      else otWeekday += ot;
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
    var extraUpl = Number(extra.unpaidDays || 0);
    var unpaidDays = autoUpl + extraUpl;
    var unpaidDeduction = unpaidDays > 0 ? (s.basicSalary / 26) * unpaidDays : 0;

    var kliaAllow = summary.kliaDays * (s.kliaPerDay || 70);
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
    deductions.total = Math.round((deductions.unpaid + deductions.epf + deductions.socso + deductions.eis + deductions.skim) * 100) / 100;

    var net = Math.round((gross - deductions.total) * 100) / 100;

    return {
      settings: s,
      summary: summary,
      rates: rates,
      kliaAllow: kliaAllow,
      otPay: Math.round(otPay * 100) / 100,
      gross: Math.round(gross * 100) / 100,
      deductions: deductions,
      unpaidDays: unpaidDays,
      autoUplDays: autoUpl,
      extraUplDays: extraUpl,
      net: net,
      baseRate: Math.round(rates.rate * 100) / 100
    };
  }

  function row(label, value, bold) {
    var tr = document.createElement("tr");
    var td1 = document.createElement("td");
    td1.textContent = label;
    var td2 = document.createElement("td");
    td2.textContent = typeof value === "number" ? ("RM " + value.toFixed(2)) : String(value);
    td2.style.textAlign = "right";
    if (bold) {
      td1.style.fontWeight = "700";
      td2.style.fontWeight = "700";
    }
    tr.appendChild(td1);
    tr.appendChild(td2);
    return tr;
  }

  function render() {
    var body = document.getElementById("salaryPanelBody");
    if (!body) return;
    var unpaidInput = document.getElementById("salaryUnpaidDays");
    var extraUpl = unpaidInput ? Number(unpaidInput.value) || 0 : 0;
    var est = estimate(typeof dailyRecords !== "undefined" ? dailyRecords : {}, { unpaidDays: extraUpl });
    var hint = document.getElementById("salaryUplAutoHint");
    if (hint) {
      var a = est.autoUplDays || 0;
      hint.textContent = a > 0
        ? ("Rekod UPL: " + a + " hari (auto)")
        : "Rekod UPL: 0 hari";
    }

    body.innerHTML = "";
    var tb = document.createElement("table");
    tb.className = "salary-table";
    tb.appendChild(row("Gaji pokok", est.settings.basicSalary));
    tb.appendChild(row("Base rate / jam", est.baseRate));
    tb.appendChild(row("OT weekday (" + est.summary.otWeekday.toFixed(2) + " j × " + est.settings.weekdayMult + ")",
      Math.round(est.rates.weekday * 100) / 100));
    tb.appendChild(row("OT rest/Ahad (" + est.summary.otRest.toFixed(2) + " j × " + est.settings.restMult + ")",
      Math.round(est.rates.rest * 100) / 100));
    tb.appendChild(row("OT cuti (" + est.summary.otPh.toFixed(2) + " j × " + est.settings.phMult + ")",
      Math.round(est.rates.ph * 100) / 100));
    tb.appendChild(row("Jumlah OT pay", est.otPay));
    tb.appendChild(row("Allowance KLIA (" + est.summary.kliaDays + " hari × RM" + (est.settings.kliaPerDay || 70) + ")", est.kliaAllow));
    tb.appendChild(row("Gross", est.gross, true));
    tb.appendChild(row("Cuti tanpa gaji (UPL " + (est.unpaidDays || 0) + " hari)", est.deductions.unpaid));
    tb.appendChild(row("EPF pekerja 11%", est.deductions.epf));
    tb.appendChild(row("SOCSO", est.deductions.socso));
    tb.appendChild(row("EIS", est.deductions.eis));
    if (est.deductions.skim) tb.appendChild(row("SKIM", est.deductions.skim));
    tb.appendChild(row("Jumlah potongan", est.deductions.total));
    tb.appendChild(row("Anggaran net", est.net, true));
    body.appendChild(tb);
  }

  function openSettings() {
    var s = loadSettings();
    var b = prompt("Gaji pokok (RM):", s.basicSalary);
    if (b === null) return;
    var k = prompt("KLIA allowance per hari (RM):", s.kliaPerDay);
    if (k === null) return;
    s.basicSalary = Number(b) || s.basicSalary;
    s.kliaPerDay = Number(k) || s.kliaPerDay;
    saveSettings(s);
    render();
    showToast("Tetapan gaji disimpan");
  }

  function wire() {
    var btn = document.getElementById("salaryToggleBtn");
    var panel = document.getElementById("salaryPanel");
    if (btn && panel && !btn._sal) {
      btn._sal = true;
      btn.addEventListener("click", function () {
        var open = panel.style.display !== "none";
        panel.style.display = open ? "none" : "block";
        if (!open) render();
      });
    }
    var settingsBtn = document.getElementById("salarySettingsBtn");
    if (settingsBtn && !settingsBtn._sal) {
      settingsBtn._sal = true;
      settingsBtn.addEventListener("click", openSettings);
    }
    var unpaid = document.getElementById("salaryUnpaidDays");
    if (unpaid && !unpaid._wired) {
      unpaid._wired = true;
      unpaid.addEventListener("change", render);
      unpaid.addEventListener("input", render);
    }
    if (typeof updateReport === "function" && !updateReport._sal) {
      var orig = updateReport;
      window.updateReport = function () {
        orig.apply(this, arguments);
        var panel = document.getElementById("salaryPanel");
        if (panel && panel.style.display !== "none") render();
      };
      window.updateReport._sal = true;
    }
  }

  window.RezaOT_salary = { estimate: estimate, render: render, loadSettings: loadSettings };

  function tryWire(n) {
    wire();
    if (n < 20) setTimeout(function () { tryWire(n + 1); }, 300);
  }
  document.addEventListener("rezaot-ready", function () { tryWire(0); });
  tryWire(0);
})();
