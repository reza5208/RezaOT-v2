// main.js - RezaOT v18.1 (runtime bootstrap)
// Full logic loaded from main-app.js to avoid accidental truncation on push.
(function () {
  var s = document.createElement("script");
  s.src = "main-app.js?v=19";
  s.onerror = function () {
    console.error("Failed to load main-app.js");
    alert("Gagal load main-app.js — hard refresh atau clear cache.");
  };
  document.head.appendChild(s);
})();
