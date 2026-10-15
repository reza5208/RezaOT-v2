// print-orient-v67.js — pilihan Portrait / Landscape untuk cetak & PDF
(function () {
  "use strict";

  var KEY = "rezaot_print_orient";

  function getPref() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "landscape" ? "landscape" : "portrait";
    } catch (e) {
      return "portrait";
    }
  }

  function setPref(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  function applyOrientClass(orient) {
    document.body.classList.remove("print-landscape", "print-portrait");
    document.body.classList.add(orient === "landscape" ? "print-landscape" : "print-portrait");
    var st = document.getElementById("printOrientPageStyle");
    if (!st) {
      st = document.createElement("style");
      st.id = "printOrientPageStyle";
      document.head.appendChild(st);
    }
    if (orient === "landscape") {
      st.textContent = "@page { size: A4 landscape; margin: 6mm 8mm 8mm 8mm; }";
    } else {
      st.textContent = "@page { size: A4 portrait; margin: 8mm 8mm 10mm 8mm; }";
    }
  }

  function clearOrientClass() {
    document.body.classList.remove("print-landscape", "print-portrait");
    var st = document.getElementById("printOrientPageStyle");
    if (st) st.textContent = "";
  }

  function ensureCss() {
    if (document.getElementById("printOrientCss")) return;
    var link = document.createElement("link");
    link.id = "printOrientCss";
    link.rel = "stylesheet";
    link.href = "styles-print-orient.css?v=67";
    document.head.appendChild(link);
  }

  function chooseOrientation() {
    return new Promise(function (resolve) {
      ensureCss();
      var old = document.getElementById("printOrientModal");
      if (old) old.remove();

      var pref = getPref();
      var root = document.createElement("div");
      root.id = "printOrientModal";
      root.className = "print-orient-modal no-print";
      root.innerHTML =
        '<div class="print-orient-backdrop" data-cancel></div>' +
        '<div class="print-orient-box" role="dialog" aria-modal="true">' +
        '  <p class="print-orient-title">Orientasi cetak / PDF</p>' +
        '  <p class="print-orient-sub">Pilih A4 Portrait atau Landscape</p>' +
        '  <div class="print-orient-actions">' +
        '    <button type="button" class="print-orient-btn" data-orient="portrait"' +
        (pref === "portrait" ? ' data-pref' : '') + '>📄 Portrait</button>' +
        '    <button type="button" class="print-orient-btn" data-orient="landscape"' +
        (pref === "landscape" ? ' data-pref' : '') + '>🖼️ Landscape</button>' +
        "  </div>" +
        '  <button type="button" class="print-orient-cancel" data-cancel>Batal</button>' +
        "</div>";
      document.body.appendChild(root);

      function close(val) {
        root.remove();
        resolve(val);
      }
      root.addEventListener("click", function (e) {
        var t = e.target;
        if (!t) return;
        if (t.getAttribute("data-cancel") != null || t.closest("[data-cancel]")) {
          close(null);
          return;
        }
        var btn = t.closest("[data-orient]");
        if (btn) {
          var o = btn.getAttribute("data-orient");
          setPref(o);
          close(o);
        }
      });
      document.addEventListener("keydown", function onEsc(e) {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", onEsc);
          close(null);
        }
      });
    });
  }

  function doPrint(orient) {
    if (window.__printBusy) return;
    window.__printBusy = true;
    applyOrientClass(orient);
    if (typeof applyPrintAutoSize === "function") applyPrintAutoSize();
    document.body.classList.add("pdf-export");
    requestAnimationFrame(function () {
      setTimeout(function () {
        try { window.print(); } catch (e) {}
        setTimeout(function () {
          document.body.classList.remove("pdf-export");
          clearOrientClass();
          if (typeof clearPrintAutoSize === "function") clearPrintAutoSize();
          window.__printBusy = false;
        }, 600);
      }, 250);
    });
  }

  function doPdf(orient) {
    if (window.__pdfBusy) return;
    window.__pdfBusy = true;
    if (typeof showToast === "function") showToast("Sediakan PDF…");
    var ready = (typeof window.loadExportLibs === "function")
      ? window.loadExportLibs()
      : Promise.resolve();
    ready.then(function () {
      if (typeof html2pdf === "undefined") {
        if (typeof showToast === "function") showToast("html2pdf tidak load");
        window.__pdfBusy = false;
        return;
      }
      var el = document.querySelector(".container");
      if (!el) { window.__pdfBusy = false; return; }
      applyOrientClass(orient);
      if (typeof applyPrintAutoSize === "function") applyPrintAutoSize();
      document.body.classList.add("pdf-export");
      var isLand = orient === "landscape";
      var opt = {
        margin: isLand ? [6, 8, 8, 8] : [8, 8, 10, 8],
        filename: "RezaOT_" + (typeof currentMonthKey !== "undefined" ? currentMonthKey : "report").replace(/\s+/g, "_") +
          (isLand ? "_L" : "") + ".pdf",
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
        jsPDF: { unit: "mm", format: "a4", orientation: isLand ? "landscape" : "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
      };
      setTimeout(function () {
        html2pdf().set(opt).from(el).save()
          .then(function () {
            if (typeof showToast === "function") showToast("PDF dimuat turun");
          })
          .catch(function () {
            if (typeof showToast === "function") showToast("Gagal jana PDF");
          })
          .finally(function () {
            document.body.classList.remove("pdf-export");
            clearOrientClass();
            if (typeof clearPrintAutoSize === "function") clearPrintAutoSize();
            setTimeout(function () { window.__pdfBusy = false; }, 800);
          });
      }, 250);
    }).catch(function () {
      if (typeof showToast === "function") showToast("Gagal load library PDF");
      window.__pdfBusy = false;
    });
  }

  function isMobileOrPwa() {
    var standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    var coarse = window.matchMedia("(pointer: coarse)").matches;
    var narrow = window.matchMedia("(max-width: 900px)").matches;
    return standalone || (coarse && narrow);
  }

  function install() {
    if (window.__printOrient67) return;
    window.__printOrient67 = true;
    ensureCss();

    window.handlePrint = function () {
      if (isMobileOrPwa()) {
        window.handleExportPdf();
        return;
      }
      chooseOrientation().then(function (orient) {
        if (!orient) return;
        doPrint(orient);
      });
    };

    window.handleExportPdf = function () {
      chooseOrientation().then(function (orient) {
        if (!orient) return;
        doPdf(orient);
      });
    };

    function rebind(id, fn) {
      var btn = document.getElementById(id);
      if (!btn) return;
      var neo = btn.cloneNode(true);
      btn.parentNode.replaceChild(neo, btn);
      neo.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        fn();
      });
    }
    rebind("printButton", function () { window.handlePrint(); });
    rebind("exportPdfBtn", function () { window.handleExportPdf(); });
  }

  document.addEventListener("rezaot-ready", function () {
    setTimeout(install, 600);
  });
  if (document.readyState !== "loading") setTimeout(install, 2000);
})();
