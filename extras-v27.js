// extras-v27.js — AWB dupe, UPL, month history, skeleton, FAB, supervisor lock, PIN, better delete
(function () {
  "use strict";

  function setSkeleton(on) {
    var wrap = document.querySelector(".table-wrap");
    var noMsg = document.getElementById("noRecordsMessage");
    if (!wrap) return;
    if (on) {
      wrap.classList.add("is-loading");
      if (noMsg) noMsg.style.visibility = "hidden";
    } else {
      wrap.classList.remove("is-loading");
      if (noMsg) noMsg.style.visibility = "";
    }
  }

  function wrapSyncStatus() {
    if (typeof setSyncStatus !== "function" || setSyncStatus._v27) return;
    var orig = setSyncStatus;
    window.setSyncStatus = function (state) {
      orig(state);
      if (state === "syncing") setSkeleton(true);
      else setSkeleton(false);
    };
    window.setSyncStatus._v27 = true;
  }

  function findAwbDuplicate(awb) {
    if (!awb) return null;
    var needle = String(awb).trim().toLowerCase();
    var dates = Object.keys(dailyRecords || {});
    for (var i = 0; i < dates.length; i++) {
      var d = dates[i];
      var trips = (dailyRecords[d] && dailyRecords[d].trips) || [];
      for (var j = 0; j < trips.length; j++) {
        var t = String(trips[j]);
        var m = t.match(/\(([^)]+)\)/);
        if (m && m[1].trim().toLowerCase() === needle) {
          return { date: d, trip: t };
        }
      }
    }
    return null;
  }

  function wrapTripSubmit() {
    if (typeof handleTripFormSubmit !== "function" || handleTripFormSubmit._v27) return;
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
        if (dup) {
          if (!confirm('AWB "' + awb + '" sudah wujud pada ' + dup.date + ".\nTambah juga?")) return;
        }
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
    window.handleTripFormSubmit._v27 = true;
    var tripForm = document.getElementById("tripForm");
    if (tripForm) {
      var neo = tripForm.cloneNode(true);
      tripForm.parentNode.replaceChild(neo, tripForm);
      neo.addEventListener("submit", window.handleTripFormSubmit);
      var dest = document.getElementById("destination");
      if (dest && typeof handleDestinationChange === "function") {
        dest.addEventListener("change", handleDestinationChange);
      }
    }
  }

  function wrapClockSubmit() {
    if (typeof handleClockFormSubmit !== "function" || handleClockFormSubmit._v27) return;
    window.handleClockFormSubmit = function (e) {
      e.preventDefault();
      var date = document.getElementById("date").value;
      var clockIn = document.getElementById("clockIn").value;
      var clockOut = document.getElementById("clockOut").value;
      if (!date || !clockIn || !clockOut) {
        showToast("Sila isi semua medan.");
        return;
      }
      if (dailyRecords[date] && (dailyRecords[date].clock_in || dailyRecords[date].clock_out)) {
        if (!confirm("Rekod untuk " + date + " sudah wujud. Tulis ganti?")) return;
      }
      if (!dailyRecords[date]) dailyRecords[date] = { clock_in: clockIn, clock_out: clockOut, trips: [] };
      else {
        dailyRecords[date].clock_in = clockIn;
        dailyRecords[date].clock_out = clockOut;
      }
      var upl = document.getElementById("unpaidLeaveCheck");
      if (upl) dailyRecords[date].unpaid = !!upl.checked;
      saveToLocalStorage();
      updateReport();
      showToast("Kehadiran berjaya disimpan!");
    };
    window.handleClockFormSubmit._v27 = true;
    var clockForm = document.getElementById("clockForm");
    if (clockForm) {
      var neo = clockForm.cloneNode(true);
      clockForm.parentNode.replaceChild(neo, clockForm);
      neo.addEventListener("submit", window.handleClockFormSubmit);
      var nowIn = document.getElementById("nowInBtn");
      var nowOut = document.getElementById("nowOutBtn");
      if (nowIn && typeof setNowTime === "function") nowIn.addEventListener("click", function () { setNowTime("clockIn"); });
      if (nowOut && typeof setNowTime === "function") nowOut.addEventListener("click", function () { setNowTime("clockOut"); });
      var dateInput = document.getElementById("date");
      if (dateInput && typeof updateHolidayBadge === "function") dateInput.addEventListener("change", updateHolidayBadge);
    }
  }

  function wrapDeletes() {
    window.deleteRecord = function (date) {
      var rec = dailyRecords[date];
      var n = rec && Array.isArray(rec.trips) ? rec.trips.length : 0;
      var msg = "Padam rekod " + date + "?\nTrip: " + n + " · In: " + (rec && rec.clock_in ? rec.clock_in : "-") + " · Out: " + (rec && rec.clock_out ? rec.clock_out : "-");
      if (!confirm(msg)) return;
      delete dailyRecords[date];
      saveToLocalStorage();
      updateReport();
      showToast("Rekod dipadam");
    };
    window.deleteTrip = function (date, tripIndex) {
      var rec = dailyRecords[date];
      if (!rec || !Array.isArray(rec.trips) || !rec.trips[tripIndex]) return;
      var name = String(rec.trips[tripIndex]);
      if (!confirm("Padam trip pada " + date + "?\n\"" + name + "\"\nBaki trip hari ini: " + (rec.trips.length - 1))) return;
      rec.trips.splice(tripIndex, 1);
      saveToLocalStorage();
      updateReport();
      showToast("Trip dipadam");
    };
  }

  function wrapSupervisor() {
    window.editSupervisorName = function () {
      if (localStorage.getItem("supervisorLocked") === "1") {
        var pin = localStorage.getItem("rezaot_pin") || "";
        if (pin) {
          var entered = prompt("Nama ketua dikunci. Masukkan PIN:");
          if (entered !== pin) {
            showToast("PIN salah — nama ketua tidak diubah");
            return;
          }
        } else {
          showToast("Nama ketua dikunci. Set PIN dulu (🔑) atau buka kunci.");
          return;
        }
      }
      var el = document.getElementById("supervisorName");
      if (!el) return;
      var next = prompt("Nama ketua:", el.textContent.trim() || "Talib");
      if (next === null) return;
      var name = next.trim() || "Talib";
      el.textContent = name;
      localStorage.setItem("supervisorName", name);
      showToast("Nama ketua dikemaskini");
    };
    var lockBtn = document.getElementById("supervisorLockBtn");
    if (lockBtn && !lockBtn._wired) {
      lockBtn._wired = true;
      lockBtn.addEventListener("click", function () {
        var locked = localStorage.getItem("supervisorLocked") === "1";
        if (!locked) {
          localStorage.setItem("supervisorLocked", "1");
          lockBtn.textContent = "🔒";
          lockBtn.title = "Nama ketua dikunci";
          showToast("Nama ketua dikunci");
        } else {
          var pin = localStorage.getItem("rezaot_pin");
          if (pin) {
            var entered = prompt("Masukkan PIN untuk buka kunci:");
            if (entered !== pin) { showToast("PIN salah"); return; }
          }
          localStorage.setItem("supervisorLocked", "0");
          lockBtn.textContent = "🔓";
          lockBtn.title = "Kunci nama ketua";
          showToast("Nama ketua dibuka");
        }
      });
      lockBtn.textContent = localStorage.getItem("supervisorLocked") === "1" ? "🔒" : "🔓";
    }
  }

  function buildMonthHistory() {
    var sel = document.getElementById("monthHistory");
    if (!sel) return;
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("dailyRecords_") === 0) keys.push(k.replace("dailyRecords_", ""));
    }
    if (typeof currentMonthKey === "string" && keys.indexOf(currentMonthKey) < 0) keys.push(currentMonthKey);
    keys.sort();
    var prev = sel.value;
    sel.innerHTML = "";
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— Bulan cepat —";
    sel.appendChild(opt0);
    keys.forEach(function (key) {
      var o = document.createElement("option");
      o.value = key;
      o.textContent = key;
      if (key === currentMonthKey) o.selected = true;
      sel.appendChild(o);
    });
  }

  function wireMonthHistory() {
    var sel = document.getElementById("monthHistory");
    if (!sel || sel._wired) return;
    sel._wired = true;
    sel.addEventListener("change", function () {
      var key = sel.value;
      if (!key || key === currentMonthKey) return;
      var parts = key.split(" ");
      if (parts.length < 2) return;
      var names = typeof monthNames !== "undefined" ? monthNames : [];
      var idx = names.indexOf(parts[0]);
      if (idx < 0) return;
      var monthInput = document.getElementById("monthYear");
      var intended = parts[1] + "-" + String(idx + 1).padStart(2, "0");
      if (!confirm("Tukar ke " + key + "?\nData bulan semasa sudah disimpan.")) {
        buildMonthHistory();
        return;
      }
      currentMonthKey = key;
      if (monthInput) monthInput.value = intended;
      var currentMonthEl = document.getElementById("currentMonth");
      if (currentMonthEl) currentMonthEl.textContent = currentMonthKey;
      if (typeof stopFirebaseListener === "function") stopFirebaseListener();
      loadFromLocalStorage();
      updateReport();
      if (typeof loadTrips === "function") loadTrips();
      if (typeof startFirebaseListener === "function") startFirebaseListener();
      showToast("Bulan: " + currentMonthKey);
      buildMonthHistory();
    });
  }

  function wireFab() {
    var fab = document.getElementById("fabAddTrip");
    if (!fab || fab._wired) return;
    fab._wired = true;
    fab.addEventListener("click", function () {
      var dateInput = document.getElementById("date");
      if (dateInput && typeof getLocalDateString === "function") {
        dateInput.value = getLocalDateString(new Date());
      }
      var dest = document.getElementById("destination");
      if (dest) {
        dest.focus();
        dest.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      showToast("Pilih destinasi untuk hari ini");
    });
  }

  function ensurePinOverlay() {
    if (document.getElementById("pinOverlay")) return;
    var ov = document.createElement("div");
    ov.id = "pinOverlay";
    ov.className = "pin-overlay no-print";
    ov.innerHTML = '<div class="pin-box"><h2>RezaOT</h2><p class="pin-hint">Masukkan PIN</p>' +
      '<input type="password" id="pinInput" inputmode="numeric" maxlength="8" autocomplete="off" />' +
      '<button type="button" id="pinSubmitBtn">Buka</button>' +
      '<p id="pinError" class="pin-error" hidden>PIN salah</p></div>';
    document.body.appendChild(ov);
  }

  function checkPinLock() {
    var pin = localStorage.getItem("rezaot_pin");
    if (!pin) return;
    ensurePinOverlay();
    var ov = document.getElementById("pinOverlay");
    ov.style.display = "flex";
    document.body.classList.add("pin-locked");
    var input = document.getElementById("pinInput");
    var btn = document.getElementById("pinSubmitBtn");
    var err = document.getElementById("pinError");
    function tryUnlock() {
      if (input.value === pin) {
        ov.style.display = "none";
        document.body.classList.remove("pin-locked");
        input.value = "";
        if (err) err.hidden = true;
      } else {
        if (err) err.hidden = false;
        input.value = "";
        input.focus();
      }
    }
    if (btn && !btn._wired) {
      btn._wired = true;
      btn.addEventListener("click", tryUnlock);
    }
    if (input && !input._wired) {
      input._wired = true;
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") tryUnlock();
      });
    }
    setTimeout(function () { if (input) input.focus(); }, 100);
  }

  function wirePinSettings() {
    var btn = document.getElementById("pinSettingsBtn");
    if (!btn || btn._wired) return;
    btn._wired = true;
    btn.addEventListener("click", function () {
      var cur = localStorage.getItem("rezaot_pin") || "";
      if (cur) {
        var action = prompt("PIN semasa (atau taip HAPUS untuk buang PIN):");
        if (action === null) return;
        if (action.toUpperCase() === "HAPUS") {
          var confirmOld = prompt("Masukkan PIN semasa untuk buang:");
          if (confirmOld !== cur) { showToast("PIN salah"); return; }
          localStorage.removeItem("rezaot_pin");
          showToast("PIN dibuang");
          return;
        }
        if (action !== cur) { showToast("PIN salah"); return; }
      }
      var n1 = prompt("PIN baru (4–8 digit):");
      if (n1 === null || !n1) return;
      if (!/^\d{4,8}$/.test(n1)) { showToast("PIN mesti 4–8 digit"); return; }
      var n2 = prompt("Ulang PIN:");
      if (n2 !== n1) { showToast("PIN tak sama"); return; }
      localStorage.setItem("rezaot_pin", n1);
      showToast("PIN disimpan");
    });
  }

  function boot() {
    wrapSyncStatus();
    wrapDeletes();
    wrapTripSubmit();
    wrapClockSubmit();
    wrapSupervisor();
    buildMonthHistory();
    wireMonthHistory();
    wireFab();
    wirePinSettings();
    checkPinLock();
    var orig = window.updateReport;
    if (typeof orig === "function" && !orig._v27hist) {
      window.updateReport = function () {
        orig.apply(this, arguments);
        try { buildMonthHistory(); } catch (e) {}
      };
      window.updateReport._v27hist = true;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 400); });
  } else {
    setTimeout(boot, 400);
  }
  setTimeout(boot, 1000);
})();
