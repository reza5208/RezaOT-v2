// constants.js
const defaultTrips = [
  "KLIA Cargo", "MBG KLIA2", "MBG 163", "MBG AEON Maluri", "MBG NU Sentral",
  "MBG DPulze", "MBG Setapak Sentral", "MBG Selayang", "MBG Nilai", "MBG Redtick",
  "MBG AEON Shah Alam", "MBG IOI Putrajaya", "MBG MRT", "MBG Pavilion Bukit Jalil",
  "MBG Ampang", "MBG Bangsar", "MBG Setia Alam", "MBG Kota Damansara"
];

const monthNames = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember"
];

const defaultOtSettings = {
  weekdayAfter: "17:00",
  saturdayAfter: "14:00"
};

// Cuti umum Malaysia — Nasional + WP KL + Selangor
// Tarikh Islamik 2027 adalah anggaran (tertakluk moon-sighting rasmi)
const publicHolidays = {
  "2025-01-01": "Tahun Baru",
  "2025-01-29": "Tahun Baru Cina",
  "2025-01-30": "Tahun Baru Cina (Hari 2)",
  "2025-02-01": "Thaipusam / Hari Wilayah Persekutuan (KL)",
  "2025-03-31": "Hari Raya Aidilfitri",
  "2025-04-01": "Hari Raya Aidilfitri (Hari 2)",
  "2025-05-01": "Hari Pekerja",
  "2025-05-12": "Hari Wesak",
  "2025-06-02": "Keputeraan YDPA",
  "2025-06-07": "Hari Raya Aidiladha",
  "2025-06-27": "Awal Muharram",
  "2025-08-31": "Hari Kebangsaan",
  "2025-09-05": "Maulidur Rasul",
  "2025-09-16": "Hari Malaysia",
  "2025-10-20": "Deepavali",
  "2025-12-11": "Keputeraan Sultan Selangor",
  "2025-12-25": "Krismas",
  "2026-01-01": "Tahun Baru",
  "2026-01-29": "Tahun Baru Cina",
  "2026-01-30": "Tahun Baru Cina (Hari 2)",
  "2026-02-01": "Hari Wilayah Persekutuan (KL) / Thaipusam (semak tarikh)",
  "2026-03-21": "Nuzul Al-Quran (anggaran)",
  "2026-03-22": "Hari Raya Aidilfitri (anggaran)",
  "2026-03-23": "Hari Raya Aidilfitri Hari 2 (anggaran)",
  "2026-05-01": "Hari Pekerja",
  "2026-05-27": "Hari Wesak (anggaran)",
  "2026-06-01": "Keputeraan YDPA",
  "2026-06-17": "Hari Raya Aidiladha (anggaran)",
  "2026-07-07": "Awal Muharram (anggaran)",
  "2026-08-31": "Hari Kebangsaan",
  "2026-09-16": "Hari Malaysia",
  "2026-11-08": "Deepavali (anggaran)",
  "2026-12-11": "Keputeraan Sultan Selangor",
  "2026-12-25": "Krismas",
  "2027-01-01": "Tahun Baru",
  "2027-02-01": "Hari Wilayah Persekutuan (KL)",
  "2027-02-06": "Tahun Baru Cina (anggaran)",
  "2027-02-07": "Tahun Baru Cina Hari 2 (anggaran)",
  "2027-03-10": "Nuzul Al-Quran (anggaran)",
  "2027-03-12": "Hari Raya Aidilfitri (anggaran)",
  "2027-03-13": "Hari Raya Aidilfitri Hari 2 (anggaran)",
  "2027-05-01": "Hari Pekerja",
  "2027-05-16": "Hari Wesak (anggaran)",
  "2027-06-01": "Keputeraan YDPA",
  "2027-06-07": "Hari Raya Aidiladha (anggaran)",
  "2027-06-26": "Awal Muharram (anggaran)",
  "2027-08-31": "Hari Kebangsaan",
  "2027-09-16": "Hari Malaysia",
  "2027-10-28": "Deepavali (anggaran)",
  "2027-12-11": "Keputeraan Sultan Selangor",
  "2027-12-25": "Krismas"
};

// The bundled calendar is legacy reference data, not a verified official calendar.
// Company selections and corrections are explicit; no holiday is taken by default.
const holidayCatalogInfo = {
  verified: false,
  source: "Katalog warisan 2025–2027 — semak dengan kalendar rasmi / company sebelum memilih"
};

function RezaOT_isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parts = value.split("-").map(Number);
  if (parts[0] < 1900 || parts[0] > 9999) return false;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2];
}

function RezaOT_isValidTime(value) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function readCalculationSetting(key, fallback, validator) {
  if (window.RezaOT_storage) return RezaOT_storage.read(key, fallback, function (value) {
    if (validator && !validator(value)) throw new TypeError("Tetapan tidak sah: " + key);
    return value;
  });
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return !validator || validator(parsed) ? parsed : fallback;
  } catch (e) { return fallback; }
}

