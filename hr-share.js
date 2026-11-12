(function () {
  "use strict";
  const M = RezaOT_hrModel;
  const $ = id => document.getElementById(id);
  let busy = false, panelMonth = "", generation = 0, returnFocus;
  function en() { return document.documentElement.lang === "en"; }
  function text(ms, english) { return en() ? english : ms; }
  function access() {
    if (!window.RezaOT_auth || !RezaOT_auth.canSync() || !getFirebaseRoot()) throw Error(text("Login akaun pemilik dan aktifkan sync dahulu.", "Sign in as the owner and enable sync first."));
    if (!navigator.onLine) throw Error(text("Sambung internet untuk urus link HR.", "Connect to the internet to manage HR links."));
    const database = ensureDatabase();
    if (!database) throw Error(text("Sambungan cloud belum tersedia.", "Cloud connection is unavailable."));
    return { database, root: getFirebaseRoot(), uid: RezaOT_auth.uid() };
  }
  function sameOwner(ctx) {
    if (!RezaOT_auth.canSync() || RezaOT_auth.uid() !== ctx.uid || getFirebaseRoot() !== ctx.root) throw Error(text("Akaun berubah. Buka semula panel ini.", "Account changed. Reopen this panel."));
  }
  function clean(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll(".no-print, button, input, select, textarea").forEach(n => n.remove());
    clone.querySelectorAll(".trip-item").forEach(n => n.appendChild(document.createTextNode("\n")));
    return clone.textContent.trim();
  }
  function snapshot(month, days) {
    if (currentMonthKey !== month) throw Error(text("Bulan berubah. Buka semula Kongsi HR.", "Month changed. Reopen Share with HR."));
    if (![7, 30, 90].includes(days)) throw Error("Invalid link duration");
    const rows = Array.from(document.querySelectorAll("#reportTable tbody tr[data-date]"), row => {
      const cells = Array.from(row.cells).slice(0, 8).map(clean);
      if (row.classList.contains("upl-row")) cells[1] += " (UPL)";
      if (row.classList.contains("annual-row")) cells[1] += " (ANN)";
      return cells;
    });
    if (!rows.length) throw Error(text("Tiada rekod untuk dikongsi bagi bulan ini.", "There are no records to share for this month."));
    const total = document.querySelector("#reportTable .ot-total-row");
    const report = {
      title: document.querySelector(".report-document-header h1").textContent.trim(),
      header: Array.from(document.querySelectorAll(".header-info p"), clean).join("\n"),
      headings: Array.from(document.querySelectorAll("#reportTable thead th")).slice(0, 8).map(clean),
      rows, totalLabel: total ? clean(total.cells[0]) : text("JUMLAH OT", "TOTAL OT"),
      total: total ? clean(total.cells[1]) : "0.00",
      footer: clean(document.querySelector("#printFooter .print-summary-note"))
    };
    const updatedAt = Date.now();
    const value = { version: 1, month, updatedAt, expiresAt: updatedAt + days * 86400000, report: JSON.stringify(report) };
    M.validate(value);
    return value;
  }
  function indexPath(ctx) { return ctx.root + "/_meta/hrShares/" + panelMonth; }
  function message(value) { $("hrShareStatus").textContent = value; }
  function controls(disabled) {
    $("hrSharePanel").querySelectorAll("button:not([data-close]), select").forEach(b => b.disabled = disabled);
    $("hrSharePanel").setAttribute("aria-busy", String(disabled));
  }
  async function run(action) {
    if (busy) return;
    busy = true; controls(true);
    try { await action(); }
    catch (error) {
      const denied = /permission|denied/i.test(error.code || error.message);
      message(denied ? text("Firebase belum membenarkan perkongsian. Publish database.rules.owner.json versi 77 dahulu. Rekod peribadi tidak berubah.", "Sharing is not enabled in Firebase yet. Publish the v77 database.rules.owner.json first. Private records are unchanged.") : error.message);
    } finally { busy = false; controls(false); }
  }
  function button(label, action) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.onclick = () => run(action); return b;
  }
  async function list(ctx) {
    const seq = ++generation, month = panelMonth;
    const values = (await ctx.database.ref(indexPath(ctx)).once("value")).val() || {};
    sameOwner(ctx);
    if (seq !== generation || month !== panelMonth || $("hrShareDialog").hidden) return;
    const list = $("hrShareList"); list.replaceChildren();
    for (const [id, entry] of Object.entries(values)) {
      if (!M.validToken(id)) continue;
      const item = document.createElement("section"); item.className = "hr-share-item";
      const info = document.createElement("p");
      info.textContent = text("Dikemas kini: ", "Updated: ") + new Date(entry.updatedAt).toLocaleString(en() ? "en-MY" : "ms-MY") + " · " +
        text("Luput: ", "Expires: ") + new Date(entry.expiresAt).toLocaleString(en() ? "en-MY" : "ms-MY");
      item.appendChild(info);
      const input = document.createElement("input"); input.type = "text"; input.readOnly = true; input.value = M.link(location.href, id);
      input.setAttribute("aria-label", text("Link laporan HR", "HR report link")); input.onclick = () => input.select(); item.appendChild(input);
      const actions = document.createElement("div"); actions.className = "hr-share-actions";
      actions.appendChild(button(text("Salin link", "Copy link"), async () => {
        try { await navigator.clipboard.writeText(input.value); message(text("Link disalin.", "Link copied.")); }
        catch (_) { input.focus(); input.select(); message(text("Tekan lama pada link untuk salin.", "Select and copy the link above.")); }
      }));
      const open = document.createElement("a"); open.href = input.value; open.target = "_blank"; open.rel = "noopener noreferrer"; open.textContent = text("Lihat laporan", "View report"); actions.appendChild(open);
      actions.appendChild(button(text("Kemas kini laporan", "Update report"), async () => {
        const active = access(); sameOwner(ctx);
        const value = snapshot(month, Number($("hrShareExpiry").value));
        if (!(await rezaotConfirm(text("Ganti laporan pada link ini dengan rekod semasa?", "Replace the report at this link with the current records?")))) return;
        sameOwner(active);
        await publish(active, id, value); await list(active); message(text("Laporan dikemas kini. Link sama dikekalkan.", "Report updated. The same link still works."));
      }));
      actions.appendChild(button(text("Batalkan link", "Revoke link"), async () => {
        const active = access(); sameOwner(ctx);
        if (!(await rezaotConfirm(text("Batalkan akses HR melalui link ini? Salinan yang sudah dicetak tidak boleh ditarik balik.", "Revoke this HR link? Previously printed copies cannot be recalled.")))) return;
        sameOwner(active);
        const changes = {}; changes["sharedReports/" + id] = null; changes[indexPath(active) + "/" + id] = null;
        await active.database.ref().update(changes); await list(active); message(text("Link dibatalkan.", "Link revoked."));
      }));
      item.appendChild(actions); list.appendChild(item);
    }
    if (!list.children.length) list.textContent = text("Belum ada link untuk bulan ini.", "No links for this month yet.");
    controls(busy);
  }
  async function publish(ctx, id, value) {
    sameOwner(ctx);
    const changes = {}; changes["sharedReports/" + id] = value;
    changes[indexPath(ctx) + "/" + id] = { updatedAt: value.updatedAt, expiresAt: value.expiresAt };
    // One acknowledged atomic write. Never persist/replay a sharing mutation in the app's offline queue.
    await ctx.database.ref().update(changes);
  }
  function close() { $("hrShareDialog").hidden = true; generation++; if (returnFocus) returnFocus.focus(); }
  function init() {
    $("hrShareBtn").onclick = () => {
      if (busy) return;
      returnFocus = document.activeElement; panelMonth = currentMonthKey;
      $("reportExportMenu").hidden = true; $("exportMenuBtn").setAttribute("aria-expanded", "false");
      $("hrShareTitle").textContent = text("Kongsi HR · ", "Share with HR · ") + panelMonth;
      $("hrShareNote").textContent = text("Salinan laporan bulan ini sahaja. HR boleh baca dan cetak/PDF tanpa login. Sesiapa yang menerima link boleh membukanya. Perubahan rekod tidak dikongsi sehingga anda mengemas kini laporan.", "A snapshot of this month only. HR can read and print/save PDF without signing in. Anyone with the link can open it. Record changes appear only when you update the shared report.");
      $("hrShareCreate").textContent = text("Jana link baharu", "Create new link");
      $("hrShareExpiryLabel").textContent = text("Tempoh link", "Link duration");
      $("hrShareExpiry").querySelectorAll("option").forEach(o => o.textContent = o.value + text(" hari", " days"));
      $("hrShareDialog").hidden = false; $("hrShareClose").focus(); message(""); $("hrShareList").replaceChildren();
      run(async () => list(access()));
    };
    $("hrShareClose").onclick = close;
    $("hrShareDialog").addEventListener("keydown", event => {
      if (event.key === "Escape") { event.stopPropagation(); close(); }
      if (event.key === "Tab") {
        const items = Array.from($("hrSharePanel").querySelectorAll("button:not(:disabled), input, select:not(:disabled), a[href]"));
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    $("hrShareCreate").onclick = () => run(async () => {
      const ctx = access(), value = snapshot(panelMonth, Number($("hrShareExpiry").value)), id = M.token(crypto);
      if (!(await rezaotConfirm(text("Kongsi salinan laporan ", "Share a snapshot for ") + panelMonth + text(" dengan sesiapa yang menerima link?", " with anyone who receives the link?")))) return;
      sameOwner(ctx); await publish(ctx, id, value); await list(ctx);
      message(text("Link siap. Salin dan hantar kepada HR.", "Link ready. Copy it and send it to HR."));
    });
  }
  window.RezaOT_hrShare = { snapshot, init };
  document.addEventListener("rezaot-ready", init);
  document.addEventListener("rezaot-auth-state", () => { if ($("hrShareDialog") && !$("hrShareDialog").hidden) close(); });
})();
