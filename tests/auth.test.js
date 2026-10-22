"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function harness(options = {}) {
  const values = new Map(Object.entries(options.storage || {}));
  const nodes = new Map();
  const ids = ["cloudAuthPanel", "cloudAuthForm", "cloudAuthStatus", "cloudSignOut", "cloudApproveSync", "cloudAuthMessage", "cloudPassword"];
  for (const id of ids) nodes.set(id, { textContent: "", hidden: false, disabled: false, value: "", setAttribute() {}, querySelectorAll() { return []; } });
  let onAuthState;
  let reconnects = 0;
  let loaderCalls = 0;
  const auth = {
    currentUser: null,
    onAuthStateChanged(callback) { onAuthState = callback; callback(this.currentUser); },
    async signOut() { this.currentUser = null; onAuthState(null); }
  };
  const context = {
    REZAOT_CONFIG: { requireAuth: options.requireAuth !== false },
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
    setUser(user) { auth.currentUser = user; onAuthState(user); },
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
