// print-fix-v52.js — restore A4 portrait (undo landscape v51)
(function () {
  "use strict";

  function normalAutoSize() {
    var tbody = document.querySelector("#reportTable tbody");
    if (!tbody) return;
    var rows = tbody.querySelectorAll("tr").length;
    document.body.classList.remove("print-size-sm", "print-size-xs", "print-size-xxs");
    if (rows > 26) document.body.classList.add("print-size-xxs");
    else if (rows > 18) document.body.classList.add("print-size-xs");
    else if (rows > 12) document.body.classList.add("print-size-sm");
  }

  window.applyPrintAutoSize = normalAutoSize;

  function patchPdf() {
    if (window.__printFix52) return;
    window.__printFix52 = true;

    window.handleExportPdf = function () {
      if (window.__pdfBusy) return;
      window.__pdfBusy = true;
      showToast("Sediakan PDF…");
      var ready = (typeof window.loadExportLibs === "function")
        ? window.loadExportLibs()
        : Promise.resolve();
      ready.then(function () {
        if (typeof html2pdf === "undefined") {
          showToast("html2pdf tidak load");
          window.__pdfBusy = false;
          return;
        }
        var el = document.querySelector(".container");
        if (!el) { window.__pdfBusy = false; return; }
        normalAutoSize();
        document.body.classList.add("pdf-export");
        var opt = {
          margin: [8, 8, 10, 8],
          filename: "RezaOT_" + (typeof currentMonthKey !== "undefined" ? currentMonthKey : "report").replace(/\s+/g, "_") + ".pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            scrollY: 0,
            scrollX: 0,
            windowWidth: el.scrollWidth,
            windowHeight: el.scrollHeight + 40,
            logging: false
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] }
        };
        setTimeout(function () {
          html2pdf().set(opt).from(el).save()
            .then(function () { showToast("PDF dimuat turun"); })
            .catch(function () { showToast("Gagal jana PDF"); })
            .finally(function () {
              document.body.classList.remove("pdf-export");
              if (typeof clearPrintAutoSize === "function") clearPrintAutoSize();
              setTimeout(function () { window.__pdfBusy = false; }, 800);
            });
        }, 250);
      }).catch(function () {
        showToast("Gagal load library PDF");
        window.__pdfBusy = false;
      });
    };

    var prevPrint = window.handlePrint;
    window.handlePrint = function () {
      normalAutoSize();
      if (typeof prevPrint === "function") return prevPrint.apply(this, arguments);
      window.print();
    };
  }

  document.addEventListener("rezaot-ready", function () { setTimeout(patchPdf, 300); });
  if (document.readyState !== "loading") setTimeout(patchPdf, 1200);
})();
