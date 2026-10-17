// side-job-patch.js — Susun=*  Pallets=#  (v61: side job KLIA only)
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
    var base = cleanTripLabel(raw);
    if (base.toLowerCase().indexOf("klia cargo") < 0) return "";
    if (/\*\s*$/.test(raw)) return " *";
    if (/#\s*$/.test(raw)) return " #";
    var awb = extractAwb(base);
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

  function ensureSideJobUi() {
    if (document.getElementById("sideJobField")) return;
    var awbField = document.getElementById("airwayBillField");
    if (!awbField || !awbField.parentNode) return;
    var box = document.createElement("div");
    box.id = "sideJobField";
    box.className = "side-job-field";
    box.innerHTML =
      '<span class="side-job-label">Side job</span>' +
      '<label class="side-job-opt"><input type="radio" name="sideJob" value="" checked> Tiada</label>' +
      '<label class="side-job-opt"><input type="radio" name="sideJob" value="susun"> Susun</label>' +
      '<label class="side-job-opt"><input type="radio" name="sideJob" value="pallets"> Pallets</label>';
    awbField.parentNode.insertBefore(box, awbField.nextSibling);
  }

  function cleanNonKliaSideMarks() {
    var changed = false;
    Object.keys(dailyRecords || {}).forEach(function (date) {
      var rec = dailyRecords[date];
      if (!rec || !Array.isArray(rec.trips)) return;
      for (var i = 0; i < rec.trips.length; i++) {
        var t = String(rec.trips[i]);
        var cleaned = cleanTripLabel(t);
        if (cleaned.toLowerCase().indexOf("klia cargo") < 0 && cleaned !== t) {
          rec.trips[i] = cleaned;
          changed = true;
        }
      }
    });
    return changed;
  }

  function migrateLegacyTripLabels() {
    var changed = false;
    Object.keys(dailyRecords || {}).forEach(function (date) {
      var rec = dailyRecords[date];
      if (!rec || !Array.isArray(rec.trips)) return;
      for (var i = 0; i < rec.trips.length; i++) {
        var t = String(rec.trips[i]);
        var mSusun = t.match(/\s*[·•\-]\s*Susun\s*$/i) || /\s*\[Susun\]\s*$/i.test(t);
        var mPal = t.match(/\s*[·•\-]\s*Pallets\s*$/i) || /\s*\[Pallets\]\s*$/i.test(t);
        if (!mSusun && !mPal && !/\*\s*$/.test(t) && !/#\s*$/.test(t)) continue;
        var base = cleanTripLabel(t);
        if (base.toLowerCase().indexOf("klia cargo") < 0) {
          rec.trips[i] = base;
          changed = true;
          continue;
        }
        var awb = extractAwb(base);
        var type = mSusun || /\*\s*$/.test(t) ? "susun" : "pallets";
        if (awb) pushSideJob(date, awb, type);
        if (base !== t) {
          rec.trips[i] = base;
          changed = true;
        }
      }
    });
    return changed;
  }

  function applySideMarksInDom() {
    var rows = document.querySelectorAll("#reportTable tbody tr");
    if (!rows.length) return;
    rows.forEach(function (tr) {
      var dateCell = tr.querySelector("td.tarikh");
      if (!dateCell) return;
      var txt = (dateCell.textContent || "").trim();
      var date = null;
      Object.keys(dailyRecords || {}).some(function (d) {
        if (formatDateForPDF(d) === txt) { date = d; return true; }
        return false;
      });
      if (!date || !dailyRecords[date]) return;
      var rec = dailyRecords[date];
      var tripCell = tr.querySelector("td:nth-child(3)");
      if (!tripCell) return;
      tripCell.querySelectorAll(".trip-text, .trip-item span").forEach(function (el, idx) {
        var trips = rec.trips || [];
        if (idx >= trips.length) return;
        var mark = sideMarkFor(rec, trips[idx]);
        var base = cleanTripLabel(trips[idx]);
        var existing = el.querySelector(".side-mark");
        if (existing) existing.remove();
        el.childNodes.forEach(function (n) {
          if (n.nodeType === 3) n.textContent = base;
        });
        if (!el.childNodes.length) el.textContent = base;
        if (mark) {
          var span = document.createElement("span");
          span.className = "side-mark";
          span.textContent = mark;
          el.appendChild(span);
        }
      });
    });
  }

  function patchTripSubmit() {
    if (window.__sideJobTrip61) return;
    if (typeof handleTripFormSubmit !== "function") return;
    window.__sideJobTrip61 = true;
    ensureSideJobUi();
    var orig = handleTripFormSubmit;
    window.handleTripFormSubmit = function (e) {
      var dateEl = document.getElementById("date");
      var destEl = document.getElementById("destination");
      var awbEl = document.getElementById("airwayBill");
      var date = dateEl ? dateEl.value : "";
      var destination = destEl ? destEl.value : "";
      var awb = awbEl ? String(awbEl.value || "").trim() : "";
      var side = getSideValue();

      orig.apply(this, arguments);

      try {
        if (
          date &&
          destination &&
          destination.toLowerCase().indexOf("klia cargo") >= 0 &&
          awb &&
          (side === "susun" || side === "pallets")
        ) {
          var rec = dailyRecords[date];
          if (rec && Array.isArray(rec.trips) && rec.trips.length) {
            var last = String(rec.trips[rec.trips.length - 1] || "");
            var awbLower = awb.toLowerCase();
            if (
              last.toLowerCase().indexOf(awbLower) >= 0 &&
              !/\s\*$/.test(last) &&
              !/\s#$/.test(last)
            ) {
              rec.trips[rec.trips.length - 1] =
                last + (side === "susun" ? " *" : " #");
            }
          }
          pushSideJob(date, awb, side);
          try { saveToLocalStorage(); } catch (err) {}
          if (typeof updateReport === "function") updateReport();
        }
      } catch (err) {}
      resetSideRadios();
    };
    var form = document.getElementById("tripForm");
    if (form) {
      try { form.removeEventListener("submit", orig); } catch (e) {}
      form.addEventListener("submit", window.handleTripFormSubmit);
    }
  }

  function patchDeleteTrip() {
    if (window.__sideJobDel61) return;
    if (typeof deleteTrip !== "function") return;
    window.__sideJobDel61 = true;
    var orig = deleteTrip;
    window.deleteTrip = function (date, tripIndex) {
      var rec = dailyRecords[date];
      var before = rec && Array.isArray(rec.trips) ? String(rec.trips[tripIndex] || "") : "";
      var awb = extractAwb(before);
      orig.apply(this, arguments);
      if (awb && dailyRecords[date]) {
        var still = (rec.trips || []).some(function (t) { return String(t) === before; });
        if (!still) removeSideJobForAwb(date, awb);
      }
    };
  }

  function patchUpdateReport() {
    if (window.__sideJobReport61) return;
    if (typeof updateReport !== "function") return;
    window.__sideJobReport61 = true;
    var orig = updateReport;
    window.updateReport = function () {
      if (cleanNonKliaSideMarks() || migrateLegacyTripLabels()) {
        try { saveToLocalStorage(); } catch (e) {}
      }
      orig.apply(this, arguments);
      applySideMarksInDom();
    };
  }

  function patchExcel() {
    if (window.__sideJobExcel61) return;
    if (typeof exportToExcel !== "function") return;
    window.__sideJobExcel61 = true;
    var orig = exportToExcel;
    window.exportToExcel = function () {
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
      "body.dark-mode .side-mark{color:#ff8a80;}" + "body.dark .side-mark{color:#ff8a80;}" +
      "@media print{.side-mark{color:#000!important;font-weight:700!important;}}";
    document.head.appendChild(st);
  }

  function boot() {
    injectSideMarkCss();
    patchTripSubmit();
    patchDeleteTrip();
    patchUpdateReport();
    patchExcel();
    resetSideRadios();
    if (cleanNonKliaSideMarks() || migrateLegacyTripLabels()) {
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
