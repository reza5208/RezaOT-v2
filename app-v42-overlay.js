// app-v42-overlay.js — filters + copy yesterday trips
(function () {
  "use strict";
  function tt(k, f) {
    if (window.RezaOT_i18n && RezaOT_i18n.t) {
      var v = RezaOT_i18n.t(k);
      if (v && v !== k) return v;
    }
    return f || k;
  }

  function wireFilters() {
    document.querySelectorAll(".filter-chip").forEach(function (btn) {
      if (btn._v42) return;
      btn._v42 = true;
      btn.addEventListener("click", function () {
        var mode = btn.getAttribute("data-filter") || "all";
        window.__tableFilter = mode;
        document.querySelectorAll(".filter-chip").forEach(function (b) {
          b.classList.toggle("active", b.getAttribute("data-filter") === mode);
        });
        document.querySelectorAll("#reportTable tbody tr").forEach(function (tr) {
          var show = true;
          if (mode === "ot") show = parseFloat((tr.querySelector("td:nth-child(6)") || {}).textContent || "0") > 0;
          else if (mode === "klia") show = /klia cargo/i.test(tr.textContent || "");
          else if (mode === "upl") show = tr.classList.contains("upl-row");
          tr.style.display = show ? "" : "none";
        });
      });
    });
    var dup = document.getElementById("dupYesterdayBtn");
    if (dup && !dup._v42) {
      dup._v42 = true;
      dup.addEventListener("click", function () {
        var dateInput = document.getElementById("date");
        if (!dateInput || !dateInput.value) {
          showToast(tt("toastPickDate", "Sila pilih tarikh dahulu."));
          return;
        }
        var today = dateInput.value;
        var d = new Date(today + "T00:00:00");
        d.setDate(d.getDate() - 1);
        var yday = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        var src = dailyRecords[yday];
        if (!src || !Array.isArray(src.trips) || !src.trips.length) {
          showToast(tt("toastDupNone", "Tiada trip semalam"));
          return;
        }
        if (!dailyRecords[today]) dailyRecords[today] = { clock_in: "", clock_out: "", trips: [] };
        if (!Array.isArray(dailyRecords[today].trips)) dailyRecords[today].trips = [];
        src.trips.forEach(function (x) { dailyRecords[today].trips.push(String(x)); });
        if (!dailyRecords[today].clock_in && src.clock_in) dailyRecords[today].clock_in = src.clock_in;
        if (!dailyRecords[today].clock_out && src.clock_out) dailyRecords[today].clock_out = src.clock_out;
        saveToLocalStorage();
        updateReport();
        showToast(tt("toastDupOk", "Trip semalam disalin") + " (" + src.trips.length + ")");
      });
    }
  }

  function boot() { wireFilters(); }
  document.addEventListener("rezaot-ready", boot);
  if (document.readyState !== "loading") setTimeout(boot, 600);
})();
