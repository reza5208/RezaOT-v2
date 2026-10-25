'use strict';
// Generate repeated RTDB validation branches from one auditable schema.
const fs = require('node:fs');
const path = require('node:path');
const target = path.resolve(__dirname, '../database.rules.example.json');
const months = ['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
const year = '(19|[2-9][0-9])[0-9]{2}';
const monthPattern = `^(${months.join('|')}) ${year}$`;
const ordinaryDate = `^${year}-((01|03|05|07|08|10|12)-(0[1-9]|[12][0-9]|3[01])|(04|06|09|11)-(0[1-9]|[12][0-9]|30)|02-(0[1-9]|1[0-9]|2[0-8]))$`;
const leapDate = '^((19|[2-9][0-9])(0[48]|[2468][048]|[13579][26])|(20|24|28|32|36|40|44|48|52|56|60|64|68|72|76|80|84|88|92|96)00)-02-29$';
const validDate = key => `(${key}.matches(/${ordinaryDate}/) || ${key}.matches(/${leapDate}/))`;
const validMonth = key => `${key}.matches(/${monthPattern}/)`;
const inMonth = (key,month) => '(' + months.map((name,index)=>`(${month}.beginsWith('${name} ') && ${key}.beginsWith(${month}.replace('${name} ', '') + '-${String(index+1).padStart(2,'0')}-'))`).join(' || ') + ')';
const string = (max,empty=true) => `newData.isString() && newData.val().length <= ${max}${empty ? '' : " && newData.val().matches(/.*[^ \\t\\r\\n].*/)"}`;
const field = validate => ({'.validate':validate});
const rejectOther = { '$other': { '.validate':false } };
const strict = (values,validate) => Object.assign(validate ? {'.validate':validate} : {}, values, rejectOther);
const number = (min,max) => field(`newData.isNumber() && newData.val() >= ${min} && newData.val() <= ${max}`);
const time = field("newData.isString() && (newData.val() === '' || newData.val().matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/))");
const clock = field("newData.isString() && newData.val().matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)");
const iso = field("newData.isString() && newData.val().matches(/^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]{1,3})?Z$/)");
const metadata = () => ({revision:field(string(200,false)),deviceId:field(string(200,false)),lastUpdated:iso,lastUpdatedServer:field('newData.isNumber() && newData.val() >= 0 && newData.val() <= now + 1000')});
// RTDB omits empty lists/maps. Do not require these optional collection nodes.
const list = item => ({'$index':Object.assign({'.validate':"$index.matches(/^(0|[1-9][0-9]{0,2}|[1-4][0-9]{3})$/)"},item,{'.validate':`$index.matches(/^(0|[1-9][0-9]{0,2}|[1-4][0-9]{3})$/) && (${item['.validate'] || 'true'})`})});
const destinations = () => list(field(string(500,false)));
const holidays = custom => ({'$day':field(`${validDate('$day')} && ${custom ? string(200,false) : 'newData.isBoolean()'}`)});
const otSettings = () => strict({weekdayAfter:clock,saturdayAfter:clock,weekdayStart:clock,saturdayStart:clock},"(newData.hasChildren(['weekdayAfter', 'saturdayAfter']) || newData.hasChildren(['weekdayStart', 'saturdayStart'])) && (!newData.hasChild('weekdayAfter') || !newData.hasChild('weekdayStart') || newData.child('weekdayAfter').val() === newData.child('weekdayStart').val()) && (!newData.hasChild('saturdayAfter') || !newData.hasChild('saturdayStart') || newData.child('saturdayAfter').val() === newData.child('saturdayStart').val())");
const salary = () => strict({
  basicSalary:number(0,100000000),hoursPerMonth:field('newData.isNumber() && newData.val() > 0 && newData.val() <= 744'),
  kliaPerDay:number(0,100000000),epfEmployeeRate:number(0,1),epfEmployerRate:number(0,1),
  weekdayMult:number(0,10),restMult:number(0,10),phMult:number(0,10),uplDivisor:number(1,366),
  socso:number(0,100000000),eis:number(0,100000000),skim:number(0,100000000),restBreakHours:number(0,24),_v:number(0,1000000)
});
const snapshot = () => strict({otSettings:otSettings(),salarySettings:salary(),observedHolidays:holidays(false),customHolidays:holidays(true),capturedAt:iso},"newData.hasChildren(['otSettings', 'salarySettings', 'capturedAt'])");
const job = () => strict({awb:field(string(200,false)),type:field("newData.val() === 'susun' || newData.val() === 'pallets'")},"newData.hasChildren(['awb', 'type'])");
const detail = () => strict({id:field(string(200,false)),label:field(string(1000,false)),awb:field(string(200)),sideJob:field("newData.val() === '' || newData.val() === 'susun' || newData.val() === 'pallets'")},"newData.hasChildren(['id', 'label', 'awb', 'sideJob']) && (newData.child('sideJob').val() === '' || newData.child('awb').val().length > 0) && newData.parent().parent().child('trips').child($index).val() === newData.child('label').val() + (newData.child('sideJob').val() === 'susun' ? ' *' : newData.child('sideJob').val() === 'pallets' ? ' #' : '')");
const record = () => strict({clock_in:time,clock_out:time,unpaid:field('newData.isBoolean()'),annual:field('newData.isBoolean()'),trips:list(field(string(1000,false))),tripDetails:list(detail()),sideJobs:list(job())},"newData.hasChildren(['clock_in', 'clock_out']) && !(newData.child('unpaid').val() === true && newData.child('annual').val() === true)");
const month = () => strict(Object.assign(metadata(),{dailyRecords:{'$day':Object.assign({'.validate':`${validDate('$day')} && ${inMonth('$day','$month')}`},record(),{'.validate':`${validDate('$day')} && ${inMonth('$day','$month')} && (${record()['.validate']})`})},trips:destinations(),deleted:field('newData.val() === true')}),`${validMonth('$month')} && (newData.hasChild('dailyRecords') || newData.hasChild('revision') || newData.child('deleted').val() === true) && (newData.child('deleted').val() !== true || !newData.hasChild('dailyRecords'))`);
const settings = () => strict(Object.assign(metadata(),{supervisorName:field(string(200)),otSettings:otSettings(),salarySettings:salary(),observedHolidays:holidays(false),customHolidays:holidays(true),monthSettings:{'$snapshotMonth':Object.assign({'.validate':validMonth('$snapshotMonth')},snapshot(),{'.validate':`${validMonth('$snapshotMonth')} && (${snapshot()['.validate']})`})}}),"newData.hasChild('supervisorName') || newData.hasChild('otSettings') || newData.hasChild('salarySettings') || newData.hasChild('observedHolidays') || newData.hasChild('customHolidays') || newData.hasChild('monthSettings')");
const allowed = "auth != null && auth.uid === $uid && $uid !== 'default' && auth.token.rezaot_owner === true";
const document = {rules:{'.read':false,'.write':false,users:{'$uid':{
  '.read':allowed,'.write':`(${allowed}) && newData.exists()`,
  settings:settings(),
  _meta:strict({trips:strict(Object.assign(metadata(),{list:destinations()})),months:{'$month':field(`${validMonth('$month')} && newData.val() === true`)}}),
  '$month':month()
}}}};
const output = JSON.stringify(document,null,2)+'\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target,'utf8') !== output) throw new Error('Rules artifact differs. Run npm --prefix firebase run rules:build.');
  console.log('Rules artifact matches the generated schema.');
} else {
  fs.writeFileSync(target,output);
  console.log('Generated database.rules.example.json');
}
