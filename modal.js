// modal.js — confirm / prompt in-app (no browser dialog)
(function () {
  "use strict";

  function t(key, fallback) {
    if (window.RezaOT_i18n && RezaOT_i18n.t) {
      var v = RezaOT_i18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function ensureModal() {
    var root = document.getElementById("rezaotModal");
    if (root) return root;
    root = document.createElement("div");
    root.id = "rezaotModal";
    root.className = "rezaot-modal no-print";
    root.hidden = true;
    root.innerHTML =
      '<div class="rezaot-modal-backdrop" data-modal-cancel></div>' +
      '<div class="rezaot-modal-box" role="dialog" aria-modal="true">' +
      '  <p class="rezaot-modal-msg" id="rezaotModalMsg"></p>' +
      '  <input type="text" id="rezaotModalInput" class="rezaot-modal-input" hidden />' +
      '  <div class="rezaot-modal-actions">' +
      '    <button type="button" class="rezaot-modal-btn cancel" id="rezaotModalCancel"></button>' +
      '    <button type="button" class="rezaot-modal-btn ok" id="rezaotModalOk"></button>' +
      "  </div>" +
      "</div>";
    document.body.appendChild(root);
    return root;
  }

  function openModal(opts) {
    return new Promise(function (resolve) {
      var root = ensureModal();
      var msg = document.getElementById("rezaotModalMsg");
      var input = document.getElementById("rezaotModalInput");
      var btnOk = document.getElementById("rezaotModalOk");
      var btnCancel = document.getElementById("rezaotModalCancel");
      msg.textContent = opts.message || "";
      btnOk.textContent = opts.okText || t("btnOk", "OK");
      btnCancel.textContent = opts.cancelText || t("btnCancel", "Batal");
      var isPrompt = !!opts.prompt;
      input.hidden = !isPrompt;
      if (isPrompt) {
        input.value = opts.defaultValue || "";
        input.placeholder = opts.placeholder || "";
      }
      root.hidden = false;
      document.body.classList.add("modal-open");

      function close(result) {
        root.hidden = true;
        document.body.classList.remove("modal-open");
        root.removeEventListener("click", onBackdrop);
        btnOk.onclick = null;
        btnCancel.onclick = null;
        input.onkeydown = null;
        document.removeEventListener("keydown", onEsc);
        resolve(result);
      }
      function onBackdrop(e) {
        if (e.target && e.target.getAttribute("data-modal-cancel") != null) {
          close(isPrompt ? null : false);
        }
      }
      function onEsc(e) {
        if (e.key === "Escape") close(isPrompt ? null : false);
      }
      root.addEventListener("click", onBackdrop);
      btnOk.onclick = function () {
        close(isPrompt ? input.value : true);
      };
      btnCancel.onclick = function () {
        close(isPrompt ? null : false);
      };
      document.addEventListener("keydown", onEsc);
      setTimeout(function () {
        if (isPrompt) input.focus();
        else btnOk.focus();
      }, 30);
      input.onkeydown = function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          close(input.value);
        }
      };
    });
  }

  window.rezaotConfirm = function (message) {
    return openModal({ message: message, prompt: false });
  };
  window.rezaotPrompt = function (message, defaultValue) {
    return openModal({ message: message, prompt: true, defaultValue: defaultValue || "" });
  };
})();
