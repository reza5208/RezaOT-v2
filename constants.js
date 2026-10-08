const defaultTrips = [
  "MBG Wangsa Walk", "MBG IOI Putrajaya", "MBG DPulze", "MBG KLIA2",
  "MBG AEON Maluri", "MBG NU Sentral", "MBG Ampang", "Hospital Serdang",
  "KLIA Cargo"
];

const monthNames = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember"
];

const defaultOtSettings = {
  weekdayAfter: "17:00",
  saturdayAfter: "14:00"
};

/** Katalog cuti umum MY (KL/Selangor) — key YYYY-MM-DD */
const publicHolidays = {
  "2026-01-01": "Hari Tahun Baru",
  "2026-01-29": "Tahun Baru Cina",
  "2026-01-30": "Tahun Baru Cina (hari ke-2)",
  "2026-02-01": "Hari Wilayah Persekutuan",
  "2026-03-21": "Hari Nuzul Al-Quran (anggaran)",
  "2026-03-22": "Hari Raya Aidilfitri (anggaran)",
  "2026-03-23": "Hari Raya Aidilfitri (hari ke-2, anggaran)",
  "2026-05-01": "Hari Pekerja",
  "2026-05-27": "Hari Wesak (anggaran)",
  "2026-06-01": "Hari Keputeraan SPB Yang di-Pertuan Agong",
  "2026-06-17": "Hari Raya Aidiladha (anggaran)",
  "2026-07-07": "Awal Muharram (anggaran)",
  "2026-08-31": "Hari Kebangsaan",
  "2026-09-16": "Hari Malaysia",
  "2026-09-16": "Hari Malaysia",
  "2026-11-08": "Deepavali (anggaran)",
  "2026-12-11": "Keputeraan Sultan Selangor",
  "2026-12-25": "Hari Krismas",
  "2027-01-01": "Hari Tahun Baru",
  "2027-02-06": "Tahun Baru Cina (anggaran)",
  "2027-02-07": "Tahun Baru Cina (hari ke-2, anggaran)",
  "2027-02-01": "Hari Wilayah Persekutuan",
  "2027-03-10": "Hari Nuzul Al-Quran (anggaran)",
  "2027-03-12": "Hari Raya Aidilfitri (anggaran)",
  "2027-03-13": "Hari Raya Aidilfitri (hari ke-2, anggaran)",
  "2027-05-01": "Hari Pekerja",
  "2027-05-16": "Hari Wesak (anggaran)",
  "2027-06-01": "Hari Keputeraan SPB Yang di-Pertuan Agong",
  "2027-06-07": "Hari Raya Aidiladha (anggaran)",
  "2027-06-26": "Awal Muharram (anggaran)",
  "2027-08-31": "Hari Kebangsaan",
  "2027-09-16": "Hari Malaysia",
  "2027-10-28": "Deepavali (anggaran)",
  "2027-12-11": "Keputeraan Sultan Selangor",
  "2027-12-25": "Hari Krismas"
};

function getObservedHolidaysMap() {
  try {
    const raw = localStorage.getItem("observedHolidays");
    if (raw) return JSON.parse(raw) || {};
  } catch (e) {}
  return {};
}

function saveObservedHolidaysMap(map) {
  localStorage.setItem("observedHolidays", JSON.stringify(map || {}));
}

function getAllHolidayDates() {
  return Object.keys(publicHolidays).sort();
}

function isCatalogHoliday(dateStr) {
  return Object.prototype.hasOwnProperty.call(publicHolidays, dateStr);
}

/** Cuti yang company AMBIL — diguna untuk OT & highlight table */
function isPublicHoliday(dateStr) {
  if (!isCatalogHoliday(dateStr)) return false;
  const map = getObservedHolidaysMap();
  if (!Object.prototype.hasOwnProperty.call(map, dateStr)) return true;
  return map[dateStr] === true;
}

function getHolidayName(dateStr) {
  return publicHolidays[dateStr] || "";
}

function setHolidayObserved(dateStr, observed) {
  if (!isCatalogHoliday(dateStr)) return;
  const map = getObservedHolidaysMap();
  map[dateStr] = !!observed;
  saveObservedHolidaysMap(map);
}

function timeToMinutes(time) {
  if (!time || typeof time !== "string") return 0;
  const parts = time.split(":");
  return Number(parts[0]) * 60 + Number(parts[1] || 0);
}

function getOtSettings() {
  try {
    const raw = localStorage.getItem("otSettings");
    if (raw) {
      const parsed = JSON.parse(raw);
      var w = parsed.weekdayAfter || parsed.weekdayStart || defaultOtSettings.weekdayAfter;
      var s = parsed.saturdayAfter || parsed.saturdayStart || defaultOtSettings.saturdayAfter;
      return {
        weekdayAfter: w,
        saturdayAfter: s,
        weekdayStart: w,
        saturdayStart: s
      };
    }
  } catch (e) { /* ignore */ }
  return {
    weekdayAfter: defaultOtSettings.weekdayAfter,
    saturdayAfter: defaultOtSettings.saturdayAfter,
    weekdayStart: defaultOtSettings.weekdayAfter,
    saturdayStart: defaultOtSettings.saturdayAfter
  };
}

function saveOtSettings(settings) {
  localStorage.setItem("otSettings", JSON.stringify(settings));
}
