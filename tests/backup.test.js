const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function app() {
  const values = new Map();const storage={get length(){return values.size},key:(index)=>Array.from(values.keys())[index]||null,getItem:(key)=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:(key)=>values.delete(key)};
  const c={console,Date,Map,Set,localStorage:storage,currentMonthKey:'Oktober 2026',dailyRecords:{},trips:['KLIA Cargo'],queued:[],archives:[],values};
  c.window=c;c.RezaOT_storage={archive:(reason,data)=>{c.archives.push({reason,data});return 'recovery-key'},transaction:(entries)=>{for(const [key,value]of Object.entries(entries))storage.setItem(key,typeof value==='string'?value:JSON.stringify(value))}};
  c.RezaOT_sync={saveMonth:(month,records)=>c.queued.push({month,records}),tripsChanged:()=>{},settingsChanged:()=>{}};
  vm.createContext(c);for(const file of ['model.js','improvements-model.js','backup.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  return c;
}
const record=(trips=[])=>({clock_in:'08:00',clock_out:'19:00',trips});
const plain=(value)=>JSON.parse(JSON.stringify(value));
test('backup includes every retained month, active state and settings without PIN secrets',()=>{
  const c=app();c.localStorage.setItem('dailyRecords_September 2026',JSON.stringify({'2026-09-15':record()}));c.dailyRecords={'2026-10-19':record(['KLIA Cargo (ABC) *'])};
  c.localStorage.setItem('supervisorName','Talib');c.localStorage.setItem('observedHolidays',JSON.stringify({'2026-10-19':true}));c.localStorage.setItem('rezaot_pin','1234');
  const data=c.RezaOT_backup.create();assert.equal(data.schemaVersion,2);assert.equal(Object.keys(data.months).length,2);assert.equal(data.settings.supervisorName,'Talib');assert.equal(data.settings.rezaot_pin,undefined);
  assert.equal(c.RezaOT_backup.parse(JSON.stringify(data)).months['Oktober 2026']['2026-10-19'].sideJobs[0].type,'susun');
});
test('invalid schema, impossible dates and wrong source month fail before writes',()=>{
  const c=app();
  for(const input of [
    {month:'Oktober 2026',dailyRecords:{'2026-10-19':{trips:'oops'}}},
    {month:'Februari 2026',dailyRecords:{'2026-02-30':record()}},
    {month:'Oktober 2026',dailyRecords:{'2026-09-15':record()}},
    {schemaVersion:3,months:{}},
    {schemaVersion:2,months:{},settings:{salarySettings:{hoursPerMonth:0}}}
  ])assert.throws(()=>c.RezaOT_backup.apply(input,'replace'));
  assert.equal(c.values.size,0);assert.equal(c.archives.length,0);
});
test('legacy backup restores into source month and leaves unrelated active month untouched',()=>{
  const c=app();c.dailyRecords={'2026-10-19':record(['Other'])};c.localStorage.setItem('dailyRecords_Oktober 2026',JSON.stringify(c.dailyRecords));
  c.RezaOT_backup.apply({month:'September 2026',dailyRecords:{'2026-09-15':record()}},'replace');
  assert.deepEqual(Object.keys(JSON.parse(c.localStorage.getItem('dailyRecords_Oktober 2026'))),['2026-10-19']);
  assert.deepEqual(Object.keys(JSON.parse(c.localStorage.getItem('dailyRecords_September 2026'))),['2026-09-15']);assert.equal(c.archives.length,1);assert.equal(c.queued[0].month,'September 2026');
});
test('merge preserves other dates while replacing matching imported dates; replace affects listed months only',()=>{
  for(const mode of ['merge','replace']){
    const c=app();c.localStorage.setItem('dailyRecords_Oktober 2026',JSON.stringify({'2026-10-18':record(),'2026-10-19':record(['Old'])}));
    c.RezaOT_backup.apply({schemaVersion:2,months:{'Oktober 2026':{'2026-10-19':record(['New'])}},settings:{}},mode);
    const stored=JSON.parse(c.localStorage.getItem('dailyRecords_Oktober 2026'));
    assert.equal(Object.keys(stored).length,mode==='merge'?2:1);assert.equal(stored['2026-10-19'].trips[0],'New');
  }
});
test('transaction failure does not replace active state or queue partial imports',()=>{
  const c=app();c.dailyRecords={'2026-10-19':record(['Current'])};c.RezaOT_storage.transaction=()=>{throw new Error('quota')};
  assert.throws(()=>c.RezaOT_backup.apply({month:'Oktober 2026',dailyRecords:{'2026-10-20':record()}},'replace'),/quota/);
  assert.deepEqual(Object.keys(c.dailyRecords),['2026-10-19']);assert.equal(c.queued.length,0);assert.equal(c.archives.length,1);
});
test('incomplete or recursively nested monthly snapshots fail before archiving or persisting',()=>{
  const c=app();
  for (const snapshot of [
    {},
    {otSettings:{weekdayAfter:'17:00',saturdayAfter:'14:00'},salarySettings:{},observedHolidays:{},capturedAt:'invalid'},
    {otSettings:{weekdayAfter:'17:00',saturdayAfter:'14:00'},salarySettings:{},observedHolidays:{},capturedAt:'2026-10-19T00:00:00Z',monthSettings:{}}
  ]) assert.throws(()=>c.RezaOT_backup.apply({schemaVersion:2,months:{},settings:{monthSettings:{'Oktober 2026':snapshot}}},'replace'));
  assert.equal(c.values.size,0);assert.equal(c.archives.length,0);
});
test('import commits prepared queue and records in one transaction before flushing',()=>{
  const c=app();let flushed=0;
  c.RezaOT_sync.prepareImport=({months,trips,settings})=>{
    assert.equal(months['Oktober 2026']['2026-10-19'].trips[0],'New');
    assert.equal(trips[0],'New');assert.equal(settings.supervisorName,'New supervisor');
    return {rezaot_offline_queue:[{path:'users/default/Oktober 2026',revision:'r1'}]};
  };
  c.RezaOT_sync.flush=()=>{flushed++;assert.ok(c.localStorage.getItem('dailyRecords_Oktober 2026'));assert.ok(c.localStorage.getItem('rezaot_offline_queue'));};
  c.RezaOT_backup.apply({schemaVersion:2,months:{'Oktober 2026':{'2026-10-19':record(['New'])}},trips:['New'],settings:{supervisorName:'New supervisor'}},'replace');
  assert.equal(flushed,1);assert.equal(c.queued.length,0);
});
test('queue preparation failure leaves original state untouched',()=>{
  const c=app();c.dailyRecords={'2026-10-19':record(['Current'])};
  c.RezaOT_sync.prepareImport=()=>{throw new Error('queue quota')};
  assert.throws(()=>c.RezaOT_backup.apply({month:'Oktober 2026',dailyRecords:{'2026-10-20':record()}},'replace'),/queue quota/);
  assert.deepEqual(Object.keys(c.dailyRecords),['2026-10-19']);assert.equal(c.values.size,0);
});
test('system and legacy theme preferences round-trip while invalid imports stay atomic',()=>{
  for(const value of ['system','0','1']){
    const c=app();
    c.localStorage.setItem('darkMode',value);
    const backup=c.RezaOT_backup.create();
    assert.equal(backup.settings.darkMode,value);
    assert.equal(c.RezaOT_backup.parse(backup).settings.darkMode,value);
    c.localStorage.setItem('darkMode',value==='0'?'1':'0');
    let applied=0;
    c.RezaOT_theme={apply(){applied++;assert.equal(c.localStorage.getItem('darkMode'),value);}};
    c.RezaOT_backup.apply({schemaVersion:2,months:{},settings:{darkMode:value}},'merge');
    assert.equal(c.localStorage.getItem('darkMode'),value);
    assert.equal(applied,1,'Apply the imported preference after its transaction commits');
  }
  for(const value of ['dark','light','auto',null,1]){
    const c=app();
    assert.throws(()=>c.RezaOT_backup.apply({schemaVersion:2,months:{},settings:{darkMode:value}},'merge'));
    assert.equal(c.values.size,0);assert.equal(c.archives.length,0);
  }
});

test('backup includes offline sync evidence but excludes PIN and Firebase authentication secrets',()=>{
  const c=app();
  const state={
    pending:[{path:'users/owner-uid/Oktober 2026',revision:'queued-revision',data:{dailyRecords:{'2026-10-19':record()}}}],
    dirty:[{owner:'owner-uid',target:'Oktober 2026',revision:'dirty-revision',data:{dailyRecords:{'2026-10-20':record()}}}],
    conflicts:[{id:'conflict-1',owner:'owner-uid',path:'users/owner-uid/Oktober 2026',local:{dailyRecords:{'2026-10-19':record(['Local'])}},remote:{dailyRecords:{'2026-10-19':record(['Remote'])}}}]
  };
  c.localStorage.setItem('rezaot_offline_queue',JSON.stringify(state.pending));
  c.localStorage.setItem('rezaot_local_dirty',JSON.stringify(state.dirty));
  c.localStorage.setItem('rezaot_sync_conflicts',JSON.stringify(state.conflicts));
  c.localStorage.setItem('rezaot_pin','secret-pin');
  c.localStorage.setItem('firebase:authUser:test-api-key:[DEFAULT]',JSON.stringify({stsTokenManager:{accessToken:'secret-access-token',refreshToken:'secret-refresh-token'}}));
  const backup=c.RezaOT_backup.create();
  assert.deepEqual(plain(backup.syncState),{version:1,...state});
  const serialized=JSON.stringify(backup);
  for(const secret of ['secret-pin','secret-access-token','secret-refresh-token','stsTokenManager'])assert.equal(serialized.includes(secret),false);
});

test('import ignores exported owner paths, raw queues and authentication fields instead of replaying them',()=>{
  const c=app();
  const currentQueue=[{path:'users/current-owner/September 2026',revision:'existing-revision'}];
  c.localStorage.setItem('rezaot_offline_queue',JSON.stringify(currentQueue));
  c.localStorage.setItem('rezaot_auth_data_owner','current-owner');
  const incoming={schemaVersion:2,months:{'Oktober 2026':{'2026-10-19':record(['Imported'])}},settings:{rezaot_pin:'attacker-pin',rezaot_auth_data_owner:'foreign-owner'},
    syncState:{version:1,pending:[{path:'users/foreign-owner/settings',data:{supervisorName:'Foreign'}}],dirty:[{owner:'foreign-owner',target:'settings'}],conflicts:[{id:'foreign-conflict'}]},
    'firebase:authUser:test-api-key:[DEFAULT]':{stsTokenManager:{accessToken:'foreign-token'}}};
  const parsed=c.RezaOT_backup.parse(incoming);
  assert.equal(parsed.syncState,undefined);
  assert.deepEqual(plain(parsed.settings),{});
  c.RezaOT_backup.apply(incoming,'replace');
  assert.deepEqual(JSON.parse(c.localStorage.getItem('rezaot_offline_queue')),currentQueue);
  assert.equal(c.localStorage.getItem('rezaot_auth_data_owner'),'current-owner');
  for(const key of ['rezaot_local_dirty','rezaot_sync_conflicts','rezaot_pin','firebase:authUser:test-api-key:[DEFAULT]'])assert.equal(c.localStorage.getItem(key),null);
  assert.equal(c.queued.length,1);
  assert.equal(c.queued[0].month,'Oktober 2026');
  assert.equal(c.queued[0].records['2026-10-19'].trips[0],'Imported');
});

test('malformed sync evidence prevents incomplete backups and leaves import data untouched',()=>{
  for(const key of ['rezaot_offline_queue','rezaot_local_dirty','rezaot_sync_conflicts']){
    const c=app();
    c.localStorage.setItem(key,'{}');
    c.dailyRecords={'2026-10-19':record(['Current'])};
    const before=Array.from(c.values.entries());
    assert.throws(()=>c.RezaOT_backup.create(),/Sync state/);
    assert.throws(()=>c.RezaOT_backup.apply({schemaVersion:2,months:{'Oktober 2026':{'2026-10-20':record()}},settings:{}},'replace'),/Sync state/);
    assert.deepEqual(Array.from(c.values.entries()),before);
    assert.equal(c.archives.length,0);
    assert.equal(c.queued.length,0);
    assert.deepEqual(Object.keys(c.dailyRecords),['2026-10-19']);
  }
});

test('private payslip and favorites restore through validated backup without erasing other months on merge',()=>{
 const c=app();c.localStorage.setItem('rezaot_payroll',JSON.stringify({'2026-10':{net:3000,side:0,note:''}}));
 c.localStorage.setItem('rezaot_favorites',JSON.stringify({destinations:['A']}));
 c.RezaOT_backup.apply({app:'RezaOT',schemaVersion:2,months:{},settings:{rezaot_payroll:{'2026-11':{net:3200,side:100,note:'test'}},rezaot_favorites:{destinations:['B']}}},'merge');
 const out=c.RezaOT_backup.create();assert.equal(Object.keys(out.settings.rezaot_payroll).length,2);assert.deepEqual(plain(out.settings.rezaot_favorites.destinations),['A','B']);
 assert.throws(()=>c.RezaOT_backup.apply({schemaVersion:2,months:{},settings:{rezaot_payroll:{'2026-11':{net:-1,side:0,note:''}}}},'merge'));
});
