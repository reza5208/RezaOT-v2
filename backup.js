// Versioned all-month backups. Validate first, archive current data, then commit locally as one transaction.
(function (root) {
  "use strict";
  const SETTINGS = ["otSettings", "salarySettings", "observedHolidays", "customHolidays", "monthSettings", "supervisorName", "darkMode", "rezaot_lang", "rezaot_print_orientation"];
  const object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  function error(message) { throw new Error(message); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function read(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw == null) return clone(fallback);
    try { return JSON.parse(raw); } catch (e) { error("Data lokal rosak: " + key + ". Pulihkan data sebelum backup/import."); }
  }
  function validateMap(value, kind) {
    if (!object(value)) error("Tetapan cuti tidak sah");
    const result = {};
    for (const date of Object.keys(value)) {
      if (!root.RezaOT_model.validDate(date) || (kind === "observed" ? typeof value[date] !== "boolean" : typeof value[date] !== "string" || !value[date].trim() || value[date].length > 200)) error("Tetapan cuti tidak sah");
      result[date] = value[date];
    }
    return result;
  }
  function validateOt(value) {
    if (typeof root.validateOtSettings === "function") return root.validateOtSettings(value);
    if (!object(value)) error("Tetapan OT tidak sah");
    const weekday = value.weekdayAfter || value.weekdayStart;
    const saturday = value.saturdayAfter || value.saturdayStart;
    if (!root.RezaOT_model.validTime(weekday) || !root.RezaOT_model.validTime(saturday)) error("Tetapan OT tidak sah");
    return { weekdayAfter: weekday, saturdayAfter: saturday, weekdayStart: weekday, saturdayStart: saturday };
  }
  function validateSalary(value) {
    if (typeof root.RezaOT_validateSalarySettings === "function") return root.RezaOT_validateSalarySettings(value);
    if (!object(value)) error("Tetapan gaji tidak sah");
    const fields = ["basicSalary", "hoursPerMonth", "kliaPerDay", "epfEmployeeRate", "epfEmployerRate", "weekdayMult", "restMult", "phMult", "uplDivisor", "socso", "eis", "skim", "restBreakHours", "_v"];
    const result = {};
    for (const key of Object.keys(value)) {
      if (!fields.includes(key)) continue;
      const number = value[key];
      if (typeof number !== "number" || !Number.isFinite(number) || number < 0 || (["hoursPerMonth", "uplDivisor"].includes(key) && number <= 0) || (["epfEmployeeRate", "epfEmployerRate"].includes(key) && number > 1) || (key === "restBreakHours" && number > 24)) error("Tetapan gaji tidak sah: " + key);
      result[key] = number;
    }
    return result;
  }
  function validateSettings(value) {
    if (!object(value)) error("Tetapan backup tidak sah");
    const result = {};
    for (const key of SETTINGS) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      const entry = value[key];
      if (key === "otSettings") result[key] = validateOt(entry);
      else if (key === "salarySettings") result[key] = validateSalary(entry);
      else if (key === "observedHolidays") result[key] = validateMap(entry, "observed");
      else if (key === "customHolidays") result[key] = validateMap(entry, "custom");
      else if (key === "monthSettings") {
        if (!object(entry) || Object.keys(entry).length > 1200) error("Snapshot bulan tidak sah");
        result[key] = {};
        for (const month of Object.keys(entry)) {
          root.RezaOT_model.validateMonthKey(month);
          const snapshot = entry[month];
          if (!object(snapshot) || Object.prototype.hasOwnProperty.call(snapshot, "monthSettings") ||
              !object(snapshot.otSettings) || !object(snapshot.salarySettings) ||
              !object(snapshot.observedHolidays) || typeof snapshot.capturedAt !== "string" ||
              !Number.isFinite(Date.parse(snapshot.capturedAt))) error("Snapshot bulan tidak sah");
          result[key][month] = {
            otSettings: validateOt(snapshot.otSettings),
            salarySettings: validateSalary(snapshot.salarySettings),
            observedHolidays: validateMap(snapshot.observedHolidays, "observed"),
            customHolidays: validateMap(snapshot.customHolidays || {}, "custom"),
            capturedAt: snapshot.capturedAt
          };
        }
        if (typeof root.RezaOT_validateMonthSettings === "function") result[key] = root.RezaOT_validateMonthSettings(result[key]);
      } else {
        if (typeof entry !== "string" || entry.length > 200) error("Tetapan tidak sah: " + key);
        if (key === "darkMode" && !["0", "1"].includes(entry)) error("Tema tidak sah");
        if (key === "rezaot_lang" && !["ms", "en"].includes(entry)) error("Bahasa tidak sah");
        if (key === "rezaot_print_orientation" && !["portrait", "landscape"].includes(entry)) error("Orientasi tidak sah");
        result[key] = entry;
      }
    }
    return result;
  }
  function create() {
    const months = {};
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith("dailyRecords_")) continue;
      const month = key.slice("dailyRecords_".length);
      root.RezaOT_model.validateMonthKey(month);
      months[month] = root.RezaOT_model.validateRecords(read(key, {}), month);
    }
    if (typeof currentMonthKey !== "undefined" && currentMonthKey) months[currentMonthKey] = root.RezaOT_model.validateRecords(dailyRecords, currentMonthKey);
    const settings = {};
    for (const key of SETTINGS) {
      const raw = localStorage.getItem(key);
      if (raw == null) continue;
      settings[key] = ["supervisorName", "darkMode", "rezaot_lang", "rezaot_print_orientation"].includes(key) ? raw : read(key, {});
    }
    return { schemaVersion: 2, app: "RezaOT", exportedAt: new Date().toISOString(), months, trips: root.RezaOT_model.validateDestinations(typeof trips !== "undefined" ? trips : read("trips", [])), settings: validateSettings(settings) };
  }
  function parse(input) {
    const data = typeof input === "string" ? JSON.parse(input) : input;
    if (!object(data)) error("Fail JSON tidak sah");
    const result = { schemaVersion: 2, months: {}, settings: {} };
    if (data.schemaVersion != null && data.schemaVersion !== 2) error("Versi backup tidak disokong");
    if (data.schemaVersion === 2) {
      if (!object(data.months) || Object.keys(data.months).length > 1200) error("Senarai bulan backup tidak sah");
      for (const month of Object.keys(data.months)) result.months[month] = root.RezaOT_model.validateRecords(data.months[month], month);
      result.settings = validateSettings(data.settings || {});
    } else {
      if (!object(data.dailyRecords)) error("Fail JSON tidak sah");
      let month = data.month;
      if (!month) {
        const months = Array.from(new Set(Object.keys(data.dailyRecords).map(root.RezaOT_model.monthFromDate)));
        if (months.length !== 1) error("Bulan asal backup tidak dapat dikenal pasti");
        month = months[0];
      }
      result.months[month] = root.RezaOT_model.validateRecords(data.dailyRecords, month);
      if (data.otSettings != null) result.settings.otSettings = validateOt(data.otSettings);
    }
    if (data.trips != null) result.trips = root.RezaOT_model.validateDestinations(data.trips);
    return result;
  }
  function preview(data) {
    return Object.entries(data.months).map(([month, records]) => month + ": " + Object.keys(records).length + " rekod").join("\n");
  }
  function apply(input, mode) {
    if (!["merge", "replace"].includes(mode)) error("Pilihan import tidak sah");
    const data = parse(input);
    // Archive before any mutation; quota/archive failure leaves the original untouched.
    const recovery = root.RezaOT_storage.archive("before-import", create());
    const entries = {};
    const months = {};
    for (const [month, records] of Object.entries(data.months)) {
      const existing = root.RezaOT_model.validateRecords(read("dailyRecords_" + month, {}), month);
      months[month] = mode === "merge" ? Object.assign({}, existing, records) : records;
      entries["dailyRecords_" + month] = months[month];
    }
    if (data.trips) {
      const previous = root.RezaOT_model.validateDestinations(read("trips", []));
      entries.trips = mode === "merge" ? Array.from(new Set(previous.concat(data.trips))) : data.trips;
    }
    for (const [key, value] of Object.entries(data.settings)) {
      entries[key] = mode === "merge" && ["monthSettings", "observedHolidays", "customHolidays"].includes(key) ? Object.assign({}, read(key, {}), value) : value;
    }
    // Queue every imported cloud write in the same local transaction as its data.
    // If quota is exhausted, neither imported records nor their pending revisions commit.
    const prepare = root.RezaOT_sync && root.RezaOT_sync.prepareImport;
    if (prepare) {
      const queue = prepare({ months, trips: entries.trips, settings: Object.fromEntries(Object.keys(data.settings).map((key) => [key, entries[key]])) });
      Object.assign(entries, queue);
    }
    root.RezaOT_storage.transaction(entries);
    if (typeof currentMonthKey !== "undefined" && months[currentMonthKey]) dailyRecords = months[currentMonthKey];
    if (entries.trips) trips = entries.trips;
    if (prepare) root.RezaOT_sync.flush();
    else if (root.RezaOT_sync) {
      for (const [month, records] of Object.entries(months)) root.RezaOT_sync.saveMonth(month, records);
      if (entries.trips) root.RezaOT_sync.tripsChanged();
      if (Object.keys(data.settings).length) root.RezaOT_sync.settingsChanged();
    }
    return { months: Object.keys(months), recovery };
  }
  root.RezaOT_backup = { create, parse, preview, apply, validateSettings, settingsKeys: SETTINGS.slice() };
})(typeof window === "undefined" ? globalThis : window);
