// Compatibility facade. Trip and side-job mutations are atomic in the core record handlers.
(function () {
  "use strict";
  function sideMarkFor(record, label) {
    const normalized = RezaOT_model.normalizeRecord(record || { trips: [] }, "");
    const index = normalized.trips.findIndex((trip) => RezaOT_model.cleanTripLabel(trip) === RezaOT_model.cleanTripLabel(label));
    if (index < 0) return "";
    const type = normalized.tripDetails[index].sideJob;
    return type === "susun" ? " *" : type === "pallets" ? " #" : "";
  }
  window.RezaOT_sideMark = {
    cleanTripLabel: RezaOT_model.cleanTripLabel,
    extractAwb: RezaOT_model.extractAwb,
    sideMarkFor,
    formatTripDisplay: (record, label) => RezaOT_model.cleanTripLabel(label) + sideMarkFor(record, label)
  };
})();
