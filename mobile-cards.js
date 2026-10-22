// Mobile reports share the record actions and calculation used by desktop.
(function () {
  "use strict";

  if (window.__mobileCards1) return;
  window.__mobileCards1 = true;

  function injectCss() {
    if (document.getElementById("mobile-cards-css")) return;
    var st = document.createElement("style");
    st.id = "mobile-cards-css";
    st.textContent =
      "#mobileCards{display:none;}" +
      "@media (max-width:600px){" +
      "#mobileCards{display:block;}" +
      "#reportTable{display:none;}" +
      "}" +
      "@media print{" +
      "#reportTable{display:table!important;}" +
      "#mobileCards{display:none!important;}" +
      ".menu-wrap{display:none!important;}" +
      "}" +
      ".mc-card{border-radius:10px;padding:10px 12px;margin-bottom:8px;" +
      "background:var(--card-bg,#fff);border:1px solid #e3e8ef;}" +
      ".mc-card.mc-sat{background:#f5f5f5;}" +
      ".mc-card.mc-sun{background:#ececec;}" +
      ".mc-card.mc-ph{background:#e8f4ff;}" +
      ".mc-line1{font-size:14px;font-weight:700;margin-bottom:4px;}" +
      ".mc-line2{font-size:15px;margin-bottom:4px;word-break:break-word;}" +
      ".mc-line3{font-size:13px;margin-bottom:8px;opacity:.9;}" +
      ".mc-actions{display:flex;gap:8px;}" +
      ".mc-actions button{min-height:40px;flex:1;padding:8px 12px;border-radius:8px;" +
      "border:1px solid #c5cdd8;background:#f7f9fc;color:#243244;font-size:14px;}" +
      "body.dark .mc-card,body.dark-mode .mc-card{background:#1e2530;border-color:#2a3340;color:#e8eaed;}" +
      "body.dark .mc-card.mc-sat,body.dark-mode .mc-card.mc-sat{background:#232a36;}" +
      "body.dark .mc-card.mc-sun,body.dark-mode .mc-card.mc-sun{background:#1a2029;}" +
      "body.dark .mc-card.mc-ph,body.dark-mode .mc-card.mc-ph{background:#1a2838;}" +
      "body.dark .mc-actions button,body.dark-mode .mc-actions button{" +
      "background:#2a3340;border-color:#3a4555;color:#e8eaed;}" +
      ".header-top h1{font-size:18px;line-height:1.25;}" +
      ".menu-wrap{position:relative;display:inline-block;}" +
      ".menu-panel{position:absolute;right:0;top:100%;background:#fff;border-radius:10px;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.15);padding:6px;min-width:180px;z-index:50;}" +
      ".menu-panel button{display:block;width:100%;text-align:left;padding:10px 12px;" +
      "border:0;background:none;font-size:15px;}" +
      "body.dark .menu-panel,body.dark-mode .menu-panel{background:#1e2530;color:#e8eaed;}" +
      "body.dark .menu-panel button,body.dark-mode .menu-panel button{color:#e8eaed;}" +
      ".mc-trip{display:flex;align-items:center;gap:8px;margin:4px 0;}" +
      ".mc-trip-edit{flex:1;text-align:left;background:none;border:0;padding:8px 0;min-height:44px;color:inherit;font:inherit;word-break:break-word;}" +
      ".mc-trip .mc-trip-delete{flex:0 0 44px;min-height:44px;min-width:44px;width:44px!important;height:44px!important;border-radius:8px;font-size:22px!important;background:#fff!important;color:#922534!important;opacity:1;border:1px solid #d5dce5!important;}" +
      "body.dark .mc-trip .mc-trip-delete{background:#2a3340!important;color:#ffb1b8!important;border-color:#3a4555!important;}" +
      "body{padding-bottom:96px;}" +
      "@media print{.menu-wrap{display:none!important;}}";
    document.head.appendChild(st);
  }

  function t(key, fallback) {
    var value = window.RezaOT_i18n && RezaOT_i18n.t(key);
    return value && value !== key ? value : fallback;
  }

  function dayName(dateStr) {
    try {
      var day = new Date(dateStr + "T00:00:00").getDay();
      if (window.RezaOT_i18n && typeof RezaOT_i18n.days === "function") {
        var arr = RezaOT_i18n.days();
        if (arr && arr[day] != null) return arr[day];
      }
    } catch (e) {}
    var fallback = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
    return fallback[new Date(dateStr + "T00:00:00").getDay()] || "";
  }

  function formatTimeSafe(t) {
    if (!t) return "-";
    if (typeof formatTime === "function") return formatTime(t) || "-";
    return String(t);
  }

  function ensureContainer() {
    var existing = document.getElementById("mobileCards");
    if (existing) return existing;
    var wrap = document.querySelector(".table-wrap");
    var parent = wrap ? wrap.parentNode : document.querySelector(".container");
    if (!parent) return null;
    var div = document.createElement("div");
    div.id = "mobileCards";
    div.className = "mobile-cards no-print";
    if (wrap && wrap.nextSibling) parent.insertBefore(div, wrap.nextSibling);
    else if (wrap) parent.appendChild(div);
    else parent.appendChild(div);
    return div;
  }

  function rebuildCards() {
    var host = ensureContainer();
    if (!host) return;
    host.textContent = "";
    var records = (typeof dailyRecords !== "undefined" && dailyRecords) ? dailyRecords : {};
    var dates = Object.keys(records).sort();
    dates.forEach(function (date) {
      var rec = records[date];
      if (!rec) return;
      var card = document.createElement("div");
      card.className = "mc-card";
      var day = new Date(date + "T00:00:00").getDay();
      if (day === 6) card.classList.add("mc-sat");
      else if (day === 0) card.classList.add("mc-sun");
      if (typeof isPublicHoliday === "function" && isPublicHoliday(date)) card.classList.add("mc-ph");

      var line1 = document.createElement("div");
      line1.className = "mc-line1";
      var dateTxt = (typeof formatDateForPDF === "function") ? formatDateForPDF(date) : date;
      line1.textContent = dateTxt + " · " + dayName(date);
      card.appendChild(line1);

      var line2 = document.createElement("div");
      line2.className = "mc-line2";
      var trips = Array.isArray(rec.trips) ? rec.trips : [];
      if (!trips.length) {
        line2.textContent = "—";
      } else {
        trips.forEach(function (trip, index) {
          var row = document.createElement("div");
          row.className = "mc-trip";
          var label = window.RezaOT_sideMark && typeof RezaOT_sideMark.formatTripDisplay === "function"
            ? RezaOT_sideMark.formatTripDisplay(rec, trip) : String(trip);
          var edit = document.createElement("button");
          edit.type = "button";
          edit.className = "mc-trip-edit trip-text";
          edit.textContent = label;
          edit.setAttribute("aria-label", t("editTrip", "Edit trip") + ": " + label);
          edit.addEventListener("click", function () {
            if (typeof window.editTrip === "function") window.editTrip(date, index);
          });
          row.appendChild(edit);
          var remove = document.createElement("button");
          remove.type = "button";
          remove.className = "mc-trip-delete trip-del-btn";
          remove.textContent = "×";
          remove.setAttribute("aria-label", t("deleteTrip", "Padam trip") + ": " + label);
          remove.addEventListener("click", function () {
            if (typeof window.deleteTrip === "function") window.deleteTrip(date, index);
          });
          row.appendChild(remove);
          line2.appendChild(row);
        });
      }
      card.appendChild(line2);

      var line3 = document.createElement("div");
      line3.className = "mc-line3";
      var cin = formatTimeSafe(rec.clock_in);
      var cout = formatTimeSafe(rec.clock_out);
      var otTxt;
      if (rec.unpaid) {
        otTxt = "UPL";
      } else if (rec.annual) {
        otTxt = "ANN";
      } else {
        var ot = 0;
        if (typeof window.RezaOT_recordOT === "function") {
          ot = window.RezaOT_recordOT(date, rec);
        } else if (typeof calculateOT === "function") {
          ot = calculateOT(rec.clock_in, rec.clock_out, date, rec.trips || []);
        }
        otTxt = "OT " + (Number(ot) || 0).toFixed(2);
      }
      line3.textContent = cin + " → " + cout + "  ·  " + otTxt;
      card.appendChild(line3);

      var actions = document.createElement("div");
      actions.className = "mc-actions";
      if (typeof editRecord === "function") {
        var editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.textContent = (window.RezaOT_i18n && RezaOT_i18n.t("btnEdit")) || "Edit";
        editBtn.addEventListener("click", function () { editRecord(date); });
        actions.appendChild(editBtn);
      }
      if (typeof deleteRecord === "function") {
        var delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = (window.RezaOT_i18n && RezaOT_i18n.t("btnDelete")) || "Padam";
        delBtn.addEventListener("click", function () { deleteRecord(date); });
        actions.appendChild(delBtn);
      }
      card.appendChild(actions);

      host.appendChild(card);
    });
  }

  function wireMenu() {
    var toggle = document.getElementById("menuToggleBtn");
    var panel = document.getElementById("menuPanel");
    if (!toggle || !panel || toggle._mcMenu) return;
    toggle._mcMenu = true;
    toggle.setAttribute("aria-controls", "menuPanel");
    toggle.setAttribute("aria-expanded", "false");
    function setOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    }
    toggle.addEventListener("click", function () { setOpen(panel.hidden); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (!panel || panel.hasAttribute("hidden")) return;
      var t = e.target;
      if (toggle.contains(t) || panel.contains(t)) {
        if (panel.contains(t) && t.closest("button") && t !== toggle) {
          setOpen(false);
        }
        return;
      }
      setOpen(false);
    });
  }

  function boot() {
    injectCss();
    wireMenu();
    try { rebuildCards(); } catch (e) {}
  }

  window.RezaOT_mobileCards = { init: boot, render: rebuildCards };
  document.addEventListener("rezaot-report", rebuildCards);
  document.addEventListener("rezaot-ready", boot);
})();
