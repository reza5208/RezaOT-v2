// salary-estimator.js — anggaran gaji (no-print only)
// Formula ikut payslip MBG Fruits JUL 2026 (M-264)
(function () {
  "use strict";

  var DEFAULTS = {
    basicSalary: 2905.76,
    hoursPerMonth: 208,
    kliaAllowance: 700,
    kliaPerDay: 70,
    usePerKliaDay: false,
    otNormalRate: 1.5,
    otRestRate: 2.0,
    otHolidayRate: 3.0,
    otRestFirst8Rate: 1.0,
    otRestFirst8Hours: 8,
    useRestFirst8: true,
    epfEmployeePct: 0.11,
    epfEmployerPct: 0.13,
    epfIncludeKlia: true,
    epfIncludeOT: false,
    eisEmployeePct: 0.002,
    eisEmployerPct: 0.002,
    skimSkbbk: 29.65
  };

  function loadSettings() {
    try {
      var raw = localStorage.getItem("salarySettings");
      if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) {}
    return Object.assign({}, DEFAULTS);
  }

  function saveSettings(s) {
    localStorage.setItem("salarySettings", JSON.stringify(s));
  }

  function baseHourly(s) {
    return s.basicSalary / s.hoursPerMonth;
  }

  function breakdownOTHours(records) {
    var normal = 0, rest = 0, holiday = 0, kliaDays = 0, workDays = 0;
    Object.keys(records || {}).forEach(function (date) {
      var rec = records[date];
      if (!rec) return;
      var trips = rec.trips || [];
      var hasKlia = trips.some(function (t) {
        return String(t).toLowerCase().indexOf("klia cargo") >= 0;
      });
      if (hasKlia) kliaDays++;
      if (rec.clock_in || rec.clock_out || trips.length) workDays++;
      var hours = typeof calculateOT === "function"
        ? calculateOT(rec.clock_in, rec.clock_out, date, trips) : 0;
      var day = new Date(date + "T00:00:00").getDay();
      var isHol = typeof isPublicHoliday === "function" && isPublicHoliday(date);
      if (isHol) holiday += hours;
      else if (day === 0) rest += hours;
      else normal += hours;
    });
    return {
      normal: Math.round(normal * 100) / 100,
      rest: Math.round(rest * 100) / 100,
      holiday: Math.round(holiday * 100) / 100,
      kliaDays: kliaDays,
      workDays: workDays
    };
  }

  function calcRestPay(hours, hourly, s) {
    if (!s.useRestFirst8) return hours * hourly * s.otRestRate;
    var first = Math.min(hours, s.otRestFirst8Hours);
    var excess = Math.max(hours - s.otRestFirst8Hours, 0);
    return first * hourly * s.otRestFirst8Rate + excess * hourly * s.otRestRate;
  }

  function socsoEmployee(wage) {
    if (wage < 30) return 0;
    if (wage <= 3000) return 14.75;
    if (wage <= 3500) return 17.25;
    if (wage <= 3900) return 19.25;
    if (wage <= 4000) return 19.75;
    if (wage <= 5000) return 24.75;
    return 29.75;
  }

  function socsoEmployer(wage) {
    if (wage <= 3000) return 51.25;
    if (wage <= 3500) return 60.25;
    if (wage <= 3900) return 67.35;
    if (wage <= 4000) return 69.15;
    if (wage <= 5000) return 86.65;
    return 104.15;
  }

  function estimate(records, extra) {
    var s = loadSettings();
    extra = extra || {};
    var hourly = baseHourly(s);
    var bd = breakdownOTHours(records);
    var normalOT = bd.normal * hourly * s.otNormalRate;
    var restOT = calcRestPay(bd.rest, hourly, s);
    var holidayOT = bd.holiday * hourly * s.otHolidayRate;
    var klia = s.usePerKliaDay ? s.kliaPerDay * bd.kliaDays : s.kliaAllowance;
    var unpaidDays = Number(extra.unpaidDays || 0);
    var unpaidDeduction = unpaidDays > 0 ? (s.basicSalary / 26) * unpaidDays : 0;

    var earnings = {
      basic: s.basicSalary,
      klia: klia,
      normalOT: Math.round(normalOT * 100) / 100,
      restOT: Math.round(restOT * 100) / 100,
      holidayOT: Math.round(holidayOT * 100) / 100
    };
    earnings.total = Math.round((earnings.basic + earnings.klia + earnings.normalOT + earnings.restOT + earnings.holidayOT) * 100) / 100;

    var epfBase = s.basicSalary;
    if (s.epfIncludeKlia) epfBase += klia;
    if (s.epfIncludeOT) epfBase += earnings.normalOT + earnings.restOT + earnings.holidayOT;
    epfBase = Math.round(epfBase * 100) / 100;
    var epfEmp = Math.round(epfBase * s.epfEmployeePct);
    var epfEr = Math.round(epfBase * s.epfEmployerPct);
    var socsoWage = Math.min(epfBase, 6000);
    var socsoEmp = socsoEmployee(socsoWage);
    var socsoEr = socsoEmployer(socsoWage);
    var eisEmp = Math.round(Math.min(epfBase, 6000) * s.eisEmployeePct * 100) / 100;
    var eisEr = Math.round(Math.min(epfBase, 6000) * s.eisEmployerPct * 100) / 100;

    var deductions = {
      unpaid: Math.round(unpaidDeduction * 100) / 100,
      epf: epfEmp,
      socso: socsoEmp,
      eis: eisEmp,
      skim: s.skimSkbbk
    };
    deductions.total = Math.round((deductions.unpaid + deductions.epf + deductions.socso + deductions.eis + deductions.skim) * 100) / 100;
    var net = Math.round((earnings.total - deductions.total) * 100) / 100;

    return {
      hourly: Math.round(hourly * 10000) / 10000,
      bd: bd,
      earnings: earnings,
      deductions: deductions,
      employer: { epf: epfEr, socso: socsoEr, eis: eisEr },
      epfBase: epfBase,
      net: net,
      settings: s
    };
  }

  function money(n) {
    return Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function render() {
    var panel = document.getElementById("salaryPanelBody");
    if (!panel) return;
    var unpaidInput = document.getElementById("salaryUnpaidDays");
    var unpaidDays = unpaidInput ? Number(unpaidInput.value) || 0 : 0;
    var est = estimate(typeof dailyRecords !== "undefined" ? dailyRecords : {}, { unpaidDays: unpaidDays });

    panel.innerHTML = "";
    function row(label, val, strong) {
      var tr = document.createElement("tr");
      var td1 = document.createElement("td");
      td1.textContent = label;
      var td2 = document.createElement("td");
      td2.textContent = "RM " + money(val);
      td2.style.textAlign = "right";
      if (strong) { td1.style.fontWeight = "700"; td2.style.fontWeight = "700"; }
      tr.appendChild(td1);
      tr.appendChild(td2);
      return tr;
    }

    var html = document.createElement("div");
    html.className = "salary-grid";
    var meta = document.createElement("p");
    meta.className = "salary-meta";
    meta.textContent = "Base rate: RM " + money(est.hourly) + "/jam · OT biasa " + est.bd.normal + "j · Rehat " + est.bd.rest + "j · Cuti " + est.bd.holiday + "j · KLIA " + est.bd.kliaDays + " hari";
    html.appendChild(meta);

    var table = document.createElement("table");
    table.className = "salary-table";
    var tb = document.createElement("tbody");
    tb.appendChild(row("Gaji pokok", est.earnings.basic));
    tb.appendChild(row("Allowance KLIA", est.earnings.klia));
    tb.appendChild(row("OT biasa (×1.5)", est.earnings.normalOT));
    tb.appendChild(row("OT hari rehat", est.earnings.restOT));
    tb.appendChild(row("OT cuti umum", est.earnings.holidayOT));
    tb.appendChild(row("JUMLAH PENDAPATAN", est.earnings.total, true));
    tb.appendChild(row("Cuti tanpa gaji", est.deductions.unpaid));
    tb.appendChild(row("EPF pekerja (11%)", est.deductions.epf));
    tb.appendChild(row("SOCSO pekerja", est.deductions.socso));
    tb.appendChild(row("EIS pekerja", est.deductions.eis));
    tb.appendChild(row("SKIM SKBBK 24J", est.deductions.skim));
    tb.appendChild(row("JUMLAH POTONGAN", est.deductions.total, true));
    table.appendChild(tb);
    html.appendChild(table);

    var net = document.createElement("div");
    net.className = "salary-net";
    net.textContent = "ANGGARAN NET PAY: RM " + money(est.net);
    html.appendChild(net);

    var note = document.createElement("p");
    note.className = "salary-note";
    note.textContent = "Anggaran sahaja (ikut payslip Jul 2026). EPF atas gaji pokok" + (est.settings.epfIncludeKlia ? " + KLIA" : "") + ". Tak termasuk dalam cetak/PDF.";
    html.appendChild(note);
    panel.appendChild(html);
  }

  function openSettings() {
    var s = loadSettings();
    var basic = prompt("Gaji pokok (RM):", String(s.basicSalary));
    if (basic === null) return;
    var klia = prompt("Allowance KLIA bulanan (RM):", String(s.kliaAllowance));
    if (klia === null) return;
    var skim = prompt("SKIM SKBBK 24J (RM):", String(s.skimSkbbk));
    if (skim === null) return;
    s.basicSalary = Number(basic) || s.basicSalary;
    s.kliaAllowance = Number(klia) || 0;
    s.skimSkbbk = Number(skim) || 0;
    saveSettings(s);
    render();
    if (typeof showToast === "function") showToast("Tetapan gaji dikemaskini");
  }

  function togglePanel() {
    var body = document.getElementById("salaryPanel");
    if (!body) return;
    var show = body.style.display === "none" || !body.style.display;
    body.style.display = show ? "block" : "none";
    if (show) render();
  }

  function wire() {
    var btn = document.getElementById("salaryToggleBtn");
    if (btn && !btn._wired) {
      btn._wired = true;
      btn.addEventListener("click", togglePanel);
    }
    var setBtn = document.getElementById("salarySettingsBtn");
    if (setBtn && !setBtn._wired) {
      setBtn._wired = true;
      setBtn.addEventListener("click", openSettings);
    }
    var unpaid = document.getElementById("salaryUnpaidDays");
    if (unpaid && !unpaid._wired) {
      unpaid._wired = true;
      unpaid.addEventListener("change", render);
      unpaid.addEventListener("input", render);
    }
    var orig = window.updateReport;
    if (typeof orig === "function" && !orig._salaryWrapped) {
      window.updateReport = function () {
        orig.apply(this, arguments);
        var panel = document.getElementById("salaryPanel");
        if (panel && panel.style.display !== "none") render();
      };
      window.updateReport._salaryWrapped = true;
    }
  }

  window.RezaOT_salary = { estimate: estimate, render: render, loadSettings: loadSettings };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(wire, 300); });
  } else {
    setTimeout(wire, 300);
  }
  setTimeout(wire, 900);
})();
