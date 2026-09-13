// side-job-patch.js — Susun=*  Pallets=#  (v54)
(function () {
  "use strict";

  function getSideValue() {
    var el = document.querySelector('input[name="sideJob"]:checked');
    return el ? el.value : "";
  }

  function resetSideRadios() {
    document.querySelectorAll('input[name="sideJob"]').forEach(function (r) {
      r.checked = r.value === "";
    });
  }

  function extractAwb(tripName) {
    var m = String(tripName).match(/KLIA\s*Cargo\s*\(([^)]+)\)/i);
    return m ? m[1].trim() : "";
  }

  function cleanTripLabel(s) {
    return String(s)
      .replace(/\s*[·•\-]\s*(Susun|Pallets)\s*$/i, "")
      .replace(/\s*\[(Susun|Pallets)\]\s*$/i, "")
      .replace(/\s*[\*#]\s*$/, "")
      .trim();
  }

  /** * = Susun, # = Pallets */
  function sideMarkFor(rec, tripStr) {
    var awb = extractAwb(cleanTripLabel(tripStr));
    if (!awb || !rec || !Array.isArray(rec.sideJobs)) return "";
    var awbL = String(awb).toLowerCase();
    for (var i = 0; i < rec.sideJobs.length; i++) {
      if (String(rec.sideJobs[i].awb || "").toLowerCase() !== awbL) continue;
      var ty = String(rec.sideJobs[i].type || "").toLowerCase();
      if (ty === "susun") return " *";
      if (ty === "pallets") return " #";
    }
    return "";
  }

  function formatTripDisplay(rec, tripStr) {
    var clean = cleanTripLabel(tripStr);
    return clean + sideMarkFor(rec, tripStr);
  }

  window.RezaOT_sideMark = {
    cleanTripLabel: cleanTripLabel,
    sideMarkFor: sideMarkFor,
    formatTripDisplay: formatTripDisplay,
    extractAwb: extractAwb
  };

  function pushSideJob(date, awb, type) {
    if (!type || !awb) return;
    if (!dailyRecords[date].sideJobs) dailyRecords[date].sideJobs = [];
    var awbL = String(awb).toLowerCase();
    var exists = dailyRecords[date].sideJobs.some(function (sj) {
      return String(sj.awb || "").toLowerCase() === awbL && String(sj.type || "").toLowerCase() === type;
    });
    if (!exists) dailyRecords[date].sideJobs.push({ awb: awb, type: type });
  }

  function removeSideJobForAwb(date, awb) {
    var rec = dailyRecords[date];
    if (!rec || !Array.isArray(rec.sideJobs) || !awb) return;
    var awbL = String(awb).toLowerCase();
    for (var i = 0; i < rec.sideJobs.length; i++) {
      if (String(rec.sideJobs[i].awb || "").toLowerCase() === awbL) {
        rec.sideJobs.splice(i, 1);
        return;
      }
    }
  }

  function migrateLegacyTripLabels() {
    if (!window.dailyRecords) return false;
    var changed = false;
    Object.keys(dailyRecords).forEach(function (date) {
      var rec = dailyRecords[date];
      if (!rec || !Array.isArray(rec.trips)) return;
      if (!Array.isArray(rec.sideJobs)) rec.sideJobs = [];
      rec.trips = rec.trips.map(function (t) {
        var s = String(t);
        var m = s.match(/^(.*?)(?:\s*[·•\-]\s*(Susun|Pallets)|\s*\[(Susun|Pallets)\])\s*$/i);
        if (!m) return cleanTripLabel(s);
        var clean = m[1].trim();
        var type = String(m[2] || m[3] || "").toLowerCase();
        var awb = extractAwb(clean);
        if (type === "susun" || type === "pallets") {
          pushSideJob(date, awb || extractAwb(s), type);
        }
        changed = true;
        return clean;
      });
    });
    return changed;
  }

  function applySideMarksInDom() {
    if (!window.dailyRecords) return;
    var dates = Object.keys(dailyRecords).sort();
    var rows = document.querySelectorAll("#reportTable tbody tr");
    for (var r = 0; r < rows.length && r < dates.length; r++) {
      var date = dates[r];
      var rec = dailyRecords[date];
      if (!rec) continue;
      var trips = rec.trips || [];
      var texts = rows[r].querySelectorAll(".trip-text");
      for (var i = 0; i < texts.length; i++) {
        var base = trips[i] != null ? cleanTripLabel(trips[i]) : cleanTripLabel(texts[i].textContent);
        var mark = sideMarkFor(rec, trips[i] || base);
        texts[i].textContent = base + mark;
        if (mark === " *") texts[i].title = "Side job: Susun (RM100)";
        else if (mark === " #") texts[i].title = "Side job: Pallets (RM50)";
        else texts[i].title = "Klik untuk edit";
      }
    }
  }

  function patchTripSubmit() {
    if (window.__sideJobTrip54) return;
    if (typeof handleTripFormSubmit !== "function") return;
    window.__sideJobTrip54 = true;
    var orig = handleTripFormSubmit;

    window.handleTripFormSubmit = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      var date = document.getElementById("date").value;
      var destination = document.getElementById("destination").value;
      var awbEl = document.getElementById("airwayBill");
      var awb = awbEl ? awbEl.value.trim() : "";
      if (!date) { showToast("Sila pilih tarikh."); return; }
      if (!destination) { showToast("Sila pilih destinasi."); return; }

      function doAdd() {
        if (!dailyRecords[date]) dailyRecords[date] = { trips: [], clock_in: "", clock_out: "" };
        if (!Array.isArray(dailyRecords[date].trips)) dailyRecords[date].trips = [];
        var tripName = destination;
        if (destination.toLowerCase().includes("klia cargo") && awb) {
          tripName = "KLIA Cargo (" + awb + ")";
        }
        dailyRecords[date].trips.push(tripName);
        var side = getSideValue();
        if (side && awb) pushSideJob(date, awb, side);
        var upl = document.getElementById("unpaidLeaveCheck");
        if (upl && upl.checked) dailyRecords[date].unpaid = true;
        saveToLocalStorage();
        document.getElementById("destination").value = "";
        if (awbEl) awbEl.value = "";
        resetSideRadios();
        if (typeof updateAirwayBillVisibility === "function") updateAirwayBillVisibility();
        updateReport();
        var mark = side === "susun" ? " *" : (side === "pallets" ? " #" : "");
        showToast("Trip ditambah" + (mark ? " (" + mark.trim() + ")" : ""));
      }

      if (destination.toLowerCase().includes("klia cargo") && awb) {
        var dup = null;
        Object.keys(dailyRecords).forEach(function (d) {
          var rec = dailyRecords[d];
          if (!rec || !Array.isArray(rec.trips)) return;
          rec.trips.forEach(function (t) {
            if (extractAwb(t).toLowerCase() === awb.toLowerCase()) dup = { date: d, trip: t };
          });
        });
        if (dup) {
          var msg = "AWB " + awb + " sudah wujud pada " + dup.date + ".\nTambah juga?";
          if (typeof rezaotConfirm === "function") {
            rezaotConfirm(msg).then(function (ok) { if (ok) doAdd(); });
            return;
          }
          if (!confirm(msg)) return;
        }
      }
      doAdd();
    };

    var form = document.getElementById("tripForm");
    if (form) {
      try { form.removeEventListener("submit", orig); } catch (e) {}
      form.addEventListener("submit", window.handleTripFormSubmit);
    }
  }

  function patchDeleteTrip() {
    if (window.__sideJobDel54) return;
    if (typeof deleteTrip !== "function") return;
    window.__sideJobDel54 = true;
    var prev = deleteTrip;
    window.deleteTrip = function (date, tripIndex) {
      var rec = dailyRecords[date];
      var tname = rec && Array.isArray(rec.trips) ? rec.trips[tripIndex] : null;
      var awb = tname ? extractAwb(cleanTripLabel(tname)) : "";

      if (typeof rezaotConfirm === "function" && tname != null) {
        var msg = "Padam trip ini?\n" + date + '\n"' + formatTripDisplay(rec, tname) + '"';
        rezaotConfirm(msg).then(function (ok) {
          if (!ok) return;
          if (awb) removeSideJobForAwb(date, awb);
          rec.trips.splice(tripIndex, 1);
          saveToLocalStorage();
          updateReport();
          showToast("Trip dipadam");
        });
        return;
      }
      var before = tname ? String(tname) : null;
      prev.apply(this, arguments);
      if (before && awb && rec) {
        var still = (rec.trips || []).some(function (t) { return String(t) === before; });
        if (!still) removeSideJobForAwb(date, awb);
      }
    };
  }

  function patchUpdateReport() {
    if (window.__sideJobReport54) return;
    if (typeof updateReport !== "function") return;
    window.__sideJobReport54 = true;
    var orig = updateReport;
    window.updateReport = function () {
      if (migrateLegacyTripLabels()) {
        try { saveToLocalStorage(); } catch (e) {}
      }
      orig.apply(this, arguments);
      applySideMarksInDom();
    };
  }

  function patchExcel() {
    if (window.__sideJobExcel54) return;
    if (typeof handleExportExcel !== "function") return;
    window.__sideJobExcel54 = true;
    var orig = handleExportExcel;
    window.handleExportExcel = function () {
      var backup = {};
      if (window.dailyRecords) {
        Object.keys(dailyRecords).forEach(function (date) {
          var rec = dailyRecords[date];
          if (!rec || !Array.isArray(rec.trips)) return;
          backup[date] = rec.trips.slice();
          rec.trips = rec.trips.map(function (t) {
            return formatTripDisplay(rec, t);
          });
        });
      }
      try {
        orig.apply(this, arguments);
      } finally {
        Object.keys(backup).forEach(function (date) {
          if (dailyRecords[date]) dailyRecords[date].trips = backup[date];
        });
      }
    };
  }

  function boot() {
    patchTripSubmit();
    patchDeleteTrip();
    patchUpdateReport();
    patchExcel();
    if (migrateLegacyTripLabels()) {
      try { saveToLocalStorage(); } catch (e) {}
      if (typeof updateReport === "function") updateReport();
    } else {
      applySideMarksInDom();
    }
  }
  document.addEventListener("rezaot-ready", function () { setTimeout(boot, 150); });
  if (document.readyState !== "loading") setTimeout(boot, 1000);
})();
