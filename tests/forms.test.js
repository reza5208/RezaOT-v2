const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function app() {
  const elements = {};
  for (const id of ['date','clockIn','clockOut','unpaidLeaveCheck','annualLeaveCheck','clockForm','tripForm','destination','airwayBill','airwayBillField','supervisorName']) elements[id] = { value:'', checked:false, style:{}, querySelector:()=>({disabled:false}) };
  elements.date.value='2026-10-19'; elements.clockIn.value='08:00';elements.clockOut.value='19:00';elements.supervisorName.textContent='Talib';
  const state = {currentMonthKey:'Oktober 2026',dailyRecords:{},trips:['KLIA Cargo'], elements, saves:0,toasts:[],confirmAnswer:true,radio:{value:''}};
  Object.assign(state, { console, Event, setTimeout, clearTimeout, Date, Promise,
    document:{getElementById:(id)=>elements[id] || null,querySelector:()=>state.radio,querySelectorAll:()=>[],dispatchEvent:()=>{}},
    navigator:{onLine:true},localStorage:{getItem:()=>null},
    rezaotConfirm:()=>Promise.resolve(state.confirmAnswer),rezaotPrompt:()=>Promise.resolve(state.promptAnswer),
    showToast:(message)=>state.toasts.push(message),saveToLocalStorage:()=>state.saves++,
    calculateOT:()=>9,RezaOT_recordOT:(_date,record)=>record.unpaid||record.annual?0:9,
    formatDateForPDF:(date)=>date,formatTime:(time)=>time,updateHolidayBadge:()=>{},isPublicHoliday:()=>false,
  });
  state.window=state; vm.createContext(state);vm.runInContext(source('model.js'),state);vm.runInContext(source('main-app-2.js'),state);
  state.updateReport=()=>{};
  return state;
}
const event = () => ({preventDefault(){}});
const plain = (value) => JSON.parse(JSON.stringify(value));
test('ANN and UPL save without clock times and retain their mutually exclusive flags',async()=>{
  for(const type of ['annualLeaveCheck','unpaidLeaveCheck']) {
    const c=app();c.elements[type].checked=true;c.elements.clockIn.value='';c.elements.clockOut.value='';
    assert.equal(await c.handleClockFormSubmit(event()),true);
    assert.equal(c.dailyRecords['2026-10-19'][type==='annualLeaveCheck'?'annual':'unpaid'],true);
    assert.equal(c.saves,1);
  }
});
test('attendance and trips reject a date outside the selected month',async()=>{
  const c=app();c.elements.date.value='2026-09-15';c.elements.destination.value='KLIA Cargo';
  assert.equal(await c.handleClockFormSubmit(event()),false);assert.equal(await c.handleTripFormSubmit(event()),false);
  assert.equal(c.saves,0);assert.deepEqual(plain(c.dailyRecords),{});
});
test('cancelled duplicate AWB cannot change existing side jobs or add a trip',async()=>{
  const c=app();c.dailyRecords['2026-10-19']={clock_in:'08:00',clock_out:'19:00',trips:['KLIA Cargo (ABC) *'],sideJobs:[{awb:'ABC',type:'susun'}]};
  c.elements.destination.value='KLIA Cargo';c.elements.airwayBill.value='ABC';c.radio.value='pallets';c.confirmAnswer=false;
  const before=JSON.stringify(c.dailyRecords);
  assert.equal(await c.handleTripFormSubmit(event()),false);assert.equal(JSON.stringify(c.dailyRecords),before);assert.equal(c.saves,0);
});
test('confirmed trip deletion removes its side income and preserves stable remaining identity',async()=>{
  const c=app();c.dailyRecords['2026-10-19']=c.RezaOT_model.normalizeRecord({trips:['KLIA Cargo (ABC) *','Shah Alam'],sideJobs:[{awb:'ABC',type:'susun'}]},'2026-10-19');
  const remainingId=c.dailyRecords['2026-10-19'].tripDetails[1].id;
  assert.equal(await c.deleteTrip('2026-10-19',0),true);
  assert.deepEqual(plain(c.dailyRecords['2026-10-19'].sideJobs),[]);
  assert.equal(c.dailyRecords['2026-10-19'].tripDetails[0].id,remainingId);assert.equal(c.saves,1);
});
test('trip edit updates AWB and side job together without changing its ID',async()=>{
  const c=app();c.dailyRecords['2026-10-19']=c.RezaOT_model.normalizeRecord({trips:['KLIA Cargo (ABC) *']},'2026-10-19');
  const id=c.dailyRecords['2026-10-19'].tripDetails[0].id;c.promptAnswer='KLIA Cargo (XYZ) #';
  assert.equal(await c.editTrip('2026-10-19',0),true);
  assert.deepEqual(plain(c.dailyRecords['2026-10-19'].sideJobs),[{awb:'XYZ',type:'pallets'}]);assert.equal(c.dailyRecords['2026-10-19'].tripDetails[0].id,id);
});
test('modal confirmation cannot mutate a different month or a concurrently changed record',async()=>{
  for (const change of [c=>c.currentMonthKey='September 2026',c=>c.dailyRecords['2026-10-19'].trips.push('Other')]) {
    const c=app();c.dailyRecords['2026-10-19']={trips:['KLIA Cargo (ABC) *']};let resolve;
    c.rezaotConfirm=()=>new Promise(r=>{resolve=r});const result=c.deleteTrip('2026-10-19',0);
    change(c);resolve(true);assert.equal(await result,false);assert.equal(c.saves,0);assert.equal(c.dailyRecords['2026-10-19'].trips[0],'KLIA Cargo (ABC) *');
  }
});
test('first Excel export loads its own library, retains side marks and uses leave-aware OT',async()=>{
  const c=app();let loads=0,written;
  c.dailyRecords={'2026-10-18':{annual:true,clock_in:'08:00',clock_out:'17:00',trips:[]},'2026-10-19':{trips:['KLIA Cargo (ABC) *']}};
  c.loadExcelLib=async()=>{loads++;c.XLSX={utils:{book_new:()=>({}),aoa_to_sheet:(rows)=>({rows}),book_append_sheet:(_book,sheet)=>{written=sheet.rows}},writeFile:()=>{}}};
  assert.equal(await c.exportToExcel(),true);assert.equal(loads,1);
  assert.equal(written[6][7],0);assert.equal(written[7][2],'KLIA Cargo *');assert.equal(written[7][3],'ABC');
});
test('record model rejects year ranges unsupported by payroll and date inputs',()=>{
  const c=app();
  assert.equal(c.RezaOT_model.validDate('0099-01-01'),false);
  assert.equal(c.RezaOT_model.validDate('1899-12-31'),false);
  assert.equal(c.RezaOT_model.validDate('1900-01-01'),true);
  assert.throws(()=>c.RezaOT_model.validateMonthKey('Januari 0099'));
});
test('malicious legacy trip IDs cannot produce duplicate stable identifiers',()=>{
  const c=app();const date='2026-10-19';
  const first=c.RezaOT_model.normalizeRecord({trips:['A','B']},date);
  const collision=first.tripDetails[1].id;
  first.tripDetails[0].id=collision;
  const normalized=c.RezaOT_model.normalizeRecord(first,date);
  assert.notEqual(normalized.tripDetails[0].id,normalized.tripDetails[1].id);
});
test('legacy marker-only labels and oversized AWBs cannot create self-invalidating records',()=>{
  const c=app();
  assert.throws(()=>c.RezaOT_model.normalizeRecord({trips:['*']},'2026-10-19'));
  assert.throws(()=>c.RezaOT_model.normalizeRecord({trips:['KLIA Cargo ('+'A'.repeat(201)+') *']},'2026-10-19'));
});
