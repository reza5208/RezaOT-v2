// side-job-patch.js — Susun/Pallets in sideJobs[] only; never show in trip label (v47)
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
      .trim();
  }

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
        if (!m) return s;
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

  function stripTripLabelsInDom() {
    document.querySelectorAll("#reportTable .trip-text, #reportTable td .trip-item span").forEach(function (el) {
      var cleaned = cleanTripLabel(el.textContent || "");
      if (cleaned !== el.textContent) el.textContent = cleaned;
    });
  }

  function patchTripSubmit() {
    if (window.__sideJobTrip47) return;
    if (typeof handleTripFormSubmit !== "function") return;
    window.__sideJobTrip47 = true;

    var orig = handleTripFormSubmit;
    window.handleTripFormSubmit = function (e) {
      e.preventDefault();
      var date = document.getElementById("date").value;
      var destination = document.getElementById("destination").value;
      var awbInput = document.getElementById("airwayBill");
      var awb = awbInput ? awbInput.value.trim() : "";
      if (!date) { showToast("Sila pilih tarikh dahulu."); return; }
      if (!destination) { showToast("Sila pilih destinasi."); return; }

      function doAdd() {
        if (!dailyRecords[date]) dailyRecords[date] = { clock_in: "", clock_out: "", trips: [] };
        if (!Array.isArray(dailyRecords[date].trips)) dailyRecords[date].trips = [];
        var tripName = destination;
        var side = "";
        if (destination.toLowerCase().includes("klia cargo") && awb) {
          tripName = "KLIA Cargo (" + awb + ")";
          side = getSideValue();
        }
        dailyRecords[date].trips.push(tripName);
        if (side === "susun" || side === "pallets") pushSideJob(date, awb, side);
        var upl = document.getElementById("unpaidLeaveCheck");
        if (upl && upl.checked) dailyRecords[date].unpaid = true;
        saveToLocalStorage();
        updateReport();
        document.getElementById("destination").value = "";
        if (awbInput) awbInput.value = "";
        resetSideRadios();
        var af = document.getElementById("airwayBillField");
        if (af) af.style.display = "none";
        showToast("Trip berjaya ditambah!");
      }

      if (destination.toLowerCase().includes("klia cargo") && awb) {
        var dup = typeof findAwbDuplicate === "function" ? findAwbDuplicate(awb) : null;
        if (dup) {
          var msg = 'AWB "' + awb + '" sudah wujud pada ' + dup.date + ".\nTambah juga?";
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
    if (window.__sideJobDel47) return;
    if (typeof deleteTrip !== "function") return;
    window.__sideJobDel47 = true;
    var prev = deleteTrip;
    window.deleteTrip = function (date, tripIndex) {
      var rec = dailyRecords[date];
      var tname = rec && Array.isArray(rec.trips) ? rec.trips[tripIndex] : null;
      var awb = tname ? extractAwb(cleanTripLabel(tname)) : "";

      if (typeof rezaotConfirm === "function" && tname != null) {
        var msg = "Padam trip ini?\n" + date + '\n"' + cleanTripLabel(tname) + '"';
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
    if (window.__sideJobReport47) return;
    if (typeof updateReport !== "function") return;
    window.__sideJobReport47 = true;
    var orig = updateReport;
    window.updateReport = function () {
      if (migrateLegacyTripLabels()) {
        try { saveToLocalStorage(); } catch (e) {}
      }
      orig.apply(this, arguments);
      stripTripLabelsInDom();
    };
  }

  function boot() {
    patchTripSubmit();
    patchDeleteTrip();
    patchUpdateReport();
    if (migrateLegacyTripLabels()) {
      try { saveToLocalStorage(); } catch (e) {}
      if (typeof updateReport === "function") updateReport();
    } else {
      stripTripLabelsInDom();
    }
  }
  document.addEventListener("rezaot-ready", function () { setTimeout(boot, 150); });
  if (document.readyState !== "loading") setTimeout(boot, 1000);
})();
