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

test('listing a damaged recovery archive preserves its raw contents without creating more archives', () => {
  const h = storageHarness();
  const key = 'rezaot_recovery_12345_1';
  h.data.set(key, '{damaged archive');
  h.data.set('records', '{"count":1}');
  const before = Array.from(h.data.entries());
  for (let index = 0; index < 3; index++) {
    const entries = h.store.recoveryEntries();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].key, key);
    assert.equal(entries[0].value.reason, 'unreadable-recovery');
    assert.equal(entries[0].value.data.raw, '{damaged archive');
  }
  assert.deepEqual(Array.from(h.data.entries()), before);
});

test('removing an archive cannot remove live records or other local app state', () => {
  const h = storageHarness();
  const key = h.store.archive('before-import', { records: { count: 1 } });
  h.data.set('dailyRecords_Oktober 2026', '{"retained":true}');
  h.data.set('rezaot_auth_data_owner', 'owner-uid');
  for (const invalid of ['dailyRecords_Oktober 2026', 'rezaot_auth_data_owner', 'rezaot_recovery_', 'rezaot_recovery_1_2_suffix', null, {}]) {
    assert.throws(() => h.store.removeRecovery(invalid), /Invalid recovery key/);
  }
  assert.equal(h.data.get('dailyRecords_Oktober 2026'), '{"retained":true}');
  assert.equal(h.data.get('rezaot_auth_data_owner'), 'owner-uid');
  assert.equal(h.store.recoveryEntries().length, 1);
  h.store.removeRecovery(key);
  assert.equal(h.store.recoveryEntries().length, 0);
  assert.equal(h.data.size, 2);
});

test('storage usage includes UTF-16 keys and values without modifying them', () => {
  const h = storageHarness();
  h.data.set('name', 'M\u00e9');
  h.data.set('emoji', '\ud83d\ude80');
  const before = Array.from(h.data.entries());
  assert.equal(h.store.usageBytes(), (4 + 2 + 5 + 2) * 2);
  assert.deepEqual(Array.from(h.data.entries()), before);
});
