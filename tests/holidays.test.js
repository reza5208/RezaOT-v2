const test = require('node:test');
const assert = require('node:assert/strict');
const payrollContext = require('./payroll-fixture');

test('catalog holidays are not observed unless explicitly selected', () => {
  const app = payrollContext();
  assert.equal(app.isPublicHoliday('2026-05-01'), false);
  app.setHolidayObserved('2026-05-01', true);
  assert.equal(app.isPublicHoliday('2026-05-01'), true);
  assert.equal(app.RezaOT_recordOT('2026-05-01', { clock_in: '08:00', clock_out: '17:00', trips: ['KLIA Cargo'] }), 9);
  app.setHolidayObserved('2026-05-01', false);
  assert.equal(app.isPublicHoliday('2026-05-01'), false);
});

test('company holidays outside bundled years can be added, renamed and removed', () => {
  const app = payrollContext();
  let notifications = 0;
  app.RezaOT_sync = { settingsChanged() { notifications++; } };
  app.addCustomHoliday('2030-01-02', 'Cuti Company', true);
  assert.equal(app.isCatalogHoliday('2030-01-02'), true);
  assert.equal(app.getHolidayName('2030-01-02'), 'Cuti Company');
  assert.equal(app.isPublicHoliday('2030-01-02'), true);
  assert.ok(app.getAllHolidayDates().includes('2030-01-02'));
  app.addCustomHoliday('2030-01-02', 'Cuti Warehouse', false);
  assert.equal(app.getHolidayName('2030-01-02'), 'Cuti Warehouse');
  assert.equal(app.isPublicHoliday('2030-01-02'), false);
  app.removeCustomHoliday('2030-01-02');
  assert.equal(app.isCatalogHoliday('2030-01-02'), false);
  assert.ok(notifications >= 3);
});

test('invalid company holidays and malformed selection maps do not persist', () => {
  const app = payrollContext();
  for (const [date, name] of [['2026-02-30', 'Cuti'], ['2026-10-19', ''], ['2026-10-19', 'x'.repeat(201)]]) {
    assert.throws(() => app.addCustomHoliday(date, name));
  }
  assert.throws(() => app.saveObservedHolidaysMap({ '2026-10-19': 'true' }));
  assert.throws(() => app.saveCustomHolidaysMap({ '2026-10-19': 1 }));
  assert.equal(app.localStorage.getItem('customHolidays'), null);
});

test('month snapshots preserve observed/custom holiday settings', () => {
  const app = payrollContext();
  app.addCustomHoliday('2026-10-19', 'Company annual day', true);
  app.captureMonthSettings('Oktober 2026');
  app.removeCustomHoliday('2026-10-19');
  assert.equal(app.isPublicHoliday('2026-10-19'), true);
  assert.equal(app.getHolidayName('2026-10-19'), 'Company annual day');
  app.captureMonthSettings('Oktober 2026', { replace: true });
  assert.equal(app.isPublicHoliday('2026-10-19'), false);
});

test('backup snapshot validator rejects invalid nested settings', () => {
  const app = payrollContext();
  const snapshot = JSON.parse(JSON.stringify(app.captureMonthSettings('Oktober 2026')));
  assert.ok(app.RezaOT_validateMonthSettings({ 'Oktober 2026': snapshot }));
  assert.throws(() => app.RezaOT_validateMonthSettings({ 'NotAMonth 2026': snapshot }));
  assert.throws(() => app.RezaOT_validateMonthSettings({ 'Oktober 2026': { ...snapshot, otSettings: { weekdayAfter: '99:99' } } }));
  assert.throws(() => app.RezaOT_validateMonthSettings({ 'Oktober 2026': { ...snapshot, salarySettings: { hoursPerMonth: 0 } } }));
});
