// app-v42-overlay.js — filters, copy yesterday, modal wrappers
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
        var yday =
          d.getFullYear() +
          "-" +
          String(d.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(d.getDate()).padStart(2, "0");
        var src = dailyRecords[yday];
        if (!src || !Array.isArray(src.trips) || !src.trips.length) {
          showToast(tt("toastDupNone", "Tiada trip semalam"));
          return;
        }
        if (!dailyRecords[today]) dailyRecords[today] = { clock_in: "", clock_out: "", trips: [] };
        if (!Array.isArray(dailyRecords[today].trips)) dailyRecords[today].trips = [];
        src.trips.forEach(function (x) {
          dailyRecords[today].trips.push(String(x));
        });
        if (!dailyRecords[today].clock_in && src.clock_in) dailyRecords[today].clock_in = src.clock_in;
        if (!dailyRecords[today].clock_out && src.clock_out) dailyRecords[today].clock_out = src.clock_out;
        saveToLocalStorage();
        updateReport();
        showToast(tt("toastDupOk", "Trip semalam disalin") + " (" + src.trips.length + ")");
      });
    }
  }

  function wrapDialogs() {
    if (window.__v42Dialogs) return;
    window.__v42Dialogs = true;
    if (typeof deleteRecord === "function" && !deleteRecord._v42) {
      window.deleteRecord = function (date) {
        var rec = dailyRecords[date];
        var n = rec && Array.isArray(rec.trips) ? rec.trips.length : 0;
        var msg =
          tt("confirmDelRec", "Padam rekod ini?") +
          "\n" +
          date +
          "\nTrip: " +
          n +
          " · In: " +
          ((rec && rec.clock_in) || "-") +
          " · Out: " +
          ((rec && rec.clock_out) || "-");
        if (typeof rezaotConfirm === "function") {
          rezaotConfirm(msg).then(function (ok) {
            if (!ok) return;
            delete dailyRecords[date];
            saveToLocalStorage();
            updateReport();
            showToast(tt("toastRecDel", "Rekod dipadam"));
          });
          return;
        }
        if (!confirm(msg)) return;
        delete dailyRecords[date];
        saveToLocalStorage();
        updateReport();
        showToast(tt("toastRecDel", "Rekod dipadam"));
      };
      window.deleteRecord._v42 = true;
    }
    if (typeof deleteTrip === "function" && !deleteTrip._v42) {
      window.deleteTrip = function (date, tripIndex) {
        var rec = dailyRecords[date];
        if (!rec || !Array.isArray(rec.trips) || !rec.trips[tripIndex]) return;
        var name = String(rec.trips[tripIndex]);
        var msg = tt("confirmDelTrip", "Padam trip ini?") + "\n" + date + '\n"' + name + '"';
        if (typeof rezaotConfirm === "function") {
          rezaotConfirm(msg).then(function (ok) {
            if (!ok) return;
            rec.trips.splice(tripIndex, 1);
            saveToLocalStorage();
            updateReport();
            showToast(tt("toastTripDel", "Trip dipadam"));
          });
          return;
        }
        if (!confirm(msg)) return;
        rec.trips.splice(tripIndex, 1);
        saveToLocalStorage();
        updateReport();
        showToast(tt("toastTripDel", "Trip dipadam"));
      };
      window.deleteTrip._v42 = true;
    }
    if (typeof editSupervisorName === "function" && !editSupervisorName._v42) {
      window.editSupervisorName = function () {
        var el = document.getElementById("supervisorName");
        if (!el) return;
        if (typeof rezaotPrompt === "function") {
          rezaotPrompt(tt("promptSup", "Nama ketua:"), el.textContent.trim() || "Talib").then(function (next) {
            if (next === null) return;
            var name = String(next).trim() || "Talib";
            el.textContent = name;
            localStorage.setItem("supervisorName", name);
            showToast(tt("toastSupSaved", "Nama ketua dikemaskini"));
          });
          return;
        }
        var next = prompt(tt("promptSup", "Nama ketua:"), el.textContent.trim() || "Talib");
        if (next === null) return;
        var name = String(next).trim() || "Talib";
        el.textContent = name;
        localStorage.setItem("supervisorName", name);
        showToast(tt("toastSupSaved", "Nama ketua dikemaskini"));
      };
      window.editSupervisorName._v42 = true;
    }
  }

  function boot() {
    wireFilters();
    wrapDialogs();
  }
  document.addEventListener("rezaot-ready", function () {
    setTimeout(boot, 50);
  });
  if (document.readyState !== "loading") setTimeout(boot, 800);
})();
