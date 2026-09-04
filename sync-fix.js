// sync-fix.js — settings sync only (month data in main-app-1 v34)
(function () {
  "use strict";

  function settingsPath() {
    return "users/default/settings";
  }

  function pushSettingsToCloud() {
    if (typeof db === "undefined" || !navigator.onLine) return;
    try {
      var payload = {
        observedHolidays: (typeof getObservedHolidaysMap === "function")
          ? getObservedHolidaysMap() : {},
        otSettings: (typeof getOtSettings === "function")
          ? getOtSettings() : {},
        lastUpdated: new Date().toISOString(),
        deviceId: (typeof getDeviceId === "function") ? getDeviceId() : ""
      };
      db.ref(settingsPath()).set(payload).catch(function (err) {
        console.warn("settings push failed", err);
      });
    } catch (e) {
      console.warn(e);
    }
  }

  function pullSettingsFromCloud(data) {
    if (!data) return;
    if (data.observedHolidays && typeof data.observedHolidays === "object") {
      try {
        localStorage.setItem("observedHolidays", JSON.stringify(data.observedHolidays));
      } catch (e) {}
    }
    if (data.otSettings && typeof data.otSettings === "object") {
      try {
        localStorage.setItem("otSettings", JSON.stringify(data.otSettings));
      } catch (e) {}
    }
    if (typeof updateHolidayBadge === "function") updateHolidayBadge();
    if (typeof updateReport === "function") updateReport();
  }

  function wrapHolidaySave() {
    if (typeof setHolidayObserved === "function" && !setHolidayObserved._sync32) {
      var orig = setHolidayObserved;
      window.setHolidayObserved = function (dateStr, observed) {
        orig(dateStr, observed);
        window.__settingsLocalAt = Date.now();
        pushSettingsToCloud();
      };
      window.setHolidayObserved._sync32 = true;
    }
    if (typeof saveObservedHolidaysMap === "function" && !saveObservedHolidaysMap._sync32) {
      var origSave = saveObservedHolidaysMap;
      window.saveObservedHolidaysMap = function (map) {
        origSave(map);
        window.__settingsLocalAt = Date.now();
        clearTimeout(window.__settingsPushT);
        window.__settingsPushT = setTimeout(pushSettingsToCloud, 400);
      };
      window.saveObservedHolidaysMap._sync32 = true;
    }
  }

  function install() {
    if (typeof db === "undefined") return false;
    if (window.__syncFix34) return true;
    window.__syncFix34 = true;
    wrapHolidaySave();
    if (!window.__settingsListener32) {
      window.__settingsListener32 = true;
      db.ref(settingsPath()).on("value", function (snap) {
        var s = snap.val();
        if (!s) {
          window.__settingsLocalAt = Date.now();
          pushSettingsToCloud();
          return;
        }
        if (s.deviceId && typeof getDeviceId === "function" &&
            s.deviceId === getDeviceId() &&
            Date.now() - (window.__settingsLocalAt || 0) < 2500) {
          return;
        }
        pullSettingsFromCloud(s);
      }, function (err) {
        console.warn("settings listener", err);
      });
    }
    return true;
  }

  function tryInstall(n) {
    if (install()) return;
    if (n < 20) setTimeout(function () { tryInstall(n + 1); }, 200);
  }
  document.addEventListener("rezaot-ready", function () {
    setTimeout(function () { tryInstall(0); }, 50);
  });
  tryInstall(0);
})();