function writeCalculationSetting(key, value) {
  const changes = { [key]: value };
  // A deliberate defaults edit also protects retained legacy months which do
  // not yet have a snapshot. Merely reading a report never writes a snapshot.
  if (["otSettings", "salarySettings", "observedHolidays", "customHolidays"].includes(key)) {
    const snapshots = readCalculationSetting("monthSettings", {}, isPlainSettingMap);
    let changed = false;
    for (let i = 0; i < localStorage.length; i++) {
      const stored = localStorage.key(i);
      if (!stored || !stored.startsWith("dailyRecords_")) continue;
      const month = stored.slice("dailyRecords_".length);
      const parts = month.split(" ");
      if (parts.length !== 2 || monthNames.indexOf(parts[0]) < 0 || !/^(?:19|[2-9]\d)\d{2}$/.test(parts[1]) || snapshots[month]) continue;
      let records;
      try { records = JSON.parse(localStorage.getItem(stored)); } catch (_) { continue; }
      if (!records || Array.isArray(records) || typeof records !== "object" || !Object.keys(records).length) continue;
      snapshots[month] = JSON.parse(JSON.stringify(Object.assign(getGlobalCalculationSettings(), { capturedAt: new Date().toISOString() })));
      changed = true;
    }
    if (changed) changes.monthSettings = snapshots;
  }
  if (window.RezaOT_sync && typeof RezaOT_sync.updateSettings === "function") {
    return RezaOT_sync.updateSettings(changes);
  }
  if (window.RezaOT_storage) RezaOT_storage.transaction(changes);
  else Object.keys(changes).forEach(function (name) { localStorage.setItem(name, JSON.stringify(changes[name])); });
  if (window.RezaOT_sync && typeof RezaOT_sync.settingsChanged === "function") RezaOT_sync.settingsChanged();
}

