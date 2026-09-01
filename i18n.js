// i18n.js — BM / EN toggle
(function () {
  "use strict";

  const STR = {
    ms: {
      appTitle: "Report Trips dan OT",
      pickMonth: "Pilih Bulan & Tahun:",
      quickSave: "⚡ Simpan Hari Ini (8–5)",
      nameLabel: "Nama:",
      deptLabel: "Jabatan:",
      monthLabel: "Bulan:",
      supervisorLabel: "Nama Ketua:",
      editHint: "(klik untuk edit)",
      dateLabel: "Tarikh:",
      clockIn: "Clock-In:",
      clockOut: "Clock-Out:",
      nowBtn: "⏱️ Sekarang",
      saveAttendance: "✅ Simpan Kehadiran",
      destination: "Destinasi:",
      awb: "Airway Bill (KLIA Cargo):",
      addTrip: "➕ Tambah Trip",
      manageDest: "⚙️ Manage Destinasi",
      manageTitle: "Manage Destinasi",
      newDestPlaceholder: "Nama destinasi baru",
      addBtn: "Tambah",
      currentList: "Senarai Destinasi Semasa:",
      monthlyReport: "Laporan Bulanan",
      thDate: "Tarikh",
      thDay: "Hari",
      thDest: "Destinasi",
      thIn: "Clock-In",
      thOut: "Clock-Out",
      thOT: "OT (Jam)",
      thSig1: "T/T pekerja",
      thSig2: "T/T ketua",
      thAction: "Tindakan",
      noRecords: "Tiada rekod untuk bulan ini.",
      totalOT: "Jumlah OT Bulan Ini:",
      hours: "Jam",
      sumDays: "Hari Berkerja",
      sumKlia: "Hari KLIA Cargo",
      sumAwb: "Total AWB",
      sumTrips: "Total Trip",
      printBtn: "Cetak Laporan (A4)",
      pdfBtn: "📄 Export PDF",
      excelBtn: "📊 Export ke Excel",
      backupBtn: "Export Data (Backup)",
      importBtn: "Import Data",
      holidayTitle: "Cuti umum — pilih yang company ambil",
      holidayHint: "Data katalog kekal. Hanya cuti yang ditanda ✓ dikira OT penuh & highlight biru.",
      yearLabel: "Tahun:",
      allOn: "✓ Semua",
      allOff: "✗ Tiada",
      printOT: "Jumlah OT",
      printTrips: "Jumlah Trip",
      printKlia: "Hari / Trip KLIA Cargo",
      printNote: "Nota: Kelabu = Sabtu · Lebih gelap = Ahad · Biru muda = Cuti umum (yang company ambil)",
      days: ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"],
      holidaySuffix: " (Cuti)",
      langBtn: "EN",
      langTitle: "Switch to English",
      toastPrintPdf: "Phone/PWA: buka PDF untuk cetak…",
      toastSaved: "Kehadiran berjaya disimpan!",
      toastTrip: "Trip berjaya ditambah!",
      toastToday: "Hari ini disimpan (08:00–17:00)",
      confirmMonth: "Tukar ke",
      confirmMonth2: "Data bulan semasa sudah disimpan.",
      confirmOverwrite: "sudah wujud. Tulis ganti?",
      fillAll: "Sila isi semua medan.",
      pickDate: "Sila pilih tarikh dahulu.",
      pickDest: "Sila pilih destinasi."
    },
    en: {
      appTitle: "Trips & OT Report",
      pickMonth: "Select Month & Year:",
      quickSave: "⚡ Save Today (8–5)",
      nameLabel: "Name:",
      deptLabel: "Dept:",
      monthLabel: "Month:",
      supervisorLabel: "Supervisor:",
      editHint: "(tap to edit)",
      dateLabel: "Date:",
      clockIn: "Clock-In:",
      clockOut: "Clock-Out:",
      nowBtn: "⏱️ Now",
      saveAttendance: "✅ Save Attendance",
      destination: "Destination:",
      awb: "Airway Bill (KLIA Cargo):",
      addTrip: "➕ Add Trip",
      manageDest: "⚙️ Manage Destinations",
      manageTitle: "Manage Destinations",
      newDestPlaceholder: "New destination name",
      addBtn: "Add",
      currentList: "Current destinations:",
      monthlyReport: "Monthly Report",
      thDate: "Date",
      thDay: "Day",
      thDest: "Destination",
      thIn: "Clock-In",
      thOut: "Clock-Out",
      thOT: "OT (Hrs)",
      thSig1: "Staff sign",
      thSig2: "Supervisor",
      thAction: "Actions",
      noRecords: "No records for this month.",
      totalOT: "Total OT this month:",
      hours: "Hrs",
      sumDays: "Work Days",
      sumKlia: "KLIA Cargo Days",
      sumAwb: "Total AWB",
      sumTrips: "Total Trips",
      printBtn: "Print Report (A4)",
      pdfBtn: "📄 Export PDF",
      excelBtn: "📊 Export Excel",
      backupBtn: "Export Data (Backup)",
      importBtn: "Import Data",
      holidayTitle: "Public holidays — select company days off",
      holidayHint: "Full catalogue kept. Only checked days count as full OT & blue highlight.",
      yearLabel: "Year:",
      allOn: "✓ All",
      allOff: "✗ None",
      printOT: "Total OT",
      printTrips: "Total Trips",
      printKlia: "KLIA Cargo days / trips",
      printNote: "Note: Grey = Saturday · Darker = Sunday · Light blue = Public holiday (observed)",
      days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      holidaySuffix: " (PH)",
      langBtn: "BM",
      langTitle: "Tukar ke Bahasa Melayu",
      toastPrintPdf: "Phone/PWA: opening PDF for print…",
      toastSaved: "Attendance saved!",
      toastTrip: "Trip added!",
      toastToday: "Today saved (08:00–17:00)",
      confirmMonth: "Switch to",
      confirmMonth2: "Current month data is already saved.",
      confirmOverwrite: "already exists. Overwrite?",
      fillAll: "Please fill all fields.",
      pickDate: "Please select a date first.",
      pickDest: "Please select a destination."
    }
  };

  window.RezaOT_i18n = {
    lang: localStorage.getItem("rezaot_lang") || "ms",
    t: function (key) {
      const pack = STR[this.lang] || STR.ms;
      return pack[key] != null ? pack[key] : (STR.ms[key] || key);
    },
    days: function () {
      return this.t("days");
    },
    apply: function () {
      const lang = this.lang;
      document.documentElement.lang = lang === "en" ? "en" : "ms";
      document.querySelectorAll("[data-i18n]").forEach(function (el) {
        const key = el.getAttribute("data-i18n");
        const val = window.RezaOT_i18n.t(key);
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          if (el.hasAttribute("data-i18n-placeholder")) el.placeholder = val;
        } else {
          el.textContent = val;
        }
      });
      document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
        el.title = window.RezaOT_i18n.t(el.getAttribute("data-i18n-title"));
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
        el.placeholder = window.RezaOT_i18n.t(el.getAttribute("data-i18n-placeholder"));
      });

      const langBtn = document.getElementById("langToggleBtn");
      if (langBtn) {
        langBtn.textContent = window.RezaOT_i18n.t("langBtn");
        langBtn.title = window.RezaOT_i18n.t("langTitle");
      }

      const totalWrap = document.querySelector(".total-ot h3");
      if (totalWrap) {
        const span = document.getElementById("totalOT");
        const otVal = span ? span.textContent : "0.00";
        totalWrap.textContent = "";
        totalWrap.appendChild(document.createTextNode(window.RezaOT_i18n.t("totalOT") + " "));
        const s = document.createElement("span");
        s.id = "totalOT";
        s.textContent = otVal;
        totalWrap.appendChild(s);
        totalWrap.appendChild(document.createTextNode(" " + window.RezaOT_i18n.t("hours")));
      }

      if (typeof updateReport === "function") updateReport();
    },
    toggle: function () {
      this.lang = this.lang === "ms" ? "en" : "ms";
      localStorage.setItem("rezaot_lang", this.lang);
      this.apply();
      if (typeof showToast === "function") {
        showToast(this.lang === "en" ? "Language: English" : "Bahasa: Melayu");
      }
    }
  };

  window.t = function (key) {
    return window.RezaOT_i18n.t(key);
  };
})();
