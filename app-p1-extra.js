// app-p1-extra.js — v51: load feature patches + print landscape dense
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
    "app-v42-overlay.js?v=51",
    "side-job-patch.js?v=51",
    "sync-fix-v48.js?v=51",
    "month-fix.js?v=51",
    "print-fix-v51.js?v=51"
  ].reduce(function (p, src) {
    return p.then(function () { return load(src); });
  }, Promise.resolve());
})();
