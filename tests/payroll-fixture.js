const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

module.exports = function payrollContext(initial = {}) {
  const entries = new Map(Object.entries(initial));
  const listeners = {};
  const context = {
    console,
    Date,
    setTimeout,
    clearTimeout,
    localStorage: {
      getItem(key) { return entries.has(key) ? entries.get(key) : null; },
      setItem(key, value) { entries.set(key, String(value)); },
      removeItem(key) { entries.delete(key); },
      key(index) { return Array.from(entries.keys())[index] ?? null; },
      get length() { return entries.size; }
    },
    document: {
      addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
      getElementById() { return null; },
      querySelector() { return null; }
    },
    prompt() { return null; }
  };
  context.window = context;
  vm.createContext(context);
  for (const name of ['storage.js', 'constants.js', 'utils.js', 'salary-estimator.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', name), 'utf8'), context, { filename: name });
  }
  context.entries = entries;
  context.listeners = listeners;
  return context;
};
