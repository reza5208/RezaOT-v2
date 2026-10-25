const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function harness(sharedRemote) {
  const data = new Map(), remote = sharedRemote || new Map(), callbacks = new Map(), writes = [];
  let setHook = null, onceHook = null;
  const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const serverValues = value => JSON.parse(JSON.stringify(value).replace(/\{"\.sv":"timestamp"\}/g, String(Date.now())));
  const database = { ref(key) { return {
    on(event, fn) { callbacks.set(key, fn); if(key === '.info/connected')fn({val:()=>true}); },
    off() { callbacks.delete(key); },
    async once() { if (onceHook) await onceHook(key); const value = copy(remote.get(key) ?? null); return { val: () => copy(value) }; },
    async set(value) {
      if(setHook)await setHook(key,copy(value));
      const resolved=serverValues(value);remote.set(key,resolved);writes.push({path:key,value:copy(resolved)});
    },
    async transaction(update, callback, applyLocally) {
      assert.equal(applyLocally,false,'Transactions must not publish provisional local events');
      for(let attempt=0;attempt<25;attempt++){
        const before=copy(remote.get(key) ?? null), candidate=update(copy(before));
        if(candidate===undefined){const result={committed:false,snapshot:{val:()=>copy(remote.get(key) ?? null)}};if(callback)callback(null,false,result.snapshot);return result;}
        if(setHook)await setHook(key,copy(candidate),attempt);
        const now=remote.get(key) ?? null;
        if(JSON.stringify(now)!==JSON.stringify(before) && JSON.stringify(now)!==JSON.stringify(candidate))continue;
        const resolved=serverValues(candidate);remote.set(key,resolved);writes.push({path:key,value:copy(resolved)});
        const result={committed:true,snapshot:{val:()=>copy(resolved)}};if(callback)callback(null,true,result.snapshot);return result;
      }
      throw new Error('Too many transaction retries');
    }
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
  return { context, data, remote, callbacks, writes, setHook(fn) { setHook = fn; }, onceHook(fn) { onceHook = fn; },
    emit(key,value){remote.set(key,copy(value));const cb=callbacks.get(key);if(cb)cb({val:()=>copy(value)});} };
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
  h.emit('users/default/Oktober 2026', { dailyRecords: record(), lastUpdated: '2026-01-01T00:00:00Z' });
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
  const h = harness(); await h.context.RezaOT_sync.startMonth();
  h.emit('users/default/settings', {supervisorName:'Old name'});
  h.emit('users/default/_meta/trips', {list:['Old']});
  h.context.navigator.onLine = false;
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

test('different remote edits create an explicit conflict regardless of clock timestamps', async () => {
  const h = harness(); h.context.navigator.onLine = false;
  h.context.RezaOT_state.dailyRecords = record('19:00'); h.context.RezaOT_sync.saveMonth();
  h.remote.set('users/default/Oktober 2026', { dailyRecords: record('22:00'), lastUpdated: '2999-01-01T00:00:00Z' });
  h.context.navigator.onLine = true; await h.context.RezaOT_sync.flush();
  const recovery = h.context.RezaOT_storage.recoveryEntries();
  assert.ok(recovery.some(item => item.value.reason === 'sync-conflict' && item.value.data.pending.dailyRecords['2026-10-19'].clock_out === '19:00'));
  assert.equal(h.context.RezaOT_state.dailyRecords['2026-10-19'].clock_out, '19:00');
  assert.equal(h.context.RezaOT_sync.getConflicts().length,1);
  assert.equal(h.remote.get('users/default/Oktober 2026').dailyRecords['2026-10-19'].clock_out,'22:00');
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
  assert.equal(h.writes.filter(v=>v.path==='users/default/Oktober 2026').length, 1);
  assert.equal(h.remote.get('users/default/_meta/months/Oktober 2026'),true);
  assert.equal(h.context.getOfflineQueue().length, 0);
});

function authenticated(h, state, uid='owner-a') {
  h.context.REZAOT_CONFIG={requireAuth:true};
  h.context.RezaOT_auth={canSync:()=>state.approved,uid:()=>state.approved?uid:null};
  h.context.firebase.auth=()=>({currentUser:state.approved?{uid}:null});
}
const monthPath='users/default/Oktober 2026';
test('signed-out changes without a cloud baseline stay visible and require reconciliation after login',async()=>{
  const h=harness(),state={approved:false};authenticated(h,state);h.data.set('rezaot_auth_data_owner','owner-a');
  h.context.RezaOT_state.dailyRecords=record('21:00');await h.context.RezaOT_sync.saveMonth();
  assert.equal(h.context.getOfflineQueue().length,0);assert.equal(JSON.parse(h.data.get('rezaot_local_dirty')).length,1);
  h.remote.set('users/owner-a/Oktober 2026',{dailyRecords:record('17:00'),revision:'old',lastUpdated:'2020-01-01T00:00:00Z'});
  state.approved=true;await h.context.RezaOT_sync.startMonth();
  h.emit('users/owner-a/Oktober 2026',h.remote.get('users/owner-a/Oktober 2026'));
  await h.context.RezaOT_sync.flush();
  assert.equal(h.context.RezaOT_state.dailyRecords['2026-10-19'].clock_out,'21:00');
  assert.equal(h.remote.get('users/owner-a/Oktober 2026').dailyRecords['2026-10-19'].clock_out,'17:00');
  assert.equal(h.context.RezaOT_sync.getConflicts().length,1);
});
test('known-owner signed-out edits reconcile against the previously observed baseline',async()=>{
  const h=harness(),state={approved:true};authenticated(h,state);h.data.set('rezaot_auth_data_owner','owner-a');
  await h.context.RezaOT_sync.startMonth();h.emit('users/owner-a/Oktober 2026',{dailyRecords:record('17:00')});
  state.approved=false;await h.context.RezaOT_sync.reconnect();
  h.context.RezaOT_state.dailyRecords=record('21:00');await h.context.RezaOT_sync.saveMonth();
  state.approved=true;await h.context.RezaOT_sync.reconnect();await h.context.RezaOT_sync.flush();
  assert.equal(h.remote.get('users/owner-a/Oktober 2026').dailyRecords['2026-10-19'].clock_out,'21:00');
  assert.equal(h.context.RezaOT_sync.getConflicts().length,0);assert.equal(h.context.RezaOT_sync.getDiagnostics().dirty,0);
});
test('dirty data bound to another owner is never reassigned to the authenticated namespace',async()=>{
  const h=harness(),state={approved:false};authenticated(h,state,'owner-b');h.data.set('rezaot_auth_data_owner','owner-a');
  h.context.RezaOT_state.dailyRecords=record('21:00');await h.context.RezaOT_sync.saveMonth();
  state.approved=true;await h.context.RezaOT_sync.startMonth();await h.context.RezaOT_sync.flush();
  assert.equal(h.writes.length,0);assert.equal(JSON.parse(h.data.get('rezaot_local_dirty'))[0].owner,'users/owner-a');
});
test('two devices editing different dates merge atomically despite skewed client timestamps',async()=>{
  const remote=new Map(),a=harness(remote),b=harness(remote),base={dailyRecords:record(),revision:'base'};
  await a.context.RezaOT_sync.startMonth();await b.context.RezaOT_sync.startMonth();a.emit(monthPath,base);b.emit(monthPath,base);
  a.context.navigator.onLine=false;b.context.navigator.onLine=false;
  a.context.RezaOT_state.dailyRecords['2026-10-20']={clock_in:'08:00',clock_out:'20:00',trips:[]};
  b.context.RezaOT_state.dailyRecords['2026-10-21']={clock_in:'08:00',clock_out:'21:00',trips:[]};
  a.context.RezaOT_sync.saveMonth();b.context.RezaOT_sync.saveMonth();
  const qa=JSON.parse(a.data.get('rezaot_offline_queue'));qa[0].data.lastUpdated='2999-01-01T00:00:00Z';a.data.set('rezaot_offline_queue',JSON.stringify(qa));
  a.context.navigator.onLine=true;b.context.navigator.onLine=true;
  await a.context.RezaOT_sync.flush();await b.context.RezaOT_sync.flush();
  assert.deepEqual(Object.keys(remote.get(monthPath).dailyRecords).sort(),['2026-10-19','2026-10-20','2026-10-21']);
  assert.equal(b.context.RezaOT_sync.getConflicts().length,0);assert.equal(typeof remote.get(monthPath).lastUpdatedServer,'number');
});
test('same-date concurrent edits require a choice and local resolution preserves unrelated remote dates',async()=>{
  const remote=new Map(),a=harness(remote),b=harness(remote),base={dailyRecords:record(),revision:'base'};
  await a.context.RezaOT_sync.startMonth();await b.context.RezaOT_sync.startMonth();a.emit(monthPath,base);b.emit(monthPath,base);
  a.context.navigator.onLine=false;b.context.navigator.onLine=false;
  a.context.RezaOT_state.dailyRecords=record('20:00');b.context.RezaOT_state.dailyRecords=record('21:00');
  a.context.RezaOT_sync.saveMonth();b.context.RezaOT_sync.saveMonth();a.context.navigator.onLine=true;b.context.navigator.onLine=true;
  await a.context.RezaOT_sync.flush();await b.context.RezaOT_sync.flush();
  assert.equal(remote.get(monthPath).dailyRecords['2026-10-19'].clock_out,'20:00');
  assert.equal(b.context.RezaOT_state.dailyRecords['2026-10-19'].clock_out,'21:00');
  remote.get(monthPath).dailyRecords['2026-10-22']={clock_in:'08:00',clock_out:'18:00',trips:[]};
  const conflict=b.context.RezaOT_sync.getConflicts()[0];assert.ok(conflict);
  await b.context.RezaOT_sync.resolveConflict(conflict.id,'local');
  assert.equal(remote.get(monthPath).dailyRecords['2026-10-19'].clock_out,'21:00');
  assert.ok(remote.get(monthPath).dailyRecords['2026-10-22']);assert.equal(b.context.RezaOT_sync.getConflicts().length,0);
});
test('a transaction retry re-merges the latest server value without duplicate recovery side effects',async()=>{
  const h=harness();await h.context.RezaOT_sync.startMonth();h.emit(monthPath,{dailyRecords:record(),revision:'base'});
  h.context.navigator.onLine=false;h.context.RezaOT_state.dailyRecords['2026-10-20']={clock_in:'08:00',clock_out:'20:00',trips:[]};
  h.context.RezaOT_sync.saveMonth();let attempts=0;
  h.setHook((key,_value,attempt)=>{if(key===monthPath){attempts++;if(attempt===0)h.remote.set(key,{dailyRecords:{...record(),'2026-10-21':{clock_in:'08:00',clock_out:'21:00',trips:[]}},revision:'other-device'});}});
  h.context.navigator.onLine=true;await h.context.RezaOT_sync.flush();
  assert.equal(attempts,2);assert.equal(Object.keys(h.remote.get(monthPath).dailyRecords).length,3);
  assert.equal(h.writes.filter(v=>v.path===monthPath).length,1);assert.equal(h.context.RezaOT_sync.getConflicts().length,0);
});
test('record deletion conflicts with a concurrent edit and can be explicitly resolved',async()=>{
  const h=harness();await h.context.RezaOT_sync.startMonth();h.emit(monthPath,{dailyRecords:record(),revision:'base'});
  h.context.navigator.onLine=false;h.context.RezaOT_state.dailyRecords={};h.context.RezaOT_sync.saveMonth();
  h.remote.set(monthPath,{dailyRecords:record('22:00'),revision:'edited'});h.context.navigator.onLine=true;await h.context.RezaOT_sync.flush();
  assert.equal(Object.keys(h.context.RezaOT_state.dailyRecords).length,0);assert.equal(h.context.RezaOT_sync.getConflicts().length,1);
  await h.context.RezaOT_sync.resolveConflict(h.context.RezaOT_sync.getConflicts()[0].id,'local');
  assert.equal(Object.keys(h.remote.get(monthPath).dailyRecords).length,0);
});
test('deleting a previously observed cloud node never silently resurrects it',async()=>{
  const h=harness();await h.context.RezaOT_sync.startMonth();h.emit(monthPath,{dailyRecords:record()});h.emit(monthPath,null);
  await h.context.RezaOT_sync.flush();assert.equal(h.remote.get(monthPath),null);assert.equal(h.writes.length,0);
  const conflict=h.context.RezaOT_sync.getConflicts()[0];assert.equal(conflict.reason,'remote-node-deleted');
  await h.context.RezaOT_sync.resolveConflict(conflict.id,'remote');
  assert.equal(Object.keys(h.context.RezaOT_state.dailyRecords).length,0);assert.equal(h.context.RezaOT_sync.getConflicts().length,0);
});
test('a failed month-index acknowledgement retains the durable write for retry',async()=>{
  const h=harness();let fail=true;h.setHook((key)=>{if(key.includes('/_meta/months/')&&fail)throw new Error('permission denied');});
  h.context.RezaOT_state.dailyRecords=record();await h.context.RezaOT_sync.saveMonth();
  assert.equal(h.context.getOfflineQueue().length,1);assert.ok(h.remote.get(monthPath));
  fail=false;await h.context.RezaOT_sync.flush();
  assert.equal(h.context.getOfflineQueue().length,0);assert.equal(h.remote.get('users/default/_meta/months/Oktober 2026'),true);
});
test('connection status distinguishes an SDK instance from a connected acknowledged database',async()=>{
  const h=harness();await h.context.RezaOT_sync.startMonth();assert.equal(h.context.__rezaotSyncState,'syncing');
  h.emit(monthPath,{dailyRecords:record()});assert.equal(h.context.__rezaotSyncState,'online');
  h.callbacks.get('.info/connected')({val:()=>false});assert.equal(h.context.__rezaotSyncState,'offline');
  assert.equal(h.context.RezaOT_sync.isReady(),false);assert.equal(h.context.RezaOT_sync.getDiagnostics().connected,false);
});
test('import while signed out prepares durable owner-safe dirty state without cloud writes',()=>{
  const h=harness(),state={approved:false};authenticated(h,state);h.data.set('rezaot_auth_data_owner','owner-a');
  const prepared=h.context.RezaOT_sync.prepareImport({months:{'Oktober 2026':record()},settings:{supervisorName:'Updated'}});
  assert.equal(prepared.rezaot_local_dirty.length,2);assert.equal(prepared.rezaot_offline_queue,undefined);
  assert.ok(prepared.rezaot_local_dirty.every(v=>v.owner==='users/owner-a'));assert.equal(h.writes.length,0);
});

test('an in-progress conflict choice cannot discard a newer local save',async()=>{
  const h=harness();h.context.navigator.onLine=false;
  h.context.RezaOT_state.dailyRecords=record('21:00');h.context.RezaOT_sync.saveMonth();
  h.remote.set(monthPath,{dailyRecords:record('17:00')});h.context.navigator.onLine=true;await h.context.RezaOT_sync.flush();
  const conflict=h.context.RezaOT_sync.getConflicts()[0];let release;
  h.onceHook(()=>new Promise(resolve=>{release=resolve;}));
  const resolving=h.context.RezaOT_sync.resolveConflict(conflict.id,'remote');await tick();
  h.context.navigator.onLine=false;h.context.RezaOT_state.dailyRecords=record('23:00');h.context.RezaOT_sync.saveMonth();
  release();await assert.rejects(resolving,/Rekod telah berubah/);
  assert.equal(h.context.RezaOT_state.dailyRecords['2026-10-19'].clock_out,'23:00');
  assert.equal(h.context.getOfflineQueue()[0].data.dailyRecords['2026-10-19'].clock_out,'23:00');
});

test('RTDB omitted empty holiday maps clear old local maps and valid month snapshots still load',async()=>{
  const h=harness();await h.context.RezaOT_sync.startMonth();
  h.emit('users/default/settings',{supervisorName:'Cloud',observedHolidays:{'2026-10-19':false},customHolidays:{'2026-10-19':'Company'}});
  const saved=snapshot(h.context,3100);delete saved.observedHolidays;delete saved.customHolidays;
  h.emit('users/default/settings',{supervisorName:'Cloud',monthSettings:{'Oktober 2026':saved}});
  assert.deepEqual(JSON.parse(h.data.get('observedHolidays')),{});
  assert.deepEqual(JSON.parse(h.data.get('customHolidays')),{});
  assert.equal(JSON.parse(h.data.get('monthSettings'))['Oktober 2026'].salarySettings.basicSalary,3100);
  assert.deepEqual(JSON.parse(h.data.get('monthSettings'))['Oktober 2026'].observedHolidays,{});
  assert.equal(h.context.RezaOT_sync.getConflicts().length,0);
});

test('a pending no-op cannot resurrect a cloud node removed since its baseline',async()=>{
  const h=harness();await h.context.RezaOT_sync.startMonth();h.emit(monthPath,{dailyRecords:record()});
  h.context.navigator.onLine=false;h.context.RezaOT_sync.saveMonth();h.remote.set(monthPath,null);
  h.context.navigator.onLine=true;await h.context.RezaOT_sync.flush();
  assert.equal(h.remote.get(monthPath),null);assert.equal(h.context.RezaOT_sync.getConflicts().length,1);
  assert.equal(h.writes.length,0);
});

test('an explicit tombstone requires a choice even without a known baseline',async()=>{
  const h=harness();h.context.navigator.onLine=false;h.context.RezaOT_state.dailyRecords=record('21:00');h.context.RezaOT_sync.saveMonth();
  h.remote.set(monthPath,{deleted:true});h.context.navigator.onLine=true;await h.context.RezaOT_sync.flush();
  assert.equal(h.remote.get(monthPath).deleted,true);assert.equal(h.writes.length,0);
  const conflict=h.context.RezaOT_sync.getConflicts()[0];assert.ok(conflict);
  await h.context.RezaOT_sync.resolveConflict(conflict.id,'local');
  assert.equal(h.remote.get(monthPath).dailyRecords['2026-10-19'].clock_out,'21:00');
  assert.equal(h.context.RezaOT_sync.getConflicts().length,0);assert.equal(h.context.getOfflineQueue().length,0);
});

test('an initial tombstone snapshot preserves visible local records for a decision',async()=>{
  const h=harness();h.context.RezaOT_state.dailyRecords=record('21:00');await h.context.RezaOT_sync.startMonth();
  h.emit(monthPath,{deleted:true});await h.context.RezaOT_sync.flush();
  assert.equal(h.context.RezaOT_state.dailyRecords['2026-10-19'].clock_out,'21:00');
  assert.equal(h.remote.get(monthPath).deleted,true);assert.equal(h.writes.length,0);
  assert.equal(h.context.RezaOT_sync.getConflicts().length,1);
});

test('accepting deleted cloud settings resets local settings without re-seeding the node',async()=>{
  const h=harness();await h.context.RezaOT_sync.startMonth();
  h.emit('users/default/settings',{supervisorName:'Old',observedHolidays:{'2026-10-19':false},customHolidays:{'2026-10-19':'Company'}});
  h.emit('users/default/settings',null);
  await h.context.RezaOT_sync.resolveConflict(h.context.RezaOT_sync.getConflicts()[0].id,'remote');
  assert.equal(h.data.get('supervisorName'),'Talib');assert.deepEqual(JSON.parse(h.data.get('customHolidays')),{});
  h.emit('users/default/settings',null);await h.context.RezaOT_sync.flush();
  assert.equal(h.remote.get('users/default/settings'),null);assert.equal(h.context.getOfflineQueue().length,0);assert.equal(h.writes.length,0);
});

test('new snapshots cannot overwrite local data awaiting a conflict choice',async()=>{
  const h=harness();await h.context.RezaOT_sync.startMonth();h.emit(monthPath,{dailyRecords:record('21:00')});
  h.emit(monthPath,null);const first=h.context.RezaOT_sync.getConflicts()[0];
  const copies=h.context.RezaOT_storage.recoveryEntries().length;
  h.emit(monthPath,null);
  assert.equal(h.context.RezaOT_sync.getConflicts()[0].id,first.id);assert.equal(h.context.RezaOT_storage.recoveryEntries().length,copies);
  h.emit(monthPath,{dailyRecords:record('17:00')});
  assert.equal(h.context.RezaOT_state.dailyRecords['2026-10-19'].clock_out,'21:00');
  assert.equal(h.context.RezaOT_sync.getConflicts()[0].remote.dailyRecords['2026-10-19'].clock_out,'17:00');
});

test('UID disagreement cannot subscribe to the database root or bind unowned dirty data',async()=>{
  const h=harness(),state={approved:false};authenticated(h,state);
  h.context.RezaOT_state.dailyRecords=record();await h.context.RezaOT_sync.saveMonth();
  state.approved=true;h.context.RezaOT_auth.uid=()=> 'a-different-owner';
  await h.context.RezaOT_sync.startMonth();
  assert.equal(h.context.getOfflineQueue().length,0);assert.equal(h.callbacks.size,0);
  assert.equal(JSON.parse(h.data.get('rezaot_local_dirty'))[0].owner,null);assert.equal(h.writes.length,0);
});

test('a stale connection callback cannot overwrite the reconnected SDK state',async()=>{
  const h=harness();await h.context.RezaOT_sync.startMonth();const old=h.callbacks.get('.info/connected');
  await h.context.RezaOT_sync.reconnect();assert.equal(h.context.RezaOT_sync.getDiagnostics().connected,true);
  old({val:()=>false});assert.equal(h.context.RezaOT_sync.getDiagnostics().connected,true);
});
