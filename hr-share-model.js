// Public reports contain only print-facing text, never application state or HTML.
(function (root) {
  "use strict";
  const TOKEN = /^[a-f0-9]{64}$/;
  function token(crypto) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  }
  function validate(value) {
    function str(s, max) { return typeof s === "string" && s.length <= max; }
    if (!value || value.version !== 1 || !str(value.month, 80) || !value.month ||
        !Number.isFinite(value.updatedAt) || !Number.isFinite(value.expiresAt) ||
        value.expiresAt <= value.updatedAt || !str(value.report, 250000)) throw Error("Invalid shared report");
    const report = JSON.parse(value.report);
    if (!report || !str(report.title, 200) || !str(report.header, 2000) || !str(report.footer, 2000) ||
        !Array.isArray(report.headings) || report.headings.length !== 8 || !report.headings.every(s => str(s, 200)) ||
        !Array.isArray(report.rows) || !report.rows.length || report.rows.length > 31 ||
        !report.rows.every(row => Array.isArray(row) && row.length === 8 && row.every(s => str(s, 20000))) ||
        !str(report.totalLabel, 100) || !str(report.total, 100)) throw Error("Invalid shared report content");
    return report;
  }
  function link(base, id) {
    if (!TOKEN.test(id)) throw Error("Invalid report link");
    const url = new URL("hr.html", base); url.hash = id; return url.href;
  }
  const api = { token, validToken: id => TOKEN.test(id), validate, link };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RezaOT_hrModel = api;
})(globalThis);
