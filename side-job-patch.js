// side-job-patch.js — Susun=*  Pallets=#  (v55: store mark on trip label)
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

  function normalizeAwb(a) {
    return String(a || "").toLowerCase().replace(/\s+/g, "");
  }

  function sideMarkFor(rec, tripStr) {
    var raw = String(tripStr || "");
    if (/\*\s*$/.test(raw)) return " *";
    if (/#\s*$/.test(raw)) return " #";
    var awb = extractAwb(cleanTripLabel(raw));
    if (!awb || !rec || !Array.isArray(rec.sideJobs)) return "";
    var awbN = normalizeAwb(awb);
    for (var i = 0; i < rec.sideJobs.length; i++) {
      if (normalizeAwb(rec.sideJobs[i].awb) !== awbN) continue;
      var ty = String(rec.sideJobs[i].type || "").toLowerCase();
      if (ty === "susun") return " *";
      if (ty === "pallets") return " #";
    }
    return "";
  }

  function formatTripDisplay(rec, tripStr) {
    return cleanTripLabel(tripStr) + sideMarkFor(rec, tripStr);
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
    var awbN = normalizeAwb(awb);
    for (var i = 0; i < dailyRecords[date].sideJobs.length; i++) {
      if (normalizeAwb(dailyRecords[date].sideJobs[i].awb) === awbN) {
        dailyRecords[date].sideJobs[i].type = type;
        return;
      }
    }
    dailyRecords[date].sideJobs.push({ awb: awb, type: type });
  }

  function removeSideJobForAwb(date, awb) {
    var rec = dailyRecords[date];
    if (!rec || !Array.isArray(rec.sideJobs) || !awb) return;
    var awbN = normalizeAwb(awb);
    for (var i = 0; i < rec.sideJobs.length; i++) {
      if (normalizeAwb(rec.sideJobs[i].awb) === awbN) {
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
        if (m) {
          var clean = m[1].trim();
          var type = String(m[2] || m[3] || "").toLowerCase();
          var awb = extractAwb(clean);
          if (type === "susun" || type === "pallets") {
            pushSideJob(date, awb || extractAwb(s), type);
            changed = true;
            return clean + (type === "susun" ? " *" : " #");
          }
          changed = true;
          return clean;
        }
        if (/\*\s*$/.test(s)) {
          var c = cleanTripLabel(s);
          var a = extractAwb(c);
          if (a) pushSideJob(date, a, "susun");
          return c + " *";
        }
        if (/#\s*$/.test(s)) {
          var c2 = cleanTripLabel(s);
          var a2 = extractAwb(c2);
          if (a2) pushSideJob(date, a2, "pallets");
          return c2 + " #";
        }
        var base = cleanTripLabel(s);
        var mark = sideMarkFor(rec, base);
        if (mark && s === base) {
          changed = true;
          return base + mark;
        }
        return s;
      });
    });
    return changed;
  }

  function applySideMarksInDom() {
    if (!window.dailyRecords) return;
    var dates = Object.keys(dailyRecords).sort();
    var rows = document.querySelectorAll("#reportTable tbody tr");
    for (var r = 0; r < rows.length; r++) {
      var texts = rows[r].querySelectorAll(".trip-text");
      if (!texts.length) continue;
      var rec = null;
      var dateKey = dates[r];
      if (dateKey && dailyRecords[dateKey]) rec = dailyRecords[dateKey];
      for (var i = 0; i < texts.length; i++) {
        var el = texts[i];
        var shown = el.textContent || "";
        var base = cleanTripLabel(shown);
        var mark = rec ? sideMarkFor(rec, (rec.trips && rec.trips[i]) || shown) : "";
        if (!mark) {
          var awb = extractAwb(base);
          if (awb) {
            Object.keys(dailyRecords).some(function (d) {
              var rr = dailyRecords[d];
              if (!rr) return false;
              mark = sideMarkFor(rr, base);
              return !!mark;
            });
          }
        }
        el.textContent = "";
        el.appendChild(document.createTextNode(base));
        if (mark) {
          var badge = document.createElement("span");
          badge.className = "side-mark";
          badge.textContent = mark;
          badge.title = mark.indexOf("*") >= 0 ? "Susun (RM100)" : "Pallets (RM50)";
          el.appendChild(badge);
        } else {
          el.title = "Klik untuk edit";
        }
      }
    }
  }

  function patchTripSubmit() {
    if (window.__sideJobTrip55) return;
    if (typeof handleTripFormSubmit !== "function") return;
    window.__sideJobTrip55 = true;
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
        var side = getSideValue();
        if (side === "susun") tripName += " *";
        else if (side === "pallets") tripName += " #";
        dailyRecords[date].trips.push(tripName);
        if (side && awb) pushSideJob(date, awb, side);
        var upl = document.getElementById("unpaidLeaveCheck");
        if (upl && upl.checked) dailyRecords[date].unpaid = true;
        saveToLocalStorage();
        document.getElementById("destination").value = "";
        if (awbEl) awbEl.value = "";
        resetSideRadios();
        if (typeof updateAirwayBillVisibility === "function") updateAirwayBillVisibility();
        updateReport();
        var tip = side === "susun" ? " *" : (side === "pallets" ? " #" : "");
        showToast("Trip ditambah" + (tip ? " (" + tip.trim() + ")" : ""));
      }

      if (destination.toLowerCase().includes("klia cargo") && awb) {
        var dup = null;
        Object.keys(dailyRecords).forEach(function (d) {
          var rec = dailyRecords[d];
          if (!rec || !Array.isArray(rec.trips)) return;
          rec.trips.forEach(function (t) {
            if (normalizeAwb(extractAwb(t)) === normalizeAwb(awb)) dup = { date: d, trip: t };
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
    if (window.__sideJobDel55) return;
    if (typeof deleteTrip !== "function") return;
    window.__sideJobDel55 = true;
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
    if (window.__sideJobReport55) return;
    if (typeof updateReport !== "function") return;
    window.__sideJobReport55 = true;
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
    if (window.__sideJobExcel55) return;
    if (typeof handleExportExcel !== "function") return;
    window.__sideJobExcel55 = true;
    var orig = handleExportExcel;
    window.handleExportExcel = function () {
      var backup = {};
      if (window.dailyRecords) {
        Object.keys(dailyRecords).forEach(function (date) {
          var rec = dailyRecords[date];
          if (!rec || !Array.isArray(rec.trips)) return;
          backup[date] = rec.trips.slice();
          rec.trips = rec.trips.map(function (t) { return formatTripDisplay(rec, t); });
        });
      }
      try { orig.apply(this, arguments); }
      finally {
        Object.keys(backup).forEach(function (date) {
          if (dailyRecords[date]) dailyRecords[date].trips = backup[date];
        });
      }
    };
  }

  function injectSideMarkCss() {
    if (document.getElementById("side-mark-css")) return;
    var st = document.createElement("style");
    st.id = "side-mark-css";
    st.textContent = ".side-mark{font-weight:800;color:#c0392b;margin-left:2px;white-space:nowrap;}" +
      "body.dark-mode .side-mark{color:#ff8a80;}" +
      "@media print{.side-mark{color:#000!important;font-weight:700!important;}}";
    document.head.appendChild(st);
  }

  function boot() {
    injectSideMarkCss();
    patchTripSubmit();
    patchDeleteTrip();
    patchUpdateReport();
    patchExcel();
    if (migrateLegacyTripLabels()) {
      try { saveToLocalStorage(); } catch (e) {}
      if (typeof updateReport === "function") updateReport();
    } else if (typeof updateReport === "function") {
      updateReport();
    } else {
      applySideMarksInDom();
    }
  }
  document.addEventListener("rezaot-ready", function () { setTimeout(boot, 200); });
  if (document.readyState !== "loading") setTimeout(boot, 1200);
})();
