// Durable synchronization. The local UI and storage do not depend on Firebase.
(function () {
  "use strict";
  var monthSubscription = null;
  var sharedSubscriptions = [];
  var sharedRoot = null;
  var running = null;
  var flushAgain = false;
  var initialized = false;
  var monthGeneration = 0;
  var sharedGeneration = 0;
  var lastTrips = null;
  var conflictSeen = false;
  var archived = Object.create(null);
  var settingKeys = ["observedHolidays", "customHolidays", "otSettings", "salarySettings", "monthSettings"];

  function clone(v) { return RezaOT_storage.clone(v); }
  function isObject(v) { return v && typeof v === "object" && !Array.isArray(v); }
  function timestamp(v) {
    var n = typeof v === "number" ? v : Date.parse(v || "");
    return Number.isFinite(n) ? n : 0;
  }
  function queueFor(path) { return getOfflineQueue().find(function (item) { return item.path === path; }); }
  function status() {
    if (conflictSeen) { setSyncStatus("conflict"); return; }
    if (!navigator.onLine) { setSyncStatus("offline"); return; }
    if (!getFirebaseRoot()) { setSyncStatus("auth"); return; }
    if (!ensureDatabase()) { setSyncStatus("unavailable"); return; }
    var root = getFirebaseRoot() + "/";
    setSyncStatus(getOfflineQueue().some(function (item) { return item.path.indexOf(root) === 0; }) ? "pending" : "online");
  }
  function failure(error) {
    var message = String(error && (error.code || error.message) || error);
    setSyncStatus(/permission|denied|unauthori[sz]ed/i.test(message) ? "denied" : "offline");
    console.warn("Cloud sync postponed:", message);
  }
  function archiveDifference(path, local, remote, reason) {
    if (JSON.stringify(local) === JSON.stringify(remote)) return;
    var signature = JSON.stringify([path, local, remote]);
    if (archived[signature]) return;
    RezaOT_storage.archive(reason, { path: path, local: local, remote: remote });
    archived[signature] = true;
  }
  function payload(data, identity) {
    identity = identity || getDeviceId();
    return Object.assign({}, clone(data), {
      lastUpdated: new Date().toISOString(), deviceId: identity,
      revision: identity + ":" + Date.now() + ":" + Math.random().toString(36).slice(2)
    });
  }
  function preparedQueue(operations, identity) {
    var queue = getOfflineQueue();
    operations.forEach(function (operation) {
      var value = payload(operation.data, identity);
      queue = queue.filter(function (item) { return item.path !== operation.path; });
      queue.push({ path: operation.path, data: value, revision: value.revision, queuedAt: new Date().toISOString() });
    });
    return queue;
  }
  function enqueue(path, data, localEntries) {
    // A user edit and its pending cloud revision either both persist or neither does.
    var entries = Object.assign({}, localEntries || {});
    if (path) entries[OFFLINE_QUEUE_KEY] = preparedQueue([{ path: path, data: data }]);
    RezaOT_storage.transaction(entries);
    status();
    return path ? flush() : Promise.resolve(false);
  }
  function settingsPayload() {
    var value = { supervisorName: localStorage.getItem("supervisorName") || "Talib" };
    settingKeys.forEach(function (key) {
      var defaults = key === "otSettings" && typeof getOtSettings === "function" ? getOtSettings() : {};
      value[key] = RezaOT_storage.read(key, defaults, function (v) {
        if (!isObject(v)) throw new Error("Tetapan tidak sah: " + key);
        return v;
      });
    });
    return value;
  }
  function settingsChanged() {
    var root = getFirebaseRoot();
    return enqueue(root && root + "/settings", settingsPayload());
  }
  function updateSettings(changes) {
    var clean = validatedSettings(changes);
    var root = getFirebaseRoot();
    var combined = Object.assign({}, settingsPayload(), clean);
    return enqueue(root && root + "/settings", combined, clean);
  }
  function tripsChanged(force) {
    var list = RezaOT_model.validateDestinations(trips);
    var signature = JSON.stringify(list);
    if (!force && signature === lastTrips) return Promise.resolve(true);
    var root = getFirebaseRoot();
    try {
      var result = enqueue(root && root + "/_meta/trips", { list: list }, { trips: list });
      lastTrips = signature;
      return result;
    } catch (error) {
      trips = RezaOT_storage.read("trips", defaultTrips, RezaOT_model.validateDestinations);
      if (typeof loadTrips === "function") loadTrips();
      throw error;
    }
  }
  function saveMonth(month, records) {
    month = month || currentMonthKey;
    if (!month) return Promise.resolve(false);
    RezaOT_model.validateMonthKey(month);
    var value = RezaOT_model.validateRecords(records == null ? dailyRecords : records, month);
    var root = getFirebaseRoot();
    var entries = {}; entries["dailyRecords_" + month] = value;
    try {
      var result = enqueue(root && root + "/" + month, { dailyRecords: value, trips: clone(trips) }, entries);
      if (month === currentMonthKey) dailyRecords = clone(value);
      return result;
    } catch (error) {
      if (month === currentMonthKey) {
        dailyRecords = RezaOT_storage.read("dailyRecords_" + month, {}, function (stored) { return RezaOT_model.validateRecords(stored, month); });
        if (typeof updateReport === "function") updateReport();
      }
      throw error;
    }
  }
  function refresh() {
    if (typeof updateReport === "function") updateReport();
    if (typeof loadTrips === "function") loadTrips();
    if (typeof updateHolidayBadge === "function") updateHolidayBadge();
  }
  function validatedSettings(data) {
    if (!isObject(data)) throw new Error("Cloud settings tidak sah");
    var result = {};
    settingKeys.forEach(function (key) {
      if (data[key] == null) return;
      if (!isObject(data[key])) throw new Error("Cloud setting tidak sah: " + key);
      result[key] = clone(data[key]);
    });
    if (data.supervisorName != null) {
      if (typeof data.supervisorName !== "string" || data.supervisorName.length > 200) throw new Error("Nama ketua tidak sah");
      result.supervisorName = data.supervisorName;
    }
    if (result.observedHolidays && typeof isObservedHolidaysMap === "function" && !isObservedHolidaysMap(result.observedHolidays)) throw new Error("Pilihan cuti cloud tidak sah");
    if (result.customHolidays && typeof isCustomHolidaysMap === "function" && !isCustomHolidaysMap(result.customHolidays)) throw new Error("Cuti company cloud tidak sah");
    if (result.otSettings && typeof validateOtSettings === "function") result.otSettings = validateOtSettings(result.otSettings);
    if (result.monthSettings && window.RezaOT_validateMonthSettings) result.monthSettings = RezaOT_validateMonthSettings(result.monthSettings);
    if (result.salarySettings && window.RezaOT_salary && typeof RezaOT_salary.validateSettings === "function") {
      result.salarySettings = RezaOT_salary.validateSettings(result.salarySettings);
    }
    return result;
  }
  function prepareImport(input) {
    var root = getFirebaseRoot();
    if (!root) return {};
    var operations = [];
    var list = input.trips == null ? clone(trips) : RezaOT_model.validateDestinations(input.trips);
    Object.keys(input.months || {}).forEach(function (month) {
      RezaOT_model.validateMonthKey(month);
      operations.push({ path: root + "/" + month, data: { dailyRecords: RezaOT_model.validateRecords(input.months[month], month), trips: list } });
    });
    if (input.trips != null) operations.push({ path: root + "/_meta/trips", data: { list: list } });
    if (input.settings && Object.keys(input.settings).length) {
      operations.push({ path: root + "/settings", data: Object.assign({}, settingsPayload(), validatedSettings(input.settings)) });
    }
    if (!operations.length) return {};
    var identity = localStorage.getItem("deviceId");
    var entries = {};
    if (!identity) {
      identity = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      entries.deviceId = identity;
    }
    entries[OFFLINE_QUEUE_KEY] = preparedQueue(operations, identity);
    return entries;
  }
  function validatePending(item, root) {
    if (!isObject(item.data)) throw new Error("Pending cloud payload tidak sah");
    var target = item.path.slice(root.length + 1);
    if (target === "settings") {
      if (!Object.keys(validatedSettings(item.data)).length) throw new Error("Pending settings kosong/tidak sah");
    } else if (target === "_meta/trips") {
      RezaOT_model.validateDestinations(item.data.list);
    } else {
      RezaOT_model.validateMonthKey(target);
      RezaOT_model.validateRecords(item.data.dailyRecords, target);
      if (item.data.trips != null) RezaOT_model.validateDestinations(item.data.trips);
    }
  }
  function applyRemote(path, data) {
    if (!data || queueFor(path)) return;
    var root = getFirebaseRoot();
    if (!root || path.indexOf(root + "/") !== 0) return;
    if (path === root + "/settings") {
      var settings = validatedSettings(data);
      var local = settingsPayload();
      if (settings.monthSettings) settings.monthSettings = Object.assign({}, local.monthSettings || {}, settings.monthSettings);
      var comparable = Object.assign({}, local, settings);
      archiveDifference(path, local, comparable, "before-cloud-settings");
      RezaOT_storage.transaction(settings);
      var el = document.getElementById("supervisorName");
      if (el && settings.supervisorName != null) el.textContent = settings.supervisorName;
      refresh();
      return;
    }
    if (path === root + "/_meta/trips") {
      var list = RezaOT_model.validateDestinations(data.list);
      archiveDifference(path, trips, list, "before-cloud-destinations");
      trips = list;
      lastTrips = JSON.stringify(list);
      RezaOT_storage.write("trips", list);
      if (typeof loadTrips === "function") loadTrips();
      return;
    }
    var month = path.slice(root.length + 1);
    RezaOT_model.validateMonthKey(month);
    var records = RezaOT_model.validateRecords(data.dailyRecords || {}, month);
    var key = "dailyRecords_" + month;
    var localRecords = month === currentMonthKey ? dailyRecords : RezaOT_storage.read(key, {});
    if (Object.keys(localRecords).length) archiveDifference(path, localRecords, records, "before-cloud-month");
    RezaOT_storage.write(key, records);
    if (month === currentMonthKey) {
      dailyRecords = records;
      firebaseReady = true;
      refresh();
    }
  }
  function receive(path, data) {
    try {
      if (queueFor(path)) { flush(); return; }
      if (data == null) {
        var root = getFirebaseRoot();
        if (path === root + "/settings") settingsChanged();
        else if (path === root + "/_meta/trips") tripsChanged(true);
        else if (path === getFirebasePath() && Object.keys(dailyRecords).length) saveMonth();
      } else applyRemote(path, data);
      status();
    } catch (error) {
      // Invalid remote data never replaces a usable local copy.
      try { RezaOT_storage.archive("invalid-cloud-data", { path: path, data: data, message: error.message }); } catch (_) {}
      conflictSeen = true;
      setSyncStatus("conflict");
      console.warn("Cloud data retained for review:", error.message);
    }
  }
  async function processQueue() {
    while (navigator.onLine && ensureDatabase()) {
      var root = getFirebaseRoot();
      if (!root) return false;
      var item = getOfflineQueue().find(function (entry) { return entry.path.indexOf(root + "/") === 0; });
      if (!item) { status(); return true; }
      var activeDb = db;
      setSyncStatus("syncing");
      try {
        try { validatePending(item, root); }
        catch (invalidPending) {
          // Corrupt local queues must never overwrite a healthy cloud path.
          RezaOT_storage.archive("invalid-pending-write", { path: item.path, pending: item.data, message: invalidPending.message });
          clearOfflineQueueItem(item.path, item.revision);
          conflictSeen = true;
          continue;
        }
        var snapshot = await activeDb.ref(item.path).once("value");
        if (getFirebaseRoot() !== root) return false;
        var remote = snapshot.val();
        var current = queueFor(item.path);
        if (!current || current.revision !== item.revision) continue;
        var remoteTime = remote && (timestamp(remote.lastUpdatedServer) || timestamp(remote.lastUpdated));
        var localTime = timestamp(item.data.lastUpdated);
        if (remote && remote.revision !== item.data.revision && remoteTime > localTime) {
          // Preserve the losing local version before honoring documented last-write-wins.
          RezaOT_storage.archive("sync-conflict", { path: item.path, pending: item.data, remote: remote });
          clearOfflineQueueItem(item.path, item.revision);
          conflictSeen = true;
          applyRemote(item.path, remote);
          continue;
        }
        if (remote && remote.revision !== item.data.revision) {
          archiveDifference(item.path, remote, item.data, "before-cloud-write");
        }
        var outgoing = clone(item.data);
        // Snapshot months absent from this device must survive a shared settings edit.
        if (item.path === root + "/settings" && remote && isObject(remote.monthSettings)) {
          var remoteSnapshots = validatedSettings({ monthSettings: remote.monthSettings }).monthSettings;
          outgoing.monthSettings = Object.assign({}, remoteSnapshots, outgoing.monthSettings || {});
        }
        await activeDb.ref(item.path).set(outgoing);
        // A newer save may have replaced the queued item while this write was pending.
        clearOfflineQueueItem(item.path, item.revision);
        if (item.path === root + "/settings" && getFirebaseRoot() === root) applyRemote(item.path, outgoing);
        firebaseReady = true;
      } catch (error) {
        failure(error);
        return false;
      }
    }
    status();
    return false;
  }
  function flush() {
    if (running) { flushAgain = true; return running; }
    if (!navigator.onLine || !ensureDatabase()) { status(); return Promise.resolve(false); }
    flushAgain = false;
    running = Promise.resolve().then(processQueue).then(function (result) {
      running = null;
      if (flushAgain) { flushAgain = false; return flush(); }
      return result;
    }, function (error) {
      running = null;
      flushAgain = false;
      failure(error);
      return false;
    });
    return running;
  }
  function subscribe(path, valid) {
    var ref = db.ref(path);
    var callback = function (snapshot) {
      if (!valid || valid()) receive(path, snapshot.val());
    };
    ref.on("value", callback, failure);
    return { ref: ref, callback: callback };
  }
  function stopMonth() {
    monthGeneration++;
    if (monthSubscription) monthSubscription.ref.off("value", monthSubscription.callback);
    monthSubscription = null;
    firebaseRef = null;
  }
  function startShared() {
    var root = getFirebaseRoot();
    if (!root || !ensureDatabase() || root === sharedRoot) return;
    sharedSubscriptions.forEach(function (entry) { entry.ref.off("value", entry.callback); });
    sharedSubscriptions = [];
    var generation = ++sharedGeneration;
    sharedRoot = root;
    sharedSubscriptions.push(subscribe(root + "/settings", function () { return sharedGeneration === generation && getFirebaseRoot() === root; }));
    sharedSubscriptions.push(subscribe(root + "/_meta/trips", function () { return sharedGeneration === generation && getFirebaseRoot() === root; }));
    if (typeof Event === "function") window.dispatchEvent(new Event("rezaot-cloud-ready"));
  }
  function startMonth() {
    init();
    stopMonth();
    if (!currentMonthKey || !ensureDatabase()) { status(); return Promise.resolve(false); }
    var path = getFirebasePath();
    var month = currentMonthKey;
    var generation = monthGeneration;
    startShared();
    setSyncStatus("syncing");
    monthSubscription = subscribe(path, function () { return monthGeneration === generation && currentMonthKey === month && getFirebasePath() === path; });
    firebaseRef = monthSubscription.ref;
    return flush();
  }
  function reconnect() {
    stopMonth();
    sharedSubscriptions.forEach(function (entry) { entry.ref.off("value", entry.callback); });
    sharedSubscriptions = [];
    sharedGeneration++;
    sharedRoot = null;
    db = null;
    lastTrips = null;
    return startMonth();
  }
  function init() {
    if (initialized) return;
    initialized = true;
    lastTrips = JSON.stringify(trips);
    window.addEventListener("online", function () { reconnect(); });
    window.addEventListener("offline", status);
    window.addEventListener("rezaot-storage-error", function () {
      showToast("Data bermasalah dikekalkan untuk pemulihan. Eksport backup sebelum membuang data.", 5000);
    });
  }

  window.RezaOT_sync = {
    init: init, saveMonth: saveMonth, startMonth: startMonth, stopMonth: stopMonth,
    settingsChanged: settingsChanged, tripsChanged: tripsChanged, flush: flush,
    updateSettings: updateSettings, prepareImport: prepareImport,
    reconnect: reconnect, settingsPayload: settingsPayload,
    userPath: getFirebaseRoot, isReady: function () { return !!getFirebaseRoot() && !!ensureDatabase(); }
  };
})();
