// Local persistence shared by the app, backup and sync modules.
(function () {
  "use strict";
  var serial = 0;
  var blocked = Object.create(null);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function announce(error, key) {
    if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent("rezaot-storage-error", { detail: { key: key, message: error.message } }));
    }
  }

  function archive(reason, data) {
    var key;
    try {
      do { key = "rezaot_recovery_" + Date.now() + "_" + (++serial); }
      while (localStorage.getItem(key) !== null);
      localStorage.setItem(key, JSON.stringify({ reason: reason, savedAt: new Date().toISOString(), data: data }));
      return key;
    } catch (error) {
      announce(error, key);
      throw new Error("Storage penuh/tidak tersedia. Eksport backup sebelum meneruskan.");
    }
  }

  function read(key, fallback, validate) {
    var raw;
    try {
      raw = localStorage.getItem(key);
      if (raw == null) return clone(fallback);
      var value = JSON.parse(raw);
      return validate ? validate(value) : value;
    } catch (error) {
      // Retain the original key until its raw contents have a recoverable copy.
      if (raw != null && !blocked[key]) {
        try {
          archive("invalid-storage", { key: key, raw: raw, error: error.message });
          blocked[key] = "archived";
        } catch (backupError) {
          blocked[key] = "unarchived";
        }
      }
      announce(error, key);
      return clone(fallback);
    }
  }

  function write(key, value) {
    if (blocked[key] === "unarchived") {
      throw new Error("Data asal belum dapat disalin. Eksport backup atau kosongkan ruang dahulu.");
    }
    try {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      delete blocked[key];
    } catch (error) {
      announce(error, key);
      throw new Error("Data belum disimpan: storage penuh/tidak tersedia.");
    }
  }

  function transaction(entries) {
    if (!Array.isArray(entries)) entries = Object.keys(entries).map(function (key) { return [key, entries[key]]; });
    var old = Object.create(null);
    try { entries.forEach(function (entry) { old[entry[0]] = localStorage.getItem(entry[0]); }); }
    catch (error) { announce(error, "transaction"); throw new Error("Data belum disimpan: storage penuh/tidak tersedia."); }
    try {
      entries.forEach(function (entry) { write(entry[0], entry[1]); });
    } catch (error) {
      Object.keys(old).forEach(function (key) {
        try {
          if (old[key] == null) localStorage.removeItem(key);
          else localStorage.setItem(key, old[key]);
        } catch (rollbackError) { announce(rollbackError, key); }
      });
      throw error;
    }
  }

  function recoveryEntries() {
    var result = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf("rezaot_recovery_") === 0) result.push({ key: key, value: read(key, null) });
    }
    return result;
  }

  window.RezaOT_storage = { read: read, write: write, transaction: transaction, archive: archive, clone: clone, recoveryEntries: recoveryEntries };
})();
