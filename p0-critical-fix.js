// p0-critical-fix.js — P0 safety nets (v64)
(function () {
  "use strict";

  if (typeof calculateOT === "function" && !window.__p0OtEqual) {
    window.__p0OtEqual = true;
    var _ot = calculateOT;
    window.calculateOT = function (clockIn, clockOut, date, recordTrips) {
      if (clockIn && clockOut && String(clockIn) === String(clockOut)) return 0;
      return _ot.apply(this, arguments);
    };
  }

  function forceTiadaDefault() {
    document.querySelectorAll('input[name="sideJob"]').forEach(function (r) {
      r.checked = (r.value === "");
    });
  }

  function wireUplAnn() {
    var upl = document.getElementById("unpaidLeaveCheck");
    var ann = document.getElementById("annualLeaveCheck");
    var cin = document.getElementById("clockIn");
    var cout = document.getElementById("clockOut");
    function syncRequired() {
      var leave = !!(upl && upl.checked) || !!(ann && ann.checked);
      if (cin) cin.required = !leave;
      if (cout) cout.required = !leave;
    }
    if (upl && !upl.__p0) {
      upl.__p0 = true;
      upl.addEventListener("change", function () {
        if (upl.checked && ann) ann.checked = false;
        syncRequired();
      });
    }
    if (ann && !ann.__p0) {
      ann.__p0 = true;
      ann.addEventListener("change", function () {
        if (ann.checked && upl) upl.checked = false;
        syncRequired();
      });
    }
    syncRequired();
  }

  function patchClockSave() {
    if (window.__p0AnnClock || typeof handleClockFormSubmit !== "function") return;
    window.__p0AnnClock = true;
    var orig = handleClockFormSubmit;
    window.handleClockFormSubmit = function (e) {
      orig.apply(this, arguments);
      try {
        var date = document.getElementById("date") && document.getElementById("date").value;
        if (!date || !window.dailyRecords || !dailyRecords[date]) return;
        var ann = document.getElementById("annualLeaveCheck");
        if (ann) {
          dailyRecords[date].annual = !!ann.checked;
          if (dailyRecords[date].annual) dailyRecords[date].unpaid = false;
          if (typeof saveToLocalStorage === "function") saveToLocalStorage();
          if (typeof updateReport === "function") updateReport();
        }
      } catch (err) {}
    };
    var form = document.getElementById("clockForm");
    if (form) {
      try { form.removeEventListener("submit", orig); } catch (e) {}
      form.addEventListener("submit", window.handleClockFormSubmit);
    }
  }

  document.addEventListener("rezaot-ready", function () {
    setTimeout(function () {
      forceTiadaDefault();
      wireUplAnn();
      patchClockSave();
    }, 300);
  });
  if (document.readyState !== "loading") {
    setTimeout(function () {
      forceTiadaDefault();
      wireUplAnn();
    }, 1500);
  }
})();
