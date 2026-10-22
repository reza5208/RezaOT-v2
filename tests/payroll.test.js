const test = require('node:test');
const assert = require('node:assert/strict');
const payrollContext = require('./payroll-fixture');

const record = (clock_in = '08:00', clock_out = '19:00', trips = []) => ({ clock_in, clock_out, trips });

test('shared overtime preserves weekday, Saturday, Sunday, overnight and KLIA rules', () => {
  const app = payrollContext();
  for (const [date, entry, expected] of [
    ['2026-10-19', record(), 2],
    ['2026-10-17', record('08:00', '17:00'), 3],
    ['2026-10-18', record('08:00', '17:00'), 9],
    ['2026-10-19', record('08:00', '02:00'), 9],
    ['2026-10-19', record('18:00', '19:00'), 1],
    ['2026-10-19', record('08:00', '08:00'), 0],
    ['2026-10-19', record('08:00', '19:00', ['KLIA Cargo (ABC)']), 0],
    ['2026-10-18', record('08:00', '17:00', ['KLIA Cargo (ABC)']), 9]
  ]) assert.equal(app.RezaOT_recordOT(date, entry), expected, date);
});

test('leave flags produce zero OT in both shared calculation and salary summary', () => {
  const app = payrollContext();
  for (const flag of ['unpaid', 'annual']) {
    const entry = { ...record('08:00', '17:00'), [flag]: true };
    assert.equal(app.RezaOT_recordOT('2026-10-18', entry), 0);
    const result = app.RezaOT_salary.estimate({ '2026-10-18': entry });
    assert.equal(result.summary.otTotal, 0);
    assert.equal(result.deductions.annualDays, flag === 'annual' ? 1 : 0);
    assert.equal(result.deductions.autoUplDays, flag === 'unpaid' ? 1 : 0);
  }
});

test('invalid dates, times and malformed trips never generate NaN overtime', () => {
  const app = payrollContext();
  for (const date of ['2026-02-30', '2026-13-01', 'oops']) {
    assert.equal(app.RezaOT_isValidDate(date), false);
    assert.equal(app.calculateOT('08:00', '19:00', date, []), 0);
  }
  for (const time of ['99:99', '24:00', '08:60', '8:00', 'NaN']) {
    assert.equal(app.RezaOT_isValidTime(time), false);
    assert.equal(app.calculateOT(time, '19:00', '2026-10-19', []), 0);
  }
  assert.equal(app.calculateOT('08:00', '19:00', '2026-10-19', 'bad-array'), 2);
  assert.equal(app.RezaOT_isValidDate('2028-02-29'), true);
});

test('OT settings reject invalid hours and retain valid zero-midnight settings', () => {
  const app = payrollContext();
  assert.throws(() => app.saveOtSettings({ weekdayAfter: '99:99' }), /00:00/);
  assert.equal(app.localStorage.getItem('otSettings'), null);
  app.saveOtSettings({ weekdayAfter: '00:00', saturdayAfter: '14:30' });
  assert.equal(app.RezaOT_recordOT('2026-10-19', record()), 11);
});

test('salary settings permit zero values but reject negative, infinite and zero divisors', () => {
  const app = payrollContext();
  const valid = app.RezaOT_salary.validateSettings({ kliaPerDay: 0, epfEmployeeRate: 0, socso: 0 });
  assert.equal(valid.kliaPerDay, 0);
  assert.equal(valid.epfEmployeeRate, 0);
  for (const invalid of [{ basicSalary: -1 }, { hoursPerMonth: 0 }, { uplDivisor: 0 }, { epfEmployeeRate: 2 }, { kliaPerDay: Infinity }, { socso: NaN }, { skim: '5' }, { restBreakHours: 25 }]) {
    assert.throws(() => app.RezaOT_salary.saveSettings(invalid));
  }
  assert.equal(app.localStorage.getItem('salarySettings'), null);
});

