// p0-critical-fix.js — P0 safety nets (v62)
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

  function wireUpl() {
    var upl = document.getElementById("unpaidLeaveCheck");
    var cin = document.getElementById("clockIn");
    var cout = document.getElementById("clockOut");
    if (!upl || upl.__p0) return;
    upl.__p0 = true;
    function sync() {
      var on = !!upl.checked;
      if (cin) cin.required = !on;
      if (cout) cout.required = !on;
    }
    upl.addEventListener("change", sync);
    sync();
  }

  document.addEventListener("rezaot-ready", function () {
    setTimeout(function () {
      forceTiadaDefault();
      wireUpl();
    }, 300);
  });
  if (document.readyState !== "loading") {
    setTimeout(function () {
      forceTiadaDefault();
      wireUpl();
    }, 1500);
  }
})();
