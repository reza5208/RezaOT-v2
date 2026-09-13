// sync-fix-v48.js — never wipe local when Firebase path is empty; always push up
(function () {
  "use strict";
  function patch() {
    if (window.__syncFix48) return;
    if (typeof startFirebaseListener !== "function") return;
    if (typeof getFirebasePath !== "function" || typeof db === "undefined") return;
    window.__syncFix48 = true;

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
      setSyncStatus("syncing");
      firebaseRef.on("value", function (snap) {
        if (typeof firebaseReady !== "undefined") firebaseReady = true;
        var data = snap.val();
        if (!data) {
          var localCount = Object.keys(dailyRecords || {}).length;
          if (localCount > 0 && typeof saveToFirebase === "function") {
            setTimeout(function () { saveToFirebase(); }, 200);
          }
          setSyncStatus("online");
          return;
        }
        var remoteTs = data.lastUpdated ? Date.parse(data.lastUpdated) : 0;
        if (data.deviceId && typeof getDeviceId === "function" && data.deviceId === getDeviceId()
            && typeof lastLocalSaveAt !== "undefined" && Date.now() - lastLocalSaveAt < 2500) {
          setSyncStatus("online");
          return;
        }
        if (remoteTs && typeof lastLocalSaveAt !== "undefined" && lastLocalSaveAt
            && remoteTs < lastLocalSaveAt - 800) {
          setSyncStatus("online");
          return;
        }
        if (typeof syncingFromFirebase !== "undefined") syncingFromFirebase = true;
        try {
          var remoteRecords = (data.dailyRecords && typeof data.dailyRecords === "object")
            ? data.dailyRecords : {};
          dailyRecords = Object.assign({}, remoteRecords);
          if (data.trips && Array.isArray(data.trips)) trips = data.trips.slice();
          if (typeof persistLocalOnly === "function") persistLocalOnly();
          else if (typeof localStorage !== "undefined" && currentMonthKey) {
            localStorage.setItem("dailyRecords_" + currentMonthKey, JSON.stringify(dailyRecords));
          }
          if (typeof updateReport === "function") updateReport();
          if (typeof loadTrips === "function") loadTrips();
          setSyncStatus("online");
        } finally {
          setTimeout(function () {
            if (typeof syncingFromFirebase !== "undefined") syncingFromFirebase = false;
          }, 300);
        }
      }, function (err) {
        console.error("Firebase listener error:", err);
        setSyncStatus("offline");
        if (typeof updateReport === "function") updateReport();
      });
      if (typeof flushOfflineQueue === "function") flushOfflineQueue();
    };
  }
  document.addEventListener("rezaot-ready", function () { setTimeout(patch, 200); });
  if (document.readyState !== "loading") setTimeout(patch, 1200);
})();
