const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness() {
  const stored = new Map([['dailyRecords_September 2026', '{}']]);
  const remote = new Map(), reads = [], writes = [], warnings = [];
  const documentEvents = new Map(), windowEvents = new Map();
  let root = 'users/default', ready = true, onceHook = null, updateHook = null, changes = 0;
  const select = {
    children: [], value: '', handlers: [],
    appendChild(node) { this.children.push(node); },
    addEventListener(name, callback) { this.handlers.push({ name, callback }); },
    set textContent(_) { this.children = []; }
  };
  const monthInput = { value: '' };
  function listen(events, name, callback) {
    if (!events.has(name)) events.set(name, []);
    events.get(name).push(callback);
  }
  function makeDatabase() {
    const instance = {
      ref(key) { return {
        once() {
          reads.push({ instance, key });
          return onceHook ? onceHook(key, instance) : Promise.resolve({ val: () => clone(remote.get(key) ?? null) });
        },
        async update(values) {
          writes.push({ instance, key, values: clone(values) });
          if (updateHook) return updateHook(key, values, instance);
          remote.set(key, Object.assign({}, remote.get(key) || {}, clone(values)));
        }
      }; }
    };
    return instance;
  }
  const context = {
    console: { warn: (...args) => warnings.push(args) },
    db: makeDatabase(), currentMonthKey: 'Oktober 2026', navigator: { onLine: true },
    localStorage: {
      get length() { return stored.size; }, key: n => Array.from(stored.keys())[n] ?? null,
      getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value))
    },
    document: {
      getElementById: id => id === 'monthHistory' ? select : id === 'monthYear' ? monthInput : null,
      createElement: () => ({}), addEventListener: (name, callback) => listen(documentEvents, name, callback)
    },
    addEventListener: (name, callback) => listen(windowEvents, name, callback),
    RezaOT_sync: { userPath: () => root, isReady: () => ready },
    appText: (_key, fallback) => fallback,
    handleMonthChange: async () => { changes++; }, showToast() {}
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['model.js', 'month-history-v65.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  return {
    context, stored, remote, reads, writes, warnings, select, monthInput,
    api: context.RezaOT_monthHistory,
    names: () => select.children.map(x => x.value).filter(Boolean),
    root(value) { root = value; }, ready(value) { ready = value; },
    once(fn) { onceHook = fn; }, update(fn) { updateHook = fn; },
    newDatabase() { context.db = makeDatabase(); return context.db; },
    emit: (name, target = 'document') => Promise.all((target === 'document' ? documentEvents : windowEvents).get(name)?.map(fn => fn({ type: name })) || []),
    changes: () => changes
  };
}

test('month history reads only the small manifest and accepts valid true month markers', async () => {
  const h = harness();
  h.remote.set('users/default/_meta/months', {
    'Ogos 2026': true, 'November 2026': true, 'Disember 2026': false,
    settings: true, 'January 2026': true, 'Januari 1000': true
  });
  await h.api.refresh();
  assert.deepEqual(h.reads.map(x => x.key), ['users/default/_meta/months']);
  assert.deepEqual(h.names(), ['November 2026', 'Oktober 2026', 'September 2026', 'Ogos 2026']);
  assert.equal(h.writes.length, 0);
});

test('missing legacy manifest is bootstrapped once without rewriting month records', async () => {
  const h = harness();
  h.remote.set('users/default', {
    'Julai 2026': { dailyRecords: {} }, 'Ogos 2026': { dailyRecords: {} },
    'Jun 2026': { deleted: true }, settings: { supervisorName: 'Example' }, _meta: { trips: [] }
  });
  await h.api.refresh();
  assert.deepEqual(h.reads.map(x => x.key), ['users/default/_meta/months', 'users/default']);
  assert.deepEqual(h.writes.map(x => ({ key: x.key, values: x.values })), [
    { key: 'users/default/_meta/months', values: { 'Julai 2026': true, 'Ogos 2026': true } }
  ]);
  assert.ok(!h.names().includes('Jun 2026'), 'Deleted month tombstones must not reappear');
  await h.api.refresh();
  assert.equal(h.reads.filter(x => x.key === 'users/default').length, 1);
  assert.equal(h.writes.length, 1);
});