function isPlainSettingMap(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isObservedHolidaysMap(value) {
  return isPlainSettingMap(value) && Object.keys(value).every(function (date) {
    return RezaOT_isValidDate(date) && typeof value[date] === "boolean";
  });
}

function isCustomHolidaysMap(value) {
  return isPlainSettingMap(value) && Object.keys(value).every(function (date) {
    return RezaOT_isValidDate(date) && typeof value[date] === "string" && value[date].trim().length > 0 && value[date].length <= 200;
  });
}

function getObservedHolidaysMap() {
  return readCalculationSetting("observedHolidays", {}, isObservedHolidaysMap);
}

function saveObservedHolidaysMap(map) {
  if (!isObservedHolidaysMap(map)) throw new TypeError("Pilihan cuti tidak sah.");
  writeCalculationSetting("observedHolidays", map);
}

function getCustomHolidaysMap() {
  return readCalculationSetting("customHolidays", {}, isCustomHolidaysMap);
}

function saveCustomHolidaysMap(map) {
  if (!isCustomHolidaysMap(map)) throw new TypeError("Cuti company tidak sah.");
  writeCalculationSetting("customHolidays", map);
}

function addCustomHoliday(date, name, observed) {
  if (!RezaOT_isValidDate(date) || typeof name !== "string" || !name.trim() || name.trim().length > 200) {
    throw new TypeError("Isi tarikh dan nama cuti yang sah (maksimum 200 aksara).");
  }
  const map = getCustomHolidaysMap();
  map[date] = name.trim();
  saveCustomHolidaysMap(map);
  setHolidayObserved(date, observed !== false);
}

function removeCustomHoliday(date) {
  const map = getCustomHolidaysMap();
  delete map[date];
  saveCustomHolidaysMap(map);
  const observed = getObservedHolidaysMap();
  delete observed[date];
  saveObservedHolidaysMap(observed);
}

function getAllHolidayDates() {
  return Array.from(new Set(Object.keys(publicHolidays).concat(Object.keys(getCustomHolidaysMap())))).sort();
}

function isCatalogHoliday(dateStr) {
  return Object.prototype.hasOwnProperty.call(publicHolidays, dateStr) || Object.prototype.hasOwnProperty.call(getCustomHolidaysMap(), dateStr);
}

function monthKeyForDate(dateStr) {
  if (!RezaOT_isValidDate(dateStr)) return "";
  return monthNames[Number(dateStr.slice(5, 7)) - 1] + " " + dateStr.slice(0, 4);
}

function getGlobalCalculationSettings() {
  return {
    otSettings: getOtSettings(),
    salarySettings: window.RezaOT_salary ? RezaOT_salary.loadSettings() : {},
    observedHolidays: getObservedHolidaysMap(),
    customHolidays: getCustomHolidaysMap()
  };
}

function getMonthCalculationSettings(monthKey) {
  const snapshots = readCalculationSetting("monthSettings", {}, isPlainSettingMap);
  const snapshot = Object.prototype.hasOwnProperty.call(snapshots, monthKey) ? snapshots[monthKey] : null;
  if (snapshot && isPlainSettingMap(snapshot) && isPlainSettingMap(snapshot.salarySettings) &&
      isObservedHolidaysMap(snapshot.observedHolidays) && isCustomHolidaysMap(snapshot.customHolidays || {})) {
    try {
      return Object.assign({}, snapshot, {
        otSettings: validateOtSettings(snapshot.otSettings),
        salarySettings: window.RezaOT_validateSalarySettings ? RezaOT_validateSalarySettings(snapshot.salarySettings) : snapshot.salarySettings
      });
    } catch (e) { /* Invalid stored snapshots never become calculation inputs. */ }
  }
  return getGlobalCalculationSettings();
}

function getRecordCalculationSettings(dateStr) {
  return getMonthCalculationSettings(monthKeyForDate(dateStr));
}

function captureMonthSettings(monthKey, options) {
  if (typeof monthKey !== "string" || !/^[^ ]+ \d{4}$/.test(monthKey) || monthNames.indexOf(monthKey.split(" ")[0]) < 0 || Number(monthKey.split(" ")[1]) < 1900) {
    throw new TypeError("Bulan tetapan tidak sah.");
  }
  const snapshots = readCalculationSetting("monthSettings", {}, isPlainSettingMap);
  if (snapshots[monthKey] && !(options && options.replace)) return snapshots[monthKey];
  const snapshot = Object.assign(getGlobalCalculationSettings(), { capturedAt: new Date().toISOString() });
  snapshots[monthKey] = JSON.parse(JSON.stringify(snapshot));
  writeCalculationSetting("monthSettings", snapshots);
  return snapshots[monthKey];
}

/** Only company-selected holidays count; historical records use their month snapshot. */
function isPublicHoliday(dateStr, calculationSettings) {
  const settings = calculationSettings || getRecordCalculationSettings(dateStr);
  const custom = settings.customHolidays || {};
  if (!Object.prototype.hasOwnProperty.call(publicHolidays, dateStr) && !Object.prototype.hasOwnProperty.call(custom, dateStr)) return false;
  return !!settings.observedHolidays && settings.observedHolidays[dateStr] === true;
}

function getHolidayName(dateStr, useCurrentDefaults) {
  const custom = useCurrentDefaults ? getCustomHolidaysMap() : getRecordCalculationSettings(dateStr).customHolidays || {};
  return custom[dateStr] || publicHolidays[dateStr] || "";
}

function setHolidayObserved(dateStr, observed) {
  if (!isCatalogHoliday(dateStr)) return;
  const map = getObservedHolidaysMap();
  map[dateStr] = !!observed;
  saveObservedHolidaysMap(map);
}

function timeToMinutes(time) {
  if (!RezaOT_isValidTime(time)) return NaN;
  const parts = time.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function validateOtSettings(settings) {
  if (!isPlainSettingMap(settings)) throw new TypeError("Tetapan OT tidak sah.");
  const w = settings.weekdayAfter ?? settings.weekdayStart ?? defaultOtSettings.weekdayAfter;
  const s = settings.saturdayAfter ?? settings.saturdayStart ?? defaultOtSettings.saturdayAfter;
  if (!RezaOT_isValidTime(w) || !RezaOT_isValidTime(s)) throw new TypeError("Masa mesti 00:00–23:59 (HH:MM).");
  return { weekdayAfter: w, saturdayAfter: s, weekdayStart: w, saturdayStart: s };
}

function getOtSettings() {
  const parsed = readCalculationSetting("otSettings", defaultOtSettings, isPlainSettingMap);
  try { return validateOtSettings(parsed); }
  catch (e) { return validateOtSettings(defaultOtSettings); }
}

function saveOtSettings(settings) {
  writeCalculationSetting("otSettings", validateOtSettings(settings));
}

function validateMonthSettings(value) {
  if (!isPlainSettingMap(value)) throw new TypeError("Snapshot bulan tidak sah.");
  const result = {};
  Object.keys(value).forEach(function (month) {
    const parts = month.split(" ");
    const snapshot = value[month];
    if (parts.length !== 2 || monthNames.indexOf(parts[0]) < 0 || !/^\d{4}$/.test(parts[1]) || Number(parts[1]) < 1900 ||
        !isPlainSettingMap(snapshot) || !isObservedHolidaysMap(snapshot.observedHolidays) ||
        !isCustomHolidaysMap(snapshot.customHolidays || {}) || !Number.isFinite(Date.parse(snapshot.capturedAt))) {
      throw new TypeError("Snapshot bulan tidak sah: " + month);
    }
    result[month] = {
      otSettings: validateOtSettings(snapshot.otSettings),
      salarySettings: RezaOT_validateSalarySettings(snapshot.salarySettings),
      observedHolidays: snapshot.observedHolidays,
      customHolidays: snapshot.customHolidays || {},
      capturedAt: snapshot.capturedAt
    };
  });
  return result;
}
window.RezaOT_validateMonthSettings = validateMonthSettings;
