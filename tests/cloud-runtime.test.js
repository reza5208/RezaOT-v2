"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function harness(options = {}) {
  const calls = [];
  const database = { useEmulator(...args) { calls.push(["database-emulator", ...args]); } };
  const auth = { useEmulator(...args) { calls.push(["auth-emulator", ...args]); } };
  const firebase = {
    apps: options.apps || [],
    initializeApp(config) { calls.push(["initialize", config.projectId]); const app = { options: config }; this.apps.push(app); return app; },
    database() { calls.push(["database"]); return database; },
    auth() { calls.push(["auth"]); return auth; },
    appCheck() { return { activate(...args) { calls.push(["app-check", ...args]); } }; }
  };
  const context = {
    URL, Promise, Number, JSON, Error,
    location: { hostname: options.hostname || "localhost" },
    REZAOT_CONFIG: options.config || {}, firebase,
    loadAppCheckLib() { calls.push(["load-app-check"]); return Promise.resolve(); }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "cloud-runtime.js"), "utf8"), context);
  return { api: context.RezaOT_cloud, context, calls, database, auth };
}
const demo = { projectId: "demo-rezaot", apiKey: "demo-public-key" };
const production = { projectId: "example-production", apiKey: "public-web-key" };
const emulators = () => ({ auth: "http://127.0.0.1:9099", database: { host: "127.0.0.1", port: 9000 } });

test("normal setup shares one app and keeps emulator connections disabled", async () => {
  const h = harness();
  assert.equal(await h.api.prepare(production), h.api.initialize(production));
  assert.equal(h.api.database(production), h.api.database(production));
  assert.equal(h.api.auth(production), h.api.auth(production));
  assert.equal(h.calls.filter(call => call[0] === "initialize").length, 1);
  assert.equal(h.calls.some(call => /emulator|app-check/.test(call[0])), false);
});

test("local demo connects both emulators once before returning SDK instances", () => {
  const h = harness({ config: { emulators: emulators() } });
  assert.equal(h.api.auth(demo), h.auth);
  assert.equal(h.api.database(demo), h.database);
  h.api.auth(demo); h.api.database(demo);
  assert.equal(h.calls.filter(call => call[0] === "auth-emulator").length, 1);
  assert.equal(h.calls.filter(call => call[0] === "database-emulator").length, 1);
  assert.deepEqual(h.calls.find(call => call[0] === "database-emulator").slice(1), ["127.0.0.1", 9000]);
  assert.equal(h.calls.find(call => call[0] === "auth-emulator")[1], "http://127.0.0.1:9099");
});

test("emulator guards reject production projects, public pages and nonlocal endpoints before SDK initialization", async () => {
  const cases = [
    { project: production, config: { emulators: emulators() } },
    { hostname: "example.com", project: demo, config: { emulators: emulators() } },
    { project: demo, config: { emulators: { auth: "http://example.com:9099", database: { host: "127.0.0.1", port: 9000 } } } },
    { project: demo, config: { emulators: { auth: "http://127.0.0.1:9099", database: { host: "example.com", port: 9000 } } } },
    { project: demo, config: { emulators: { auth: "http://127.0.0.1:9099/?token=secret", database: { host: "127.0.0.1", port: 9000 } } } },
    { project: demo, config: { emulators: { database: { host: "127.0.0.1", port: 9000 } } } },
    { project: demo, config: { emulators: { auth: "http://127.0.0.1:9099", database: { host: "127.0.0.1", port: 0 } } } },
    { project: demo, config: { emulators: emulators(), appCheck: { enabled: true, siteKey: "public" } } }
  ];
  for (const entry of cases) {
    const h = harness(entry);
    await assert.rejects(h.api.prepare(entry.project));
    assert.equal(h.calls.length, 0);
  }
});

test("an initialized app cannot switch projects or emulator transport", () => {
  const h = harness(); h.api.initialize(demo);
  assert.throws(() => h.api.database(production), /project/);
  h.context.REZAOT_CONFIG.emulators = emulators();
  assert.throws(() => h.api.database(demo), /transport/);
  const mismatched = harness({ apps: [{ options: { projectId: "other-project" } }] });
  assert.throws(() => mismatched.api.auth(production), /project/);
  assert.equal(mismatched.calls.length, 0);
});

test("App Check is explicit, gates SDK operations until prepared and activates only once", async () => {
  const h = harness({ config: { appCheck: { enabled: true, siteKey: "public-site-key", provider: "recaptcha-v3" } } });
  assert.throws(() => h.api.database(production), /App Check is not ready/);
  assert.equal(h.calls.some(call => call[0] === "database"), false);
  await Promise.all([h.api.prepare(production), h.api.prepare(production)]);
  h.api.database(production); h.api.auth(production);
  await h.api.prepare(production);
  assert.equal(h.calls.filter(call => call[0] === "load-app-check").length, 1);
  assert.equal(h.calls.filter(call => call[0] === "app-check").length, 1);
  assert.deepEqual(h.calls.find(call => call[0] === "app-check"), ["app-check", "public-site-key", true]);
  h.context.REZAOT_CONFIG.appCheck.siteKey = "another-public-key";
  assert.throws(() => h.api.database(production), /cannot change/);
  await assert.rejects(h.api.prepare(production), /cannot change/);
});

test("App Check SDK failure remains retryable without returning an unprotected database", async () => {
  const h = harness({ config: { appCheck: { enabled: true, siteKey: "public-site-key", autoRefresh: false } } });
  h.context.loadAppCheckLib = () => Promise.reject(new Error("offline"));
  await assert.rejects(h.api.prepare(production), /offline/);
  assert.throws(() => h.api.database(production), /not ready/);
  h.context.loadAppCheckLib = () => Promise.resolve();
  await h.api.prepare(production);
  assert.deepEqual(h.calls.find(call => call[0] === "app-check"), ["app-check", "public-site-key", false]);
});

test("App Check settings changed during SDK loading cannot activate or open a database", async () => {
  const h = harness({ config: { appCheck: { enabled: true, siteKey: "reviewed-public-key" } } });
  let finishLoading;
  h.context.loadAppCheckLib = () => new Promise(resolve => { finishLoading = resolve; });
  const pending = h.api.prepare(production);
  await Promise.resolve();
  h.context.REZAOT_CONFIG.appCheck.siteKey = "different-public-key";
  finishLoading();
  await assert.rejects(pending, /changed during initialization/);
  assert.equal(h.calls.some(call => call[0] === "app-check" || call[0] === "database"), false);
  assert.throws(() => h.api.database(production), /not ready/);
  h.context.REZAOT_CONFIG.appCheck.siteKey = "reviewed-public-key";
  h.context.loadAppCheckLib = () => Promise.resolve();
  await h.api.prepare(production);
  assert.equal(h.api.database(production), h.database);
});

test("invalid App Check settings fail before any Firebase operation", async () => {
  for (const appCheck of [true, [], { enabled: true }, { enabled: "true" }, { enabled: true, siteKey: "public", provider: "unknown" }]) {
    const h = harness({ config: { appCheck } });
    await assert.rejects(h.api.prepare(production));
    assert.equal(h.calls.length, 0);
  }
});

test("existing SDK mocks without project metadata retain legacy initialization compatibility", () => {
  const h = harness({ apps: [{}] });
  assert.equal(h.api.database(production), h.database);
  assert.equal(h.calls.some(call => call[0] === "initialize"), false);
  assert.throws(() => h.api.auth(demo), /project/);
});