test('denied bootstrap write keeps session history usable without downloading the user subtree again', async () => {
  const h = harness();
  h.remote.set('users/default', { 'Julai 2026': { dailyRecords: {} } });
  h.update(async () => { throw Object.assign(new Error('denied'), { code: 'PERMISSION_DENIED' }); });
  assert.equal(await h.api.refresh(), true);
  await h.api.refresh();
  assert.equal(h.reads.filter(x => x.key === 'users/default').length, 1);
  assert.equal(h.writes.length, 1);
  assert.ok(h.names().includes('Julai 2026'));
  h.context.navigator.onLine = false;
  const count = h.reads.length;
  assert.equal(await h.api.refresh(), false);
  assert.equal(h.reads.length, count);
  assert.ok(h.names().includes('Julai 2026'), 'Same-owner session history remains usable offline');
});

test('sign-out and UID changes clear cloud options and reject stale index responses', async () => {
  const h = harness(), pending = deferred();
  h.root('users/owner-a');
  h.remote.set('users/owner-a/_meta/months', { 'Januari 2026': true });
  await h.api.refresh();
  assert.ok(h.names().includes('Januari 2026'));
  h.once((key) => key.startsWith('users/owner-a/') ? pending.promise : Promise.resolve({ val: () => ({ 'Februari 2026': true }) }));
  const old = h.api.refresh();
  h.root(null); await h.emit('rezaot-auth-state');
  assert.ok(!h.names().includes('Januari 2026'));
  h.root('users/owner-b'); await h.emit('rezaot-auth-state');
  assert.ok(h.names().includes('Februari 2026'));
  pending.resolve({ val: () => ({ 'Mac 2026': true }) }); await old;
  assert.ok(!h.names().includes('Mac 2026'));
  assert.ok(!h.names().includes('Januari 2026'));
});

test('database changes invalidate in-flight results and do not reuse another database legacy cache', async () => {
  const h = harness();
  h.remote.set('users/default', { 'Julai 2026': { dailyRecords: {} } });
  h.update(async () => { throw new Error('temporarily unavailable'); });
  await h.api.refresh();
  const oldDb = h.context.db, pending = deferred();
  h.once((key, instance) => instance === oldDb ? pending.promise : Promise.resolve({ val: () => key.endsWith('_meta/months') ? null : { 'Disember 2026': { dailyRecords: {} } } }));
  const old = h.api.refresh();
  h.newDatabase(); await h.api.refresh();
  pending.resolve({ val: () => ({ 'Januari 2026': true }) }); await old;
  assert.ok(h.names().includes('Disember 2026'));
  assert.ok(!h.names().includes('Julai 2026'));
  assert.ok(!h.names().includes('Januari 2026'));
});

test('manifest permission failure does not broaden access and denied legacy reads are attempted only once', async () => {
  const h = harness();
  h.once(async () => { throw Object.assign(new Error('denied'), { code: 'PERMISSION_DENIED' }); });
  assert.equal(await h.api.refresh(), false);
  assert.deepEqual(h.reads.map(x => x.key), ['users/default/_meta/months']);
  assert.deepEqual(h.names(), ['Oktober 2026', 'September 2026']);
  h.once(async key => {
    if (key.endsWith('/_meta/months')) return { val: () => null };
    throw new Error('root not readable');
  });
  assert.equal(await h.api.refresh(), false);
  await h.api.refresh();
  assert.equal(h.reads.filter(x => x.key === 'users/default').length, 1);
  assert.deepEqual(h.names(), ['Oktober 2026', 'September 2026']);
});

test('a removed previously known manifest is not recreated from a full user read', async () => {
  const h = harness();
  h.remote.set('users/default/_meta/months', { 'Julai 2026': true });
  await h.api.refresh();
  h.remote.delete('users/default/_meta/months');
  h.remote.set('users/default', { 'Julai 2026': { dailyRecords: {} } });
  await h.api.refresh();
  assert.ok(!h.names().includes('Julai 2026'));
  assert.equal(h.reads.filter(x => x.key === 'users/default').length, 0);
  assert.equal(h.writes.length, 0);
});

test('duplicate ready events share the request and month change is bound once', async () => {
  const h = harness(), pending = deferred();
  h.once(() => pending.promise);
  const first = h.api.init(), second = h.api.init();
  const cloud = h.emit('rezaot-cloud-ready', 'window');
  assert.equal(h.reads.length, 1);
  assert.equal(h.select.handlers.length, 1);
  pending.resolve({ val: () => ({ 'Julai 2026': true }) });
  await Promise.all([first, second, cloud]);
  h.select.value = 'Julai 2026'; await h.select.handlers[0].callback();
  assert.equal(h.monthInput.value, '2026-07');
  assert.equal(h.changes(), 1);
});
