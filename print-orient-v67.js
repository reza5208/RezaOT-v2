// One print/PDF controller. Layout and busy state are always restored.
(function () {
  "use strict";
  var KEY = "rezaot_print_orient";
  var cssReady;
  var choosing = false;

  function t(key, fallback) {
    var value = window.RezaOT_i18n && RezaOT_i18n.t(key);
    return value && value !== key ? value : fallback;
  }
  function toast(key, fallback) {
    if (typeof showToast === "function") showToast(t(key, fallback));
  }
  function getPref() {
    try { return localStorage.getItem(KEY) === "landscape" ? "landscape" : "portrait"; }
    catch (e) { return "portrait"; }
  }
  function ensureCss() {
    if (cssReady) return cssReady;
    cssReady = new Promise(function (resolve, reject) {
      var link = document.getElementById("printOrientCss");
      if (link && link.sheet) { resolve(); return; }
      if (!link) {
        link = document.createElement("link");
        link.id = "printOrientCss";
        link.rel = "stylesheet";
        link.href = "styles-print-orient.css?v=" + (window.REZAOT_RELEASE ? REZAOT_RELEASE.version : "70");
        document.head.appendChild(link);
      }
      link.addEventListener("load", resolve, { once: true });
      link.addEventListener("error", function () {
        link.remove();
        cssReady = null;
        reject(new Error("Print stylesheet unavailable"));
      }, { once: true });
    });
    return cssReady;
  }
  function applyOrientation(orientation) {
    document.body.classList.remove("print-landscape", "print-portrait");
    document.body.classList.add("print-" + orientation);
    var style = document.getElementById("printOrientPageStyle");
    if (!style) {
      style = document.createElement("style");
      style.id = "printOrientPageStyle";
      document.head.appendChild(style);
    }
    style.textContent = "@page { size: A4 " + orientation + "; margin: " +
      (orientation === "landscape" ? "6mm 8mm 8mm 8mm" : "8mm 8mm 10mm 8mm") + "; }";
    if (typeof applyPrintAutoSize === "function") applyPrintAutoSize();
  }
  function cleanup() {
    document.body.classList.remove("pdf-export", "print-landscape", "print-portrait");
    var style = document.getElementById("printOrientPageStyle");
    if (style) style.textContent = "";
    if (typeof clearPrintAutoSize === "function") clearPrintAutoSize();
    window.__pdfBusy = false;
    window.__printBusy = false;
  }
  async function chooseOrientation() {
    if (choosing || window.__pdfBusy || window.__printBusy) return null;
    choosing = true;
    try {
      var choice = await rezaotChoose(t("printOrientationPrompt", "Pilih orientasi cetak / PDF A4:"), [
        { value: "portrait", label: t("printPortrait", "Portrait") },
        { value: "landscape", label: t("printLandscape", "Landscape") }
      ], { title: t("printOrientationTitle", "Orientasi cetak / PDF"), preferredValue: getPref() });
      if (choice) {
        try { localStorage.setItem(KEY, choice); } catch (e) {}
      }
      return choice;
    } finally { choosing = false; }
  }
  function nextPaint() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () { requestAnimationFrame(resolve); });
    });
  }
  async function doPdf(orientation) {
    if (window.__pdfBusy || window.__printBusy) return false;
    window.__pdfBusy = true;
    var savedScroll = { x: window.scrollX, y: window.scrollY };
    try {
      toast("pdfPreparing", "Sediakan PDF…");
      await ensureCss();
      if (typeof window.loadPdfLib === "function") await window.loadPdfLib();
      if (typeof html2pdf !== "function") throw new Error("PDF library unavailable");
      var element = document.querySelector(".container");
      if (!element) throw new Error("Report unavailable");
      applyOrientation(orientation);
      document.body.classList.add("pdf-export");
      await nextPaint();
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      var landscape = orientation === "landscape";
      var options = {
        margin: landscape ? [6, 8, 8, 8] : [8, 8, 10, 8],
        filename: "RezaOT_" + (typeof currentMonthKey !== "undefined" ? currentMonthKey : "report").replace(/\s+/g, "_") + (landscape ? "_L" : "") + ".pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          scrollY: 0,
          scrollX: 0,
          // Keep desktop report media rules in the cloned canvas on a phone.
          windowWidth: landscape ? 1123 : 794,
          windowHeight: Math.max(element.scrollHeight + 40, 1123),
          logging: false
        },
        jsPDF: { unit: "mm", format: "a4", orientation: orientation },
        pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".print-footer"] }
      };
      await html2pdf().set(options).from(element).save();
      toast("pdfDownloaded", "PDF dimuat turun");
      return true;
    } catch (error) {
      console.error("PDF export failed:", error);
      toast("pdfFailed", "Gagal jana PDF. Cuba lagi atau guna Cetak.");
      return false;
    } finally {
      cleanup();
      window.scrollTo(savedScroll.x, savedScroll.y);
    }
  }
  async function doPrint(orientation) {
    if (window.__printBusy || window.__pdfBusy) return false;
    window.__printBusy = true;
    var media;
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      window.removeEventListener("afterprint", finish);
      if (media && media.removeEventListener) media.removeEventListener("change", onMedia);
      cleanup();
    }
    function onMedia(event) { if (!event.matches) finish(); }
    try {
      await ensureCss();
      applyOrientation(orientation);
      document.body.classList.add("pdf-export");
      await nextPaint();
      media = window.matchMedia("print");
      if (media.addEventListener) media.addEventListener("change", onMedia);
      window.addEventListener("afterprint", finish, { once: true });
      // Safari may return before the dialog closes. Keep the report layout until
      // afterprint/the print media transition rather than cleaning on return.
      window.print();
      return true;
    } catch (error) {
      finish();
      console.error("Print failed:", error);
      toast("printFailed", "Gagal mencetak. Cuba eksport PDF.");
      return false;
    }
  }
  function isMobileOrPwa() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true ||
      (window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(max-width: 900px)").matches);
  }
  window.handlePrint = async function () {
    var orientation = await chooseOrientation();
    if (!orientation) return false;
    return isMobileOrPwa() ? doPdf(orientation) : doPrint(orientation);
  };
  window.handleExportPdf = async function () {
    var orientation = await chooseOrientation();
    return orientation ? doPdf(orientation) : false;
  };
  function init() {
    [["printButton", "handlePrint"], ["exportPdfBtn", "handleExportPdf"]].forEach(function (entry) {
      var button = document.getElementById(entry[0]);
      if (!button || button.dataset.printBound) return;
      button.dataset.printBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        window[entry[1]]();
      });
    });
    ensureCss().catch(function (error) { console.warn(error.message); });
  }
  window.RezaOT_print = { init: init, exportPdf: doPdf, print: doPrint, cleanup: cleanup };
  document.addEventListener("rezaot-ready", init);
})();
