// side-job-patch.js — encode Susun/Pallets on KLIA AWB trips (v44)
(function () {
  "use strict";
  function patch() {
    if (window.__sideJobPatched) return;
    if (typeof handleTripFormSubmit !== "function") return;
    window.__sideJobPatched = true;
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
        if (destination.toLowerCase().includes("klia cargo") && awb) {
          tripName = "KLIA Cargo (" + awb + ")";
          var sideEl = document.querySelector('input[name="sideJob"]:checked');
          var side = sideEl ? sideEl.value : "";
          if (side === "susun") tripName += " · Susun";
          else if (side === "pallets") tripName += " · Pallets";
        }
        dailyRecords[date].trips.push(tripName);
        var upl = document.getElementById("unpaidLeaveCheck");
        if (upl && upl.checked) dailyRecords[date].unpaid = true;
        saveToLocalStorage();
        updateReport();
        document.getElementById("destination").value = "";
        if (awbInput) awbInput.value = "";
        document.querySelectorAll('input[name="sideJob"]').forEach(function (r) {
          r.checked = r.value === "";
        });
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
      form.removeEventListener("submit", orig);
      form.addEventListener("submit", window.handleTripFormSubmit);
    }
  }
  document.addEventListener("rezaot-ready", function () { setTimeout(patch, 100); });
  if (document.readyState !== "loading") setTimeout(patch, 900);
})();
