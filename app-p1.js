// PIN and personal UI controls. Sync, reports and export modules own their flows.
(function () {
  "use strict";
  function tr(key, fallback) { return window.RezaOT_i18n ? RezaOT_i18n.text(key, fallback) : fallback; }
  async function ask(message, value, secret) {
    return rezaotPrompt(message, value || "", { inputType: secret ? "password" : "text" });
  }
  async function checkPin(message) {
    var pin = localStorage.getItem("rezaot_pin");
    if (!pin) return true;
    if (await ask(message, "", true) === pin) return true;
    showToast(tr("wrongPin", "PIN salah")); return false;
  }
  window.editSupervisorName = async function () {
    if (localStorage.getItem("supervisorLocked") === "1") {
      if (!localStorage.getItem("rezaot_pin")) { showToast(tr("setPinFirst", "Set PIN untuk buka kunci nama ketua.")); return; }
      if (!await checkPin(tr("supervisorPin", "Nama ketua dikunci. Masukkan PIN:"))) return;
    }
    var el = document.getElementById("supervisorName");
    if (!el) return;
    var next = await ask(tr("promptSup", "Nama ketua:"), el.textContent.trim() || "Talib");
    if (next === null) return;
    var name = next.trim() || "Talib";
    if (window.RezaOT_sync && typeof RezaOT_sync.updateSettings === "function") RezaOT_sync.updateSettings({ supervisorName: name });
    else localStorage.setItem("supervisorName", name);
    el.textContent = name;
    document.dispatchEvent(new Event("rezaot-profile"));
    showToast(tr("toastSupSaved", "Nama ketua dikemaskini"));
  };
  async function editPin() {
    var cur = localStorage.getItem("rezaot_pin");
    if (cur) {
      var action = await rezaotChoose(tr("pinAction", "PIN app"), [
        { value: "change", label: tr("pinChange", "Tukar PIN") },
        { value: "remove", label: tr("pinRemove", "Buang PIN") }
      ]);
      if (!action || !await checkPin(tr("currentPin", "PIN semasa:"))) return;
      if (action === "remove") { localStorage.removeItem("rezaot_pin"); showToast(tr("pinRemoved", "PIN dibuang")); return; }
    }
    var next = await ask(tr("newPin", "PIN baru (4–8 digit):"), "", true);
    if (next === null) return;
    if (!/^\d{4,8}$/.test(next)) { showToast(tr("invalidPin", "PIN mesti 4–8 digit")); return; }
    if (await ask(tr("repeatPin", "Ulang PIN:"), "", true) !== next) { showToast(tr("pinMismatch", "PIN tak sama")); return; }
    localStorage.setItem("rezaot_pin", next);
    showToast(tr("pinSaved", "PIN disimpan"));
  }
  function wire(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", function () { Promise.resolve().then(fn).catch(function (e) { showToast(e.message); }); });
  }
  function wireExtras() {
    wire("langToggleBtn", function () { RezaOT_i18n.toggle(); });
    wire("pinSettingsBtn", editPin);
    var lockBtn = document.getElementById("supervisorLockBtn");
    if (lockBtn) {
      lockBtn.textContent = localStorage.getItem("supervisorLocked") === "1" ? "🔒" : "🔓";
      wire("supervisorLockBtn", async function () {
        var locked = localStorage.getItem("supervisorLocked") === "1";
        if (locked && !await checkPin(tr("unlockPin", "PIN untuk buka kunci:"))) return;
        localStorage.setItem("supervisorLocked", locked ? "0" : "1");
        lockBtn.textContent = locked ? "🔓" : "🔒";
        showToast(tr(locked ? "supervisorUnlocked" : "supervisorLocked", locked ? "Nama ketua dibuka" : "Nama ketua dikunci"));
      });
    }
    wire("fabAddTrip", async function () {
      if (window.RezaOT_dashboard) RezaOT_dashboard.navigate("today");
      var today = getLocalDateString(new Date());
      var target = monthNames[new Date().getMonth()] + " " + new Date().getFullYear();
      if (target !== currentMonthKey) {
        var ok = await rezaotConfirm(tr("switchTodayMonth", "Tukar ke bulan semasa untuk tambah trip hari ini?"));
        if (!ok) return;
        selectMonth(target);
      }
      var date = document.getElementById("date");
      if (date) date.value = today;
      updateHolidayBadge();
      var dest = document.getElementById("destination");
      if (dest) { dest.focus(); dest.scrollIntoView({ behavior: "smooth", block: "center" }); }
      showToast(tr("pickDest", "Sila pilih destinasi."));
    });
    var pin = localStorage.getItem("rezaot_pin");
    if (pin && !document.getElementById("pinOverlay")) {
      var ov = document.createElement("div");
      ov.id = "pinOverlay";
      ov.className = "pin-overlay no-print";
      ov.style.display = "flex";
      ov.innerHTML = '<div class="pin-box" role="dialog" aria-modal="true" aria-labelledby="pinTitle"><h2 id="pinTitle">RezaOT</h2><label class="pin-hint" for="pinInput">PIN</label><input type="password" id="pinInput" aria-label="PIN" inputmode="numeric" maxlength="8" autocomplete="one-time-code"/><button type="button" id="pinSubmitBtn" data-i18n="pinOpen">Buka</button><p id="pinError" class="pin-error" hidden>PIN salah</p></div>';
      document.body.appendChild(ov);
      document.body.classList.add("pin-locked");
      var app = document.querySelector(".container");
      if (app) app.inert = true;

      // PIN is client-side only (stored in localStorage). This lockout slows casual guessing; it is NOT real security.
      function getFailState() {
        try { return JSON.parse(localStorage.getItem("rezaot_pin_fail") || "null") || { n: 0, until: 0 }; }
        catch (e) { return { n: 0, until: 0 }; }
      }
      function setFailState(s) {
        localStorage.setItem("rezaot_pin_fail", JSON.stringify(s));
      }
      function lockedRemaining() {
        var st = getFailState();
        var left = Math.ceil((st.until - Date.now()) / 1000);
        return left > 0 ? left : 0;
      }
      function applyLockUi(secs) {
        var input = document.getElementById("pinInput");
        var btn = document.getElementById("pinSubmitBtn");
        var err = document.getElementById("pinError");
        if (input) input.disabled = true;
        if (btn) btn.disabled = true;
        if (err) {
          err.hidden = false;
          err.textContent = tr("pinWait", "Terlalu banyak cubaan. Cuba semula sebentar lagi.");
        }
      }
      function clearLockUi() {
        var input = document.getElementById("pinInput");
        var btn = document.getElementById("pinSubmitBtn");
        var err = document.getElementById("pinError");
        if (input) input.disabled = false;
        if (btn) btn.disabled = false;
        if (err) { err.hidden = true; err.textContent = tr("wrongPin", "PIN salah"); }
      }
      function registerFail() {
        var st = getFailState();
        st.n = (st.n || 0) + 1;
        if (st.n >= 5) {
          st.until = Date.now() + 60000;
          st.n = 0;
          setFailState(st);
          applyLockUi(60);
          setTimeout(function () {
            setFailState({ n: 0, until: 0 });
            clearLockUi();
          }, 60000);
        } else {
          setFailState(st);
        }
      }

      function unlockOk() {
        setFailState({ n: 0, until: 0 });
        ov.style.display = "none";
        document.body.classList.remove("pin-locked");
        if (app) app.inert = false;
        var input = document.getElementById("pinInput");
        if (input) { input.value = ""; input.disabled = false; }
        var btn = document.getElementById("pinSubmitBtn");
        if (btn) btn.disabled = false;
        var err = document.getElementById("pinError");
        if (err) { err.hidden = true; err.textContent = tr("wrongPin", "PIN salah"); }
      }

      function tryU() {
        if (lockedRemaining() > 0) return;
        var input = document.getElementById("pinInput");
        var err = document.getElementById("pinError");
        if (!input) return;
        if (input.value === pin) {
          unlockOk();
        } else {
          registerFail();
          if (err && lockedRemaining() === 0) { err.hidden = false; err.textContent = tr("wrongPin", "PIN salah"); }
          input.value = "";
          if (!input.disabled) input.focus();
        }
      }

      document.getElementById("pinInput").addEventListener("input", function () {
        if (lockedRemaining() > 0) return;
        var input = document.getElementById("pinInput");
        var err = document.getElementById("pinError");
        if (!input) return;
        if (err) { err.hidden = true; err.textContent = tr("wrongPin", "PIN salah"); }
        var v = String(input.value).replace(/[^0-9]/g, "");
        if (v !== input.value) input.value = v;
        if (v.length < pin.length) return;
        if (v.slice(0, pin.length) === pin) {
          unlockOk();
        } else {
          registerFail();
          if (err && lockedRemaining() === 0) { err.hidden = false; err.textContent = tr("wrongPin", "PIN salah"); }
          input.value = "";
          if (!input.disabled) input.focus();
        }
      });

      document.getElementById("pinSubmitBtn").addEventListener("click", tryU);
      document.getElementById("pinInput").addEventListener("keydown", function (e) {
        if (e.key === "Enter") tryU();
      });
      var left0 = lockedRemaining();
      if (left0 > 0) {
        applyLockUi(left0);
        setTimeout(function () {
          setFailState({ n: 0, until: 0 });
          clearLockUi();
        }, left0 * 1000);
      }
      requestAnimationFrame(function () {
        var i = document.getElementById("pinInput");
        if (i && !i.disabled) i.focus();
      });
    }

  }
  document.addEventListener("rezaot-ready", wireExtras, { once: true });
})();
