// Deterministic workspace startup. Required modules load once, in dependency order.
(function () {
  "use strict";
  var release = window.REZAOT_RELEASE;
  var loads = Object.create(null);
  function loadScript(path, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    if (loads[path]) return loads[path];
    loads[path] = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = path + "?v=" + release.version;
      script.async = false;
      script.onload = function () {
        if (globalName && !window[globalName]) reject(new Error("Library failed to initialize: " + path));
        else resolve(globalName ? window[globalName] : undefined);
      };
      script.onerror = function () { script.remove(); reject(new Error("Failed to load: " + path)); };
      document.head.appendChild(script);
    }).catch(function (err) { delete loads[path]; throw err; });
    return loads[path];
  }
  window.loadExcelLib = function () { return loadScript("vendor/xlsx.full.min.js", "XLSX"); };
  window.loadPdfLib = function () { return loadScript("vendor/html2pdf.bundle.min.js", "html2pdf"); };
  window.loadAuthLib = function () { return loadScript("vendor/firebase-auth-compat.js").then(function () { return firebase.auth; }); };
  window.loadExportLibs = function () { return Promise.all([window.loadExcelLib(), window.loadPdfLib()]); };
  function showBootError(err) {
    console.error("RezaOT startup:", err);
    document.body.setAttribute("data-startup", "failed");
    var panel = document.getElementById("startupStatus");
    if (panel) {
      panel.hidden = false;
      panel.replaceChildren(document.createTextNode("App gagal dimuatkan. Data lokal dikekalkan. / App could not start. Local data is preserved. "));
      var retry = document.createElement("button");
      retry.type = "button"; retry.textContent = "Muat semula / Reload";
      retry.addEventListener("click", function () { location.reload(); });
      panel.appendChild(retry);
    }
  }
  function registerWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(function (reg) {
      function offerUpdate() {
        if (!reg.waiting || !navigator.serviceWorker.controller) return;
        var button = document.getElementById("updateAppBtn");
        if (!button) return;
        button.hidden = false;
        button.onclick = function () { reg.waiting.postMessage({ type: "SKIP_WAITING" }); };
      }
      offerUpdate();
      reg.addEventListener("updatefound", function () {
        var worker = reg.installing;
        if (worker) worker.addEventListener("statechange", offerUpdate);
      });
    }).catch(function (err) { console.warn("Offline cache unavailable:", err); });
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (hadController) location.reload();
      hadController = true;
    });
  }
  async function boot() {
    if (window.__rezaotMainBooting) return;
    window.__rezaotMainBooting = true;
    var errors = [];
    function onError(event) { errors.push(event.error || new Error(event.message)); }
    window.addEventListener("error", onError);
    try {
      if (!release) throw new Error("Release manifest missing");
      if (!window.RezaOT_theme) throw new Error("Theme module missing");
      for (var path of release.scripts) await loadScript(path);
      rezaotInitApp();
      document.dispatchEvent(new Event("rezaot-ready"));
      if (!window.__rezaotInited || errors.length) throw errors[0] || new Error("Application initialization incomplete");
      window.__rezaotScriptsLoaded = true;
      document.body.setAttribute("data-startup", "ready");
      var panel = document.getElementById("startupStatus");
      if (panel) panel.hidden = true;
      if (window.RezaOT_i18n) RezaOT_i18n.apply();
      registerWorker();
    } catch (err) { showBootError(err); }
    finally { window.removeEventListener("error", onError); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
