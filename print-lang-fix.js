// print-lang-fix.js — language + single print/PDF path (no double fire)
(function () {
  "use strict";

  var busy = false;

  function isMobileOrPwa() {
    var ua = navigator.userAgent || "";
    var mobile = /Android|iPhone|iPad|iPod/i.test(ua);
    var standalone =
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      !!navigator.standalone;
    return mobile || standalone;
  }

  function doBrowserPrint() {
    if (typeof applyPrintAutoSize === "function") applyPrintAutoSize();
    try {
      window.print();
    } catch (e) {
      console.warn("print failed", e);
    }
    if (typeof clearPrintAutoSize === "function") {
      setTimeout(clearPrintAutoSize, 800);
    }
  }

  /** Reliable PDF — wait layout, avoid sticky/overflow blank page */
  function doExportPdf() {
    if (busy) return;
    if (typeof html2pdf === "undefined") {
      if (typeof showToast === "function") showToast("PDF library belum load");
      doBrowserPrint();
      return;
    }
    var el = document.querySelector(".container");
    if (!el) return;

    busy = true;
    if (typeof applyPrintAutoSize === "function") applyPrintAutoSize();
    if (typeof showToast === "function") {
      showToast(typeof t === "function" ? t("toastPrintPdf") : "Menjana PDF…", 2500);
    }

    // Prepare formal layout
    document.body.classList.add("pdf-export");

    // Disable sticky during capture (html2canvas often blanks sticky cells)
    var stickyCells = document.querySelectorAll(
      "#reportTable th:nth-child(1), #reportTable td:nth-child(1)"
    );
    stickyCells.forEach(function (c) {
      c.style.position = "static";
      c.style.boxShadow = "none";
      c.style.left = "auto";
    });

    var wrap = document.querySelector(".table-wrap");
    var prevOverflow = wrap ? wrap.style.overflow : "";
    if (wrap) wrap.style.overflow = "visible";

    var monthKey = typeof currentMonthKey !== "undefined" ? currentMonthKey : "report";
    var filename =
      "RezaOT_" + String(monthKey).replace(/\s+/g, "_") + ".pdf";

    // Allow browser to apply pdf-export CSS before capture
    setTimeout(function () {
      var opt = {
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          windowWidth: el.scrollWidth,
          windowHeight: el.scrollHeight
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] }
      };

      html2pdf()
        .set(opt)
        .from(el)
        .save()
        .then(function () {
          if (typeof showToast === "function") showToast("PDF dimuat turun");
        })
        .catch(function (err) {
          console.error("PDF error", err);
          if (typeof showToast === "function") showToast("Gagal jana PDF");
        })
        .finally(function () {
          document.body.classList.remove("pdf-export");
          stickyCells.forEach(function (c) {
            c.style.position = "";
            c.style.boxShadow = "";
            c.style.left = "";
          });
          if (wrap) wrap.style.overflow = prevOverflow;
          if (typeof clearPrintAutoSize === "function") clearPrintAutoSize();
          busy = false;
        });
    }, 250);
  }

  // Public overrides — replace originals
  window.handlePrint = function () {
    if (busy) return;
    // Phone/PWA: print dialog often empty → PDF only (once)
    if (isMobileOrPwa()) {
      doExportPdf();
    } else {
      doBrowserPrint();
    }
  };

  window.handleExportPdf = function () {
    doExportPdf();
  };

  function replaceClick(id, fn) {
    var btn = document.getElementById(id);
    if (!btn) return;
    // Clone removes all previous listeners (fixes double fire)
    var neo = btn.cloneNode(true);
    btn.parentNode.replaceChild(neo, btn);
    neo.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
  }

  function wire() {
    replaceClick("printButton", function () {
      window.handlePrint();
    });
    replaceClick("exportPdfBtn", function () {
      window.handleExportPdf();
    });

    var langBtn = document.getElementById("langToggleBtn");
    if (langBtn && !langBtn._wired) {
      langBtn._wired = true;
      langBtn.addEventListener("click", function () {
        if (window.RezaOT_i18n) window.RezaOT_i18n.toggle();
      });
    }
    if (window.RezaOT_i18n) window.RezaOT_i18n.apply();
  }

  // Wire once after app init (bootstrap dispatches DOMContentLoaded)
  var wired = false;
  function safeWire() {
    if (wired) return;
    // Wait until print button exists and main handlers registered
    if (!document.getElementById("printButton")) return;
    wired = true;
    wire();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(safeWire, 200);
    });
  } else {
    setTimeout(safeWire, 200);
  }
  setTimeout(safeWire, 600);
  setTimeout(safeWire, 1200);
})();
