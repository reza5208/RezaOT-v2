// app-v42-overlay.js — modal wrappers only (filters/dup removed)
(function () {
  "use strict";

  function tt(k, f) {
    if (window.RezaOT_i18n && RezaOT_i18n.t) {
      var v = RezaOT_i18n.t(k);
      if (v && v !== k) return v;
    }
    return f || k;
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
    wrapDialogs();
  }
  document.addEventListener("rezaot-ready", function () {
    setTimeout(boot, 50);
  });
  if (document.readyState !== "loading") setTimeout(boot, 800);
})();
