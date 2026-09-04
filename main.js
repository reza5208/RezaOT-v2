// main.js - RezaOT v30 (fast bootstrap)
(function () {
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Failed: " + src)); };
      document.head.appendChild(s);
    });
  }

  /** Load heavy export libs only when user needs them */
  window.loadExportLibs = function () {
    if (window.__exportLibsReady) return window.__exportLibsReady;
    window.__exportLibsReady = Promise.all([
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"),
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js")
    ]).catch(function (err) {
      console.warn("Export libs load error", err);
      window.__exportLibsReady = null;
      throw err;
    });
    return window.__exportLibsReady;
  };

  function boot() {
    loadScript("main-app-1.js?v=30")
      .then(function () { return loadScript("main-app-2.js?v=30"); })
      .then(function () {
        return Promise.all([
          loadScript("salary-estimator.js?v=30"),
          loadScript("app-p1.js?v=30")
        ]);
      })
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
