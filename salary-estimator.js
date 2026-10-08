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

  function loadSettings() {
    try {
      var raw = localStorage.getItem("salarySettings");
      if (raw) {
        var p = JSON.parse(raw);
        var s = Object.assign({}, DEFAULTS, p);
        if (!p._v || p._v < 64) {
          s.phMult = 2.0;
          s.uplDivisor = 30;
          if (p.skim == null) s.skim = 35.65;
          if (p.socso == null) s.socso = 23.75;
          if (p.eis == null) s.eis = 9.50;
          if (p.restBreakHours == null) s.restBreakHours = 0;
          delete s.socsoRate;
          delete s.eisRate;
          s._v = 64;
          try { localStorage.setItem("salarySettings", JSON.stringify(s)); } catch (e2) {}
        }
        return s;
      }
    } catch (e) {}
    return Object.assign({}, DEFAULTS, { _v: 64 });
  }

  function saveSettings(s) {
    localStorage.setItem("salarySettings", JSON.stringify(s));
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

  function summarizeRecords(records) {
    var workDays = 0;
    var otWeekday = 0, otRest = 0, otPh = 0;
    var kliaDays = new Set();
    var susunCount = 0, palletsCount = 0;
    var unpaidDays = 0, annualDays = 0;
    Object.keys(records || {}).forEach(function (date) {
      var rec = records[date];
      if (!rec) return;
      var trips = rec.trips || [];
      if (rec.annual) {
        annualDays += 1;
        return;
      }
      if (rec.unpaid) unpaidDays += 1;
      if (rec.clock_in || rec.clock_out || trips.length) workDays++;
      var ot = (typeof calculateOT === "function")
        ? calculateOT(rec.clock_in, rec.clock_out, date, trips) : 0;
      if (rec.unpaid) ot = 0;
      var day = new Date(date + "T00:00:00").getDay();
      var hol = typeof isPublicHoliday === "function" && isPublicHoliday(date);
      if (hol) otPh += ot;
      else if (day === 0) otRest += ot;
      else otWeekday += ot;
      trips.forEach(function (t) {
        var str = String(t);
        if (str.toLowerCase().indexOf("klia cargo") >= 0) kliaDays.add(date);
        if (/\*\s*$/.test(str)) susunCount++;
        else if (/#\s*$/.test(str)) palletsCount++;
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
    var s = loadSettings();
    var summary = summarizeRecords(records || {});
    var rates = otMoney(summary, s);
    var autoUpl = summary.unpaidDays || countUnpaidDays(records || {});
    var extraUpl = Number(extra.unpaidDays) || 0;
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
    if (est.deductions.annualDays > 0) {
      tb.appendChild(row("Cuti tahunan / ANN (" + est.deductions.annualDays + " hari)", "— (tiada potongan)"));
    }
    tb.appendChild(row("Asas EPF (pokok+KLIA−UPL)", est.deductions.epfWage));
    tb.appendChild(row("Bracket EPF (↑ RM20)", est.deductions.epfBracket));
    tb.appendChild(row("EPF pekerja (" + (est.settings.epfEmployeeRate * 100) + "%)", -est.deductions.epf));
    tb.appendChild(row("EPF majikan (" + (est.settings.epfEmployerRate * 100) + "%) — info", est.deductions.epfEmployer));
    tb.appendChild(row("SOCSO", -est.deductions.socso));
    tb.appendChild(row("EIS", -est.deductions.eis));
    if (est.deductions.skim) tb.appendChild(row("Skim SKBBK", -est.deductions.skim));
    tb.appendChild(row("Jumlah potongan (pekerja)", -est.totalDeduct));
    tb.appendChild(row("Anggaran bersih", est.net, "salary-net"));

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
    strong.textContent = "Side income (bukan gaji)";
    hd.appendChild(strong);
    h.appendChild(hd);
    stb.appendChild(h);
    stb.appendChild(row("Susun (" + side.susun + " AWB × RM100)", side.susunRm));
    stb.appendChild(row("Pallets (" + side.pallets + " AWB × RM50)", side.palletsRm));
    stb.appendChild(row("Jumlah side income", side.total, "salary-side-total"));
    sideTable.appendChild(stb);
    container.appendChild(sideTable);

    var note = document.createElement("p");
    note.className = "salary-note";
    note.textContent = "EPF = ceil(% × bracket↑RM20) atas (pokok+KLIA−UPL), OT tak masuk asas EPF. " +
      "Rehat Ahad/cuti: " + (est.settings.restBreakHours || 0) + " jam. Side income tidak dalam gaji.";
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
    var er = prompt("Kadar EPF pekerja (0.11 = 11%):", s.epfEmployeeRate);
    if (er !== null) s.epfEmployeeRate = parseFloat(er) || 0.11;
    var em = prompt("Kadar EPF majikan (0.13 = 13%):", s.epfEmployerRate);
    if (em !== null) s.epfEmployerRate = parseFloat(em) || 0.13;
    var so = prompt("SOCSO (RM tetap):", s.socso != null ? s.socso : 23.75);
    if (so !== null) s.socso = parseFloat(so) || 0;
    var ei = prompt("EIS (RM tetap):", s.eis != null ? s.eis : 9.50);
    if (ei !== null) s.eis = parseFloat(ei) || 0;
    var sk = prompt("Skim SKBBK (RM):", s.skim != null ? s.skim : 35.65);
    if (sk !== null) s.skim = parseFloat(sk) || 0;
    var br = prompt("Potong rehat Ahad/cuti (jam, 0=tiada):", s.restBreakHours != null ? s.restBreakHours : 0);
    if (br !== null) s.restBreakHours = parseFloat(br) || 0;
    s.phMult = s.phMult || 2.0;
    s.uplDivisor = s.uplDivisor || 30;
    s._v = 64;
    saveSettings(s);
    if (typeof showToast === "function") showToast("Tetapan gaji disimpan");
    refresh();
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
    var orig = window.updateReport;
    if (typeof orig === "function") {
      window.updateReport = function () {
        orig.apply(this, arguments);
        refresh();
      };
    }
    try { runUnitTest(); } catch (e) { console.warn(e); }
  });

  window.RezaOT_salary = {
    estimate: estimate,
    render: render,
    loadSettings: loadSettings,
    refresh: refresh,
    calcEpf: calcEpf,
    epfBracket: epfBracket,
    runUnitTest: runUnitTest
  };
})();
