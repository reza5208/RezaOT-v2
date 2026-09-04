// sync-fix.js — multi-device last-write-wins (v31)
(function () {
  "use strict";

  function installBetterSync() {
    if (typeof db === "undefined" || typeof getFirebasePath !== "function") return false;
    if (window.__syncFix31) return true;
    window.__syncFix31 = true;

    window.startFirebaseListener = function () {
      if (typeof stopFirebaseListener === "function") stopFirebaseListener();
      if (!currentMonthKey) return;
      const path = getFirebasePath();
      firebaseRef = db.ref(path);
      setSyncStatus("syncing");
      firebaseRef.on("value", function (snap) {
        firebaseReady = true;
        const data = snap.val();
        if (!data) {
          const localCount = Object.keys(dailyRecords || {}).length;
          if (localCount > 0) setTimeout(function () { saveToFirebase(); }, 200);
          setSyncStatus("online");
          return;
        }
        const remoteTs = data.lastUpdated ? Date.parse(data.lastUpdated) : 0;
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
          const remoteRecords = (data.dailyRecords && typeof data.dailyRecords === "object")
            ? data.dailyRecords : {};
          const remoteCount = Object.keys(remoteRecords).length;
          const localCount = Object.keys(dailyRecords || {}).length;

          if (remoteCount === 0 && localCount > 0) {
            setTimeout(function () { syncingFromFirebase = false; saveToFirebase(); }, 300);
            setSyncStatus("online");
            return;
          }

          if (remoteCount > 0) {
            // Remote wins per-date (mobile → PC). Keep local-only dates.
            const merged = Object.assign({}, dailyRecords);
            Object.keys(remoteRecords).forEach(function (date) {
              merged[date] = remoteRecords[date];
            });
            dailyRecords = merged;
          }

          if (data.trips && Array.isArray(data.trips) && data.trips.length) {
            const set = new Set([].concat(trips || [], data.trips));
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
        const msg = String(err && err.message ? err.message : err);
        if (msg.indexOf("permission") >= 0) {
          setSyncStatus("denied");
          showToast("Firebase permission denied.", 4000);
        } else setSyncStatus("offline");
        updateReport();
        if (typeof loadTrips === "function") loadTrips();
      });
      if (typeof flushOfflineQueue === "function") flushOfflineQueue();
    };

    // Reset so first cloud snapshot always applies after page open
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
