// main.js - RezaOT v29 (P1 cleaned)
(function () {
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Failed: " + src)); };
      document.head.appendChild(s);
    });
  }
  function boot() {
    loadScript("main-app-1.js?v=29")
      .then(function () { return loadScript("main-app-2.js?v=29"); })
      .then(function () { return loadScript("salary-estimator.js?v=29"); })
      .then(function () { return loadScript("app-p1.js?v=29"); })
      .then(function () {
        document.dispatchEvent(new Event("DOMContentLoaded"));
      })
      .catch(function (err) {
        console.error(err);
        alert("Gagal load app. Hard refresh (Ctrl+Shift+R).");
      });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
