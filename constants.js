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
  "2025-09-01": "Cuti Ganti Hari Kebangsaan",
  "2025-09-05": "Maulidur Rasul",
  "2025-09-16": "Hari Malaysia",
  "2025-10-20": "Deepavali",
  "2025-12-11": "Keputeraan Sultan Selangor",
  "2025-12-25": "Hari Krismas",
  "2026-01-01": "Tahun Baru",
  "2026-02-01": "Thaipusam / Hari Wilayah Persekutuan (KL)",
  "2026-02-02": "Cuti Ganti Thaipusam / Wilayah Persekutuan",
  "2026-02-03": "Cuti Ganti Wilayah Persekutuan (KL)",
  "2026-02-17": "Tahun Baru Cina",
  "2026-02-18": "Tahun Baru Cina (Hari 2)",
  "2026-03-07": "Nuzul Al-Quran (KL/Selangor)",
  "2026-03-21": "Hari Raya Aidilfitri",
  "2026-03-22": "Hari Raya Aidilfitri (Hari 2)",
  "2026-03-23": "Cuti Ganti Hari Raya Aidilfitri",
  "2026-05-01": "Hari Pekerja",
  "2026-05-27": "Hari Raya Aidiladha",
  "2026-05-31": "Hari Wesak",
  "2026-06-01": "Keputeraan YDPA / Cuti Ganti Wesak",
  "2026-06-17": "Awal Muharram",
  "2026-08-25": "Maulidur Rasul",
  "2026-08-31": "Hari Kebangsaan",
  "2026-09-01": "Cuti Negeri Selangor",
  "2026-09-16": "Hari Malaysia",
  "2026-11-08": "Deepavali",
  "2026-11-09": "Cuti Ganti Deepavali",
  "2026-12-11": "Keputeraan Sultan Selangor",
  "2026-12-25": "Hari Krismas",
  "2027-01-01": "Tahun Baru",
  "2027-02-01": "Hari Wilayah Persekutuan (KL)",
  "2027-02-06": "Tahun Baru Cina",
  "2027-02-07": "Tahun Baru Cina (Hari 2)",
  "2027-02-08": "Cuti Ganti Tahun Baru Cina",
  "2027-02-20": "Thaipusam",
  "2027-03-10": "Hari Raya Aidilfitri (anggaran)",
  "2027-03-11": "Hari Raya Aidilfitri (Hari 2)",
  "2027-05-01": "Hari Pekerja",
  "2027-05-16": "Hari Raya Aidiladha (anggaran)",
  "2027-05-20": "Hari Wesak (anggaran)",
  "2027-06-05": "Keputeraan YDPA",
  "2027-06-06": "Awal Muharram (anggaran)",
  "2027-08-15": "Maulidur Rasul (anggaran)",
  "2027-08-31": "Hari Kebangsaan",
  "2027-09-16": "Hari Malaysia",
  "2027-10-28": "Deepavali (anggaran)",
  "2027-12-11": "Keputeraan Sultan Selangor",
  "2027-12-25": "Hari Krismas"
};

function isPublicHoliday(dateStr) {
  return Object.prototype.hasOwnProperty.call(publicHolidays, dateStr);
}

function getHolidayName(dateStr) {
  return publicHolidays[dateStr] || "";
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
      return {
        weekdayAfter: parsed.weekdayAfter || defaultOtSettings.weekdayAfter,
        saturdayAfter: parsed.saturdayAfter || defaultOtSettings.saturdayAfter
      };
    }
  } catch (e) { /* ignore */ }
  return { ...defaultOtSettings };
}

function saveOtSettings(settings) {
  localStorage.setItem("otSettings", JSON.stringify(settings));
}
