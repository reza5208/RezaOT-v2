// print-lang-fix.js — load after main apps
(function () {
  "use strict";

  // Override print: mobile/PWA often blocks window.print()
  window.handlePrint = function handlePrint() {
    if (typeof applyPrintAutoSize === "function") applyPrintAutoSize();
    var ua = navigator.userAgent || "";
    var isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    var isStandalone =
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      !!navigator.standalone;

    if (isMobile || isStandalone) {
      if (typeof showToast === "function") {
        showToast(
          typeof t === "function" ? t("toastPrintPdf") : "Phone/PWA: opening PDF for print…",
          3000
        );
      }
      if (typeof handleExportPdf === "function") {
        handleExportPdf();
      } else {
        try { window.print(); } catch (e) {}
      }
      if (typeof clearPrintAutoSize === "function") {
        setTimeout(clearPrintAutoSize, 1500);
      }
      return;
    }

    try {
      window.print();
    } catch (e) {
      if (typeof handleExportPdf === "function") handleExportPdf();
    }
    if (typeof clearPrintAutoSize === "function") {
      setTimeout(clearPrintAutoSize, 1000);
    }
  };

  // Re-bind print button
  function wire() {
    var printBtn = document.getElementById("printButton");
    if (printBtn) {
      printBtn.onclick = function (e) {
        e.preventDefault();
        window.handlePrint();
      };
    }
    var langBtn = document.getElementById("langToggleBtn");
    if (langBtn && !langBtn._wired) {
      langBtn._wired = true;
      langBtn.addEventListener("click", function () {
        if (window.RezaOT_i18n) window.RezaOT_i18n.toggle();
      });
    }
    if (window.RezaOT_i18n) window.RezaOT_i18n.apply();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(wire, 100);
    });
  } else {
    setTimeout(wire, 100);
  }
  // Also after bootstrap re-dispatch
  setTimeout(wire, 800);
})();
