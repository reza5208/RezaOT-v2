// Device-local appearance; old 0/1 preferences remain explicit overrides.
(function () {
  "use strict";
  if (window.RezaOT_theme) return;
  var preference = "system";
  var memoryOnly = false;
  var initialized = false;
  var media = null;

  function readPreference() {
    try {
      var saved = localStorage.getItem("darkMode");
      return saved === "1" ? "dark" : saved === "0" ? "light" : "system";
    } catch (_) { return "system"; }
  }
  function resolvedTheme() {
    return preference === "dark" || (preference === "system" && media && media.matches) ? "dark" : "light";
  }
  function apply() {
    if (!memoryOnly) preference = readPreference();
    var resolved = resolvedTheme();
    var dark = resolved === "dark";
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    if (document.body) document.body.classList.toggle("dark", dark);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#101828" : "#3157e5";
    var select = document.getElementById("themePreference");
    if (select) select.value = preference;
    if (window.RezaOT_dashboard) RezaOT_dashboard.paintTheme();
    else {
      var button = document.getElementById("darkModeBtn");
      if (button) {
        var icon = button.querySelector("use");
        if (icon) icon.setAttribute("href", dark ? "#i-sun" : "#i-moon");
        button.setAttribute("aria-pressed", String(dark));
      }
    }
  }
  function setPreference(value) {
    if (!["system", "light", "dark"].includes(value)) throw new RangeError("Invalid theme preference");
    preference = value;
    try {
      localStorage.setItem("darkMode", value === "dark" ? "1" : value === "light" ? "0" : "system");
      memoryOnly = false;
    } catch (_) { memoryOnly = true; }
    apply();
  }
  function init() {
    if (!initialized) {
      initialized = true;
      try { media = window.matchMedia("(prefers-color-scheme: dark)"); } catch (_) {}
      if (media) {
        var changed = function () { if (preference === "system") apply(); };
        if (media.addEventListener) media.addEventListener("change", changed);
        else if (media.addListener) media.addListener(changed);
      }
      window.addEventListener("storage", function (event) {
        if (event.key === "darkMode" || event.key === null) {
          memoryOnly = false;
          apply();
        }
      });
    }
    var select = document.getElementById("themePreference");
    if (select && !select.__rezaotThemeBound) {
      select.__rezaotThemeBound = true;
      select.addEventListener("change", function () { setPreference(select.value); });
    }
    apply();
  }
  window.RezaOT_theme = {
    getPreference: function () { return preference; },
    getResolvedTheme: resolvedTheme,
    setPreference: setPreference,
    toggle: function () { setPreference(resolvedTheme() === "dark" ? "light" : "dark"); },
    init: init,
    apply: apply
  };
  init();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
})();
