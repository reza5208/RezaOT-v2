// Standalone read-only viewer: no app bootstrap, Auth, local records or SDK writes.
(function () {
  "use strict";
  const $ = id => document.getElementById(id), M = RezaOT_hrModel;
  const id = location.hash.slice(1);
  const endpoint = "https://reza-ot-default-rtdb.asia-southeast1.firebasedatabase.app/sharedReports/";
  let english = false, active = null, expiryTimer, polling, loading = false;
  let lastError = "";
  function t(ms, en) { return english ? en : ms; }
  function status(message) { $("viewerStatus").textContent = message; }
  window.showToast = status;
  window.loadPdfLib = () => Promise.resolve();
  function labels() {
    document.documentElement.lang = english ? "en" : "ms";
    $("viewerLanguage").textContent = english ? "BM" : "EN";
    $("readOnlyLabel").textContent = t("Baca sahaja", "Read only");
    $("viewerPrint").textContent = t("Cetak / Simpan PDF", "Print / Save PDF");
    $("viewerPdf").textContent = t("Muat turun PDF", "Download PDF");
    $("orientationLabel").textContent = t("Orientasi A4", "A4 orientation");
    $("viewerNote").textContent = t("Salinan laporan yang dikongsi pemilik. Perubahan rekod hanya muncul selepas pemilik mengemas kini salinan ini. Link boleh dibatalkan; salinan yang sudah disimpan atau dicetak tidak boleh ditarik balik.", "A report snapshot shared by its owner. Record changes appear only after the owner updates this copy. Links can be revoked; saved or printed copies cannot be recalled.");
    if (active) $("viewerMeta").textContent = active.month + " · " + t("Dikemas kini: ", "Updated: ") + new Date(active.updatedAt).toLocaleString(english ? "en-MY" : "ms-MY") + " · " + t("Luput: ", "Expires: ") + new Date(active.expiresAt).toLocaleString(english ? "en-MY" : "ms-MY");
    if (lastError) showError(lastError);
  }
  function showError(kind) {
    lastError = kind;
    const messages = {
      invalid: t("Link laporan tidak sah.", "Invalid report link."),
      unavailable: t("Laporan tidak tersedia. Link mungkin telah luput atau dibatalkan. Minta link baharu daripada pemilik.", "Report unavailable. The link may have expired or been revoked. Ask the owner for a new link."),
      network: t("Tak dapat menyemak laporan. Sambung internet dan muat semula halaman.", "Cannot verify this report. Connect to the internet and reload the page.")
    };
    status(messages[kind] || messages.unavailable);
  }
  function clear(kind) {
    active = null; clearTimeout(expiryTimer);
    RezaOT_print.cleanup();
    $("sharedDocument").hidden = true; $("viewerActions").hidden = true;
    for (const key of ["viewerTitle", "viewerHeader", "viewerFooter", "viewerMeta"]) $(key).textContent = "";
    $("reportTable").querySelectorAll("thead,tbody,tfoot").forEach(n => n.replaceChildren());
    showError(kind);
  }
  function render(value) {
    const report = M.validate(value);
    active = value; lastError = ""; window.currentMonthKey = value.month;
    $("viewerTitle").textContent = report.title;
    $("viewerHeader").textContent = report.header;
    $("viewerFooter").textContent = report.footer;
    const table = $("reportTable");
    const head = table.querySelector("thead"); head.replaceChildren();
    const tr = document.createElement("tr");
    report.headings.forEach(label => { const th = document.createElement("th"); th.scope = "col"; th.textContent = label; tr.appendChild(th); }); head.appendChild(tr);
    const body = table.querySelector("tbody"); body.replaceChildren();
    report.rows.forEach(row => {
      const tr = document.createElement("tr");
      row.forEach(label => { const td = document.createElement("td"); td.textContent = label; tr.appendChild(td); });
      body.appendChild(tr);
    });
    const foot = table.querySelector("tfoot"); foot.replaceChildren();
    const total = document.createElement("tr"), label = document.createElement("td"); label.colSpan = 5; label.textContent = report.totalLabel; total.appendChild(label);
    [report.total, "", ""].forEach(value => { const cell = document.createElement("td"); cell.textContent = value; total.appendChild(cell); }); foot.appendChild(total);
    $("sharedDocument").hidden = false; $("viewerActions").hidden = false; status(""); labels();
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(() => { if (value.expiresAt <= Date.now()) clear("unavailable"); else refresh(); }, Math.min(2147483647, Math.max(1, value.expiresAt - Date.now())));
  }
  async function refresh() {
    if (loading) return false;
    if (!M.validToken(id)) { clear("invalid"); return false; }
    loading = true;
    try {
      const response = await fetch(endpoint + id + ".json", { method: "GET", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(15000) });
      if (!response.ok) { clear(response.status === 401 || response.status === 403 || response.status === 404 ? "unavailable" : "network"); return false; }
      const value = await response.json();
      if (!value || value.expiresAt <= Date.now()) { clear("unavailable"); return false; }
      M.validate(value);
      // Polling does not replace an in-progress print/PDF document.
      if (!window.__pdfBusy && !window.__printBusy) render(value);
      return true;
    } catch (error) { clear(error instanceof SyntaxError || /Invalid shared report/.test(error.message) ? "unavailable" : "network"); return false; }
    finally { loading = false; }
  }
  async function output(pdf) {
    if (window.__pdfBusy || window.__printBusy) return;
    $("viewerPrint").disabled = $("viewerPdf").disabled = true;
    try {
      // Always recheck server-side expiry/revocation before a fresh export.
      if (!(await refresh()) || !active) return;
      const orientation = $("viewerOrientation").value === "landscape" ? "landscape" : "portrait";
      if (pdf) await RezaOT_print.exportPdf(orientation);
      else await RezaOT_print.print(orientation);
    } finally { $("viewerPrint").disabled = $("viewerPdf").disabled = false; }
  }
  $("viewerLanguage").onclick = () => { english = !english; labels(); };
  $("viewerPrint").onclick = () => output(false);
  $("viewerPdf").onclick = () => output(true);
  window.addEventListener("offline", () => clear("network"));
  window.addEventListener("online", refresh);
  // Do not show a stale BFCache report after returning to this tab.
  window.addEventListener("pageshow", event => { if (event.persisted) { clear("network"); refresh(); clearInterval(polling); polling = setInterval(() => { if (!document.hidden) refresh(); }, 30000); } });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  window.addEventListener("hashchange", () => location.reload());
  labels(); refresh();
  polling = setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  window.addEventListener("pagehide", () => { clearInterval(polling); clearTimeout(expiryTimer); });
})();
