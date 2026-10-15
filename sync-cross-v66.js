// sync-cross-v66.js — full cross-device cloud sync (never wipe local)
(function () {
  "use strict";

  var TRIPS_PATH = "users/default/_meta/trips";
  var SETTINGS_PATH = "users/default/settings";

  function parseTs(v) {
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string") {
      var n = Date.parse(v);
      return isFinite(n) ? n : 0;
    }
    return 0;
  }

  function pushTrips() {
    if (typeof db === "undefined" || !navigator.onLine) return;
    if (typeof trips === "undefined" || !Array.isArray(trips)) return;
    try {
      db.ref(TRIPS_PATH).set({
        list: trips,
        lastUpdated: new Date().toISOString(),
        deviceId: typeof getDeviceId === "function" ? getDeviceId() : ""
      }).catch(function () {});
    } catch (e) {}
  }

  function pullTripsOnce() {
    if (typeof db === "undefined") return;
    try {
      db.ref(TRIPS_PATH).once("value").then(function (snap) {
        var v = snap.val();
        if (v && Array.isArray(v.list) && v.list.length) {
          trips = v.list.slice();
          try { localStorage.setItem("trips", JSON.stringify(trips)); } catch (e) {}
          if (typeof loadTrips === "function") loadTrips();
        } else if (Array.isArray(trips) && trips.length) {
          pushTrips();
        }
      }).catch(function () {});
    } catch (e) {}
  }

  function pushAllSettings() {
    if (typeof db === "undefined" || !navigator.onLine) return;
    window.__settingsLocalAt = Date.now();
    var payload = {
      observedHolidays: (typeof getObservedHolidaysMap === "function") ? getObservedHolidaysMap() : {},
      otSettings: (typeof getOtSettings === "function") ? getOtSettings() : {},
      supervisorName: localStorage.getItem("supervisorName") || "Talib",
      lastUpdated: new Date().toISOString(),
      deviceId: typeof getDeviceId === "function" ? getDeviceId() : ""
    };
    try {
      var sal = localStorage.getItem("salarySettings");
      if (sal) payload.salarySettings = JSON.parse(sal);
    } catch (e) {}
    try {
      db.ref(SETTINGS_PATH).set(payload).catch(function () {});
    } catch (e) {}
  }

  function applySettings(s) {
    if (!s) return;
    try {
      if (s.observedHolidays) localStorage.setItem("observedHolidays", JSON.stringify(s.observedHolidays));
      if (s.otSettings) localStorage.setItem("otSettings", JSON.stringify(s.otSettings));
      if (s.salarySettings) localStorage.setItem("salarySettings", JSON.stringify(s.salarySettings));
      if (s.supervisorName) {
        localStorage.setItem("supervisorName", s.supervisorName);
        var el = document.getElementById("supervisorName");
        if (el) el.textContent = s.supervisorName;
      }
    } catch (e) {}
    if (typeof updateHolidayBadge === "function") updateHolidayBadge();
    if (typeof updateReport === "function") updateReport();
    if (window.RezaOT_salary && typeof RezaOT_salary.refresh === "function") {
      try { RezaOT_salary.refresh(); } catch (e) {}
    }
  }

  function installSafeListener() {
    if (typeof db === "undefined" || typeof getFirebasePath !== "function") return false;
    if (window.__syncCross66) return true;
    window.__syncCross66 = true;

    if (typeof saveToFirebase === "function" && !saveToFirebase._x66) {
      var origSave = saveToFirebase;
      window.saveToFirebase = function () {
        origSave.apply(this, arguments);
        pushTrips();
      };
      window.saveToFirebase._x66 = true;
    }

    window.startFirebaseListener = function () {
      if (typeof stopFirebaseListener === "function") stopFirebaseListener();
      if (!currentMonthKey) return;
      var path = getFirebasePath();
      try {
        firebaseRef = db.ref(path);
      } catch (e) {
        console.error(e);
        return;
      }
      if (typeof setSyncStatus === "function") setSyncStatus("syncing");

      firebaseRef.on("value", function (snap) {
        if (typeof firebaseReady !== "undefined") firebaseReady = true;
        var data = snap.val();

        if (!data) {
          var localCount = Object.keys(dailyRecords || {}).length;
          if (localCount > 0 && typeof saveToFirebase === "function") {
            setTimeout(function () { saveToFirebase(); }, 200);
          }
          if (typeof setSyncStatus === "function") setSyncStatus("online");
          return;
        }

        var remoteTs = parseTs(data.lastUpdatedServer) || parseTs(data.lastUpdated);
        var myId = typeof getDeviceId === "function" ? getDeviceId() : "";
        if (data.deviceId && data.deviceId === myId &&
            typeof lastLocalSaveAt !== "undefined" && Date.now() - lastLocalSaveAt < 2500) {
          if (typeof setSyncStatus === "function") setSyncStatus("online");
          return;
        }
        if (remoteTs && typeof lastLocalSaveAt !== "undefined" && lastLocalSaveAt &&
            remoteTs < lastLocalSaveAt - 800) {
          if (typeof setSyncStatus === "function") setSyncStatus("online");
          return;
        }

        if (typeof syncingFromFirebase !== "undefined") syncingFromFirebase = true;
        try {
          var remoteRecords = (data.dailyRecords && typeof data.dailyRecords === "object")
            ? data.dailyRecords : {};
          dailyRecords = Object.assign({}, remoteRecords);
          if (data.trips && Array.isArray(data.trips) && data.trips.length &&
              (!Array.isArray(trips) || !trips.length)) {
            trips = data.trips.slice();
          }
          if (typeof persistLocalOnly === "function") persistLocalOnly();
          else {
            try {
              localStorage.setItem("dailyRecords_" + currentMonthKey, JSON.stringify(dailyRecords));
            } catch (e) {}
          }
          if (typeof updateReport === "function") updateReport();
          if (typeof loadTrips === "function") loadTrips();
          if (typeof setSyncStatus === "function") setSyncStatus("online");
          try {
            if (typeof clearOfflineQueueItem === "function") clearOfflineQueueItem(path);
          } catch (e) {}
        } finally {
          setTimeout(function () {
            if (typeof syncingFromFirebase !== "undefined") syncingFromFirebase = false;
          }, 300);
        }
      }, function (err) {
        console.error("Firebase listener error:", err);
        if (typeof setSyncStatus === "function") setSyncStatus("offline");
        if (typeof updateReport === "function") updateReport();
      });

      pullTripsOnce();
      if (typeof flushOfflineQueue === "function") flushOfflineQueue();
    };

    if (!window.__settingsListener66) {
      window.__settingsListener66 = true;
      try {
        db.ref(SETTINGS_PATH).on("value", function (snap) {
          var s = snap.val();
          if (!s) {
            pushAllSettings();
            return;
          }
          if (s.deviceId && typeof getDeviceId === "function" &&
              s.deviceId === getDeviceId() &&
              Date.now() - (window.__settingsLocalAt || 0) < 2500) return;
          applySettings(s);
        });
      } catch (e) {}
    }

    if (typeof saveObservedHolidaysMap === "function" && !saveObservedHolidaysMap._x66) {
      var oSave = saveObservedHolidaysMap;
      window.saveObservedHolidaysMap = function (m) {
        oSave(m);
        clearTimeout(window.__settingsPushT);
        window.__settingsPushT = setTimeout(pushAllSettings, 400);
      };
      window.saveObservedHolidaysMap._x66 = true;
    }
    if (typeof setHolidayObserved === "function" && !setHolidayObserved._x66) {
      var oHol = setHolidayObserved;
      window.setHolidayObserved = function (d, v) {
        oHol(d, v);
        clearTimeout(window.__settingsPushT);
        window.__settingsPushT = setTimeout(pushAllSettings, 400);
      };
      window.setHolidayObserved._x66 = true;
    }
    if (typeof saveOtSettings === "function" && !saveOtSettings._x66) {
      var oOt = saveOtSettings;
      window.saveOtSettings = function (s) {
        oOt(s);
        clearTimeout(window.__settingsPushT);
        window.__settingsPushT = setTimeout(pushAllSettings, 400);
      };
      window.saveOtSettings._x66 = true;
    }

    if (typeof currentMonthKey === "string" && currentMonthKey) {
      if (typeof lastLocalSaveAt !== "undefined") lastLocalSaveAt = 0;
      window.startFirebaseListener();
    }
    return true;
  }

  function tryInstall(n) {
    if (installSafeListener()) return;
    if (n < 40) setTimeout(function () { tryInstall(n + 1); }, 150);
  }

  document.addEventListener("rezaot-ready", function () {
    setTimeout(function () { tryInstall(0); }, 500);
  });
  if (document.readyState !== "loading") setTimeout(function () { tryInstall(0); }, 1800);
})();
