// salary-patch-v27.js — enhance salary panel after salary-estimator.js
(function () {
  "use strict";
  function money(n) {
    return Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function enhanceRender() {
    if (typeof window.RezaOT_salary === "undefined" || !window.RezaOT_salary.render) return false;
    if (window.RezaOT_salary.render._patched) return true;
    var orig = window.RezaOT_salary.render;
    window.RezaOT_salary.render = function () {
      orig();
      var body = document.getElementById("salaryPanelBody");
      if (!body) return;
      // Auto UPL count
      var unpaidInput = document.getElementById("salaryUnpaidDays");
      var autoUpl = 0;
      if (typeof dailyRecords !== "undefined") {
        Object.keys(dailyRecords).forEach(function (d) {
          if (dailyRecords[d] && dailyRecords[d].unpaid) autoUpl += 1;
        });
      }
      if (unpaidInput && autoUpl > 0 && (!unpaidInput.value || unpaidInput.value === "0")) {
        unpaidInput.value = autoUpl;
      }
      // Payslip compare block
      if (document.getElementById("payslipOtInput")) return;
      var est = window.RezaOT_salary.estimate(
        typeof dailyRecords !== "undefined" ? dailyRecords : {},
        { unpaidDays: unpaidInput ? Number(unpaidInput.value) || 0 : 0 }
      );
      var cmp = document.createElement("div");
      cmp.className = "salary-compare";
      var label = document.createElement("label");
      label.textContent = "OT payslip (RM): ";
      var input = document.createElement("input");
      input.type = "number";
      input.step = "0.01";
      input.id = "payslipOtInput";
      input.value = localStorage.getItem("payslipOt_" + (typeof currentMonthKey !== "undefined" ? currentMonthKey : "")) || "";
      label.appendChild(input);
      cmp.appendChild(label);
      var out = document.createElement("p");
      out.className = "salary-diff";
      function upd() {
        localStorage.setItem("payslipOt_" + (typeof currentMonthKey !== "undefined" ? currentMonthKey : ""), input.value || "");
        if (!input.value) { out.textContent = ""; return; }
        var appOt = est.earnings.normalOT + est.earnings.restOT + est.earnings.holidayOT;
        var diff = Math.round((appOt - Number(input.value)) * 100) / 100;
        out.textContent = "App OT RM " + money(appOt) + " vs payslip → beza RM " + money(diff) +
          (diff > 0 ? " (app lebih)" : diff < 0 ? " (payslip lebih)" : " (sama)");
      }
      input.addEventListener("input", upd);
      cmp.appendChild(out);
      body.appendChild(cmp);
      upd();
      // Relabel OT rows if present
      var rows = body.querySelectorAll(".salary-table tr");
      rows.forEach(function (tr) {
        var td = tr.querySelector("td");
        if (!td) return;
        if (td.textContent === "OT biasa (×1.5)") {
          td.textContent = "OT biasa " + est.bd.normal + "j × RM" + money(est.hourly) + " × 1.5";
        } else if (td.textContent === "OT hari rehat") {
          td.textContent = "OT hari rehat " + est.bd.rest + "j";
        } else if (td.textContent === "OT cuti umum") {
          td.textContent = "OT cuti " + est.bd.holiday + "j × 3.0";
        }
      });
    };
    window.RezaOT_salary.render._patched = true;
    return true;
  }
  function tryPatch(n) {
    if (enhanceRender()) return;
    if (n < 10) setTimeout(function () { tryPatch(n + 1); }, 400);
  }
  tryPatch(0);
})();
