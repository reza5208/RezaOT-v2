// Shared Firebase setup. Emulator configuration is restricted to local demo apps.
(function () {
  "use strict";
  var app = null;
  var projectId = null;
  var transport = null;
  var database = null;
  var auth = null;
  var appCheckReady = false;
  var appCheckPromise = null;
  var appCheckSignature = null;

  function config() { return window.REZAOT_CONFIG || {}; }
  function loopback(host) {
    return typeof host === "string" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host.toLowerCase());
  }
  function port(value) { return Number.isInteger(value) && value > 0 && value <= 65535; }
  function setup(publicConfig) {
    var cfg = config();
    var settings = publicConfig || cfg.firebaseConfig;
    if (!settings || typeof settings.projectId !== "string" || !settings.projectId.trim()) {
      throw new Error("Firebase public configuration is incomplete");
    }
    var emulators = null;
    if (cfg.emulators != null && cfg.emulators !== false) {
      var input = cfg.emulators;
      if (!window.location || !loopback(window.location.hostname) || !/^demo-[a-z0-9-]+$/.test(settings.projectId)) {
        throw new Error("Firebase emulators require a local browser and demo project");
      }
      if (!input || typeof input !== "object" || typeof input.auth !== "string" ||
          !input.database || typeof input.database !== "object" ||
          !loopback(input.database.host) || !port(input.database.port)) {
        throw new Error("Both local Firebase emulator endpoints are required");
      }
      var endpoint;
      try { endpoint = new URL(input.auth); } catch (_) { throw new Error("Invalid Auth emulator endpoint"); }
      if (endpoint.protocol !== "http:" || !loopback(endpoint.hostname) ||
          !port(endpoint.port ? Number(endpoint.port) : 80) || endpoint.username || endpoint.password ||
          endpoint.search || endpoint.hash || endpoint.pathname !== "/") {
        throw new Error("Auth emulator endpoint must be a local HTTP origin");
      }
      emulators = { auth: endpoint.origin, database: { host: input.database.host, port: input.database.port } };
    }
    var appCheck = cfg.appCheck || {};
    if (typeof appCheck !== "object" || Array.isArray(appCheck)) throw new Error("Invalid App Check configuration");
    if (appCheck.enabled != null && typeof appCheck.enabled !== "boolean") throw new Error("Invalid App Check configuration");
    if (appCheck.enabled === true) {
      if (emulators) throw new Error("App Check must be disabled in the local emulator configuration");
      if (typeof appCheck.siteKey !== "string" || !appCheck.siteKey.trim() ||
          (appCheck.provider != null && appCheck.provider !== "recaptcha-v3") ||
          (appCheck.autoRefresh != null && typeof appCheck.autoRefresh !== "boolean")) {
        throw new Error("App Check requires a reCAPTCHA v3 public site key");
      }
    }
    return { settings: settings, emulators: emulators, appCheck: appCheck };
  }
  function initialize(publicConfig) {
    var options = setup(publicConfig);
    var sdk = window.firebase;
    if (!sdk || typeof sdk.initializeApp !== "function") throw new Error("Firebase SDK unavailable");
    var signature = JSON.stringify(options.emulators);
    if (app && projectId !== options.settings.projectId) throw new Error("Firebase project cannot change after initialization");
    if (app && transport !== signature) throw new Error("Firebase transport cannot change after initialization");
    var existing = app || (sdk.apps && sdk.apps[0]);
    if (existing && existing.options && existing.options.projectId && existing.options.projectId !== options.settings.projectId) {
      throw new Error("Firebase project does not match the initialized app");
    }
    if (!existing) {
      existing = sdk.initializeApp(options.settings);
      if (!existing && sdk.apps) existing = sdk.apps[sdk.apps.length - 1];
      if (!existing) throw new Error("Firebase app failed to initialize");
    }
    app = existing;
    projectId = options.settings.projectId;
    transport = signature;
    return app;
  }
  function ready(publicConfig) {
    var options = setup(publicConfig);
    var current = initialize(publicConfig);
    if (options.appCheck.enabled === true && !appCheckReady) throw new Error("Firebase App Check is not ready");
    if (options.appCheck.enabled === true && appCheckSignature !== JSON.stringify([options.appCheck.siteKey, options.appCheck.autoRefresh !== false])) {
      throw new Error("App Check configuration cannot change after activation");
    }
    return { app: current, options: options };
  }
  function getDatabase(publicConfig) {
    var current = ready(publicConfig);
    if (!database) {
      if (typeof window.firebase.database !== "function") throw new Error("Firebase Database SDK unavailable");
      var instance = window.firebase.database(current.app);
      if (current.options.emulators) instance.useEmulator(current.options.emulators.database.host, current.options.emulators.database.port);
      database = instance;
    }
    return database;
  }
  function getAuth(publicConfig) {
    var current = ready(publicConfig);
    if (!auth) {
      if (typeof window.firebase.auth !== "function") throw new Error("Firebase Auth SDK unavailable");
      var instance = window.firebase.auth(current.app);
      if (current.options.emulators) instance.useEmulator(current.options.emulators.auth, { disableWarnings: false });
      auth = instance;
    }
    return auth;
  }
  function prepare(publicConfig) {
    var options;
    var current;
    try { options = setup(publicConfig); current = initialize(publicConfig); }
    catch (error) { return Promise.reject(error); }
    if (options.appCheck.enabled !== true) return Promise.resolve(current);
    var signature = JSON.stringify([options.appCheck.siteKey, options.appCheck.autoRefresh !== false]);
    if (appCheckSignature && appCheckSignature !== signature) return Promise.reject(new Error("App Check configuration cannot change after activation"));
    if (appCheckReady) return Promise.resolve(current);
    if (appCheckPromise) return appCheckPromise;
    appCheckPromise = Promise.resolve().then(function () {
      if (typeof window.loadAppCheckLib === "function") return window.loadAppCheckLib();
      if (typeof window.firebase.appCheck !== "function") throw new Error("Firebase App Check SDK unavailable");
    }).then(function () {
      // Recheck project/transport after the asynchronous SDK load.
      initialize(publicConfig);
      var active = setup(publicConfig).appCheck;
      if (active.enabled !== true || JSON.stringify([active.siteKey, active.autoRefresh !== false]) !== signature) {
        throw new Error("App Check configuration changed during initialization");
      }
      if (typeof window.firebase.appCheck !== "function") throw new Error("Firebase App Check SDK unavailable");
      window.firebase.appCheck(current).activate(active.siteKey, active.autoRefresh !== false);
      appCheckSignature = signature;
      appCheckReady = true;
      return current;
    }).catch(function (error) { appCheckPromise = null; throw error; });
    return appCheckPromise;
  }
  window.RezaOT_cloud = { initialize: initialize, database: getDatabase, auth: getAuth, prepare: prepare };
})();
