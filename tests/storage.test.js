const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function storageHarness() {
  const data = new Map();
  let failKey = null;
  const context = { console, Date, JSON, CustomEvent: function (name, props) { this.type = name; this.detail = props.detail; }, dispatchEvent() {},
    localStorage: { getItem: key => data.has(key) ? data.get(key) : null,
      setItem(key, value) { if (key === failKey) throw new Error('quota'); data.set(key, String(value)); },
      removeItem: key => data.delete(key), key: index => Array.from(data.keys())[index] ?? null,
      get length() { return data.size; } } };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../storage.js'), 'utf8'), context);
  return { context, data, fail(key) { failKey = key; }, store: context.RezaOT_storage };
}

test('malformed JSON is retained in recovery before later writes replace it', () => {
  const h = storageHarness(); h.data.set('records', 'broken-json');
  assert.deepEqual(JSON.parse(JSON.stringify(h.store.read('records', {}))), {});
  const backups = h.store.recoveryEntries();
  assert.equal(backups.length, 1); assert.equal(backups[0].value.data.raw, 'broken-json');
  assert.equal(h.data.get('records'), 'broken-json');
  h.store.write('records', { repaired: true });
  assert.deepEqual(JSON.parse(h.data.get('records')), { repaired: true });
});

test('failed recovery never permits overwriting the original data', () => {
  const h = storageHarness(); h.data.set('records', 'original-invalid-json');
  h.context.localStorage.setItem = () => { throw new Error('quota'); };
  h.store.read('records', {});
  assert.throws(() => h.store.write('records', {}), /Data asal/);
  assert.equal(h.data.get('records'), 'original-invalid-json');
});

test('transactions preserve raw strings and rollback earlier writes on failure', () => {
  const h = storageHarness();
  h.store.transaction({ supervisorName: 'Talib', records: { count: 1 } });
  assert.equal(h.data.get('supervisorName'), 'Talib');
  h.fail('records');
  assert.throws(() => h.store.transaction({ supervisorName: 'Changed', records: { count: 2 } }));
  assert.equal(h.data.get('supervisorName'), 'Talib');
  assert.equal(JSON.parse(h.data.get('records')).count, 1);
});

test('recovery archives never overwrite a prior entry after a same-clock reload', () => {
  const h = storageHarness();
  h.context.Date = class extends Date { static now() { return 12345; } };
  const first = h.store.archive('first', { retained: true });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../storage.js'), 'utf8'), h.context);
  const second = h.context.RezaOT_storage.archive('second', { retained: true });
  assert.notEqual(first, second);
  assert.equal(JSON.parse(h.data.get(first)).reason, 'first');
  assert.equal(JSON.parse(h.data.get(second)).reason, 'second');
});

test('transaction read failure performs no writes and reports storage unavailable', () => {
  const h = storageHarness();
  h.data.set('records', '{"count":1}');
  h.context.localStorage.getItem = () => { throw new Error('unavailable'); };
  assert.throws(() => h.store.transaction({ records: { count: 2 } }), /storage/);
  assert.equal(h.data.get('records'), '{"count":1}');
});
