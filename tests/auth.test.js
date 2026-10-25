"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function harness(options = {}) {
  const values = new Map(Object.entries(options.storage || {}));
  const nodes = new Map();
  const ids = ["cloudAuthPanel", "cloudAuthForm", "cloudAuthStatus", "cloudSignOut", "cloudApproveSync", "cloudAuthMessage", "cloudPassword", "cloudEmail", "cloudResetPassword", "cloudRefreshAccess"];
  for (const id of ids) nodes.set(id, { textContent: "", hidden: false, disabled: false, value: "", setAttribute() {}, querySelectorAll() { return []; } });
  let onAuthState;
  let reconnects = 0;
  let loaderCalls = 0;
  let onAuthError;
  let observed = "";
  const resetCalls = [];
  const auth = {
    currentUser: null,
    onAuthStateChanged(callback, error) { observed = "auth"; onAuthState = callback; onAuthError = error; callback(this.currentUser); },
    async sendPasswordResetEmail(email) { resetCalls.push(email); if (auth.resetError) throw auth.resetError; },
    async signOut() { this.currentUser = null; onAuthState(null); }
  };
  if (options.tokenListener) auth.onIdTokenChanged = function (callback, error) {
    observed = "token"; onAuthState = callback; onAuthError = error; callback(this.currentUser);
  };
  const context = {
    REZAOT_CONFIG: { requireAuth: options.requireAuth !== false, requireOwnerClaim: options.requireOwnerClaim === true },
    localStorage: {
      getItem(key) { return values.get(key) || null; },
      setItem(key, value) { if (options.storageFails) throw new Error("storage unavailable"); values.set(key, String(value)); }
    },
    document: { getElementById(id) { return nodes.get(id) || null; }, addEventListener() {}, dispatchEvent() {} },
    firebase: { apps: [{}], auth() { return auth; } },
    loadAuthLib() { loaderCalls++; return Promise.resolve(); },
    rezaotConfirm: options.confirm || (() => Promise.resolve(true)),
    RezaOT_sync: { reconnect() { reconnects++; return Promise.resolve(); } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "firebase-auth.js"), "utf8"), context);
  return {
    api: context.RezaOT_auth,
    context,
    values,
    nodes,
    auth,
    resetCalls,
    observed() { return observed; },
    failSession() { onAuthError(new Error("Token rejected")); },
    setUser(user) { auth.currentUser = user; return onAuthState(user); },
    reconnects() { return reconnects; },
    loaderCalls() { return loaderCalls; }
  };
}

test("legacy mode neither loads Auth SDK nor changes the cloud gate", async () => {
  const h = harness({ requireAuth: false });
  assert.equal(await h.api.init(), false);
  assert.equal(h.api.canSync(), true);
  assert.equal(h.loaderCalls(), 0);
  assert.equal(h.reconnects(), 0);
});

test("authenticated mode does not sync until local ownership is explicitly approved", async () => {
  const h = harness();
  assert.equal(h.api.canSync(), false);
  await h.api.init();
  h.setUser({ uid: "owner-a", email: "owner@example.test" });
  assert.equal(h.api.isAuthenticated(), true);
  assert.equal(h.api.canSync(), false);
  assert.equal(await h.api.approveLocalData(), true);
  assert.equal(h.values.get("rezaot_auth_data_owner"), "owner-a");
  assert.equal(h.api.canSync(), true);
});

test("canceling data approval never binds or uploads local data", async () => {
  const h = harness({ confirm: () => Promise.resolve(false) });
  await h.api.init();
  h.setUser({ uid: "owner-a" });
  const before = h.reconnects();
  assert.equal(await h.api.approveLocalData(), false);
  assert.equal(h.values.has("rezaot_auth_data_owner"), false);
  assert.equal(h.api.canSync(), false);
  assert.equal(h.reconnects(), before);
});

