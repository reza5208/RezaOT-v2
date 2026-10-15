// app-p1-extra.js — v65
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
    "app-v42-overlay.js?v=65",
    "side-job-patch.js?v=65",
    "sync-fix-v48.js?v=65",
    "month-fix.js?v=65",
    "print-fix-v51.js?v=65",
    "ot-total-patch.js?v=65",
    "p0-critical-fix.js?v=65",
    "month-history-v65.js?v=65"
  ].reduce(function (p, src) {
    return p.then(function () { return load(src); });
  }, Promise.resolve());
})();
