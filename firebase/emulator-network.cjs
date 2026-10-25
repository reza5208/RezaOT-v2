'use strict';
// Route only the fixed local emulator ports directly; preserve every remote proxy.
function emulatorRequest(input) {
  try {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      ['9000', '9099', '4400'].includes(url.port);
  } catch (_) { return false; }
}
function localFetch(original) {
  return function (input, options) {
    if (emulatorRequest(input) && options && options.dispatcher) {
      const direct = Object.assign({}, options);
      delete direct.dispatcher;
      // Never follow a local response to a remote host without its proxy.
      direct.redirect = 'manual';
      return original(input, direct);
    }
    return original(input, options);
  };
}
function localSocketOptions(input, options) {
  try {
    const url = new URL(input);
    if (url.protocol === 'ws:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.port === '9000' && options && options.proxy) {
      const direct = Object.assign({}, options);
      delete direct.proxy;
      return direct;
    }
  } catch (_) {}
  return options;
}
module.exports = { emulatorRequest, localFetch, localSocketOptions };
