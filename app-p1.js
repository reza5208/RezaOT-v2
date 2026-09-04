// app-p1.js — single feature layer (print mobile, PIN, FAB, lock, month history, skeleton)
// P1: replaces core-v28 / extras / print-lang-fix
(function () {
  "use strict";

  function isMobileOrPwa() {
    var standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    var coarse = window.matchMedia("(pointer: coarse)").matches;
    var narrow = window.matchMedia("(max-width: 900px)").matches;
    return standalone || (coarse && narrow);
  }

  window.handlePrint = function () {
    if (isMobileOrPwa()) { window.handleExportPdf(); return; }
    if (typeof applyPrintAutoSize === "function") applyPrintAutoSize();
    document.body.classList.add("pdf-export");
    requestAnimationFrame(function () {
      setTimeout(function () {
        try { window.print(); } catch (e) {}
        setTimeout(function () {
          document.body.classList.remove("pdf-export");
          if (typeof clearPrintAutoSize === "function") clearPrintAutoSize();
        }, 500);
      }, 250);
    });
  };

  window.handleExportPdf = function () {
    if (typeof html2pdf === "undefined") {
      showToast("html2pdf tidak load");
      return;
    }
    var el = document.querySelector(".container");
    if (!el) return;
    if (typeof applyPrintAutoSize === "function") applyPrintAutoSize();
    document.body.classList.add("pdf-export");
    var opt = {
      margin: [8, 8, 8, 8],
      filename: "RezaOT_" + (currentMonthKey || "report").replace(/\s+/g, "_") + ".pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };
    setTimeout(function () {
      html2pdf().set(opt).from(el).save()
        .then(function () { showToast("PDF dimuat turun"); })
        .catch(function () { showToast("Gagal jana PDF"); })
        .finally(function () {
          document.body.classList.remove("pdf-export");
          if (typeof clearPrintAutoSize === "function") clearPrintAutoSize();
        });
    }, 250);
  };

  function rebind(id, fn) {
    var btn = document.getElementById(id);
    if (!btn) return;
    var neo = btn.cloneNode(true);
    btn.parentNode.replaceChild(neo, btn);
    neo.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
  }

  window.editSupervisorName = function () {
    if (localStorage.getItem("supervisorLocked") === "1") {
      var pin = localStorage.getItem("rezaot_pin") || "";
      if (pin) {
        if (prompt("Nama ketua dikunci. Masukkan PIN:") !== pin) {
          showToast("PIN salah"); return;
        }
      } else {
        showToast("Nama ketua dikunci. Set PIN (🔑)."); return;
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

  function wireSyncSkeleton() {
    if (typeof setSyncStatus !== "function" || setSyncStatus._p1) return;
    var orig = setSyncStatus;
    window.setSyncStatus = function (state) {
      orig(state);
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
    window.setSyncStatus._p1 = true;
  }

  function wireExtras() {
    rebind("printButton", function () { window.handlePrint(); });
    rebind("exportPdfBtn", function () { window.handleExportPdf(); });

    var langBtn = document.getElementById("langToggleBtn");
    if (langBtn && !langBtn._p1) {
      langBtn._p1 = true;
      langBtn.addEventListener("click", function () {
        if (window.RezaOT_i18n) window.RezaOT_i18n.toggle();
      });
    }
    if (window.RezaOT_i18n) window.RezaOT_i18n.apply();

    var lockBtn = document.getElementById("supervisorLockBtn");
    if (lockBtn && !lockBtn._p1) {
      lockBtn._p1 = true;
      lockBtn.textContent = localStorage.getItem("supervisorLocked") === "1" ? "🔒" : "🔓";
      lockBtn.addEventListener("click", function () {
        var locked = localStorage.getItem("supervisorLocked") === "1";
        if (!locked) {
          localStorage.setItem("supervisorLocked", "1");
          lockBtn.textContent = "🔒";
          showToast("Nama ketua dikunci");
        } else {
          var pin = localStorage.getItem("rezaot_pin");
          if (pin && prompt("PIN untuk buka kunci:") !== pin) {
            showToast("PIN salah"); return;
          }
          localStorage.setItem("supervisorLocked", "0");
          lockBtn.textContent = "🔓";
          showToast("Nama ketua dibuka");
        }
      });
    }

    var fab = document.getElementById("fabAddTrip");
    if (fab && !fab._p1) {
      fab._p1 = true;
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

    var pinBtn = document.getElementById("pinSettingsBtn");
    if (pinBtn && !pinBtn._p1) {
      pinBtn._p1 = true;
      pinBtn.addEventListener("click", function () {
        var cur = localStorage.getItem("rezaot_pin") || "";
        if (cur) {
          var a = prompt("PIN semasa (atau HAPUS):");
          if (a === null) return;
          if (a.toUpperCase() === "HAPUS") {
            if (prompt("PIN semasa:") !== cur) { showToast("PIN salah"); return; }
            localStorage.removeItem("rezaot_pin");
            showToast("PIN dibuang");
            return;
          }
          if (a !== cur) { showToast("PIN salah"); return; }
        }
        var n1 = prompt("PIN baru (4-8 digit):");
        if (!n1 || !/^\d{4,8}$/.test(n1)) { showToast("PIN mesti 4-8 digit"); return; }
        if (prompt("Ulang PIN:") !== n1) { showToast("PIN tak sama"); return; }
        localStorage.setItem("rezaot_pin", n1);
        showToast("PIN disimpan");
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
      document.getElementById("pinSubmitBtn").addEventListener("click", tryU);
      document.getElementById("pinInput").addEventListener("keydown", function (e) {
        if (e.key === "Enter") tryU();
      });
      setTimeout(function () {
        var i = document.getElementById("pinInput");
        if (i) i.focus();
      }, 100);
    }

    var sel = document.getElementById("monthHistory");
    if (sel && !sel._p1) {
      sel._p1 = true;
      function fill() {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf("dailyRecords_") === 0) keys.push(k.replace("dailyRecords_", ""));
        }
        if (typeof currentMonthKey === "string" && keys.indexOf(currentMonthKey) < 0) keys.push(currentMonthKey);
        keys.sort();
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
      fill();
      sel.addEventListener("change", function () {
        var key = sel.value;
        if (!key || key === currentMonthKey) return;
        var parts = key.split(" ");
        if (parts.length < 2) return;
        var idx = (typeof monthNames !== "undefined" ? monthNames : []).indexOf(parts[0]);
        if (idx < 0) return;
        if (!confirm("Tukar ke " + key + "?\nData bulan semasa sudah disimpan.")) {
          fill(); return;
        }
        currentMonthKey = key;
        var monthInput = document.getElementById("monthYear");
        if (monthInput) monthInput.value = parts[1] + "-" + String(idx + 1).padStart(2, "0");
        var cm = document.getElementById("currentMonth");
        if (cm) cm.textContent = currentMonthKey;
        if (typeof stopFirebaseListener === "function") stopFirebaseListener();
        loadFromLocalStorage();
        updateReport();
        if (typeof loadTrips === "function") loadTrips();
        if (typeof startFirebaseListener === "function") startFirebaseListener();
        showToast("Bulan: " + currentMonthKey);
        fill();
      });
      var orig = window.updateReport;
      if (typeof orig === "function" && !orig._p1hist) {
        window.updateReport = function () {
          orig.apply(this, arguments);
          try { fill(); } catch (e) {}
        };
        window.updateReport._p1hist = true;
      }
    }
  }

  function boot() {
    if (typeof handleClockFormSubmit !== "function") return false;
    if (window.__appP1) return true;
    window.__appP1 = true;
    wireSyncSkeleton();
    wireExtras();
    return true;
  }

  function tryBoot(n) {
    if (boot()) return;
    if (n < 15) setTimeout(function () { tryBoot(n + 1); }, 250);
  }
  tryBoot(0);
})();
