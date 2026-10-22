const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function harness() {
  const data = new Map(), remote = new Map(), callbacks = new Map(), writes = [];
  let setHook = null;
  const database = { ref(key) { return {
    on(event, fn) { callbacks.set(key, fn); }, off() { callbacks.delete(key); },
    once() { return Promise.resolve({ val: () => remote.get(key) ?? null }); },
    set(value) { writes.push({ path: key, value: JSON.parse(JSON.stringify(value)) });
      if (setHook) return setHook(key, value);
      remote.set(key, JSON.parse(JSON.stringify(value))); return Promise.resolve(); }
  }; } };
  const context = { Date, JSON, Math, Promise, Number, Object, Array, Set, console: { log() {}, warn() {} },
    setTimeout, clearTimeout, navigator: { onLine: true },
    document: { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, body: { classList: { add() {}, remove() {}, toggle() {} } } },
    addEventListener() {}, dispatchEvent() {},
    firebase: { apps: [{}], database: () => database },
    localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key), key: n => Array.from(data.keys())[n] ?? null, get length() { return data.size; } } };
  context.window = context;
  vm.createContext(context);
  for (const file of ['storage.js', 'model.js', 'constants.js', 'main-app-1.js', 'salary-estimator.js', 'sync-cross-v66.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  context.RezaOT_state.currentMonthKey = 'Oktober 2026';
  context.RezaOT_state.trips = ['KLIA Cargo'];
  context.RezaOT_sync.init();
  return { context, data, remote, callbacks, writes, setHook(fn) { setHook = fn; } };
}
const record = (out = '19:00') => ({ '2026-10-19': { clock_in: '08:00', clock_out: out, trips: [] } });
const tick = () => new Promise(resolve => setImmediate(resolve));
const snapshot = (context, basicSalary) => Object.assign({}, context.getGlobalCalculationSettings(), {
  salarySettings: Object.assign({}, context.RezaOT_salary.loadSettings(), { basicSalary }), capturedAt: '2026-01-01T00:00:00Z'
});

test('first empty month snapshot preserves and uploads existing local records', async () => {
  const h = harness(); h.context.RezaOT_state.dailyRecords = record();
  await h.context.RezaOT_sync.startMonth();
  h.callbacks.get('users/default/Oktober 2026')({ val: () => null });
  await h.context.RezaOT_sync.flush();
  assert.equal(Object.keys(h.context.RezaOT_state.dailyRecords).length, 1);
  assert.equal(h.remote.get('users/default/Oktober 2026').dailyRecords['2026-10-19'].clock_out, '19:00');
});

test('snapshot application does not suppress a subsequent user save', async () => {
  const h = harness(); await h.context.RezaOT_sync.startMonth();
  h.callbacks.get('users/default/Oktober 2026')({ val: () => ({ dailyRecords: record(), lastUpdated: '2026-01-01T00:00:00Z' }) });
  h.context.RezaOT_state.dailyRecords = record('20:00');
  await h.context.RezaOT_sync.saveMonth();
  assert.equal(h.remote.get('users/default/Oktober 2026').dailyRecords['2026-10-19'].clock_out, '20:00');
});

test('newer user save survives acknowledgement of an older in-flight write', async () => {
  const h = harness(); let resolveFirst;
  h.setHook((key, value) => {
    if (!resolveFirst) return new Promise(resolve => { resolveFirst = () => { h.remote.set(key, JSON.parse(JSON.stringify(value))); resolve(); }; });
    h.remote.set(key, JSON.parse(JSON.stringify(value))); return Promise.resolve();
  });
  h.context.RezaOT_state.dailyRecords = record('19:00');
  const first = h.context.RezaOT_sync.saveMonth(); await tick();
  h.context.RezaOT_state.dailyRecords = record('21:00'); h.context.RezaOT_sync.saveMonth();
  resolveFirst(); await first;
  assert.equal(h.remote.get('users/default/Oktober 2026').dailyRecords['2026-10-19'].clock_out, '21:00');
  assert.equal(h.context.getOfflineQueue().length, 0);
});

test('offline settings and empty destinations survive stale snapshots and reconnect', async () => {
  const h = harness(); h.context.navigator.onLine = false;
  h.data.set('supervisorName', 'New name');
  h.context.RezaOT_sync.settingsChanged();
  h.context.RezaOT_state.trips = []; h.context.RezaOT_sync.tripsChanged();
  assert.equal(h.context.getOfflineQueue().length, 2);
  h.remote.set('users/default/settings', { supervisorName: 'Old name', lastUpdated: '2020-01-01T00:00:00Z' });
  h.remote.set('users/default/_meta/trips', { list: ['Old'], lastUpdated: '2020-01-01T00:00:00Z' });
  h.context.navigator.onLine = true; await h.context.RezaOT_sync.startMonth();
  assert.equal(h.remote.get('users/default/settings').supervisorName, 'New name');
  assert.equal(h.remote.get('users/default/_meta/trips').list.length, 0);
});

test('incoming empty destination list is applied and not repopulated', async () => {
  const h = harness(); await h.context.RezaOT_sync.startMonth();
  h.callbacks.get('users/default/_meta/trips')({ val: () => ({ list: [], lastUpdated: '2026-01-01T00:00:00Z' }) });
  assert.equal(h.context.RezaOT_state.trips.length, 0);
  assert.equal(JSON.parse(h.data.get('trips')).length, 0);
});

test('newer remote conflict archives pending local version before replacement', async () => {
  const h = harness(); h.context.navigator.onLine = false;
  h.context.RezaOT_state.dailyRecords = record('19:00'); h.context.RezaOT_sync.saveMonth();
  h.remote.set('users/default/Oktober 2026', { dailyRecords: record('22:00'), lastUpdated: '2999-01-01T00:00:00Z' });
  h.context.navigator.onLine = true; await h.context.RezaOT_sync.flush();
  const recovery = h.context.RezaOT_storage.recoveryEntries();
  assert.ok(recovery.some(item => item.value.reason === 'sync-conflict' && item.value.data.pending.dailyRecords['2026-10-19'].clock_out === '19:00'));
  assert.equal(h.context.RezaOT_state.dailyRecords['2026-10-19'].clock_out, '22:00');
});

test('stale month callback cannot replace active month state', async () => {
  const h = harness(); await h.context.RezaOT_sync.startMonth();
  const oldCallback = h.callbacks.get('users/default/Oktober 2026');
  h.context.RezaOT_state.currentMonthKey = 'November 2026';
  h.context.RezaOT_state.dailyRecords = {};
  await h.context.RezaOT_sync.startMonth();
  oldCallback({ val: () => ({ dailyRecords: record(), lastUpdated: '2026-01-01T00:00:00Z' }) });
  assert.equal(Object.keys(h.context.RezaOT_state.dailyRecords).length, 0);
});

test('missing SDK keeps local saves queued without crashing', async () => {
  const h = harness(); delete h.context.firebase; h.context.RezaOT_state.db = null;
  h.context.RezaOT_state.dailyRecords = record();
  await h.context.RezaOT_sync.saveMonth();
  assert.equal(h.context.getOfflineQueue().length, 1);
  assert.ok(h.data.has('dailyRecords_Oktober 2026'));
});

test('auth gate prevents legacy queue from leaking into another account', async () => {
  const h = harness(); h.context.navigator.onLine = false;
  h.context.RezaOT_state.dailyRecords = record(); h.context.RezaOT_sync.saveMonth();
  h.context.REZAOT_CONFIG = { requireAuth: true };
  h.context.RezaOT_auth = { canSync: () => true };
  h.context.firebase.auth = () => ({ currentUser: { uid: 'owner-id' } });
  h.context.navigator.onLine = true; await h.context.RezaOT_sync.flush();
  assert.equal(h.writes.length, 0); assert.equal(h.context.getOfflineQueue().length, 1);
});

test('queue quota failure rolls back month persistence and visible state', () => {
  const h = harness(); h.context.navigator.onLine = false;
  h.data.set('dailyRecords_Oktober 2026', JSON.stringify(record('18:00')));
  h.context.RezaOT_state.dailyRecords = record('20:00');
  const put = h.context.localStorage.setItem;
  h.context.localStorage.setItem = (key, value) => { if (key === 'rezaot_offline_queue') throw new Error('quota'); put(key, value); };
  assert.throws(() => h.context.RezaOT_sync.saveMonth(), /storage/);
  assert.equal(JSON.parse(h.data.get('dailyRecords_Oktober 2026'))['2026-10-19'].clock_out, '18:00');
  assert.equal(h.context.RezaOT_state.dailyRecords['2026-10-19'].clock_out, '18:00');
  assert.equal(h.context.getOfflineQueue().length, 0);
});

test('queue quota failure rolls back a destination edit', () => {
  const h = harness(); h.context.navigator.onLine = false;
  h.data.set('trips', JSON.stringify(['Existing']));
  h.context.RezaOT_state.trips = ['Changed'];
  const put = h.context.localStorage.setItem;
  h.context.localStorage.setItem = (key, value) => { if (key === 'rezaot_offline_queue') throw new Error('quota'); put(key, value); };
  assert.throws(() => h.context.RezaOT_sync.tripsChanged(), /storage/);
  assert.deepEqual(JSON.parse(h.data.get('trips')), ['Existing']);
  assert.equal(h.context.RezaOT_state.trips[0], 'Existing');
});

test('settings edits and their pending revisions commit together', () => {
  const h = harness(); h.context.navigator.onLine = false;
  h.data.set('supervisorName', 'Existing');
  const put = h.context.localStorage.setItem;
  h.context.localStorage.setItem = (key, value) => { if (key === 'rezaot_offline_queue') throw new Error('quota'); put(key, value); };
  assert.throws(() => h.context.RezaOT_sync.updateSettings({ supervisorName: 'Changed' }), /storage/);
  assert.equal(h.data.get('supervisorName'), 'Existing');
});

test('an old same-month subscription cannot overwrite state after a round trip', async () => {
  const h = harness(); await h.context.RezaOT_sync.startMonth();
  const oldCallback = h.callbacks.get('users/default/Oktober 2026');
  h.context.RezaOT_state.currentMonthKey = 'November 2026';
  await h.context.RezaOT_sync.startMonth();
  h.context.RezaOT_state.currentMonthKey = 'Oktober 2026';
  h.context.RezaOT_state.dailyRecords = record('21:00');
  await h.context.RezaOT_sync.startMonth();
  oldCallback({ val: () => ({ dailyRecords: record('17:00') }) });
  assert.equal(h.context.RezaOT_state.dailyRecords['2026-10-19'].clock_out, '21:00');
});

test('an old shared subscription cannot apply after reconnecting the same owner', async () => {
  const h = harness(); await h.context.RezaOT_sync.startMonth();
  const oldCallback = h.callbacks.get('users/default/_meta/trips');
  await h.context.RezaOT_sync.reconnect();
  oldCallback({ val: () => ({ list: ['Stale'] }) });
  assert.equal(h.context.RezaOT_state.trips[0], 'KLIA Cargo');
});

test('incoming cloud settings preserve snapshots for local-only history months', async () => {
  const h = harness(); await h.context.RezaOT_sync.startMonth();
  h.data.set('monthSettings', JSON.stringify({ 'September 2026': snapshot(h.context, 2900) }));
  h.callbacks.get('users/default/settings')({ val: () => ({ monthSettings: { 'Oktober 2026': snapshot(h.context, 3000) } }) });
  const snapshots = JSON.parse(h.data.get('monthSettings'));
  assert.equal(snapshots['September 2026'].salarySettings.basicSalary, 2900);
  assert.equal(snapshots['Oktober 2026'].salarySettings.basicSalary, 3000);
});

test('outgoing settings preserve remote-only month snapshots and retain them locally', async () => {
  const h = harness();
  h.data.set('monthSettings', JSON.stringify({ 'Oktober 2026': snapshot(h.context, 3100) }));
  h.remote.set('users/default/settings', { monthSettings: { 'September 2026': snapshot(h.context, 2900) }, lastUpdated: '2000-01-01T00:00:00Z' });
  await h.context.RezaOT_sync.updateSettings({ supervisorName: 'Changed' });
  const cloud = h.remote.get('users/default/settings').monthSettings;
  assert.equal(cloud['September 2026'].salarySettings.basicSalary, 2900);
  assert.equal(cloud['Oktober 2026'].salarySettings.basicSalary, 3100);
  assert.equal(JSON.parse(h.data.get('monthSettings'))['September 2026'].salarySettings.basicSalary, 2900);
});

test('prepareImport creates pending revisions without writes or UI-preference leakage', () => {
  const h = harness();
  const prepared = h.context.RezaOT_sync.prepareImport({ months: { 'Oktober 2026': record() }, trips: [], settings: { supervisorName: 'Imported', darkMode: '1' } });
  assert.equal(h.data.size, 0);
  assert.equal(h.writes.length, 0);
  const queue = prepared.rezaot_offline_queue;
  assert.equal(queue.length, 3);
  assert.equal(queue.find(item => item.path.endsWith('/settings')).data.supervisorName, 'Imported');
  assert.equal(queue.find(item => item.path.endsWith('/settings')).data.darkMode, undefined);
  assert.ok(queue.every(item => item.revision === item.data.revision));
});

test('SDK and app UID disagreement closes authenticated routing', async () => {
  const h = harness(); h.context.REZAOT_CONFIG = { requireAuth: true };
  h.context.RezaOT_auth = { canSync: () => true, uid: () => 'previous-owner' };
  h.context.firebase.auth = () => ({ currentUser: { uid: 'new-owner' } });
  assert.equal(h.context.getFirebaseRoot(), null);
  await h.context.RezaOT_sync.flush();
  assert.equal(h.writes.length, 0);
});

test('corrupt pending payload is quarantined before it can replace cloud settings', async () => {
  const h = harness();
  h.remote.set('users/default/settings', { supervisorName: 'Healthy cloud name' });
  h.data.set('rezaot_offline_queue', JSON.stringify([{ path: 'users/default/settings', revision: 'broken', data: 'corrupt-payload' }]));
  await h.context.RezaOT_sync.flush();
  assert.equal(h.writes.length, 0);
  assert.equal(h.remote.get('users/default/settings').supervisorName, 'Healthy cloud name');
  assert.ok(h.context.RezaOT_storage.recoveryEntries().some(item => item.value.reason === 'invalid-pending-write'));
});

test('legacy queued records without revision still flush and clear once', async () => {
  const h = harness();
  h.data.set('rezaot_offline_queue', JSON.stringify([{ path: 'users/default/Oktober 2026', queuedAt: '2026-01-01T00:00:00Z', data: { dailyRecords: record(), lastUpdated: '2026-01-01T00:00:00Z' } }]));
  await h.context.RezaOT_sync.flush();
  assert.equal(h.writes.length, 1);
  assert.equal(h.context.getOfflineQueue().length, 0);
});