test("another account cannot reuse or overwrite local ownership binding", async () => {
  const h = harness({ storage: { rezaot_auth_data_owner: "owner-a" } });
  await h.api.init();
  h.setUser({ uid: "owner-b" });
  assert.equal(h.api.canSync(), false);
  assert.equal(await h.api.approveLocalData(), false);
  assert.equal(h.values.get("rezaot_auth_data_owner"), "owner-a");
  assert.equal(h.nodes.get("cloudApproveSync").disabled, true);
});

test("sign-out closes the sync gate without deleting local records", async () => {
  const h = harness({ storage: { rezaot_auth_data_owner: "owner-a", dailyRecords: "preserved" } });
  await h.api.init();
  h.setUser({ uid: "owner-a" });
  assert.equal(h.api.canSync(), true);
  await h.api.signOut();
  assert.equal(h.api.canSync(), false);
  assert.equal(h.values.get("dailyRecords"), "preserved");
});

test("account changes during the ownership dialog invalidate approval", async () => {
  let resolveConfirm;
  const h = harness({ confirm: () => new Promise(resolve => { resolveConfirm = resolve; }) });
  await h.api.init();
  h.setUser({ uid: "owner-a" });
  const pending = h.api.approveLocalData();
  h.setUser({ uid: "owner-b" });
  resolveConfirm(true);
  assert.equal(await pending, false);
  assert.equal(h.values.has("rezaot_auth_data_owner"), false);
  assert.equal(h.api.canSync(), false);
});

test("failed ownership persistence keeps sync disabled", async () => {
  const h = harness({ storageFails: true });
  await h.api.init();
  h.setUser({ uid: "owner-a" });
  assert.equal(await h.api.approveLocalData(), false);
  assert.equal(h.api.canSync(), false);
  assert.match(h.nodes.get("cloudAuthMessage").textContent, /tidak dapat disimpan/);
});

test("missing Auth SDK leaves local mode available and presents a recoverable error", async () => {
  const h = harness();
  h.context.loadAuthLib = () => Promise.reject(new Error("unavailable"));
  assert.equal(await h.api.init(), false);
  assert.equal(h.api.canSync(), false);
  assert.match(h.nodes.get("cloudAuthMessage").textContent, /Login gagal/);
});

test("failed token observer registration can be retried without losing the auth gate", async () => {
  const h = harness({ tokenListener: true, requireOwnerClaim: true,
    storage: { rezaot_auth_data_owner: 'owner-a', dailyRecords: 'retained' } });
  const observe = h.auth.onIdTokenChanged;
  let attempts = 0;
  h.auth.onIdTokenChanged = function (...args) {
    if (++attempts === 1) throw new Error('Auth persistence unavailable');
    return observe.apply(this, args);
  };
  assert.equal(await h.api.init(), false);
  assert.equal(h.api.canSync(), false);
  assert.equal(await h.api.init(), true);
  assert.equal(attempts, 2);
  await h.setUser({ uid: 'owner-a', getIdTokenResult: async () => ({ claims: { rezaot_owner: true } }) });
  assert.equal(h.api.canSync(), true);
  assert.equal(h.values.get('dailyRecords'), 'retained');
});

test("owner claim is checked before consent and can be refreshed without rebinding data", async () => {
  const h = harness({ requireOwnerClaim: true });
  await h.api.init();
  let allowed = false;
  const account = { uid: 'owner-a', getIdTokenResult: async () => ({ claims: { rezaot_owner: allowed } }) };
  await h.setUser(account);
  assert.equal(h.api.canSync(), false);
  assert.equal(await h.api.approveLocalData(), false);
  assert.equal(h.values.has('rezaot_auth_data_owner'), false);
  allowed = true;
  assert.equal(await h.api.refreshAccess(), true);
  assert.equal(h.api.canSync(), false, 'A server claim does not replace local ownership consent');
  assert.equal(await h.api.approveLocalData(), true);
  assert.equal(h.api.canSync(), true);
  allowed = false;
  await h.api.refreshAccess();
  assert.equal(h.api.canSync(), false);
  assert.equal(h.values.get('rezaot_auth_data_owner'), 'owner-a');
});

