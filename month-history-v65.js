// Deterministic month history; no handler wrappers or timer-based installation.
(function () {
  "use strict";
  let cloudKeys = [];
  let fetching = false;
  function localKeys() {
    const keys = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key && key.startsWith("dailyRecords_")) {
        const month = key.slice("dailyRecords_".length);
        if (RezaOT_model.monthValue(month)) keys.push(month);
      }
    }
    return keys;
  }
  function render() {
    const select = document.getElementById("monthHistory");
    if (!select || typeof currentMonthKey === "undefined") return;
    const keys = Array.from(new Set(localKeys().concat(cloudKeys, currentMonthKey))).filter(Boolean)
      .sort((a, b) => RezaOT_model.monthValue(b).localeCompare(RezaOT_model.monthValue(a)));
    select.textContent = "";
    const hint = document.createElement("option"); hint.value = "";
    hint.textContent = appText("monthQuick", "— Bulan cepat —"); select.appendChild(hint);
    for (const key of keys) {
      const option = document.createElement("option"); option.value = key; option.textContent = key;
      option.selected = key === currentMonthKey; select.appendChild(option);
    }
  }
  async function fetchKeys() {
    if (fetching) return;
    render();
    if (typeof db === "undefined" || !db || !navigator.onLine) return;
    if (window.RezaOT_sync && typeof RezaOT_sync.isReady === "function" && !RezaOT_sync.isReady()) return;
    fetching = true;
    try {
      const path = window.RezaOT_sync && typeof RezaOT_sync.userPath === "function" ? RezaOT_sync.userPath() : "users/default";
      const snapshot = await db.ref(path).once("value");
      const value = snapshot.val();
      cloudKeys = value && typeof value === "object" ? Object.keys(value).filter((key) => !!RezaOT_model.monthValue(key)) : [];
      render();
    } catch (error) { console.warn("Month history unavailable", error.code || error.message); }
    finally { fetching = false; }
  }
  function init() {
    const select = document.getElementById("monthHistory");
    if (select && !select.__historyBound) {
      select.__historyBound = true;
      select.addEventListener("change", function () {
        if (!RezaOT_model.monthValue(select.value)) return;
        const input = document.getElementById("monthYear");
        if (input) input.value = RezaOT_model.monthValue(select.value);
        Promise.resolve(handleMonthChange()).catch((error) => showToast(error.message));
      });
    }
    fetchKeys();
  }
  document.addEventListener("rezaot-ready", init);
  document.addEventListener("rezaot-report", render);
  document.addEventListener("rezaot-month", render);
  document.addEventListener("rezaot-cloud-ready", fetchKeys);
  window.addEventListener("online", fetchKeys);
  window.RezaOT_monthHistory = { init, refresh: fetchKeys };
})();
