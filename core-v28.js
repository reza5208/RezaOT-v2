// core-v28.js — single feature layer (P1: replaces extras + print-lang + salary-patch)
(function () {
  "use strict";
  var _printBusy = false;

  function isMobileOrPwa() {
    var standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    var coarse = window.matchMedia("(pointer: coarse)").matches;
    var narrow = window.matchMedia("(max-width: 900px)").matches;
    return standalone || (coarse && narrow);
  }

  window.handlePrint = function () {
    if (_printBusy) return;
    if (isMobileOrPwa()) { window.handleExportPdf(); return; }
    _printBusy = true;
    if (typeof applyPrintAutoSize === "function") applyPrintAutoSize();
    requestAnimationFrame(function () {
      setTimeout(function () {
        try { window.print(); } catch (e) {}
        setTimeout(function () {
          if (typeof clearPrintAutoSize === "function") clearPrintAutoSize();
          _printBusy = false;
        }, 500);
      }, 50);
    });
  };

  window.handleExportPdf = function () {
    if (_printBusy) return;
    if (typeof html2pdf === "undefined") { showToast("html2pdf tidak dimuat"); return; }
    _printBusy = true;
    if (typeof applyPrintAutoSize === "function") applyPrintAutoSize();
    document.body.classList.add("pdf-export");
    var el = document.querySelector(".container");
    var fname = "RezaOT_" + String(currentMonthKey || "report").replace(/\s+/g, "_") + ".pdf";
    setTimeout(function () {
      html2pdf().set({
        margin: [8, 8, 8, 8], filename: fname,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      }).from(el).save()
        .then(function () { showToast("PDF dimuat turun"); })
        .catch(function () { showToast("Gagal jana PDF"); })
        .finally(function () {
          document.body.classList.remove("pdf-export");
          if (typeof clearPrintAutoSize === "function") clearPrintAutoSize();
          _printBusy = false;
        });
    }, 250);
  };

  function rebind(id, fn) {
    var btn = document.getElementById(id);
    if (!btn) return;
    var neo = btn.cloneNode(true);
    btn.parentNode.replaceChild(neo, btn);
    neo.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
  }

  window.findAwbDuplicate = function (awb) {
    if (!awb) return null;
    var needle = String(awb).trim().toLowerCase();
    var dates = Object.keys(dailyRecords || {});
    for (var i = 0; i < dates.length; i++) {
      var tripsArr = (dailyRecords[dates[i]] && dailyRecords[dates[i]].trips) || [];
      for (var j = 0; j < tripsArr.length; j++) {
        var m = String(tripsArr[j]).match(/\(([^)]+)\)/);
        if (m && m[1].trim().toLowerCase() === needle) return { date: dates[i], trip: tripsArr[j] };
      }
    }
    return null;
  };

  window.handleTripFormSubmit = function (e) {
    e.preventDefault();
    var date = document.getElementById("date").value;
    var destination = document.getElementById("destination").value;
    var awbInput = document.getElementById("airwayBill");
    var awb = awbInput ? awbInput.value.trim() : "";
    if (!date) { showToast("Sila pilih tarikh dahulu."); return; }
    if (!destination) { showToast("Sila pilih destinasi."); return; }
    if (destination.toLowerCase().includes("klia cargo") && awb) {
      var dup = findAwbDuplicate(awb);
      if (dup && !confirm("AWB \"" + awb + "\" sudah wujud pada " + dup.date + ".\nTambah juga?")) return;
    }
    if (!dailyRecords[date]) dailyRecords[date] = { clock_in: "", clock_out: "", trips: [] };
    if (!Array.isArray(dailyRecords[date].trips)) dailyRecords[date].trips = [];
    var tripName = destination;
    if (destination.toLowerCase().includes("klia cargo") && awb) tripName = "KLIA Cargo (" + awb + ")";
    dailyRecords[date].trips.push(tripName);
    var upl = document.getElementById("unpaidLeaveCheck");
    if (upl && upl.checked) dailyRecords[date].unpaid = true;
    saveToLocalStorage();
    updateReport();
    document.getElementById("destination").value = "";
    if (awbInput) awbInput.value = "";
    var af = document.getElementById("airwayBillField");
    if (af) af.style.display = "none";
    showToast("Trip berjaya ditambah!");
  };

  window.handleClockFormSubmit = function (e) {
    e.preventDefault();
    var date = document.getElementById("date").value;
    var clockIn = document.getElementById("clockIn").value;
    var clockOut = document.getElementById("clockOut").value;
    if (!date || !clockIn || !clockOut) { showToast("Sila isi semua medan."); return; }
    if (dailyRecords[date] && (dailyRecords[date].clock_in || dailyRecords[date].clock_out)) {
      if (!confirm("Rekod untuk " + date + " sudah wujud. Tulis ganti?")) return;
    }
    if (!dailyRecords[date]) dailyRecords[date] = { clock_in: clockIn, clock_out: clockOut, trips: [] };
    else { dailyRecords[date].clock_in = clockIn; dailyRecords[date].clock_out = clockOut; }
    var upl = document.getElementById("unpaidLeaveCheck");
    if (upl) dailyRecords[date].unpaid = !!upl.checked;
    saveToLocalStorage();
    updateReport();
    showToast("Kehadiran berjaya disimpan!");
  };

  window.deleteRecord = function (date) {
    var rec = dailyRecords[date];
    var n = rec && Array.isArray(rec.trips) ? rec.trips.length : 0;
    var cin = rec && rec.clock_in ? rec.clock_in : "-";
    var cout = rec && rec.clock_out ? rec.clock_out : "-";
    if (!confirm("Padam rekod " + date + "?\nTrip: " + n + " · In: " + cin + " · Out: " + cout)) return;
    delete dailyRecords[date];
    saveToLocalStorage();
    updateReport();
    showToast("Rekod dipadam");
  };

  window.deleteTrip = function (date, tripIndex) {
    var rec = dailyRecords[date];
    if (!rec || !Array.isArray(rec.trips) || !rec.trips[tripIndex]) return;
    var name = String(rec.trips[tripIndex]);
    if (!confirm("Padam trip pada " + date + "?\n\"" + name + "\"\nBaki: " + (rec.trips.length - 1))) return;
    rec.trips.splice(tripIndex, 1);
    saveToLocalStorage();
    updateReport();
    showToast("Trip dipadam");
  };

  window.editSupervisorName = function () {
    if (localStorage.getItem("supervisorLocked") === "1") {
      var pin = localStorage.getItem("rezaot_pin") || "";
      if (pin) {
        if (prompt("Nama ketua dikunci. Masukkan PIN:") !== pin) {
          showToast("PIN salah"); return;
        }
      } else { showToast("Nama ketua dikunci. Set PIN (🔑)."); return; }
    }
    var el = document.getElementById("supervisorName");
    if (!el) return;
    var next = prompt("Nama ketua:", el.textContent.trim() || "Talib");
    if (next === null) return;
    el.textContent = next.trim() || "Talib";
    localStorage.setItem("supervisorName", el.textContent);
    showToast("Nama ketua dikemaskini");
  };

  function wireForms() {
    var clockForm = document.getElementById("clockForm");
    if (clockForm) clockForm.onsubmit = function (e) { window.handleClockFormSubmit(e); };
    var tripForm = document.getElementById("tripForm");
    if (tripForm) tripForm.onsubmit = function (e) { window.handleTripFormSubmit(e); };
  }

  function wirePrint() {
    rebind("printButton", function () { window.handlePrint(); });
    rebind("exportPdfBtn", function () { window.handleExportPdf(); });
    var langBtn = document.getElementById("langToggleBtn");
    if (langBtn && !langBtn._v28) {
      langBtn._v28 = true;
      langBtn.addEventListener("click", function () {
        if (window.RezaOT_i18n) window.RezaOT_i18n.toggle();
      });
    }
    if (window.RezaOT_i18n) window.RezaOT_i18n.apply();
  }

  if (typeof setSyncStatus === "function" && !setSyncStatus._v28) {
    var _ss = setSyncStatus;
    window.setSyncStatus = function (state) {
      _ss(state);
      var wrap = document.querySelector(".table-wrap");
      var noMsg = document.getElementById("noRecordsMessage");
      if (!wrap) return;
      if (state === "syncing") {
        wrap.classList.add("is-loading");
        if (noMsg) noMsg.style.visibility = "hidden";
      } else {
        wrap.classList.remove("is-loading");
        if (noMsg) noMsg.style.visibility = "";
      }
    };
    window.setSyncStatus._v28 = true;
  }

  function wireExtras() {
    var lockBtn = document.getElementById("supervisorLockBtn");
    if (lockBtn && !lockBtn._v28) {
      lockBtn._v28 = true;
      lockBtn.textContent = localStorage.getItem("supervisorLocked") === "1" ? "🔒" : "🔓";
      lockBtn.addEventListener("click", function () {
        if (localStorage.getItem("supervisorLocked") === "1") {
          var pin = localStorage.getItem("rezaot_pin");
          if (pin && prompt("PIN untuk buka kunci:") !== pin) { showToast("PIN salah"); return; }
          localStorage.setItem("supervisorLocked", "0");
          lockBtn.textContent = "🔓";
          showToast("Nama ketua dibuka");
        } else {
          localStorage.setItem("supervisorLocked", "1");
          lockBtn.textContent = "🔒";
          showToast("Nama ketua dikunci");
        }
      });
    }
    var fab = document.getElementById("fabAddTrip");
    if (fab && !fab._v28) {
      fab._v28 = true;
      fab.addEventListener("click", function () {
        var di = document.getElementById("date");
        if (di && typeof getLocalDateString === "function") di.value = getLocalDateString(new Date());
        var dest = document.getElementById("destination");
        if (dest) { dest.focus(); dest.scrollIntoView({ behavior: "smooth", block: "center" }); }
        showToast("Pilih destinasi untuk hari ini");
      });
    }
    var pinBtn = document.getElementById("pinSettingsBtn");
    if (pinBtn && !pinBtn._v28) {
      pinBtn._v28 = true;
      pinBtn.addEventListener("click", function () {
        var cur = localStorage.getItem("rezaot_pin") || "";
        if (cur) {
          var a = prompt("PIN semasa (atau HAPUS):");
          if (a === null) return;
          if (a.toUpperCase() === "HAPUS") {
            if (prompt("PIN semasa:") !== cur) { showToast("PIN salah"); return; }
            localStorage.removeItem("rezaot_pin"); showToast("PIN dibuang"); return;
          }
          if (a !== cur) { showToast("PIN salah"); return; }
        }
        var n1 = prompt("PIN baru (4-8 digit):");
        if (!n1 || !/^\d{4,8}$/.test(n1)) { showToast("PIN mesti 4-8 digit"); return; }
        if (prompt("Ulang PIN:") !== n1) { showToast("PIN tak sama"); return; }
        localStorage.setItem("rezaot_pin", n1); showToast("PIN disimpan");
      });
    }
    var pin = localStorage.getItem("rezaot_pin");
    if (pin && !document.getElementById("pinOverlay")) {
      var ov = document.createElement("div");
      ov.id = "pinOverlay";
      ov.className = "pin-overlay no-print";
      ov.style.display = "flex";
      ov.innerHTML = '<div class="pin-box"><h2>RezaOT</h2><p class="pin-hint">Masukkan PIN</p><input type="password" id="pinInput" inputmode="numeric" maxlength="8"/><button type="button" id="pinSubmitBtn">Buka</button><p id="pinError" class="pin-error" hidden>PIN salah</p></div>';
      document.body.appendChild(ov);
      document.body.classList.add("pin-locked");
      function tryU() {
        var input = document.getElementById("pinInput");
        var err = document.getElementById("pinError");
        if (input.value === pin) {
          ov.style.display = "none"; document.body.classList.remove("pin-locked"); input.value = "";
          if (err) err.hidden = true;
        } else { if (err) err.hidden = false; input.value = ""; input.focus(); }
      }
      document.getElementById("pinSubmitBtn").addEventListener("click", tryU);
      document.getElementById("pinInput").addEventListener("keydown", function (e) { if (e.key === "Enter") tryU(); });
    }
    var sel = document.getElementById("monthHistory");
    if (sel && !sel._v28) {
      sel._v28 = true;
      function fill() {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf("dailyRecords_") === 0) keys.push(k.replace("dailyRecords_", ""));
        }
        if (typeof currentMonthKey === "string" && keys.indexOf(currentMonthKey) < 0) keys.push(currentMonthKey);
        keys.sort();
        sel.innerHTML = '<option value="">— Bulan cepat —</option>';
        keys.forEach(function (key) {
          var o = document.createElement("option");
          o.value = key; o.textContent = key;
          if (key === currentMonthKey) o.selected = true;
          sel.appendChild(o);
        });
      }
      fill();
      sel.addEventListener("change", function () {
        var key = sel.value;
        if (!key || key === currentMonthKey) return;
        var parts = key.split(" ");
        if (parts.length < 2) return;
        var idx = monthNames.indexOf(parts[0]);
        if (idx < 0) return;
        if (!confirm("Tukar ke " + key + "?")) { fill(); return; }
        currentMonthKey = key;
        var monthInput = document.getElementById("monthYear");
        if (monthInput) monthInput.value = parts[1] + "-" + String(idx + 1).padStart(2, "0");
        var el = document.getElementById("currentMonth");
        if (el) el.textContent = key;
        stopFirebaseListener(); loadFromLocalStorage(); updateReport(); loadTrips(); startFirebaseListener();
        showToast("Bulan: " + key); fill();
      });
    }
  }

  function boot() {
    if (typeof handleClockFormSubmit !== "function") return false;
    wireForms();
    wirePrint();
    wireExtras();
    return true;
  }
  function tryBoot(n) {
    if (boot()) return;
    if (n < 12) setTimeout(function () { tryBoot(n + 1); }, 250);
  }
  tryBoot(0);
})();
