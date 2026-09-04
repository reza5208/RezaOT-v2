// i18n.js — BM / EN (v38)
(function () {
  const dict = {
    ms: {
      appTitle: "Report Trips dan OT",
      pickMonth: "Bulan:",
      quickSave: "⚡ Simpan Hari Ini (8–5)",
      nameLabel: "Nama:",
      empNoLabel: "No. pekerja:",
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
      pickDest: "Sila pilih destinasi.",
      uplLabel: "UPL (cuti tanpa gaji)",
      groupReport: "Laporan",
      groupData: "Data",
      btnEdit: "Edit",
      btnDelete: "Padam",
      selectDest: "-- Pilih Destinasi --",
      monthQuick: "Bulan cepat"
    },
    en: {
      appTitle: "Trips & OT Report",
      pickMonth: "Month:",
      quickSave: "⚡ Save Today (8–5)",
      nameLabel: "Name:",
      empNoLabel: "Emp. No.:",
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
      thSig1: "Emp. sign",
      thSig2: "Sup. sign",
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
      holidayTitle: "Public holidays — mark company observed",
      holidayHint: "Catalog stays. Only checked days count as full OT & blue highlight.",
      yearLabel: "Year:",
      allOn: "✓ All",
      allOff: "✗ None",
      printOT: "Total OT",
      printTrips: "Total trips",
      printKlia: "KLIA Cargo days / trips",
      printNote: "Note: Grey = Saturday · Darker = Sunday · Light blue = observed public holiday",
      days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      holidaySuffix: " (PH)",
      langBtn: "BM",
      langTitle: "Tukar ke Bahasa Melayu",
      toastPrintPdf: "Phone/PWA: open PDF to print…",
      toastSaved: "Attendance saved!",
      toastTrip: "Trip added!",
      toastToday: "Today saved (08:00–17:00)",
      confirmMonth: "Switch to",
      confirmMonth2: "Current month data is already saved.",
      confirmOverwrite: "already exists. Overwrite?",
      fillAll: "Please fill all fields.",
      pickDate: "Please select a date first.",
      pickDest: "Please select a destination.",
      uplLabel: "UPL (unpaid leave)",
      groupReport: "Reports",
      groupData: "Data",
      btnEdit: "Edit",
      btnDelete: "Delete",
      selectDest: "-- Select destination --",
      monthQuick: "Quick month"
    }
  };

  function getLang() {
    return localStorage.getItem("rezaot_lang") === "en" ? "en" : "ms";
  }

  window.RezaOT_i18n = {
    t: function (key) {
      const lang = getLang();
      const pack = dict[lang] || dict.ms;
      return pack[key] != null ? pack[key] : (dict.ms[key] != null ? dict.ms[key] : key);
    },
    days: function () {
      return this.t("days");
    },
    apply: function () {
      document.querySelectorAll("[data-i18n]").forEach(function (el) {
        const key = el.getAttribute("data-i18n");
        const val = window.RezaOT_i18n.t(key);
        if (val != null) el.textContent = val;
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
      if (typeof loadTrips === "function") loadTrips();
      if (typeof updateReport === "function") updateReport();
    },
    toggle: function () {
      const next = getLang() === "en" ? "ms" : "en";
      localStorage.setItem("rezaot_lang", next);
      this.apply();
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    window.RezaOT_i18n.apply();
  });
})();
