// app-p1-extra.js — v67
(function () {
  "use strict";
  function load(src) {
    return new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = function () { console.warn("Optional patch miss:", src); resolve(); };
      document.head.appendChild(s);
    });
  }
  window.__rezaotExtraReady = [
    "app-v42-overlay.js?v=67",
    "side-job-patch.js?v=67",
    "sync-fix-v48.js?v=67",
    "month-fix.js?v=67",
    "print-fix-v51.js?v=67",
    "ot-total-patch.js?v=67",
    "p0-critical-fix.js?v=67",
    "month-history-v65.js?v=67",
    "sync-cross-v66.js?v=67",
    "print-orient-v67.js?v=67"
  ].reduce(function (p, src) {
    return p.then(function () { return load(src); });
  }, Promise.resolve());
})();
