'use strict';
// The CLI's explicit ProxyAgent ignores NO_PROXY for loopback HTTP requests.
const {localFetch,localSocketOptions} = require('./emulator-network.cjs');
if (typeof globalThis.fetch === 'function') globalThis.fetch = localFetch(globalThis.fetch);
// The Node RTDB SDK also ignores NO_PROXY when constructing its WebSocket.
const faye = require('faye-websocket');
const OriginalClient = faye.Client;
function EmulatorClient(url, protocols, options) {
  return new OriginalClient(url, protocols, localSocketOptions(url, options));
}
EmulatorClient.prototype = OriginalClient.prototype;
Object.setPrototypeOf(EmulatorClient, OriginalClient);
faye.Client = EmulatorClient;
