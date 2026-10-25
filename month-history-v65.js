// Read the small month manifest; a missing legacy manifest is bootstrapped once.
(function () {
  "use strict";
  let cloudKeys = [];
  let activeRoot = null;
  let activeDb = null;
  let generation = 0;
  let request = null;
  const legacy = new Map();
  const MAX_ROOTS = 4;

  function validMonth(key) { return typeof key === "string" && !!RezaOT_model.monthValue(key); }
  function rootPath() {
    if (window.RezaOT_sync && typeof RezaOT_sync.userPath === "function") return RezaOT_sync.userPath();
    return typeof getFirebaseRoot === "function" ? getFirebaseRoot() : null;
  }
  function database() { return typeof db === "undefined" ? null : db; }
  function context() {
    const root = rootPath();
    const connection = database();
    if (root !== activeRoot || connection !== activeDb) {
      generation++;
      activeRoot = root;
      activeDb = connection;
      cloudKeys = [];
      request = null;
    }
    return { root, db: connection, generation };
  }
  function current(saved) {
    return saved.generation === generation && saved.root === rootPath() && saved.db === database();
  }
  function remember(saved, value) {
    legacy.delete(saved.root);
    legacy.set(saved.root, Object.assign({ db: saved.db }, value));
    while (legacy.size > MAX_ROOTS) legacy.delete(legacy.keys().next().value);
  }
  function localKeys() {
    const keys = [];
    try {
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key && key.startsWith("dailyRecords_") && validMonth(key.slice(13))) keys.push(key.slice(13));
      }
    } catch (_) { /* Current month remains available if local storage is blocked. */ }
    return keys;
  }
  function render() {
    context();
    const select = document.getElementById("monthHistory");
    if (!select || typeof currentMonthKey === "undefined") return;
    const keys = Array.from(new Set(localKeys().concat(cloudKeys, currentMonthKey))).filter(validMonth)
      .sort((a, b) => RezaOT_model.monthValue(b).localeCompare(RezaOT_model.monthValue(a)));
    select.textContent = "";
    const hint = document.createElement("option"); hint.value = "";
    hint.textContent = appText("monthQuick", "— Bulan cepat —"); select.appendChild(hint);
    for (const key of keys) {
      const option = document.createElement("option"); option.value = key; option.textContent = key;
      option.selected = key === currentMonthKey; select.appendChild(option);
    }
  }
  function indexedKeys(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Month index is invalid");
    return Object.keys(value).filter((key) => value[key] === true && validMonth(key));
  }
  function connected() {
    return navigator.onLine && (!window.RezaOT_sync || typeof RezaOT_sync.isReady !== "function" || RezaOT_sync.isReady());
  }
  async function load(saved) {
    const indexPath = saved.root + "/_meta/months";
    try {
      const snapshot = await saved.db.ref(indexPath).once("value");
      if (!current(saved)) return false;
      const value = snapshot.val();
      if (value != null) {
        cloudKeys = indexedKeys(value);
        // A later missing index is not permission to recreate an intentionally reset one.
        remember(saved, { indexSeen: true, keys: [] });
        render();
        return true;
      }
      const previous = legacy.get(saved.root);
      if (previous && previous.db === saved.db) {
        cloudKeys = previous.indexSeen ? [] : previous.keys.slice();
        render();
        return true;
      }
      // Old installations have no manifest. One full read preserves their history,
      // then only index entries are written; existing records are never rewritten.
      let keys = [];
      try {
        const old = await saved.db.ref(saved.root).once("value");
        if (!current(saved)) return false;
        const data = old.val();
        keys = data && typeof data === "object" && !Array.isArray(data)
          ? Object.keys(data).filter((key) => validMonth(key) && data[key] && data[key].deleted !== true) : [];
      } catch (error) {
        if (!current(saved)) return false;
        remember(saved, { indexSeen: false, keys: [] });
        console.warn("Legacy month history unavailable", error.code || error.message);
        return false;
      }
      remember(saved, { indexSeen: false, keys: keys.slice() });
      cloudKeys = keys;
      render();
      if (keys.length && connected() && current(saved)) {
        try {
          const index = {}; keys.forEach((key) => { index[key] = true; });
          await saved.db.ref(indexPath).update(index);
        } catch (error) {
          // History stays usable and this session does not repeatedly download all data.
          if (current(saved)) console.warn("Month index bootstrap postponed", error.code || error.message);
        }
      }
      return current(saved);
    } catch (error) {
      if (current(saved)) console.warn("Month history unavailable", error.code || error.message);
      return false;
    }
  }
  function fetchKeys() {
    const saved = context();
    render();
    if (!saved.root || !saved.db || !connected()) return Promise.resolve(false);
    if (request && request.generation === saved.generation) return request.promise;
    const pending = { generation: saved.generation, promise: null };
    request = pending;
    pending.promise = load(saved).finally(function () { if (request === pending) request = null; });
    return pending.promise;
  }
  function init() {
    const select = document.getElementById("monthHistory");
    if (select && !select.__historyBound) {
      select.__historyBound = true;
      select.addEventListener("change", function () {
        if (!validMonth(select.value)) return;
        const input = document.getElementById("monthYear");
        if (input) input.value = RezaOT_model.monthValue(select.value);
        Promise.resolve(handleMonthChange()).catch((error) => showToast(error.message));
      });
    }
    return fetchKeys();
  }
  document.addEventListener("rezaot-ready", init);
  document.addEventListener("rezaot-report", render);
  document.addEventListener("rezaot-month", render);
  document.addEventListener("rezaot-auth-state", fetchKeys);
  document.addEventListener("rezaot-cloud-ready", fetchKeys);
  window.addEventListener("rezaot-cloud-ready", fetchKeys);
  window.addEventListener("online", fetchKeys);
  window.RezaOT_monthHistory = { init, refresh: fetchKeys };
})();
