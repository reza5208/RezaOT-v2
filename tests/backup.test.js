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
  vm.createContext(c);for(const file of ['model.js','backup.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
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