test('salary settings save notifies cloud queue and cancel is atomic', async () => {
  const app = payrollContext();
  let notifications = 0;
  app.RezaOT_sync = { settingsChanged() { notifications++; } };
  app.RezaOT_salary.saveSettings({ kliaPerDay: 0 });
  assert.equal(notifications, 1);
  const before = app.localStorage.getItem('salarySettings');
  const answers = ['3000', null];
  app.prompt = () => answers.shift();
  await app.RezaOT_salary.openSettings();
  assert.equal(app.localStorage.getItem('salarySettings'), before);
  assert.equal(notifications, 1);
});

test('KLIA allowance is once per day and side income only counts sideJobs', () => {
  const app = payrollContext();
  const result = app.RezaOT_salary.estimate({
    '2026-10-19': { ...record(), trips: ['KLIA Cargo (ABC) *', 'KLIA Cargo (DEF) #'] },
    '2026-10-20': { ...record(), trips: ['KLIA Cargo (GHI)'], sideJobs: [{ awb: 'GHI', type: 'susun' }, { awb: 'JKL', type: 'pallets' }] }
  });
  assert.equal(result.kliaAllow, 140);
  assert.equal(result.sideIncome.total, 150);
  assert.equal(result.net, result.gross - result.totalDeduct);
  assert.equal(app.RezaOT_salary.runUnitTest().ok, true);
});

test('month snapshots stay stable after defaults change until explicitly replaced', () => {
  const app = payrollContext();
  const month = 'Oktober 2026';
  assert.equal(app.localStorage.getItem('monthSettings'), null);
  app.getMonthCalculationSettings(month);
  assert.equal(app.localStorage.getItem('monthSettings'), null, 'read must not create snapshot');
  app.captureMonthSettings(month);
  app.saveOtSettings({ weekdayAfter: '18:00', saturdayAfter: '14:00' });
  app.RezaOT_salary.saveSettings({ basicSalary: 5000 });
  const records = { '2026-10-19': record() };
  assert.equal(app.RezaOT_recordOT('2026-10-19', records['2026-10-19']), 2);
  assert.equal(app.RezaOT_salary.estimate(records).settings.basicSalary, 2905.76);
  app.captureMonthSettings(month, { replace: false });
  assert.equal(app.RezaOT_recordOT('2026-10-19', records['2026-10-19']), 2);
  app.captureMonthSettings(month, { replace: true });
  assert.equal(app.RezaOT_recordOT('2026-10-19', records['2026-10-19']), 1);
  assert.equal(app.RezaOT_salary.estimate(records).settings.basicSalary, 5000);
});

test('extra UPL and rest break accept only bounded finite values', () => {
  const app = payrollContext();
  const records = { '2026-10-18': record('08:00', '17:00') };
  for (const days of [-1, Infinity, 32, 'bad']) assert.throws(() => app.RezaOT_salary.estimate(records, { unpaidDays: days }));
  app.RezaOT_salary.saveSettings({ restBreakHours: 1 });
  assert.equal(app.RezaOT_recordOT('2026-10-18', records['2026-10-18']), 8);
  assert.equal(app.RezaOT_salary.estimate(records).summary.otTotal, 8);
});

test('editing defaults freezes retained legacy history before changing its calculation', () => {
  const app = payrollContext({ 'dailyRecords_September 2026': JSON.stringify({ '2026-09-15': record() }) });
  assert.equal(app.localStorage.getItem('monthSettings'), null);
  app.saveOtSettings({ weekdayAfter: '18:00', saturdayAfter: '14:00' });
  assert.equal(app.RezaOT_recordOT('2026-09-15', record()), 2);
  assert.equal(app.RezaOT_recordOT('2026-10-19', record()), 1, 'new month uses edited defaults');
  assert.equal(JSON.parse(app.localStorage.getItem('monthSettings'))['September 2026'].otSettings.weekdayAfter, '17:00');
});
