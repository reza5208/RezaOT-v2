// ot-total-patch.js — baris JUMLAH OT bold dalam table (v56)
(function () {
  "use strict";

  function injectCss() {
    if (document.getElementById("ot-total-css")) return;
    var st = document.createElement("style");
    st.id = "ot-total-css";
    st.textContent =
      "#reportTable tr.ot-total-row td{font-weight:700!important;border-top:2px solid #333!important;background:#f0f0f0!important;padding-top:8px!important;padding-bottom:8px!important;}" +
      "#reportTable tr.ot-total-row td strong{font-weight:800!important;font-size:1.05em;}" +
      "body.dark-mode #reportTable tr.ot-total-row td{background:#2a2a2a!important;border-top-color:#888!important;}" +
      "@media print{#reportTable tr.ot-total-row td{background:#eee!important;border-top:2px solid #000!important;font-weight:700!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}" +
      "body.pdf-export #reportTable tr.ot-total-row td{background:#eee!important;border-top:2px solid #000!important;font-weight:700!important;}";
    document.head.appendChild(st);
  }

  function appendTotalRow() {
    var tbody = document.querySelector("#reportTable tbody");
    if (!tbody) return;
    var old = tbody.querySelector("tr.ot-total-row");
    if (old) old.remove();

    var total = 0;
    if (window.dailyRecords) {
      Object.keys(dailyRecords).forEach(function (date) {
        var rec = dailyRecords[date];
        if (!rec) return;
        var ot = typeof calculateOT === "function"
          ? calculateOT(rec.clock_in, rec.clock_out, date, rec.trips || [])
          : 0;
        if (rec.unpaid) ot = 0;
        total += ot;
      });
    }

    var tr = document.createElement("tr");
    tr.className = "ot-total-row";
    var tdLabel = document.createElement("td");
    tdLabel.colSpan = 5;
    tdLabel.style.textAlign = "right";
    tdLabel.style.fontWeight = "700";
    tdLabel.textContent = (window.RezaOT_i18n && RezaOT_i18n.t("totalOTRow")) || "JUMLAH OT";
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

  function patch() {
    if (window.__otTotal56) return;
    if (typeof updateReport !== "function") return;
    window.__otTotal56 = true;
    var orig = updateReport;
    window.updateReport = function () {
      orig.apply(this, arguments);
      appendTotalRow();
    };
    appendTotalRow();
  }

  injectCss();
  document.addEventListener("rezaot-ready", function () { setTimeout(patch, 250); });
  if (document.readyState !== "loading") setTimeout(patch, 1400);
})();
