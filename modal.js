// Shared accessible dialogs. Requests are queued so every caller receives an outcome.
(function () {
  "use strict";
  var queue = [];
  var active = false;

  function t(key, fallback) {
    if (window.RezaOT_i18n && RezaOT_i18n.t) {
      var value = RezaOT_i18n.t(key);
      if (value && value !== key) return value;
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
      '<div class="rezaot-modal-box" role="dialog" aria-modal="true" aria-labelledby="rezaotModalTitle" aria-describedby="rezaotModalMsg" tabindex="-1">' +
      '<h2 class="rezaot-modal-title" id="rezaotModalTitle"></h2>' +
      '<p class="rezaot-modal-msg" id="rezaotModalMsg"></p>' +
      '<label class="rezaot-modal-label" for="rezaotModalInput" id="rezaotModalInputLabel" hidden></label>' +
      '<input type="text" id="rezaotModalInput" class="rezaot-modal-input" hidden />' +
      '<div class="rezaot-modal-actions" id="rezaotModalActions"></div></div>';
    document.body.appendChild(root);
    return root;
  }

  function next() {
    if (active || !queue.length) return;
    active = true;
    var item = queue.shift();
    var opts = item.options;
    var root = ensureModal();
    var box = root.querySelector('[role="dialog"]');
    var input = document.getElementById("rezaotModalInput");
    var label = document.getElementById("rezaotModalInputLabel");
    var actions = document.getElementById("rezaotModalActions");
    var previousFocus = document.activeElement;
    var inertSiblings = [];
    var closed = false;
    var isPrompt = opts.type === "prompt";
    var cancelValue = opts.type === "confirm" ? false : null;
    document.getElementById("rezaotModalTitle").textContent = opts.title || t("dialogTitle", "RezaOT");
    document.getElementById("rezaotModalMsg").textContent = opts.message || "";
    label.textContent = opts.inputLabel || opts.message || t("dialogValue", "Nilai");
    label.hidden = !isPrompt;
    input.hidden = !isPrompt;
    input.value = opts.defaultValue == null ? "" : String(opts.defaultValue);
    input.type = opts.inputType || "text";
    input.placeholder = opts.placeholder || "";
    input.autocomplete = opts.autocomplete || "off";
    actions.replaceChildren();

    function button(text, value, className, id) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rezaot-modal-btn " + className;
      if (id) btn.id = id;
      btn.textContent = text;
      btn.addEventListener("click", function () { close(isPrompt && value === true ? input.value : value); });
      actions.appendChild(btn);
      return btn;
    }

    var cancel = button(opts.cancelText || t("btnCancel", "Batal"), cancelValue, "cancel", "rezaotModalCancel");
    var preferred;
    if (opts.type === "choose") {
      opts.choices.forEach(function (choice) {
        var btn = button(choice.label, choice.value, "ok");
        btn.dataset.choice = String(choice.value);
        if (choice.value === opts.preferredValue) {
          btn.dataset.pref = "";
          preferred = btn;
        }
      });
    } else {
      preferred = button(opts.okText || t("btnOk", "OK"), true, "ok", "rezaotModalOk");
    }

    function focusable() {
      return Array.prototype.filter.call(box.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])'), function (el) {
        return !el.disabled && !el.hidden && el.getClientRects().length;
      });
    }
    function close(value) {
      if (closed) return;
      closed = true;
      root.hidden = true;
      root.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", containFocus, true);
      document.body.classList.remove("modal-open");
      inertSiblings.forEach(function (entry) { entry.element.inert = entry.inert; });
      if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === "function") previousFocus.focus();
      active = false;
      item.resolve(value);
      // Resume the queue after promise callbacks can enqueue their next dialog.
      Promise.resolve().then(next);
    }
    function onBackdrop(event) {
      if (event.target.hasAttribute("data-modal-cancel")) close(cancelValue);
    }
    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close(cancelValue);
      } else if (event.key === "Tab") {
        var list = focusable();
        var first = list[0] || box;
        var last = list[list.length - 1] || box;
        if (event.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !box.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      } else if (event.key === "Enter" && isPrompt && event.target === input) {
        event.preventDefault(); close(input.value);
      }
    }
    function containFocus(event) {
      if (!root.hidden && !box.contains(event.target)) (focusable()[0] || box).focus();
    }
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el !== root && el.tagName !== "SCRIPT" && el.tagName !== "STYLE") {
        inertSiblings.push({ element: el, inert: el.inert });
        el.inert = true;
      }
    });
    root.hidden = false;
    document.body.classList.add("modal-open");
    root.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", containFocus, true);
    (isPrompt ? input : preferred || cancel).focus();
    if (isPrompt) input.select();
  }

  function open(options) {
    return new Promise(function (resolve) {
      queue.push({ options: options, resolve: resolve });
      next();
    });
  }
  window.rezaotConfirm = function (message, options) {
    return open(Object.assign({}, options, { type: "confirm", message: message }));
  };
  window.rezaotPrompt = function (message, defaultValue, options) {
    return open(Object.assign({}, options, { type: "prompt", message: message, defaultValue: defaultValue }));
  };
  window.rezaotChoose = function (message, choices, options) {
    if (!Array.isArray(choices) || !choices.length) return Promise.resolve(null);
    return open(Object.assign({}, options, { type: "choose", message: message, choices: choices }));
  };
})();
