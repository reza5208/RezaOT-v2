// Mobile reports share the record actions and calculation used by desktop.
(function () {
  "use strict";

  if (window.__mobileCards1) return;
  window.__mobileCards1 = true;

  if (window.RezaOT_i18n && typeof RezaOT_i18n.extend === "function") RezaOT_i18n.extend({
    ms: { recordOtHours: "jam OT", recordNoTime: "Tiada waktu direkod", recordNoTrips: "Tiada trip", recordHoliday: "Cuti umum", recordAnnual: "Cuti tahunan", recordUnpaid: "Tanpa gaji" },
    en: { recordOtHours: "OT hours", recordNoTime: "No time recorded", recordNoTrips: "No trips", recordHoliday: "Public holiday", recordAnnual: "Annual leave", recordUnpaid: "Unpaid leave" }
  });

  function injectCss() {
    if (document.getElementById("mobile-cards-css")) return;
    var st = document.createElement("style");
    st.id = "mobile-cards-css";
    st.textContent =
      "#mobileCards{display:none;}@media(max-width:600px){#mobileCards{display:block;}#reportTable{display:none;}}" +
      "@media print{#reportTable{display:table!important;}#mobileCards{display:none!important;}.menu-wrap{display:none!important;}}" +
      "body:not(.app-shell) .mc-card{padding:14px;margin-bottom:12px;background:#fff;border:1px solid #e3e8ef;border-radius:14px;}" +
      "body:not(.app-shell) .mc-actions{display:flex;gap:8px;}body:not(.app-shell) .mc-actions button{min-height:44px;flex:1;padding:8px 12px;background:#f7f9fc;color:#243244;border:1px solid #c5cdd8;}" +
      "body:not(.app-shell) .mc-trip{display:flex;align-items:center;gap:8px;}body:not(.app-shell) .mc-trip-edit{flex:1;text-align:left;background:none;color:inherit;min-height:44px;}" +
      "body:not(.app-shell) .mc-trip .mc-trip-delete{min-height:44px;min-width:44px;width:44px!important;height:44px!important;font-size:22px!important;background:#fff!important;color:#922534!important;opacity:1;}" +
      ".menu-wrap{position:relative;}.menu-panel{position:absolute;right:0;top:100%;z-index:50;}";
    document.head.appendChild(st);
  }

  function icon(name) {
    var paths = {
      clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
      edit: '<path d="m14 5 5 5M4 20l4.5-1L20 7.5a2 2 0 0 0-5-5L3.5 14 3 20Z"/>',
      remove: '<path d="M4 6h16M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6M14 10v6"/>'
    };
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "18"); svg.setAttribute("height", "18");
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6"); svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true"); svg.innerHTML = paths[name] || paths.clock;
    return svg;
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
    Object.keys(records).sort().forEach(function (date) {
      var rec = records[date];
      if (!rec) return;
      var card = document.createElement("article");
      card.className = "mc-card";
      card.dataset.date = date;
      var day = new Date(date + "T00:00:00").getDay();
      var holiday = typeof isPublicHoliday === "function" && isPublicHoliday(date);
      if (day === 6) card.classList.add("mc-sat");
      else if (day === 0) card.classList.add("mc-sun");
      if (holiday) card.classList.add("mc-ph");
      if (rec.annual || rec.unpaid) card.classList.add("mc-leave");
      var ot = 0;
      if (!rec.annual && !rec.unpaid) {
        if (typeof window.RezaOT_recordOT === "function") ot = window.RezaOT_recordOT(date, rec);
        else if (typeof calculateOT === "function") ot = calculateOT(rec.clock_in, rec.clock_out, date, rec.trips || []);
      }

      var header = document.createElement("div"); header.className = "mc-header";
      var dateGroup = document.createElement("div"); dateGroup.className = "mc-date-group";
      var weekday = document.createElement("h3"); weekday.className = "mc-day"; weekday.textContent = dayName(date);
      var dateLabel = document.createElement("span"); dateLabel.className = "mc-date";
      dateLabel.textContent = typeof formatDateForPDF === "function" ? formatDateForPDF(date) : date;
      dateGroup.appendChild(weekday); dateGroup.appendChild(dateLabel); header.appendChild(dateGroup);
      var otBadge = document.createElement("div"); otBadge.className = "mc-ot-badge";
      var amount = document.createElement("strong"); amount.textContent = (Number(ot) || 0).toFixed(2);
      var unit = document.createElement("span"); unit.textContent = t("recordOtHours", "jam OT");
      otBadge.appendChild(amount); otBadge.appendChild(unit); header.appendChild(otBadge); card.appendChild(header);

      var timeRow = document.createElement("div"); timeRow.className = "mc-times";
      timeRow.appendChild(icon("clock"));
      var timeText = document.createElement("span");
      timeText.textContent = rec.clock_in || rec.clock_out ? formatTimeSafe(rec.clock_in) + " – " + formatTimeSafe(rec.clock_out) : t("recordNoTime", "Tiada waktu direkod");
      timeRow.appendChild(timeText);
      if (rec.annual || rec.unpaid || holiday) {
        var status = document.createElement("span"); status.className = "mc-status-badge";
        if (rec.annual) { status.classList.add("mc-status-annual"); status.textContent = "ANN · " + t("recordAnnual", "Cuti tahunan"); }
        else if (rec.unpaid) { status.classList.add("mc-status-unpaid"); status.textContent = "UPL · " + t("recordUnpaid", "Tanpa gaji"); }
        else { status.classList.add("mc-status-holiday"); status.textContent = t("recordHoliday", "Cuti umum"); }
        timeRow.appendChild(status);
      }
      card.appendChild(timeRow);

      var tripList = document.createElement("div"); tripList.className = "mc-trip-list";
      var trips = Array.isArray(rec.trips) ? rec.trips : [];
      if (!trips.length) {
        var empty = document.createElement("p"); empty.className = "mc-no-trips"; empty.textContent = t("recordNoTrips", "Tiada trip"); tripList.appendChild(empty);
      } else trips.forEach(function (trip, index) {
        var row = document.createElement("div"); row.className = "mc-trip";
        var label = window.RezaOT_sideMark && typeof RezaOT_sideMark.formatTripDisplay === "function" ? RezaOT_sideMark.formatTripDisplay(rec, trip) : String(trip);
        var marker = document.createElement("span"); marker.className = "mc-trip-dot"; marker.setAttribute("aria-hidden", "true"); row.appendChild(marker);
        var edit = document.createElement("button"); edit.type = "button"; edit.className = "mc-trip-edit trip-text"; edit.textContent = label;
        edit.setAttribute("aria-label", t("editTrip", "Edit trip") + ": " + label);
        edit.addEventListener("click", function () { if (typeof window.editTrip === "function") window.editTrip(date, index); }); row.appendChild(edit);
        var remove = document.createElement("button"); remove.type = "button"; remove.className = "mc-trip-delete trip-del-btn";
        remove.appendChild(icon("remove")); remove.setAttribute("aria-label", t("deleteTrip", "Padam trip") + ": " + label);
        remove.addEventListener("click", function () { if (typeof window.deleteTrip === "function") window.deleteTrip(date, index); }); row.appendChild(remove); tripList.appendChild(row);
      });
      card.appendChild(tripList);

      var actions = document.createElement("div"); actions.className = "mc-actions";
      if (typeof editRecord === "function") {
        var editBtn = document.createElement("button"); editBtn.type = "button"; editBtn.appendChild(icon("edit"));
        var editText = document.createElement("span"); editText.textContent = t("btnEdit", "Edit"); editBtn.appendChild(editText);
        editBtn.addEventListener("click", function () { editRecord(date); }); actions.appendChild(editBtn);
      }
      if (typeof deleteRecord === "function") {
        var delBtn = document.createElement("button"); delBtn.type = "button"; delBtn.className = "mc-day-delete"; delBtn.appendChild(icon("remove"));
        var deleteText = document.createElement("span"); deleteText.textContent = t("btnDelete", "Padam"); delBtn.appendChild(deleteText);
        delBtn.addEventListener("click", function () { deleteRecord(date); }); actions.appendChild(delBtn);
      }
      card.appendChild(actions); host.appendChild(card);
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
