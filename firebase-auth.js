// firebase-auth.js — optional account authentication; legacy mode stays unchanged.
(function () {
  "use strict";

  var OWNER_KEY = "rezaot_auth_data_owner";
  var user = null;
  var auth = null;
  var initializing = null;
  var busy = false;
  var initialized = false;

  function config() { return window.REZAOT_CONFIG || {}; }
  function enabled() { return config().requireAuth === true; }
  function text(key, fallback) {
    var i18n = window.RezaOT_i18n;
    var translated = i18n && i18n.t ? i18n.t(key) : key;
    return translated && translated !== key ? translated : fallback;
  }
  function owner() {
    try { return localStorage.getItem(OWNER_KEY) || ""; }
    catch (e) { return ""; }
  }
  function canSync() {
    return !enabled() || !!(user && user.uid && owner() === user.uid);
  }
  function element(id) { return document.getElementById(id); }
  function message(value) {
    var el = element("cloudAuthMessage");
    if (el) el.textContent = value || "";
  }
  function errorText(err) {
    var code = err && err.code;
    if (code === "auth/network-request-failed") return text("authNetworkError", "Tiada sambungan. Data lokal masih boleh digunakan.");
    if (code === "auth/too-many-requests") return text("authTooMany", "Terlalu banyak cubaan. Cuba semula kemudian.");
    if (code === "auth/operation-not-allowed") return text("authNotEnabled", "Login email/password belum diaktifkan dalam Firebase Authentication.");
    if (code === "auth/unauthorized-domain") return text("authDomainError", "Domain hosting belum dibenarkan dalam Firebase Authentication.");
    return text("authLoginError", "Login gagal. Semak email/password dan tetapan Firebase Authentication.");
  }
  function render() {
    if (!enabled()) return;
    var form = element("cloudAuthForm");
    var signOut = element("cloudSignOut");
    var approve = element("cloudApproveSync");
    var status = element("cloudAuthStatus");
    var panel = element("cloudAuthPanel");
    if (!form || !status) return;
    form.hidden = !!user;
    signOut.hidden = !user;
    approve.hidden = !user || canSync();
    approve.disabled = busy || !!(owner() && user && owner() !== user.uid);
    form.querySelectorAll("input, button").forEach(function (node) { node.disabled = busy; });
    signOut.disabled = busy;
    panel.setAttribute("aria-busy", busy ? "true" : "false");
    if (!user) {
      status.textContent = text("authSignedOut", "Cloud belum login. Rekod lokal masih boleh digunakan.");
    } else if (owner() && owner() !== user.uid) {
      status.textContent = text("authDifferentOwner", "Data lokal terikat kepada akaun lain. Gunakan profil browser berasingan untuk akaun ini.");
    } else if (!canSync()) {
      status.textContent = text("authConsentNeeded", "Login berjaya. Sahkan pemilikan data lokal sebelum mengaktifkan cloud sync.");
    } else {
      status.textContent = text("authSignedIn", "Cloud login:") + " " + (user.email || user.uid);
    }
  }
  function reconnect() {
    var sync = window.RezaOT_sync;
    if (sync && typeof sync.reconnect === "function") {
      Promise.resolve(sync.reconnect()).catch(function () {
        message(text("authReconnectError", "Cloud belum tersambung. Data lokal kekal disimpan; cuba semula apabila online."));
      });
    }
    document.dispatchEvent(new CustomEvent("rezaot-auth-state", { detail: { authenticated: !!user, canSync: canSync() } }));
  }
  function createPanel() {
    if (element("cloudAuthPanel")) return;
    var panel = document.createElement("section");
    panel.id = "cloudAuthPanel";
    panel.className = "no-print cloud-auth-panel";
    panel.setAttribute("aria-labelledby", "cloudAuthTitle");
    panel.innerHTML =
      '<h2 id="cloudAuthTitle"></h2>' +
      '<p id="cloudAuthStatus" role="status" aria-live="polite"></p>' +
      '<form id="cloudAuthForm" class="form-grid">' +
      '  <div><label id="cloudEmailLabel" for="cloudEmail"></label><input id="cloudEmail" type="email" autocomplete="username" required></div>' +
      '  <div><label id="cloudPasswordLabel" for="cloudPassword"></label><input id="cloudPassword" type="password" autocomplete="current-password" required></div>' +
      '  <button id="cloudSignIn" type="submit"></button>' +
      '</form>' +
      '<button id="cloudApproveSync" type="button" hidden></button> ' +
      '<button id="cloudSignOut" type="button" hidden></button>' +
      '<p id="cloudAuthMessage" role="alert"></p>';
    var container = document.querySelector(".container") || document.body;
    var header = container.querySelector("header");
    if (header) header.insertAdjacentElement("afterend", panel);
    else container.insertBefore(panel, container.firstChild);
    element("cloudAuthTitle").textContent = text("authTitle", "Akaun cloud");
    element("cloudEmailLabel").textContent = text("authEmail", "Email");
    element("cloudPasswordLabel").textContent = text("authPassword", "Password");
    element("cloudSignIn").textContent = text("authSignIn", "Login cloud");
    element("cloudSignOut").textContent = text("authSignOut", "Log keluar cloud");
    element("cloudApproveSync").textContent = text("authApprove", "Aktifkan sync untuk data saya");
    element("cloudAuthForm").addEventListener("submit", signIn);
    element("cloudSignOut").addEventListener("click", signOut);
    element("cloudApproveSync").addEventListener("click", approveLocalData);
    render();
  }
  async function signIn(event) {
    if (event) event.preventDefault();
    if (busy || !auth) return;
    var email = element("cloudEmail").value.trim();
    var password = element("cloudPassword").value;
    if (!email || !password) return;
    busy = true;
    message("");
    render();
    try { await auth.signInWithEmailAndPassword(email, password); }
    catch (err) { message(errorText(err)); }
    finally {
      element("cloudPassword").value = "";
      password = "";
      busy = false;
      render();
    }
  }
  async function signOut() {
    if (busy || !auth) return;
    busy = true;
    // Close the app's cloud gate immediately, before SDK persistence completes.
    user = null;
    render();
    reconnect();
    try { await auth.signOut(); }
    catch (err) { message(errorText(err)); }
    finally { busy = false; render(); }
  }
  async function approveLocalData() {
    if (busy || !user || (owner() && owner() !== user.uid)) return false;
    var approvingUid = user.uid;
    var prompt = text("authApproveMessage", "Sahkan rekod dan tetapan lokal ini milik anda. Data ini boleh disync ke akaun cloud yang sedang login. Export backup dahulu jika belum dibuat. Aktifkan sync?");
    var approved = typeof window.rezaotConfirm === "function"
      ? await window.rezaotConfirm(prompt)
      : window.confirm(prompt);
    if (!approved || !user || user.uid !== approvingUid) return false;
    try { localStorage.setItem(OWNER_KEY, approvingUid); }
    catch (err) {
      message(text("authStorageError", "Pemilikan data tidak dapat disimpan. Cloud sync belum diaktifkan."));
      return false;
    }
    message("");
    render();
    reconnect();
    return true;
  }
  function init() {
    if (!enabled()) return Promise.resolve(false);
    if (initializing) return initializing;
    createPanel();
    busy = true;
    render();
    initializing = Promise.resolve().then(function () {
      if (typeof window.loadAuthLib === "function") return window.loadAuthLib();
      if (!window.firebase || typeof firebase.auth !== "function") throw new Error("Auth SDK unavailable");
    }).then(function () {
      if (!window.firebase || typeof firebase.auth !== "function") throw new Error("Auth SDK unavailable");
      if (!firebase.apps.length) {
        var publicConfig = config().firebaseConfig || (typeof firebaseConfig !== "undefined" ? firebaseConfig : null);
        if (!publicConfig) throw new Error("Firebase web configuration unavailable");
        firebase.initializeApp(publicConfig);
      }
      auth = firebase.auth();
      if (!initialized) {
        initialized = true;
        auth.onAuthStateChanged(function (nextUser) {
          user = nextUser || null;
          render();
          reconnect();
        }, function (err) { message(errorText(err)); });
      }
      busy = false;
      render();
      return true;
    }).catch(function (err) {
      busy = false;
      initializing = null;
      message(errorText(err));
      render();
      return false;
    });
    return initializing;
  }
  window.RezaOT_auth = {
    init: init,
    enabled: enabled,
    canSync: canSync,
    uid: function () { return user && user.uid || null; },
    isAuthenticated: function () { return !!user; },
    approveLocalData: approveLocalData,
    signOut: signOut
  };
  document.addEventListener("rezaot-ready", init);
  document.addEventListener("rezaot-language", function () { if (enabled()) render(); });
})();
