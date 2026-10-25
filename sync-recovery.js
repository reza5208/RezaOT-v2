// Inspect local sync conflicts and recovery copies without replaying raw data.
(function () {
  "use strict";
  var initialized = false;
  var words = {
    recoveryManage: ["Semak sync & pemulihan", "Review sync & recovery"],
    recoveryTitle: ["Sync & pemulihan", "Sync & recovery"],
    recoveryHint: ["Semak konflik sebelum memilih versi. Muat turun backup sebelum membuang salinan lama.", "Review conflicts before choosing a version. Download a backup before removing old copies."],
    recoveryRefresh: ["Semak semula", "Refresh"],
    recoveryReconnect: ["Sambung semula cloud", "Reconnect cloud"],
    recoveryClose: ["Tutup", "Close"],
    recoveryConflicts: ["Konflik untuk disemak", "Conflicts to review"],
    recoveryCopies: ["Salinan pemulihan pada peranti", "Recovery copies on this device"],
    recoveryEmptyConflicts: ["Tiada konflik aktif.", "No active conflicts."],
    recoveryEmptyCopies: ["Belum ada salinan pemulihan.", "No recovery copies yet."],
    recoveryLocal: ["Versi peranti ini", "This device's version"],
    recoveryRemote: ["Versi cloud", "Cloud version"],
    recoveryChooseLocal: ["Pilih versi peranti", "Choose device version"],
    recoveryChooseRemote: ["Pilih versi cloud", "Choose cloud version"],
    recoveryChoosePrompt: ["Gunakan versi ini untuk bahagian yang berkonflik? Salinan pemulihan dikekalkan.", "Use this version for the conflicting parts? Recovery copies will be retained."],
    recoveryChosen: ["Pilihan konflik disimpan. Semak status sync.", "Conflict choice saved. Check sync status."],
    recoveryDownloadOne: ["Muat turun salinan", "Download copy"],
    recoveryRemove: ["Buang salinan lama", "Remove old copy"],
    recoveryRemovePrompt: ["Pastikan backup atau salinan ini sudah disimpan. Buang salinan pemulihan ini dari peranti? Rekod semasa tidak dipadam.", "Make sure a backup or this copy has been saved. Remove this recovery copy from the device? Current records will be retained."],
    recoveryRemoved: ["Salinan lama dibuang.", "Old copy removed."],
    recoveryPreview: ["Lihat kandungan", "Preview content"],
    recoveryConnected: ["Cloud tersambung", "Cloud connected"],
    recoveryDisconnected: ["Cloud belum tersambung", "Cloud disconnected"],
    recoveryPending: ["menunggu sync", "pending sync"],
    recoveryDirty: ["perubahan lokal", "local changes"],
    recoveryLegacy: ["pending dari laluan lama — perlu semakan migrasi", "pending from a previous path — migration review needed"],
    recoveryLastAck: ["Sync disahkan kali terakhir", "Last acknowledged sync"],
    recoveryStorage: ["Anggaran storan lokal", "Estimated local storage"],
    recoveryNotYet: ["Belum ada", "Not yet"]
  };
  var packs = { ms: {}, en: {} };
  Object.keys(words).forEach(function (key) { packs.ms[key] = words[key][0]; packs.en[key] = words[key][1]; });
  if (window.RezaOT_i18n) RezaOT_i18n.extend(packs);
  function t(key) { return window.RezaOT_i18n ? RezaOT_i18n.t(key) : words[key][0]; }
  function node(tag, cls, value) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (value != null) el.textContent = value;
    return el;
  }
  function preview(label, data) {
    var details = node("details", "recovery-preview");
    details.appendChild(node("summary", "", label));
    details.appendChild(node("pre", "", JSON.stringify(data == null ? null : data, null, 2)));
    return details;
  }
  function button(label, callback, danger) {
    var el = node("button", danger ? "text-button recovery-danger" : "secondary-button", label);
    el.type = "button";
    el.addEventListener("click", async function () {
      el.disabled = true;
      try { await callback(); }
      catch (error) { if (window.showToast) showToast(error.message); }
      finally { el.disabled = false; }
    });
    return el;
  }
  function download(entry) {
    var payload = { schemaVersion: 1, kind: "rezaot-recovery", exportedAt: new Date().toISOString(), entries: [entry] };
    var url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    var link = document.createElement("a");
    link.href = url; link.download = entry.key + ".json"; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function render() {
    var panel = document.getElementById("syncRecoveryPanel");
    if (!panel || panel.hidden) return;
    var sync = window.RezaOT_sync;
    var diagnostic = sync && sync.getDiagnostics ? sync.getDiagnostics() : {};
    var status = [t(diagnostic.connected ? "recoveryConnected" : "recoveryDisconnected"),
      (diagnostic.pending || 0) + " " + t("recoveryPending"), (diagnostic.dirty || 0) + " " + t("recoveryDirty")];
    if (diagnostic.legacyPending) status.push(diagnostic.legacyPending + " " + t("recoveryLegacy"));
    var ack = diagnostic.lastAcknowledgedAt;
    var time = ack && !Number.isNaN(Date.parse(ack)) ? new Date(ack).toLocaleString() : t("recoveryNotYet");
    status.push(t("recoveryLastAck") + ": " + time);
    if (RezaOT_storage.usageBytes) status.push(t("recoveryStorage") + ": " + (RezaOT_storage.usageBytes() / 1024).toFixed(1) + " KB");
    document.getElementById("syncDiagnostics").textContent = status.join(" · ");
    var list = document.getElementById("syncConflictList"); list.replaceChildren();
    var conflicts = sync && sync.getConflicts ? sync.getConflicts() : [];
    if (!conflicts.length) list.appendChild(node("p", "card-description", t("recoveryEmptyConflicts")));
    conflicts.forEach(function (conflict) {
      var card = node("article", "recovery-item"); card.dataset.conflictId = conflict.id;
      card.appendChild(node("h4", "", conflict.target || conflict.path || conflict.reason || conflict.id));
      card.appendChild(preview(t("recoveryLocal"), conflict.local));
      card.appendChild(preview(t("recoveryRemote"), conflict.remote));
      var actions = node("div", "recovery-actions");
      ["local", "remote"].forEach(function (choice) {
        var action = button(t(choice === "local" ? "recoveryChooseLocal" : "recoveryChooseRemote"), async function () {
          if (!(await rezaotConfirm(t("recoveryChoosePrompt")))) return;
          await sync.resolveConflict(conflict.id, choice);
          showToast(t("recoveryChosen")); render();
        });
        action.dataset.conflictChoice = choice; actions.appendChild(action);
      });
      card.appendChild(actions); list.appendChild(card);
    });
    var copies = document.getElementById("syncRecoveryList"); copies.replaceChildren();
    var entries = RezaOT_storage.recoveryEntries().sort(function (a, b) {
      return String(b.value && b.value.savedAt || b.key).localeCompare(String(a.value && a.value.savedAt || a.key));
    });
    if (!entries.length) copies.appendChild(node("p", "card-description", t("recoveryEmptyCopies")));
    entries.forEach(function (entry) {
      var value = entry.value || {};
      var card = node("article", "recovery-item"); card.dataset.recoveryKey = entry.key;
      card.appendChild(node("h4", "", value.reason || entry.key));
      if (value.savedAt) card.appendChild(node("p", "card-description", new Date(value.savedAt).toLocaleString()));
      card.appendChild(preview(t("recoveryPreview"), value.data == null ? value : value.data));
      var actions = node("div", "recovery-actions");
      actions.appendChild(button(t("recoveryDownloadOne"), function () { download(entry); }));
      actions.appendChild(button(t("recoveryRemove"), async function () {
        if (!(await rezaotConfirm(t("recoveryRemovePrompt")))) return;
        RezaOT_storage.removeRecovery(entry.key); showToast(t("recoveryRemoved")); render();
      }, true));
      card.appendChild(actions); copies.appendChild(card);
    });
  }
  function init() {
    if (initialized) return;
    initialized = true;
    var panel = document.getElementById("syncRecoveryPanel");
    var toggle = document.getElementById("manageRecoveryBtn");
    if (!panel || !toggle) return;
    toggle.addEventListener("click", function () {
      panel.hidden = !panel.hidden; toggle.setAttribute("aria-expanded", String(!panel.hidden));
      render(); if (!panel.hidden) panel.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    document.getElementById("syncRecoveryClose").addEventListener("click", function () {
      panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); toggle.focus();
    });
    document.getElementById("syncRecoveryRefresh").addEventListener("click", render);
    document.getElementById("syncReconnectBtn").addEventListener("click", async function () {
      try { await RezaOT_sync.reconnect(); render(); } catch (error) { showToast(error.message); }
    });
  }
  window.RezaOT_recovery = { init: init, render: render };
  document.addEventListener("rezaot-ready", init);
  document.addEventListener("rezaot-sync-state", function () { if (initialized) render(); });
  document.addEventListener("rezaot-language", function () { if (initialized) render(); });
  window.addEventListener("storage", function () { if (initialized) render(); });
})();
