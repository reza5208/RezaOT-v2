// sync-fix.js — multi-device last-write-wins + settings sync (v32)
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

  function installBetterSync() {
    if (typeof db === "undefined" || typeof getFirebasePath !== "function") return false;
    if (window.__syncFix32) return true;
    window.__syncFix32 = true;

    window.startFirebaseListener = function () {
      if (typeof stopFirebaseListener === "function") stopFirebaseListener();
      if (!currentMonthKey) return;
      var path = getFirebasePath();
      firebaseRef = db.ref(path);
      setSyncStatus("syncing");
      firebaseRef.on("value", function (snap) {
        firebaseReady = true;
        var data = snap.val();
        if (!data) {
          var localCount = Object.keys(dailyRecords || {}).length;
          if (localCount > 0) setTimeout(function () { saveToFirebase(); }, 200);
          setSyncStatus("online");
          return;
        }
        var remoteTs = data.lastUpdated ? Date.parse(data.lastUpdated) : 0;
        if (data.deviceId && data.deviceId === getDeviceId() && Date.now() - lastLocalSaveAt < 2500) {
          setSyncStatus("online");
          return;
        }
        if (remoteTs && lastLocalSaveAt && remoteTs < lastLocalSaveAt - 800) {
          setSyncStatus("online");
          return;
        }
        syncingFromFirebase = true;
        try {
          var remoteRecords = (data.dailyRecords && typeof data.dailyRecords === "object")
            ? data.dailyRecords : {};
          var remoteCount = Object.keys(remoteRecords).length;
          var localCount = Object.keys(dailyRecords || {}).length;

          if (remoteCount === 0 && localCount > 0) {
            setTimeout(function () { syncingFromFirebase = false; saveToFirebase(); }, 300);
            setSyncStatus("online");
            return;
          }

          if (remoteCount > 0) {
            var merged = Object.assign({}, dailyRecords);
            Object.keys(remoteRecords).forEach(function (date) {
              merged[date] = remoteRecords[date];
            });
            dailyRecords = merged;
          }

          if (data.trips && Array.isArray(data.trips) && data.trips.length) {
            var set = new Set([].concat(trips || [], data.trips));
            trips = Array.from(set);
          }
          persistLocalOnly();
          updateReport();
          if (typeof loadTrips === "function") loadTrips();
          setSyncStatus("online");
        } finally {
          setTimeout(function () { syncingFromFirebase = false; }, 300);
        }
      }, function (err) {
        console.error("Firebase listener error:", err);
        var msg = String(err && err.message ? err.message : err);
        if (msg.indexOf("permission") >= 0) {
          setSyncStatus("denied");
          showToast("Firebase permission denied.", 4000);
        } else setSyncStatus("offline");
        updateReport();
        if (typeof loadTrips === "function") loadTrips();
      });
      if (typeof flushOfflineQueue === "function") flushOfflineQueue();

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
    };

    wrapHolidaySave();

    lastLocalSaveAt = 0;
    if (typeof startFirebaseListener === "function" && currentMonthKey) {
      startFirebaseListener();
    }
    return true;
  }

  function tryInstall(n) {
    if (installBetterSync()) return;
    if (n < 20) setTimeout(function () { tryInstall(n + 1); }, 200);
  }

  document.addEventListener("rezaot-ready", function () {
    setTimeout(function () { tryInstall(0); }, 50);
  });
  tryInstall(0);
})();
