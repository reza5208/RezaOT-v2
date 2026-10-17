// app-p1-extra.js — v68
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
    "app-v42-overlay.js?v=68",
    "side-job-patch.js?v=68",
    "sync-fix-v48.js?v=68",
    "month-fix.js?v=68",
    "print-fix-v51.js?v=68",
    "ot-total-patch.js?v=68",
    "p0-critical-fix.js?v=68",
    "month-history-v65.js?v=68",
    "sync-cross-v66.js?v=68",
    "print-orient-v67.js?v=68"
  ].reduce(function (p, src) {
    return p.then(function () { return load(src); });
  }, Promise.resolve());
})();