test("stale owner-token result cannot authorize a replacement account", async () => {
  const h = harness({ requireOwnerClaim: true, storage: { rezaot_auth_data_owner: 'owner-a' } });
  await h.api.init();
  let resolve;
  const checking = h.setUser({ uid: 'owner-a', getIdTokenResult: () => new Promise(r => { resolve = r; }) });
  await Promise.resolve();
  assert.equal(h.api.canSync(), false);
  await h.setUser({ uid: 'owner-b', getIdTokenResult: async () => ({ claims: { rezaot_owner: true } }) });
  resolve({ claims: { rezaot_owner: true } }); await checking;
  assert.equal(h.api.uid(), 'owner-b');
  assert.equal(h.api.canSync(), false);
  assert.equal(h.values.get('rezaot_auth_data_owner'), 'owner-a');
});

test("token changes and token failures close the cloud gate without deleting local records", async () => {
  const h = harness({ requireOwnerClaim: true, tokenListener: true,
    storage: { rezaot_auth_data_owner: 'owner-a', dailyRecords: 'retained' } });
  await h.api.init();
  assert.equal(h.observed(), 'token');
  await h.setUser({ uid: 'owner-a', getIdTokenResult: async () => ({ claims: { rezaot_owner: true } }) });
  assert.equal(h.api.canSync(), true);
  await h.setUser({ uid: 'owner-a', getIdTokenResult: async () => { throw new Error('revoked-token'); } });
  assert.equal(h.api.canSync(), false);
  assert.equal(h.values.get('dailyRecords'), 'retained');
  await h.setUser({ uid: 'owner-a', getIdTokenResult: async () => ({ claims: { rezaot_owner: true } }) });
  h.failSession();
  assert.equal(h.api.isAuthenticated(), false);
  assert.equal(h.api.canSync(), false);
  assert.equal(h.values.get('dailyRecords'), 'retained');
});

test("claim revocation during ownership confirmation invalidates approval", async () => {
  let resolve;
  const h = harness({ requireOwnerClaim: true, confirm: () => new Promise(r => { resolve = r; }) });
  await h.api.init();
  let allowed = true;
  const account = { uid: 'owner-a', getIdTokenResult: async () => ({ claims: { rezaot_owner: allowed } }) };
  await h.setUser(account);
  const approval = h.api.approveLocalData();
  allowed = false; await h.setUser(account); resolve(true);
  assert.equal(await approval, false);
  assert.equal(h.values.has('rezaot_auth_data_owner'), false);
});

test("password reset uses the same response for registered and absent accounts", async () => {
  const h = harness({ storage: { dailyRecords: 'retained' } });
  await h.api.init();
  assert.equal(await h.api.resetPassword('owner@example.test'), true);
  const sent = h.nodes.get('cloudAuthMessage').textContent;
  h.auth.resetError = { code: 'auth/user-not-found' };
  assert.equal(await h.api.resetPassword('missing@example.test'), true);
  assert.equal(h.nodes.get('cloudAuthMessage').textContent, sent);
  assert.deepEqual(h.resetCalls, ['owner@example.test', 'missing@example.test']);
  assert.equal(h.values.get('dailyRecords'), 'retained');
  assert.equal(h.values.has('rezaot_auth_data_owner'), false);
  h.auth.resetError = { code: 'auth/network-request-failed' };
  assert.equal(await h.api.resetPassword('owner@example.test'), false);
  assert.match(h.nodes.get('cloudAuthMessage').textContent, /sambungan/);
});

test("password reset requires an email and never starts Auth in legacy mode", async () => {
  const h = harness(); await h.api.init();
  assert.equal(await h.api.resetPassword('  '), false);
  assert.equal(h.resetCalls.length, 0);
  const legacy = harness({ requireAuth: false }); await legacy.api.init();
  assert.equal(await legacy.api.resetPassword('owner@example.test'), false);
  assert.equal(legacy.loaderCalls(), 0);
});
