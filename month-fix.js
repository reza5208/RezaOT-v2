// month-fix.js — pastikan tukar bulan tarik cloud penuh
(function () {
  function wrap() {
    if (typeof handleMonthChange !== "function" || handleMonthChange._v35) return false;
    var orig = handleMonthChange;
    window.handleMonthChange = function () {
      orig.apply(this, arguments);
      if (typeof lastLocalSaveAt !== "undefined") lastLocalSaveAt = 0;
      if (typeof startFirebaseListener === "function" && currentMonthKey) {
        startFirebaseListener();
      }
    };
    window.handleMonthChange._v35 = true;
    return true;
  }
  function tryW(n) {
    if (wrap()) return;
    if (n < 20) setTimeout(function () { tryW(n + 1); }, 200);
  }
  document.addEventListener("rezaot-ready", function () { tryW(0); });
  tryW(0);
})();
