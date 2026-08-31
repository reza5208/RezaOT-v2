// main.js - RezaOT v18.1 bootstrap (loads full app in 2 parts)
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
  loadScript("main-app-1.js?v=19")
    .then(function () { return loadScript("main-app-2.js?v=19"); })
    .catch(function (err) {
      console.error(err);
      alert("Gagal load app. Hard refresh (Ctrl+Shift+R) atau clear site data.");
    });
})();
