// Durable, owner-scoped sync. Transactions reconcile edits without device-clock winners.
(function () {
  "use strict";
  var BASE_KEY = "rezaot_sync_baselines", DIRTY_KEY = "rezaot_local_dirty", CONFLICT_KEY = "rezaot_sync_conflicts";
  var monthSubscription = null, sharedSubscriptions = [], sharedRoot = null, connectionSubscription = null, connectionDb = null;
  var connected = null, acknowledgedRoot = null, lastAcknowledgedAt = null;
  var running = null, flushAgain = false, initialized = false, monthGeneration = 0, sharedGeneration = 0, lastTrips = null;
  var archived = Object.create(null);
  var settingKeys = ["observedHolidays", "customHolidays", "otSettings", "salarySettings", "monthSettings"];
  function clone(v) { return RezaOT_storage.clone(v); }
  function object(v) { return v && typeof v === "object" && !Array.isArray(v); }
  function stable(v) {
    if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
    if (object(v)) return "{" + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ":" + stable(v[k]); }).join(",") + "}";
    return JSON.stringify(v);
  }
  function equal(a, b) { return stable(a) === stable(b); }
  function stored(key, fallback) { return RezaOT_storage.read(key, fallback); }
  function baselines() { var v = stored(BASE_KEY, {}); if (!object(v)) throw new Error("Sync baseline tidak sah"); return v; }
  function dirtyItems() { var v = stored(DIRTY_KEY, []); if (!Array.isArray(v)) throw new Error("Pending lokal tidak sah"); return v; }
  function allConflicts() { var v = stored(CONFLICT_KEY, []); if (!Array.isArray(v)) throw new Error("Konflik lokal tidak sah"); return v; }
  function ownerScope() {
    var root = getFirebaseRoot();
    if (root) return root;
    var uid = localStorage.getItem("rezaot_auth_data_owner");
    return uid ? "users/" + uid : null;
  }
  function notify() {
    if (typeof document.dispatchEvent === "function" && typeof Event === "function") document.dispatchEvent(new Event("rezaot-sync-state"));
  }
  function getConflicts() { var owner = ownerScope(); return allConflicts().filter(function (v) { return v.owner === owner; }); }
  function queueFor(path) { return getOfflineQueue().find(function (v) { return v.path === path; }); }
  function blocked(item) { return allConflicts().some(function (v) { return v.path === item.path && v.revision === item.revision; }); }
  function status() {
    var root = getFirebaseRoot();
    if (getConflicts().length) setSyncStatus("conflict");
    else if (!navigator.onLine) setSyncStatus("offline");
    else if (!root) setSyncStatus("auth");
    else if (!ensureDatabase()) setSyncStatus("unavailable");
    else if (connected === false) setSyncStatus("offline");
    else if (getOfflineQueue().some(function (v) { return v.path.indexOf(root + "/") === 0; })) setSyncStatus("pending");
    else setSyncStatus(connected === true && acknowledgedRoot === root ? "online" : "syncing");
    notify();
  }
  function failure(error) {
    var message = String(error && (error.code || error.message) || error);
    setSyncStatus(/permission|denied|unauthori[sz]ed/i.test(message) ? "denied" : "offline");
    console.warn("Cloud sync postponed:", message); notify();
  }
  function archiveDifference(path, local, remote, reason) {
    if (equal(local, remote)) return;
    var signature = stable([path, local, remote]);
    if (archived[signature]) return;
    RezaOT_storage.archive(reason, { path: path, local: local, remote: remote }); archived[signature] = true;
  }
  function payload(data, identity) {
    identity = identity || getDeviceId();
    return Object.assign({}, clone(data), { lastUpdated: new Date().toISOString(), deviceId: identity,
      revision: identity + ":" + Date.now() + ":" + Math.random().toString(36).slice(2) });
  }
  function validatedSettings(data) {
    if (!object(data)) throw new Error("Cloud settings tidak sah");
    var result = {};
    settingKeys.forEach(function (key) {
      if (data[key] == null) return;
      if (!object(data[key])) throw new Error("Cloud setting tidak sah: " + key);
      result[key] = clone(data[key]);
    });
    if (data.supervisorName != null) {
      if (typeof data.supervisorName !== "string" || data.supervisorName.length > 200) throw new Error("Nama ketua tidak sah");
      result.supervisorName = data.supervisorName;
    }
    if (result.observedHolidays && typeof isObservedHolidaysMap === "function" && !isObservedHolidaysMap(result.observedHolidays)) throw new Error("Pilihan cuti cloud tidak sah");
    if (result.customHolidays && typeof isCustomHolidaysMap === "function" && !isCustomHolidaysMap(result.customHolidays)) throw new Error("Cuti company cloud tidak sah");
    if (result.otSettings && typeof validateOtSettings === "function") result.otSettings = validateOtSettings(result.otSettings);
    if (result.monthSettings && window.RezaOT_validateMonthSettings) {
      Object.keys(result.monthSettings).forEach(function (month) {
        var snapshot = result.monthSettings[month];
        if (object(snapshot)) {
          if (snapshot.observedHolidays == null) snapshot.observedHolidays = {};
          if (snapshot.customHolidays == null) snapshot.customHolidays = {};
        }
      });
      result.monthSettings = RezaOT_validateMonthSettings(result.monthSettings);
    }
    if (result.salarySettings && window.RezaOT_salary) result.salarySettings = RezaOT_salary.validateSettings(result.salarySettings);
    return result;
  }
  function clean(target, data) {
    if (data == null || data.deleted === true) return null;
    if (!object(data)) throw new Error("Cloud payload tidak sah");
    if (target === "settings") {
      var settings = validatedSettings(data);
      // RTDB removes empty maps; an absent map in a complete snapshot means empty.
      ["observedHolidays", "customHolidays", "monthSettings"].forEach(function (key) {
        if (!Object.prototype.hasOwnProperty.call(settings, key)) settings[key] = {};
      });
      return settings;
    }
    if (target === "_meta/trips") return { list: RezaOT_model.validateDestinations(data.list || []) };
    RezaOT_model.validateMonthKey(target);
    return { dailyRecords: RezaOT_model.validateRecords(data.dailyRecords || {}, target),
      trips: RezaOT_model.validateDestinations(data.trips || []) };
  }
  function targetFor(path, root) {
    if (typeof path !== "string" || path.indexOf(root + "/") !== 0) throw new Error("Cloud path tidak sah");
    return path.slice(root.length + 1);
  }
  function preparedQueue(operations, identity) {
    var queue = getOfflineQueue(), bases = baselines();
    operations.forEach(function (op) {
      var previous = queue.find(function (v) { return v.path === op.path; });
      var known = previous && typeof previous.baseKnown === "boolean" ? previous.baseKnown : Object.prototype.hasOwnProperty.call(bases, op.path);
      var base = previous && typeof previous.baseKnown === "boolean" ? previous.base : known ? bases[op.path].data : null;
      var value = payload(op.data, identity);
      queue = queue.filter(function (v) { return v.path !== op.path; });
      queue.push({ path: op.path, data: value, revision: value.revision, queuedAt: new Date().toISOString(), baseKnown: known, base: clone(base),
        allowDeleted: !!(previous && previous.allowDeleted) });
    });
    return queue;
  }
  function preparedDirty(operations, identity) {
    var list = dirtyItems(), owner = ownerScope(), bases = baselines();
    operations.forEach(function (op) {
      var previous = list.find(function (v) { return v.target === op.target && v.owner === owner; });
      var path = owner && owner + "/" + op.target;
      var known = previous ? previous.baseKnown : !!(path && Object.prototype.hasOwnProperty.call(bases, path));
      var value = payload(op.data, identity);
      list = list.filter(function (v) { return v.target !== op.target || v.owner !== owner; });
      list.push({ target: op.target, owner: owner, mode: "auth", data: value, revision: value.revision,
        queuedAt: new Date().toISOString(), baseKnown: known, base: clone(previous ? previous.base : known ? bases[path].data : null) });
    });
    return list;
  }
  function enqueue(target, data, localEntries) {
    var root = getFirebaseRoot(), entries = Object.assign({}, localEntries || {});
    if (root) entries[OFFLINE_QUEUE_KEY] = preparedQueue([{ path: root + "/" + target, data: data }]);
    else entries[DIRTY_KEY] = preparedDirty([{ target: target, data: data }]);
    RezaOT_storage.transaction(entries); status();
    return root ? flush() : Promise.resolve(false);
  }
  function settingsPayload() {
    var result = { supervisorName: localStorage.getItem("supervisorName") || "Talib" };
    settingKeys.forEach(function (key) {
      var defaults = key === "otSettings" && typeof getOtSettings === "function" ? getOtSettings() : {};
      result[key] = stored(key, defaults);
      if (!object(result[key])) throw new Error("Tetapan tidak sah: " + key);
    });
    return result;
  }
  function settingsChanged() { return enqueue("settings", settingsPayload()); }
  function updateSettings(changes) {
    var value = validatedSettings(changes);
    return enqueue("settings", Object.assign({}, settingsPayload(), value), value);
  }
  function tripsChanged(force) {
    var list = RezaOT_model.validateDestinations(trips), signature = stable(list);
    if (!force && signature === lastTrips) return Promise.resolve(true);
    try { var result = enqueue("_meta/trips", { list: list }, { trips: list }); lastTrips = signature; return result; }
    catch (error) { trips = stored("trips", defaultTrips); if (typeof loadTrips === "function") loadTrips(); throw error; }
  }
  function saveMonth(month, records) {
    month = month || currentMonthKey; if (!month) return Promise.resolve(false);
    RezaOT_model.validateMonthKey(month);
    var value = RezaOT_model.validateRecords(records == null ? dailyRecords : records, month), entries = {};
    entries["dailyRecords_" + month] = value;
    try { var result = enqueue(month, { dailyRecords: value, trips: clone(trips) }, entries); if (month === currentMonthKey) dailyRecords = clone(value); return result; }
    catch (error) { if (month === currentMonthKey) { dailyRecords = stored("dailyRecords_" + month, {}); refresh(); } throw error; }
  }
  function prepareImport(input) {
    var root = getFirebaseRoot(), operations = [], entries = {};
    var list = input.trips == null ? clone(trips) : RezaOT_model.validateDestinations(input.trips);
    Object.keys(input.months || {}).forEach(function (month) {
      RezaOT_model.validateMonthKey(month);
      operations.push({ target: month, data: { dailyRecords: RezaOT_model.validateRecords(input.months[month], month), trips: list } });
    });
    if (input.trips != null) operations.push({ target: "_meta/trips", data: { list: list } });
    var settings = validatedSettings(input.settings || {});
    if (Object.keys(settings).length) operations.push({ target: "settings", data: Object.assign({}, settingsPayload(), settings) });
    if (!operations.length) return entries;
    var identity = localStorage.getItem("deviceId");
    if (!identity) { identity = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36); entries.deviceId = identity; }
    if (root) entries[OFFLINE_QUEUE_KEY] = preparedQueue(operations.map(function (v) { return { path: root + "/" + v.target, data: v.data }; }), identity);
    else entries[DIRTY_KEY] = preparedDirty(operations, identity);
    return entries;
  }
  function bindDirty(root) {
    if (!root) return;
    var dirty = dirtyItems(), queue = getOfflineQueue(), moved = false;
    var remaining = dirty.filter(function (v) {
      if (v.owner !== root && !(v.owner == null && root !== "users/default")) return true;
      var data = clean(v.target, v.data); if (!data) throw new Error("Pending lokal tidak sah");
      var path = root + "/" + v.target, existing = queue.find(function (q) { return q.path === path; });
      queue = queue.filter(function (q) { return q.path !== path; });
      queue.push({ path: path, data: clone(v.data), revision: v.revision, queuedAt: v.queuedAt,
        baseKnown: existing ? existing.baseKnown === true : v.baseKnown === true,
        base: clone(existing ? existing.base : v.base) }); moved = true; return false;
    });
    if (moved) { var entries = {}; entries[DIRTY_KEY] = remaining; entries[OFFLINE_QUEUE_KEY] = queue; RezaOT_storage.transaction(entries); }
  }
  function refresh() {
    if (typeof updateReport === "function") updateReport();
    if (typeof loadTrips === "function") loadTrips();
    if (typeof updateHolidayBadge === "function") updateHolidayBadge();
  }
  function writeLocal(target, value, path) {
    var entries = {}, bases = baselines();
    if (path) { bases[path] = { data: clone(value), receivedAt: new Date().toISOString() }; entries[BASE_KEY] = bases; }
    if (target === "settings") {
      if (value) {
        var settings = clone(value), local = settingsPayload();
        if (settings.monthSettings) settings.monthSettings = Object.assign({}, local.monthSettings || {}, settings.monthSettings);
        Object.assign(entries, settings);
      } else {
        Object.assign(entries, validatedSettings({ supervisorName: "Talib", otSettings: {}, salarySettings: {},
          observedHolidays: {}, customHolidays: {}, monthSettings: {} }));
      }
    } else if (target === "_meta/trips") entries.trips = value ? value.list : [];
    else entries["dailyRecords_" + target] = value ? value.dailyRecords : {};
    RezaOT_storage.transaction(entries);
    if (target === "_meta/trips") { trips = entries.trips; lastTrips = stable(trips); }
    else if (target === "settings") {
      var el = document.getElementById("supervisorName"); if (el && entries.supervisorName != null) el.textContent = entries.supervisorName;
    } else if (target === currentMonthKey) dailyRecords = entries["dailyRecords_" + target];
    refresh();
  }
  function localPayload(target) {
    if (target === "settings") return settingsPayload();
    if (target === "_meta/trips") return { list: clone(trips) };
    return { dailyRecords: target === currentMonthKey ? clone(dailyRecords) : stored("dailyRecords_" + target, {}), trips: clone(trips) };
  }
  function mergeMap(base, local, remote, known, preference, prefix) {
    var result = {}, conflicts = [];
    base = base || {}; local = local || {}; remote = remote || {};
    var keys = Array.from(new Set(Object.keys(base).concat(Object.keys(local), Object.keys(remote))));
    keys.forEach(function (key) {
      var b = base[key], l = local[key], r = remote[key], selected;
      if (equal(l, r)) selected = l;
      else if (known && equal(l, b)) selected = r;
      else if (known && equal(r, b)) selected = l;
      else if (!known && l === undefined) selected = r;
      else if (!known && r === undefined) selected = l;
      else { conflicts.push(prefix + key); selected = preference === "remote" ? r : l; }
      if (selected !== undefined) result[key] = clone(selected);
    });
    return { value: result, conflicts: conflicts };
  }
  function merge(target, base, local, remote, known, preference) {
    if (equal(local, remote)) return { value: clone(local), conflicts: [] };
    if (known && base != null && remote == null) {
      return { value: clone(preference === "remote" ? remote : local), conflicts: ["deleted-node"] };
    }
    if (remote == null) return { value: clone(local), conflicts: [] };
    if (local == null) return { value: clone(preference === "remote" ? remote : local), conflicts: known && equal(remote, base) ? [] : ["deleted-node"] };
    if (target !== "settings" && target !== "_meta/trips") {
      if (!known && !Object.keys(local.dailyRecords || {}).length && Object.keys(remote.dailyRecords || {}).length) {
        return { value: clone(preference === "local" ? local : remote), conflicts: ["unknown-baseline-deletion"] };
      }
      var records = mergeMap(base && base.dailyRecords, local.dailyRecords, remote.dailyRecords, known, preference, "dailyRecords/");
      return { value: { dailyRecords: records.value, trips: clone(remote.trips || local.trips || []) }, conflicts: records.conflicts };
    }
    if (target === "_meta/trips") {
      var list = mergeMap(base || {}, local, remote, known, preference, ""); return list;
    }
    var output = {}, errors = [];
    var keys = Array.from(new Set(Object.keys(base || {}).concat(Object.keys(local), Object.keys(remote))));
    keys.forEach(function (key) {
      var maps = ["monthSettings", "observedHolidays", "customHolidays"].includes(key);
      var step = maps ? mergeMap(base && base[key], local[key], remote[key], known, preference, key + "/") :
        mergeMap(base && Object.prototype.hasOwnProperty.call(base, key) ? { value: base[key] } : {},
          Object.prototype.hasOwnProperty.call(local, key) ? { value: local[key] } : {},
          Object.prototype.hasOwnProperty.call(remote, key) ? { value: remote[key] } : {}, known, preference, key + "/");
      if (maps) output[key] = step.value;
      else if (Object.prototype.hasOwnProperty.call(step.value, "value")) output[key] = step.value.value;
      errors = errors.concat(step.conflicts);
    });
    return { value: output, conflicts: errors };
  }
  function recordConflict(item, root, remote, reason, keys) {
    var conflicts = allConflicts();
    if (conflicts.some(function (v) { return v.path === item.path && v.revision === item.revision && equal(v.remote, remote); })) return;
    var target = targetFor(item.path, root), local = clean(target, item.data);
    var id = RezaOT_storage.archive("sync-conflict", { path: item.path, pending: item.data, remote: remote, reason: reason, keys: keys || [] });
    conflicts = conflicts.filter(function (v) { return v.path !== item.path; });
    conflicts.push({ id: id, path: item.path, target: target, owner: root, local: local, remote: clone(remote),
      baseKnown: item.baseKnown === true, base: clone(item.base || null), revision: item.revision,
      reason: reason, keys: keys || [], createdAt: new Date().toISOString() });
    RezaOT_storage.write(CONFLICT_KEY, conflicts); status();
  }
  function receive(path, data) {
    try {
      var root = getFirebaseRoot(); if (!root || path.indexOf(root + "/") !== 0) return;
      bindDirty(root);
      var item = queueFor(path); if (item) { flush(); return; }
      var target = targetFor(path, root), value = clean(target, data), bases = baselines();
      var previous = bases[path];
      var unresolved = allConflicts().find(function (v) { return v.path === path; });
      if (unresolved) {
        var visible = clean(target, localPayload(target));
        if (!equal(unresolved.local, visible) || !equal(unresolved.remote, value)) {
          var revised = payload(localPayload(target));
          recordConflict({ path: path, data: revised, revision: revised.revision, baseKnown: unresolved.baseKnown,
            base: unresolved.base }, root, value, unresolved.reason, unresolved.keys);
        }
        status(); return;
      }
      if (value == null && ((previous && previous.data != null) || (data && data.deleted === true))) {
        var pending = payload(localPayload(target));
        recordConflict({ path: path, data: pending, revision: pending.revision, baseKnown: !!previous, base: previous ? previous.data : null }, root, null, "remote-node-deleted", ["deleted-node"]);
        return;
      }
      if (value == null) {
        bases[path] = { data: null }; RezaOT_storage.write(BASE_KEY, bases);
        if (target === "settings" && !previous) settingsChanged();
        else if (target === "_meta/trips" && !previous) tripsChanged(true);
        else if (target === currentMonthKey && Object.keys(dailyRecords).length) saveMonth(target);
      } else {
        if (!previous && target !== "settings" && target !== "_meta/trips" && Object.keys(localPayload(target).dailyRecords).length) {
          var initial = merge(target, null, clean(target, localPayload(target)), value, false);
          if (initial.conflicts.length) {
            var initialPending = payload(localPayload(target));
            recordConflict({ path: path, data: initialPending, revision: initialPending.revision, baseKnown: false, base: null }, root, value, "unreconciled-local-data", initial.conflicts);
            return;
          }
          if (!equal(initial.value, value)) {
            bases[path] = { data: clone(value) }; RezaOT_storage.write(BASE_KEY, bases);
            enqueue(target, initial.value); return;
          }
        }
        archiveDifference(path, localPayload(target), value, target === "settings" ? "before-cloud-settings" : target === "_meta/trips" ? "before-cloud-destinations" : "before-cloud-month");
        writeLocal(target, value, path);
      }
      acknowledgedRoot = root; lastAcknowledgedAt = new Date().toISOString(); try{var stamps=stored("rezaot_last_ack",{});stamps[root]=lastAcknowledgedAt;RezaOT_storage.write("rezaot_last_ack",stamps);}catch(e){console.warn("Sync timestamp not persisted");} status();
    } catch (error) {
      try { RezaOT_storage.archive("invalid-cloud-data", { path: path, data: data, message: error.message }); } catch (_) {}
      failure(error);
    }
  }
  function ensureConnection() {
    if (!db || connectionDb === db) return;
    if (connectionSubscription) connectionSubscription.ref.off("value", connectionSubscription.callback);
    connectionDb = db; connected = null;
    var active = db, ref = db.ref(".info/connected");
    var callback = function (snap) {
      if (!connectionSubscription || connectionSubscription.callback !== callback || connectionDb !== active || db !== active) return;
      connected = snap.val() === true; status();
      if (connected) {
        if (typeof document.dispatchEvent === "function" && typeof Event === "function") document.dispatchEvent(new Event("rezaot-cloud-ready"));
        Promise.resolve().then(flush);
      }
    };
    connectionSubscription = { ref: ref, callback: callback };
    ref.on("value", callback, function (error) { if (connectionSubscription && connectionSubscription.callback === callback) failure(error); });
  }
  async function processQueue() {
    while (navigator.onLine && ensureDatabase()) {
      var root = getFirebaseRoot(); if (!root || connected === false) return false;
      bindDirty(root);
      var item = getOfflineQueue().find(function (v) { return v.path.indexOf(root + "/") === 0 && !blocked(v); });
      if (!item) { status(); return true; }
      var activeDb = db, target = targetFor(item.path, root);
      setSyncStatus("syncing");
      try {
        var local;
        try { local = clean(target, item.data); if (!local) throw new Error("Pending kosong/tidak sah"); if (item.baseKnown) clean(target, item.base); }
        catch (invalid) {
          RezaOT_storage.archive("invalid-pending-write", { path: item.path, pending: item.data, message: invalid.message });
          clearOfflineQueueItem(item.path, item.revision); continue;
        }
        var ref = activeDb.ref(item.path);
        if (typeof ref.transaction !== "function") throw new Error("Firebase transaction unavailable");
        var conflict = null, observed = null;
        var identity = item.data.deviceId || getDeviceId(), updatedAt = item.data.lastUpdated || new Date().toISOString();
        var result = await ref.transaction(function (remoteRaw) {
          if (getFirebaseRoot() !== root) return;
          var current = queueFor(item.path); if (!current || current.revision !== item.revision) return;
          var remote = clean(target, remoteRaw); observed = remote;
          if (remoteRaw && remoteRaw.deleted === true && !item.allowDeleted) {
            conflict = { conflicts: ["deleted-node"] }; return;
          }
          var merged = merge(target, item.baseKnown ? item.base : null, local, remote, item.baseKnown === true);
          if (merged.conflicts.length) { conflict = merged; return; }
          conflict = null;
          var outgoing = Object.assign({}, merged.value || {}, { revision: item.revision, lastUpdated: updatedAt, deviceId: identity, lastUpdatedServer: { ".sv": "timestamp" } });
          return outgoing;
        }, undefined, false);
        if (getFirebaseRoot() !== root) return false;
        if (!result.committed) {
          if (conflict) recordConflict(item, root, observed, "concurrent-edit", conflict.conflicts);
          continue;
        }
        var committed = clean(target, result.snapshot.val());
        if (target !== "settings" && target !== "_meta/trips") await activeDb.ref(root + "/_meta/months/" + target).set(true);
        if (getFirebaseRoot() !== root) return false;
        var queue = getOfflineQueue(), current = queue.find(function (v) { return v.path === item.path; });
        var bases = baselines(); bases[item.path] = { data: committed, receivedAt: new Date().toISOString() };
        if (current && current.revision !== item.revision) {
          var rebased = merge(target, local, clean(target, current.data), committed, true, "local").value;
          current.baseKnown = true; current.base = clone(committed);
          current.data = Object.assign({}, rebased, { revision: current.revision, deviceId: current.data.deviceId, lastUpdated: current.data.lastUpdated });
        } else queue = queue.filter(function (v) { return v.path !== item.path || v.revision !== item.revision; });
        var entries = {}; entries[OFFLINE_QUEUE_KEY] = queue; entries[BASE_KEY] = bases;
        entries[CONFLICT_KEY] = allConflicts().filter(function (v) { return v.path !== item.path || v.revision !== item.revision; });
        RezaOT_storage.transaction(entries);
        if (!current || current.revision === item.revision) writeLocal(target, committed, item.path);
        acknowledgedRoot = root; lastAcknowledgedAt = new Date().toISOString(); try{var stamps=stored("rezaot_last_ack",{});stamps[root]=lastAcknowledgedAt;RezaOT_storage.write("rezaot_last_ack",stamps);}catch(e){console.warn("Sync timestamp not persisted");} firebaseReady = true;
      } catch (error) { failure(error); return false; }
    }
    status(); return false;
  }
  function flush() {
    if (running) { flushAgain = true; return running; }
    if (!navigator.onLine || !ensureDatabase()) { status(); return Promise.resolve(false); }
    ensureConnection();
    if (connected === false) { status(); return Promise.resolve(false); }
    flushAgain = false;
    running = Promise.resolve().then(processQueue).then(function (value) {
      running = null;
      if (flushAgain) { flushAgain = false; return flush(); }
      return value;
    }, function (error) { running = null; flushAgain = false; failure(error); return false; });
    return running;
  }
  async function resolveConflict(id, choice) {
    if (!["local", "remote"].includes(choice)) throw new Error("Pilihan konflik tidak sah");
    var entry = getConflicts().find(function (v) { return v.id === id; }), root = getFirebaseRoot();
    if (!entry || root !== entry.owner || !ensureDatabase()) throw new Error("Login kepada pemilik data untuk menyelesaikan konflik.");
    var current = queueFor(entry.path);
    if (current && current.revision !== entry.revision) throw new Error("Rekod telah berubah. Semak konflik terkini dahulu.");
    var remote = clean(entry.target, (await db.ref(entry.path).once("value")).val());
    if (getFirebaseRoot() !== root) throw new Error("Akaun telah berubah.");
    var latest = queueFor(entry.path), latestConflict = getConflicts().find(function (v) { return v.id === id; });
    if (!latestConflict || latestConflict.revision !== entry.revision || (latest && latest.revision !== entry.revision)) {
      throw new Error("Rekod telah berubah. Semak konflik terkini dahulu.");
    }
    var selected = merge(entry.target, entry.base, entry.local, remote, entry.baseKnown, choice).value;
    var queue = getOfflineQueue().filter(function (v) { return v.path !== entry.path; }), bases = baselines(), entries = {};
    bases[entry.path] = { data: clone(remote) };
    if (!equal(selected, remote)) {
      var value = payload(selected || {});
      queue.push({ path: entry.path, data: value, revision: value.revision, queuedAt: new Date().toISOString(), baseKnown: true, base: clone(remote),
        allowDeleted: choice === "local" && remote == null });
    }
    entries[OFFLINE_QUEUE_KEY] = queue; entries[BASE_KEY] = bases;
    entries[CONFLICT_KEY] = allConflicts().filter(function (v) { return v.id !== id; });
    RezaOT_storage.transaction(entries); writeLocal(entry.target, selected, null); status(); return flush();
  }
  function subscribe(path, valid) {
    var ref = db.ref(path), callback = function (snap) { if (!valid || valid()) receive(path, snap.val()); };
    ref.on("value", callback, function (error) { if (!valid || valid()) failure(error); }); return { ref: ref, callback: callback };
  }
  function stopMonth() {
    monthGeneration++; if (monthSubscription) monthSubscription.ref.off("value", monthSubscription.callback);
    monthSubscription = null; firebaseRef = null;
  }
  function startShared() {
    var root = getFirebaseRoot(); if (!root || !ensureDatabase() || root === sharedRoot) return;
    sharedSubscriptions.forEach(function (v) { v.ref.off("value", v.callback); }); sharedSubscriptions = [];
    var generation = ++sharedGeneration; sharedRoot = root;
    sharedSubscriptions.push(subscribe(root + "/settings", function () { return sharedGeneration === generation && getFirebaseRoot() === root; }));
    sharedSubscriptions.push(subscribe(root + "/_meta/trips", function () { return sharedGeneration === generation && getFirebaseRoot() === root; }));
    if (typeof document.dispatchEvent === "function" && typeof Event === "function") document.dispatchEvent(new Event("rezaot-cloud-ready"));
  }
  function startMonth() {
    init(); stopMonth();
    if (!currentMonthKey || !ensureDatabase()) { status(); return Promise.resolve(false); }
    var root = getFirebaseRoot(); if (!root) { status(); return Promise.resolve(false); }
    bindDirty(root); ensureConnection();
    var path = getFirebasePath(), month = currentMonthKey, generation = monthGeneration;
    startShared(); setSyncStatus("syncing");
    monthSubscription = subscribe(path, function () { return monthGeneration === generation && currentMonthKey === month && getFirebasePath() === path; });
    firebaseRef = monthSubscription.ref; return flush();
  }
  function reconnect() {
    stopMonth(); sharedSubscriptions.forEach(function (v) { v.ref.off("value", v.callback); }); sharedSubscriptions = [];
    if (connectionSubscription) connectionSubscription.ref.off("value", connectionSubscription.callback);
    connectionSubscription = null; connectionDb = null; connected = null; acknowledgedRoot = null;
    sharedGeneration++; sharedRoot = null; db = null; lastTrips = null; return startMonth();
  }
  function init() {
    if (initialized) return; initialized = true; lastTrips = stable(trips);
    window.addEventListener("online", reconnect); window.addEventListener("offline", status);
    window.addEventListener("rezaot-storage-error", function () { showToast("Data bermasalah dikekalkan untuk pemulihan. Eksport backup sebelum membuang data.", 5000); });
  }
  function getDiagnostics() {
    var root = getFirebaseRoot(), owner = ownerScope(), queue = getOfflineQueue();
    return { connected: connected === true, pending: root ? queue.filter(function (v) { return v.path.indexOf(root + "/") === 0; }).length : 0,
      dirty: dirtyItems().filter(function (v) { return v.owner === owner || v.owner == null; }).length,
      conflicts: getConflicts().length, currentOwner: owner,
      legacyPending: queue.filter(function (v) { return v.path.indexOf("users/default/") === 0 && root !== "users/default"; }).length,
      lastAcknowledgedAt: root ? stored("rezaot_last_ack", {})[root] || lastAcknowledgedAt : null };
  }
  window.RezaOT_sync = { init: init, saveMonth: saveMonth, startMonth: startMonth, stopMonth: stopMonth,
    settingsChanged: settingsChanged, tripsChanged: tripsChanged, flush: flush, updateSettings: updateSettings,
    prepareImport: prepareImport, reconnect: reconnect, settingsPayload: settingsPayload, userPath: getFirebaseRoot,
    isReady: function () { return !!getFirebaseRoot() && !!ensureDatabase() && connected === true; },
    getConflicts: getConflicts, resolveConflict: resolveConflict, getDiagnostics: getDiagnostics };
})();
