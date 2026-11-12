// Optional account access. Server rules remain the authorization boundary.
(function () {
  "use strict";
  var OWNER_KEY = "rezaot_auth_data_owner";
  var user = null, auth = null, initializing = null;
  var busy = false, initialized = false, claimAllowed = false, claimChecking = false;
  var authGeneration = 0;
  if (window.RezaOT_i18n && RezaOT_i18n.extend) RezaOT_i18n.extend({
    ms: { authReset: "Lupa password?", authResetEmail: "Masukkan email akaun dahulu.", authResetSent: "Jika email ini berdaftar, arahan reset password akan dihantar. Semak inbox dan spam.", authResetFailed: "Permintaan reset belum berjaya. Semak email atau cuba lagi kemudian.", authCheckAccess: "Semak akses semula", authCheckingAccess: "Mengesahkan akses akaun…", authOwnerDenied: "Akaun ini belum diberi akses cloud. Data lokal masih tersedia.", authSessionEnded: "Sesi cloud tidak dapat disahkan. Log masuk semula; data lokal dikekalkan." },
    en: { authReset: "Forgot password?", authResetEmail: "Enter your account email first.", authResetSent: "If this email is registered, password reset instructions will be sent. Check your inbox and spam folder.", authResetFailed: "The reset request did not complete. Check the email or try again later.", authCheckAccess: "Check access again", authCheckingAccess: "Checking account access…", authOwnerDenied: "This account has not been granted cloud access. Local data is still available.", authSessionEnded: "The cloud session could not be verified. Sign in again; local data is preserved." }
  });
  function config() { return window.REZAOT_CONFIG || {}; }
  function enabled() { return config().requireAuth === true; }
  function needsClaim() { return config().requireOwnerClaim === true; }
  function text(key, fallback) {
    var i18n = window.RezaOT_i18n, translated = i18n && i18n.t ? i18n.t(key) : key;
    return translated && translated !== key ? translated : fallback;
  }
  function owner() { try { return localStorage.getItem(OWNER_KEY) || ""; } catch (_) { return ""; } }
  function permitted() { return !!user && (!config().legacyOwnerUid || user.uid === config().legacyOwnerUid) && (!needsClaim() || claimAllowed); }
  function canSync() { return !enabled() || !!(permitted() && user.uid && owner() === user.uid); }
  function element(id) { return document.getElementById(id); }
  function message(value) { var el = element("cloudAuthMessage"); if (el) el.textContent = value || ""; }
  function errorText(err) {
    var code = err && err.code;
    if (code === "auth/network-request-failed") return text("authNetworkError", "Tiada sambungan. Data lokal masih boleh digunakan.");
    if (code === "auth/too-many-requests") return text("authTooMany", "Terlalu banyak cubaan. Cuba semula kemudian.");
    if (code === "auth/operation-not-allowed") return text("authNotEnabled", "Login email/password belum diaktifkan dalam Firebase Authentication.");
    if (code === "auth/unauthorized-domain") return text("authDomainError", "Domain hosting belum dibenarkan dalam Firebase Authentication.");
    return text("authLoginError", "Login gagal. Semak email/password dan tetapan Firebase Authentication.");
  }
  function label(id, key, fallback) { var el = element(id); if (el) el.textContent = text(key, fallback); }
  function render() {
    if (!enabled()) return;
    var form = element("cloudAuthForm"), signOut = element("cloudSignOut"), approve = element("cloudApproveSync");
    var status = element("cloudAuthStatus"), panel = element("cloudAuthPanel"), refresh = element("cloudRefreshAccess");
    if (!form || !status) return;
    label("cloudAuthTitle", "authTitle", "Akaun cloud"); label("cloudEmailLabel", "authEmail", "Email");
    label("cloudPasswordLabel", "authPassword", "Password"); label("cloudSignIn", "authSignIn", "Login cloud");
    label("cloudSignOut", "authSignOut", "Log keluar cloud"); label("cloudApproveSync", "authApprove", "Aktifkan sync untuk data saya");
    label("cloudResetPassword", "authReset", "Lupa password?"); label("cloudRefreshAccess", "authCheckAccess", "Semak akses semula");
    form.hidden = !!user; signOut.hidden = !user;
    approve.hidden = !permitted() || canSync();
    approve.disabled = busy || claimChecking || !!(owner() && user && owner() !== user.uid);
    form.querySelectorAll("input, button").forEach(function (node) { node.disabled = busy; });
    signOut.disabled = busy;
    if (refresh) { refresh.hidden = !user || !needsClaim(); refresh.disabled = busy || claimChecking; }
    if (panel) panel.setAttribute("aria-busy", busy || claimChecking ? "true" : "false");
    if (!user) status.textContent = text("authSignedOut", "Cloud belum login. Rekod lokal masih boleh digunakan.");
    else if (claimChecking) status.textContent = text("authCheckingAccess", "Mengesahkan akses akaun…");
    else if (!permitted()) status.textContent = text("authOwnerDenied", "Akaun ini belum diberi akses cloud. Data lokal masih tersedia.");
    else if (owner() && owner() !== user.uid) status.textContent = text("authDifferentOwner", "Data lokal terikat kepada akaun lain. Gunakan profil browser berasingan untuk akaun ini.");
    else if (!canSync()) status.textContent = text("authConsentNeeded", "Login berjaya. Sahkan pemilikan data lokal sebelum mengaktifkan cloud sync.");
    else status.textContent = text("authSignedIn", "Cloud login:") + " " + (user.email || user.uid);
  }
  function reconnect() {
    var sync = window.RezaOT_sync;
    if (sync && typeof sync.reconnect === "function") Promise.resolve(sync.reconnect()).catch(function () {
      message(text("authReconnectError", "Cloud belum tersambung. Data lokal kekal disimpan; cuba semula apabila online."));
    });
    document.dispatchEvent(new CustomEvent("rezaot-auth-state", { detail: { authenticated: !!user, canSync: canSync() } }));
  }
  function userChanged(nextUser, forceRefresh) {
    var generation = ++authGeneration;
    user = nextUser || null; claimAllowed = !needsClaim(); claimChecking = !!user && needsClaim();
    render(); reconnect();
    if (!claimChecking) return Promise.resolve(!!user);
    var checkingUser = user;
    return Promise.resolve().then(function () {
      if (typeof checkingUser.getIdTokenResult !== "function") throw new Error("Owner token unavailable");
      return checkingUser.getIdTokenResult(!!forceRefresh);
    }).then(function (result) {
      if (generation !== authGeneration || !user || user.uid !== checkingUser.uid) return false;
      claimAllowed = !!(result && result.claims && result.claims.rezaot_owner === true);
      claimChecking = false; render(); reconnect(); return claimAllowed;
    }).catch(function () {
      if (generation !== authGeneration) return false;
      claimAllowed = false; claimChecking = false;
      message(text("authSessionEnded", "Sesi cloud tidak dapat disahkan. Log masuk semula; data lokal dikekalkan."));
      render(); reconnect(); return false;
    });
  }
  function sessionFailed() {
    ++authGeneration; user = null; claimAllowed = false; claimChecking = false;
    message(text("authSessionEnded", "Sesi cloud tidak dapat disahkan. Log masuk semula; data lokal dikekalkan."));
    render(); reconnect();
  }
  function createPanel() {
    if (element("cloudAuthPanel")) return;
    var panel = document.createElement("section"); panel.id = "cloudAuthPanel";
    panel.className = "no-print cloud-auth-panel surface-card"; panel.setAttribute("aria-labelledby", "cloudAuthTitle");
    panel.innerHTML = '<h2 id="cloudAuthTitle"></h2><p id="cloudAuthStatus" role="status" aria-live="polite"></p>' +
      '<form id="cloudAuthForm" class="form-grid">' +
      '<div><label id="cloudEmailLabel" for="cloudEmail"></label><input id="cloudEmail" type="email" autocomplete="username" required></div>' +
      '<div><label id="cloudPasswordLabel" for="cloudPassword"></label><input id="cloudPassword" type="password" autocomplete="current-password" required></div>' +
      '<button id="cloudSignIn" type="submit"></button><button id="cloudResetPassword" type="button" class="secondary-button"></button></form>' +
      '<button id="cloudApproveSync" type="button" hidden></button> <button id="cloudRefreshAccess" type="button" hidden></button> ' +
      '<button id="cloudSignOut" type="button" hidden></button><p id="cloudAuthMessage" role="alert"></p>';
    var slot = element("cloudAccountSlot");
    if (slot) slot.appendChild(panel);
    else { var container = document.querySelector(".container") || document.body, header = container.querySelector("header");
      if (header) header.insertAdjacentElement("afterend", panel); else container.insertBefore(panel, container.firstChild); }
    element("cloudAuthForm").addEventListener("submit", signIn);
    element("cloudSignOut").addEventListener("click", signOut);
    element("cloudApproveSync").addEventListener("click", approveLocalData);
    element("cloudResetPassword").addEventListener("click", function () { resetPassword(); });
    element("cloudRefreshAccess").addEventListener("click", function () { refreshAccess(); });
    render();
  }
  async function signIn(event) {
    if (event) event.preventDefault(); if (busy || !auth) return false;
    var email = element("cloudEmail").value.trim(), password = element("cloudPassword").value;
    if (!email || !password) return false;
    busy = true; message(""); render();
    try { await auth.signInWithEmailAndPassword(email, password); return true; }
    catch (err) { message(errorText(err)); return false; }
    finally { element("cloudPassword").value = ""; password = ""; busy = false; render(); }
  }
  async function resetPassword(email) {
    if (busy || !auth) return false;
    email = typeof email === "string" ? email.trim() : element("cloudEmail").value.trim();
    if (!email) { message(text("authResetEmail", "Masukkan email akaun dahulu.")); return false; }
    busy = true; message(""); render();
    try { await auth.sendPasswordResetEmail(email); }
    catch (err) {
      // The same response for existing and absent accounts avoids enumeration.
      if (!err || err.code !== "auth/user-not-found") {
        message(err && /network|too-many/.test(err.code || "") ? errorText(err) : text("authResetFailed", "Permintaan reset belum berjaya. Semak email atau cuba lagi kemudian."));
        return false;
      }
    } finally { busy = false; render(); }
    message(text("authResetSent", "Jika email ini berdaftar, arahan reset password akan dihantar. Semak inbox dan spam."));
    return true;
  }
  async function signOut() {
    if (busy || !auth) return false;
    busy = true; ++authGeneration; user = null; claimAllowed = false; claimChecking = false; render(); reconnect();
    try { await auth.signOut(); return true; }
    catch (err) { message(errorText(err)); return false; }
    finally { busy = false; render(); }
  }
  function refreshAccess() { return user && !busy ? userChanged(user, true) : Promise.resolve(false); }
  async function approveLocalData() {
    if (busy || !permitted() || (owner() && owner() !== user.uid)) return false;
    var approvingUid = user.uid, generation = authGeneration;
    var prompt = text("authApproveMessage", "Sahkan rekod dan tetapan lokal ini milik anda. Data ini boleh disync ke akaun cloud yang sedang login. Export backup dahulu jika belum dibuat. Aktifkan sync?");
    var approved = typeof window.rezaotConfirm === "function" ? await window.rezaotConfirm(prompt) : window.confirm(prompt);
    if (!approved || !permitted() || user.uid !== approvingUid || generation !== authGeneration) return false;
    try { localStorage.setItem(OWNER_KEY, approvingUid); }
    catch (_) { message(text("authStorageError", "Pemilikan data tidak dapat disimpan. Cloud sync belum diaktifkan.")); return false; }
    message(""); render(); reconnect(); return true;
  }
  function init() {
    if (!enabled()) return Promise.resolve(false);
    if (initializing) return initializing;
    createPanel(); busy = true; render();
    initializing = Promise.resolve().then(function () {
      if (typeof window.loadAuthLib === "function") return window.loadAuthLib();
      if (!window.firebase || typeof firebase.auth !== "function") throw new Error("Auth SDK unavailable");
    }).then(async function () {
      if (!window.firebase || typeof firebase.auth !== "function") throw new Error("Auth SDK unavailable");
      var publicConfig = config().firebaseConfig || (typeof firebaseConfig !== "undefined" ? firebaseConfig : null);
      if (window.RezaOT_cloud) { await RezaOT_cloud.prepare(publicConfig); auth = RezaOT_cloud.auth(publicConfig); }
      else { if (!firebase.apps.length) { if (!publicConfig) throw new Error("Firebase web configuration unavailable"); firebase.initializeApp(publicConfig); } auth = firebase.auth(); }
      if (!initialized) {
        var observe = typeof auth.onIdTokenChanged === "function" ? auth.onIdTokenChanged : auth.onAuthStateChanged;
        observe.call(auth, userChanged, sessionFailed);
        initialized = true;
      }
      busy = false; render(); return true;
    }).catch(function (err) { busy = false; initializing = null; message(errorText(err)); render(); return false; });
    return initializing;
  }
  window.RezaOT_auth = { init: init, enabled: enabled, canSync: canSync,
    uid: function () { return user && user.uid || null; }, isAuthenticated: function () { return !!user; },
    approveLocalData: approveLocalData, signOut: signOut, resetPassword: resetPassword, refreshAccess: refreshAccess };
  document.addEventListener("rezaot-ready", init);
  document.addEventListener("rezaot-language", function () { if (enabled()) render(); });
})();
