// month-history-v65.js — bulan cepat dari local + Firebase (cloud keys sekali sahaja)
(function () {
  "use strict";

  var cloudKeysCache = null;
  var cloudFetched = false;

  function boot() {
    var sel = document.getElementById("monthHistory");
    if (!sel) return;

    function renderKeys(keys) {
      if (typeof currentMonthKey === "string" && keys.indexOf(currentMonthKey) < 0) keys.push(currentMonthKey);
      keys = keys.filter(function (k, i, a) { return k && a.indexOf(k) === i; });
      keys.sort();
      var prev = sel.value;
      sel.innerHTML = "";
      var opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "— Bulan cepat —";
      sel.appendChild(opt0);
      keys.forEach(function (key) {
        var o = document.createElement("option");
        o.value = key;
        o.textContent = key;
        if (key === currentMonthKey) o.selected = true;
        sel.appendChild(o);
      });
      if (prev && keys.indexOf(prev) >= 0 && prev !== currentMonthKey) sel.value = prev;
    }

    function localMonthKeys() {
      var keys = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf("dailyRecords_") === 0) keys.push(k.replace("dailyRecords_", ""));
        }
      } catch (e) {}
      return keys;
    }

    function mergeKeys() {
      var keys = localMonthKeys();
      if (cloudKeysCache && cloudKeysCache.length) {
        cloudKeysCache.forEach(function (k) {
          if (keys.indexOf(k) < 0) keys.push(k);
        });
      }
      renderKeys(keys);
    }

    function fetchCloudKeys(force) {
      if (cloudFetched && !force) {
        mergeKeys();
        return;
      }
      try {
        if (typeof db === "undefined" || !navigator.onLine) {
          mergeKeys();
          return;
        }
        db.ref("users/default").once("value").then(function (snap) {
          var val = snap.val() || {};
          var keys = [];
          Object.keys(val).forEach(function (k) {
            if (k === "_meta" || k === "settings") return;
            keys.push(k);
          });
          cloudKeysCache = keys;
          cloudFetched = true;
          mergeKeys();
        }).catch(function () {
          mergeKeys();
        });
      } catch (e) {
        mergeKeys();
      }
    }

    function fillLocalOnly() {
      mergeKeys();
    }

    fetchCloudKeys(false);

    if (typeof handleMonthChange === "function" && !handleMonthChange._mh65) {
      var oMonth = handleMonthChange;
      window.handleMonthChange = function () {
        oMonth.apply(this, arguments);
        fetchCloudKeys(true);
      };
      window.handleMonthChange._mh65 = true;
    }

    if (!window.__monthHistCloud) {
      window.__monthHistCloud = true;
      var orig = window.updateReport;
      if (typeof orig === "function") {
        window.updateReport = function () {
          orig.apply(this, arguments);
          try { fillLocalOnly(); } catch (e) {}
        };
      }
    }
  }
  document.addEventListener("rezaot-ready", function () { setTimeout(boot, 400); });
  if (document.readyState !== "loading") setTimeout(boot, 1600);
})();
