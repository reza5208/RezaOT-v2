// Report sizing shared by native print and PDF; no timed handler overrides.
(function () {
  "use strict";
  window.applyPrintAutoSize = function () {
    var tbody = document.querySelector("#reportTable tbody");
    var rows = tbody ? tbody.querySelectorAll("tr").length : 0;
    document.body.classList.remove("print-size-sm", "print-size-xs", "print-size-xxs");
    if (rows > 26) document.body.classList.add("print-size-xxs");
    else if (rows > 18) document.body.classList.add("print-size-xs");
    else if (rows > 12) document.body.classList.add("print-size-sm");
  };
  window.clearPrintAutoSize = function () {
    document.body.classList.remove("print-size-sm", "print-size-xs", "print-size-xxs");
  };
})();
