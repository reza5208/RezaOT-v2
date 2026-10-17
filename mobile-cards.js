// mobile-cards.js — mobile day cards for report (v69)
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
      "border:1px solid #c5cdd8;background:#f7f9fc;font-size:14px;}" +
      "body.dark .mc-card,body.dark-mode .mc-card{background:#1e2530;border-color:#2a3340;color:#e8eaed;}" +
      "body.dark .mc-card.mc-sat,body.dark-mode .mc-card.mc-sat{background:#232a36;}" +
      "body.dark .mc-card.mc-sun,body.dark-mode .mc-card.mc-sun{background:#1a2029;}" +
      "body.dark .mc-card.mc-ph,body.dark-mode .mc-card.mc-ph{background:#1a2838;}" +
      "body.dark .mc-actions button,body.dark-mode .mc-actions button{" +
      "background:#2a3340;border-color:#3a4555;color:#e8eaed;}";
    document.head.appendChild(st);
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
      var trips = rec.trips || [];
      if (!trips.length) {
        line2.textContent = "—";
      } else {
        var parts = [];
        trips.forEach(function (t) {
          if (window.RezaOT_sideMark && typeof RezaOT_sideMark.formatTripDisplay === "function") {
            parts.push(RezaOT_sideMark.formatTripDisplay(rec, t));
          } else {
            parts.push(String(t));
          }
        });
        line2.textContent = parts.join(" · ");
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
        if (typeof calculateOT === "function") {
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

  function patchUpdateReport() {
    if (window.__mcReport1) return;
    if (typeof updateReport !== "function") return;
    window.__mcReport1 = true;
    var orig = updateReport;
    window.updateReport = function () {
      orig.apply(this, arguments);
      try { rebuildCards(); } catch (e) {}
    };
  }

  function boot() {
    injectCss();
    patchUpdateReport();
    try { rebuildCards(); } catch (e) {}
  }

  document.addEventListener("rezaot-ready", function () { setTimeout(boot, 300); });
  if (document.readyState !== "loading") setTimeout(boot, 1200);
})();
