// Validated, backwards-compatible records. tripDetails owns identity; trips remains the legacy label view.
(function (root) {
  "use strict";
  const MONTHS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
  const owns = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  function fail(message) { throw new Error(message); }
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1900) return false;
    const date = new Date(value + "T00:00:00Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function validTime(value) { return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }
  function monthValue(key) {
    if (typeof key !== "string") return "";
    const match = key.match(/^(.+) (\d{4})$/);
    const index = match ? MONTHS.indexOf(match[1]) : -1;
    return index >= 0 && Number(match[2]) >= 1900 ? match[2] + "-" + String(index + 1).padStart(2, "0") : "";
  }
  function validateMonthKey(key) { if (!monthValue(key)) fail("Bulan tidak sah: " + String(key)); return key; }
  function monthFromDate(value) { if (!validDate(value)) fail("Tarikh tidak sah"); return MONTHS[Number(value.slice(5, 7)) - 1] + " " + value.slice(0, 4); }
  function normalizeAwb(value) { return String(value || "").toLowerCase().replace(/\s+/g, ""); }
  function cleanTripLabel(value) {
    return String(value || "").replace(/\s*[·•-]\s*(Susun|Pallets)\s*$/i, "")
      .replace(/\s*\[(Susun|Pallets)\]\s*$/i, "").replace(/\s*[*#]\s*$/, "").trim();
  }
  function extractAwb(value) { const match = cleanTripLabel(value).match(/KLIA\s*Cargo\s*\(([^)]+)\)/i); return match ? match[1].trim() : ""; }
  function markerType(value) {
    if (/\*\s*$|(?:[·•-]\s*Susun|\[Susun\])\s*$/i.test(value)) return "susun";
    if (/#\s*$|(?:[·•-]\s*Pallets|\[Pallets\])\s*$/i.test(value)) return "pallets";
    return "";
  }
  function stableId(date, label, index) {
    let hash = 2166136261;
    for (const char of date + "|" + index + "|" + label) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    return "trip-" + hash.toString(36) + "-" + index;
  }
  function newId() {
    return root.crypto && typeof root.crypto.randomUUID === "function" ? root.crypto.randomUUID() : "trip-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }
  function validateDestinations(value) {
    if (!Array.isArray(value) || value.length > 5000 || value.some((v) => typeof v !== "string" || !v.trim() || v.length > 500)) fail("Senarai destinasi tidak sah");
    return value.slice();
  }
  function normalizeRecord(value, date) {
    if (!object(value)) fail("Rekod tidak sah: " + (date || ""));
    const result = {};
    for (const key of ["clock_in", "clock_out"]) {
      const time = value[key] == null ? "" : value[key];
      if (time !== "" && !validTime(time)) fail("Masa tidak sah: " + (date || ""));
      result[key] = time;
    }
    for (const key of ["unpaid", "annual"]) {
      if (owns(value, key) && typeof value[key] !== "boolean") fail("Status cuti tidak sah: " + (date || ""));
      result[key] = value[key] === true;
    }
    if (result.unpaid && result.annual) fail("UPL dan ANN tidak boleh dipilih serentak");
    const labels = value.trips == null ? [] : value.trips;
    if (!Array.isArray(labels) || labels.length > 5000 || labels.some((v) => typeof v !== "string" || !v.trim() || v.length > 1000)) fail("Trip tidak sah: " + (date || ""));
    const jobs = value.sideJobs == null ? [] : value.sideJobs;
    if (!Array.isArray(jobs) || jobs.length > 5000 || jobs.some((j) => !object(j) || typeof j.awb !== "string" || !j.awb.trim() || j.awb.length > 200 || !["susun", "pallets"].includes(j.type))) fail("Side job tidak sah: " + (date || ""));
    const previous = value.tripDetails == null ? [] : value.tripDetails;
    if (!Array.isArray(previous) || previous.length > 5000 || previous.some((t) => !object(t) || typeof t.id !== "string" || !t.id || t.id.length > 200 || typeof t.label !== "string" || t.label.length > 1000 || typeof t.awb !== "string" || t.awb.length > 200 || !["", "susun", "pallets"].includes(t.sideJob))) fail("Butiran trip tidak sah: " + (date || ""));
    const seenIds = new Set();
    const paid = new Map(jobs.map((j) => [normalizeAwb(j.awb), j.type]));
    result.tripDetails = labels.map((raw, index) => {
      const label = cleanTripLabel(raw);
      const awb = extractAwb(label);
      if (!label || awb.length > 200) fail("Trip/AWB tidak sah: " + (date || ""));
      const prior = previous[index];
      const matched = prior && cleanTripLabel(prior.label) === label && normalizeAwb(prior.awb) === normalizeAwb(awb);
      let id = matched ? prior.id : stableId(date || "", label, index);
      if (seenIds.has(id)) {
        const base = stableId(date || "", label, index);
        id = base;
        let suffix = 1;
        while (seenIds.has(id)) id = base + "-" + suffix++;
      }
      seenIds.add(id);
      // Structured metadata is authoritative. Legacy sideJobs/markers migrate only when metadata is absent.
      const sideJob = awb ? (matched ? prior.sideJob : (paid.get(normalizeAwb(awb)) || markerType(raw))) : "";
      return { id, label, awb, sideJob };
    });
    syncSideJobs(result);
    return result;
  }
  function syncSideJobs(record) {
    const jobs = new Map();
    for (const detail of record.tripDetails) if (detail.awb && ["susun", "pallets"].includes(detail.sideJob)) {
      const key = normalizeAwb(detail.awb);
      if (!jobs.has(key)) jobs.set(key, { awb: detail.awb, type: detail.sideJob });
    }
    record.sideJobs = Array.from(jobs.values());
    record.trips = record.tripDetails.map((detail) => detail.label + (detail.sideJob === "susun" ? " *" : detail.sideJob === "pallets" ? " #" : ""));
    return record;
  }
  function tripDetails(record, date) { return normalizeRecord(record, date).tripDetails; }
  function formatTrip(record, index) {
    const detail = tripDetails(record, "")[index];
    return detail ? detail.label + (detail.sideJob === "susun" ? " *" : detail.sideJob === "pallets" ? " #" : "") : "";
  }
  function validateRecords(value, month) {
    if (!object(value) || Object.keys(value).length > 36600) fail("Senarai rekod tidak sah");
    if (month != null) validateMonthKey(month);
    const result = {};
    for (const date of Object.keys(value)) {
      if (!validDate(date)) fail("Tarikh tidak sah: " + date);
      if (month && monthFromDate(date) !== month) fail("Tarikh " + date + " bukan dalam " + month);
      result[date] = normalizeRecord(value[date], date);
    }
    return result;
  }
  root.RezaOT_model = { validDate, validTime, monthValue, validateMonthKey, monthFromDate, normalizeAwb, cleanTripLabel, extractAwb, markerType, newId, normalizeRecord, syncSideJobs, tripDetails, formatTrip, validateRecords, validateDestinations };
})(typeof window === "undefined" ? globalThis : window);
