// ot-total-patch.js — JUMLAH OT print/PDF only, bold, nilai betul (v58)
(function () {
  "use strict";

  function injectCss() {
    if (document.getElementById("ot-total-css")) return;
    var st = document.createElement("style");
    st.id = "ot-total-css";
    st.textContent =
      "#reportTable tr.ot-total-row{display:none!important;}" +
      "@media print{#reportTable tr.ot-total-row{display:table-row!important;}" +
      "#reportTable tr.ot-total-row td{font-weight:700!important;border-top:2px solid #000!important;background:#eee!important;padding-top:6px!important;padding-bottom:6px!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
      "#reportTable tr.ot-total-row td strong{font-weight:800!important;}}" +
      "body.pdf-export #reportTable tr.ot-total-row{display:table-row!important;}" +
      "body.pdf-export #reportTable tr.ot-total-row td{font-weight:700!important;border-top:2px solid #000!important;background:#eee!important;padding-top:6px!important;padding-bottom:6px!important;}" +
      "body.pdf-export #reportTable tr.ot-total-row td strong{font-weight:800!important;}";
    document.head.appendChild(st);
  }

  function totalLabel() {
    var lang = (localStorage.getItem("rezaot_lang") || "ms").toLowerCase();
    if (window.RezaOT_i18n && typeof RezaOT_i18n.t === "function") {
      var t = RezaOT_i18n.t("totalOTRow");
      if (t && t !== "totalOTRow") return t;
    }
    return lang === "en" ? "TOTAL OT" : "JUMLAH OT";
  }

  function computeTotalOT() {
    const records = typeof dailyRecords !== "undefined" ? dailyRecords : {};
    return Object.keys(records).reduce(function (total, date) {
      return total + RezaOT_recordOT(date, records[date]);
    }, 0);
  }

  function appendTotalRow() {
    var tbody = document.querySelector("#reportTable tbody");
    if (!tbody) return;
    var old = tbody.querySelector("tr.ot-total-row");
    if (old) old.remove();

    var dataRows = tbody.querySelectorAll("tr:not(.ot-total-row)");
    if (!dataRows.length) return;

    var total = computeTotalOT();

    var tr = document.createElement("tr");
    tr.className = "ot-total-row";
    var tdLabel = document.createElement("td");
    tdLabel.colSpan = 5;
    tdLabel.style.textAlign = "right";
    tdLabel.style.fontWeight = "700";
    tdLabel.textContent = totalLabel();
    var tdOT = document.createElement("td");
    tdOT.style.fontWeight = "700";
    var strong = document.createElement("strong");
    strong.textContent = total.toFixed(2);
    tdOT.appendChild(strong);
    var tdS1 = document.createElement("td");
    tdS1.className = "print-only";
    var tdS2 = document.createElement("td");
    tdS2.className = "print-only";
    var tdAct = document.createElement("td");
    tdAct.className = "no-print";
    [tdLabel, tdOT, tdS1, tdS2, tdAct].forEach(function (td) { tr.appendChild(td); });
    tbody.appendChild(tr);
  }

  document.addEventListener("rezaot-ready", function () {
    injectCss();
    appendTotalRow();
  });
  document.addEventListener("rezaot-report", appendTotalRow);
})();
