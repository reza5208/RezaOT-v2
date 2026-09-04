// sync-fix.js v34b — force full-replace delete sync + settings
(function () {
  "use strict";

  function settingsPath() { return "users/default/settings"; }

  function pushSettingsToCloud() {
    if (typeof db === "undefined" || !navigator.onLine) return;
    try {
      db.ref(settingsPath()).set({
        observedHolidays: (typeof getObservedHolidaysMap === "function") ? getObservedHolidaysMap() : {},
        otSettings: (typeof getOtSettings === "function") ? getOtSettings() : {},
        lastUpdated: new Date().toISOString(),
        deviceId: (typeof getDeviceId === "function") ? getDeviceId() : ""
      }).catch(function (e) { console.warn(e); });
    } catch (e) {}
  }

  function pullSettingsFromCloud(data) {
    if (!data) return;
    try {
      if (data.observedHolidays) localStorage.setItem("observedHolidays", JSON.stringify(data.observedHolidays));
      if (data.otSettings) localStorage.setItem("otSettings", JSON.stringify(data.otSettings));
    } catch (e) {}
    if (typeof updateHolidayBadge === "function") updateHolidayBadge();
    if (typeof updateReport === "function") updateReport();
  }

  function installMonthSync() {
    if (typeof db === "undefined" || typeof getFirebasePath !== "function") return false;
    if (window.__monthSync34b) return true;
    window.__monthSync34b = true;

    window.flushOfflineQueue = async function () {
      if (!navigator.onLine) return;
      var q = (typeof getOfflineQueue === "function") ? getOfflineQueue() : [];
      if (!q.length) return;
      for (var i = 0; i < q.length; i++) {
        var item = q[i];
        try {
          var snap = await db.ref(item.path).once("value");
          var remote = snap.val();
          var remoteTs = remote && remote.lastUpdated ? Date.parse(remote.lastUpdated) : 0;
          var queueTs = item.data && item.data.lastUpdated ? Date.parse(item.data.lastUpdated) : 0;
          if (remoteTs && queueTs && remoteTs > queueTs) {
            clearOfflineQueueItem(item.path);
            continue;
          }
          await db.ref(item.path).set(item.data);
          clearOfflineQueueItem(item.path);
        } catch (err) {
          console.warn("Offline queue flush failed:", err);
          setSyncStatus("offline");
          return;
        }
      }
      setSyncStatus("online");
    };

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
          if (localCount > 0 && lastLocalSaveAt && (Date.now() - lastLocalSaveAt < 8000)) {
            setTimeout(function () { saveToFirebase(); }, 200);
          } else if (localCount > 0) {
            dailyRecords = {};
            persistLocalOnly();
            updateReport();
          }
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
        // FULL REPLACE — delete ikut
        syncingFromFirebase = true;
        try {
          var remoteRecords = (data.dailyRecords && typeof data.dailyRecords === "object")
            ? data.dailyRecords : {};
          dailyRecords = Object.assign({}, remoteRecords);
          if (data.trips && Array.isArray(data.trips)) trips = data.trips.slice();
          try { clearOfflineQueueItem(path); } catch (e) {}
          persistLocalOnly();
          updateReport();
          if (typeof loadTrips === "function") loadTrips();
          setSyncStatus("online");
        } finally {
          setTimeout(function () { syncingFromFirebase = false; }, 300);
        }
      }, function (err) {
        console.error("Firebase listener error:", err);
        setSyncStatus("offline");
        updateReport();
      });
      if (typeof flushOfflineQueue === "function") flushOfflineQueue();
    };

    lastLocalSaveAt = 0;
    if (currentMonthKey) startFirebaseListener();
    return true;
  }

  function installSettings() {
    if (typeof db === "undefined") return false;
    if (window.__settings34b) return true;
    window.__settings34b = true;
    if (typeof setHolidayObserved === "function" && !setHolidayObserved._s34) {
      var o = setHolidayObserved;
      window.setHolidayObserved = function (d, v) {
        o(d, v);
        window.__settingsLocalAt = Date.now();
        pushSettingsToCloud();
      };
      window.setHolidayObserved._s34 = true;
    }
    if (typeof saveObservedHolidaysMap === "function" && !saveObservedHolidaysMap._s34) {
      var os = saveObservedHolidaysMap;
      window.saveObservedHolidaysMap = function (m) {
        os(m);
        window.__settingsLocalAt = Date.now();
        clearTimeout(window.__settingsPushT);
        window.__settingsPushT = setTimeout(pushSettingsToCloud, 400);
      };
      window.saveObservedHolidaysMap._s34 = true;
    }
    db.ref(settingsPath()).on("value", function (snap) {
      var s = snap.val();
      if (!s) { window.__settingsLocalAt = Date.now(); pushSettingsToCloud(); return; }
      if (s.deviceId && typeof getDeviceId === "function" &&
          s.deviceId === getDeviceId() && Date.now() - (window.__settingsLocalAt || 0) < 2500) return;
      pullSettingsFromCloud(s);
    });
    return true;
  }

  function boot(n) {
    var a = installMonthSync();
    var b = installSettings();
    if (a && b) return;
    if (n < 25) setTimeout(function () { boot(n + 1); }, 200);
  }
  document.addEventListener("rezaot-ready", function () { setTimeout(function () { boot(0); }, 30); });
  boot(0);
})();
