const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const ready = import('../scripts/firebase-migration.mjs');
const CLI = path.resolve(__dirname, '../scripts/firebase-migration.mjs');
const record = (out = '18:00', label = 'Depot') => ({ clock_in: '08:00', clock_out: out, trips: [label] });
const month = (records, extra = {}) => ({ dailyRecords: records, ...extra });
const cloud = () => ({ users: { default: {
  'September 2026': month({ '2026-09-15': record() }),
  'Oktober 2026': month({ '2026-10-19': record(), '2026-10-20': record('17:00', 'KLIA Cargo (TEST-1) *') }),
  settings: { supervisorName: 'Test supervisor', observedHolidays: {}, customHolidays: {}, monthSettings: {} },
  _meta: { trips: { list: ['Depot', 'KLIA Cargo'] }, months: { 'September 2026': true, 'Oktober 2026': true } }
} } });
const device = (records, extra = {}) => ({ schemaVersion: 2, months: { 'Oktober 2026': records }, settings: {}, ...extra });
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rezaot-migration-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, write(name, value) { const file = path.join(root, name);fs.writeFileSync(file, JSON.stringify(value));return file; } };
}
function allChoices(plan, source = 'cloud') {
  return { choices: Object.fromEntries(plan.entries.filter(e => e.reviewRequired).map(e => [e.id, { source }])) };
}

test('inventory includes cloud-only months, normalized trip/side-job counts and stable hashes', async t => {
  const m = await ready, f = fixture(t), full = f.write('cloud.json', cloud());
  const source = m.loadSource(full, 'cloud', 'cloud');
  assert.equal(source.inventory.monthCount, 2);
  assert.equal(source.inventory.recordCount, 3);
  assert.equal(source.inventory.tripCount, 3);
  assert.equal(source.inventory.sideJobCount, 1);
  const subtree = m.loadSource(f.write('subtree.json', cloud().users.default), 'cloud', 'cloud');
  assert.equal(m.compareSources(source, subtree).identical, true);
  assert.equal(source.inventory.months[0].month, 'September 2026');
  assert.match(source.inventory.months[0].sha256, /^[a-f0-9]{64}$/);
});

test('same-date differences and missing days require review; timestamps never select a winner', async t => {
  const m = await ready, f = fixture(t);
  const a = cloud();a.users.default['Oktober 2026'].lastUpdated = '2999-01-01T00:00:00Z';
  const sources = [m.loadSource(f.write('cloud.json', a), 'cloud', 'cloud'),
    m.loadSource(f.write('device.json', device({ '2026-10-19': record('21:00'), '2026-10-21': record() })), 'device', 'device-1')];
  const plan = m.createPlan(sources);
  assert.equal(plan.entries.filter(e => e.reviewRequired).length, 3);
  assert.ok(plan.entries.some(e => e.reason === 'absence_is_not_proof_of_deletion'));
  assert.throws(() => m.buildArtifacts(plan, 'owner-test'), /Unresolved conflicts/);
  assert.equal(plan.monthSources['September 2026'].length, 1, 'Cloud-only history is never treated as a device deletion');
  const choices = allChoices(plan);
  const addition = plan.entries.find(e => e.path[2] === '2026-10-21');
  choices.choices[addition.id] = { source: 'device-1' };
  const artifacts = m.buildArtifacts(plan, 'owner-test', choices);
  assert.equal(artifacts['app-backup.json'].months['Oktober 2026']['2026-10-19'].clock_out, '18:00');
  assert.ok(artifacts['app-backup.json'].months['Oktober 2026']['2026-10-21']);
  assert.ok(artifacts['app-backup.json'].months['September 2026']['2026-09-15']);
  assert.equal(artifacts['manifest.json'].targetPath, 'users/owner-test');
  assert.equal(artifacts['manifest.json'].productionWritten, false);
  assert.deepEqual(Object.keys(artifacts['owner-subtree.json']._meta.months).sort(), ['Oktober 2026', 'September 2026']);
});

test('missing data is not silently interpreted as deletion; explicit deletion needs a reason', async t => {
  const m = await ready, f = fixture(t);
  const plan = m.createPlan([m.loadSource(f.write('cloud.json', cloud()), 'cloud', 'cloud'),
    m.loadSource(f.write('device.json', device({ '2026-10-19': record() })), 'device', 'device-1')]);
  const missing = plan.entries.find(e => e.path[2] === '2026-10-20');
  assert.throws(() => m.buildArtifacts(plan, 'owner-test', { choices: { [missing.id]: { source: 'device-1' } } }), /present source or explicit deletion/);
  assert.throws(() => m.buildArtifacts(plan, 'owner-test', { choices: { [missing.id]: { delete: true } } }), /requires a reason/);
  const artifacts = m.buildArtifacts(plan, 'owner-test', { choices: { [missing.id]: { delete: true, reason: 'Confirmed against signed-off device records' } } });
  assert.equal(artifacts['app-backup.json'].months['Oktober 2026']['2026-10-20'], undefined);
  assert.ok(artifacts['app-backup.json'].months['September 2026']);
});

test('foreign queued namespaces are preserved in quarantine and never rebound to the target UID', async t => {
  const m = await ready, f = fixture(t);
  const pending = [{ path: 'users/another-owner/Oktober 2026', revision: 'q1', data: month({ '2026-10-19': record('23:00') }) }];
  const plan = m.createPlan([m.loadSource(f.write('cloud.json', cloud()), 'cloud', 'cloud'),
    m.loadSource(f.write('device.json', device({ '2026-10-19': record(), '2026-10-20': record('17:00', 'KLIA Cargo (TEST-1) *') },
      { syncState: { version: 1, pending, dirty: [], conflicts: [] } })), 'device', 'device-1')]);
  assert.equal(plan.quarantine[0].disposition, 'foreign_namespace_quarantined_not_imported');
  assert.equal(plan.quarantine[0].candidateSource, null);
  assert.throws(() => m.buildArtifacts(plan, 'owner-test'), /ack-quarantine/);
  const artifacts = m.buildArtifacts(plan, 'owner-test', {}, { acknowledgeQuarantine: true });
  assert.equal(artifacts['quarantine.json'].entries[0].item.path, pending[0].path);
  assert.equal(artifacts['quarantine.json'].replayed, false);
  assert.equal(artifacts['app-backup.json'].months['Oktober 2026']['2026-10-19'].clock_out, '18:00');
  assert.equal(JSON.stringify(artifacts['owner-subtree.json']).includes('another-owner'), false);
});

test('known-owner dirty candidates need explicit review and cannot be copied to another UID', async t => {
  const m = await ready, f = fixture(t);
  const data = device({}, { syncState: { version: 1, pending: [], dirty: [{ target: 'November 2026', owner: 'users/right-owner',
    data: month({ '2026-11-02': record('22:00') }), revision: 'd1', baseKnown: false, base: null }], conflicts: [] } });
  const plan = m.createPlan([m.loadSource(f.write('cloud.json', cloud()), 'cloud', 'cloud'),m.loadSource(f.write('device.json', data), 'device', 'device-1')]);
  const resolutions = allChoices(plan);resolutions.acknowledgeSources = ['device-1:dirty:0'];
  assert.throws(() => m.buildArtifacts(plan, 'other-owner', resolutions, { acknowledgeQuarantine: true }), /owner differs/);
  const artifacts = m.buildArtifacts(plan, 'right-owner', resolutions, { acknowledgeQuarantine: true });
  assert.equal(artifacts['app-backup.json'].months['November 2026']['2026-11-02'].clock_out, '22:00');
  assert.equal(artifacts['quarantine.json'].entries.length, 1);
});

test('legacy pending data can enter review without replaying its path or choosing over current records', async t => {
  const m = await ready, f = fixture(t);
  const data = device({ '2026-10-19': record('21:00'), '2026-10-20': record('17:00', 'KLIA Cargo (TEST-1) *') }, {
    syncState: { version: 1, pending: [{ path: 'users/default/Oktober 2026', revision: 'old-queue', data: month({ '2026-10-19': record('20:00') }) }], dirty: [], conflicts: [] } });
  const plan = m.createPlan([m.loadSource(f.write('cloud.json', cloud()), 'cloud', 'cloud'),m.loadSource(f.write('device.json', data), 'device', 'device-1')]);
  assert.equal(plan.sources.find(s => s.id === 'device-1:pending:0').requiresAcknowledgement, true);
  assert.throws(() => m.buildArtifacts(plan, 'owner-test'), /acknowledge or exclude/);
  const choices = allChoices(plan);choices.acknowledgeSources = ['device-1:pending:0'];
  const change = plan.entries.find(e => e.path[2] === '2026-10-19');choices.choices[change.id] = { source: 'device-1' };
  const artifacts = m.buildArtifacts(plan, 'owner-test', choices, { acknowledgeQuarantine: true });
  assert.equal(artifacts['app-backup.json'].months['Oktober 2026']['2026-10-19'].clock_out, '21:00');
  assert.equal(artifacts['quarantine.json'].entries[0].item.path, 'users/default/Oktober 2026');
});

test('invalid source structures and unknown record fields stop before output creation', async t => {
  const m = await ready, f = fixture(t);
  for (const value of [
    { 'Oktober 2026': month({ '2026-10-19': { ...record(), arbitrary: 'unsupported' } }) },
    { 'Oktober 2026': month({ '2026-09-19': record() }) },
    { settings: { unexpected: 'not silently discarded' } },
    { mystery: { data: 'not silently discarded' } }
  ]) assert.throws(() => m.loadSource(f.write('invalid.json', value), 'cloud', 'cloud'));
  assert.throws(() => m.loadSource(f.write('not-cloud.json', device({})), 'cloud', 'cloud'), /Unsupported cloud node/);
  assert.throws(() => m.loadSource(f.write('unknown-device.json', device({}, { settings: { password: 'synthetic-not-a-credential' } })), 'device', 'device-1'), /Unsupported backup setting/);
  assert.throws(() => m.loadSource(f.write('deleted.json', { 'Oktober 2026': { deleted: true, revision: 'deleted-month' } }), 'cloud', 'cloud'), /separate deletion review/);
});

test('malformed collection values and unknown nested fields are never normalized away', async t => {
  const m = await ready, f = fixture(t);
  for (const value of [false, 0, '']) {
    assert.throws(() => m.loadSource(f.write('bad-records.json', { 'Oktober 2026': { dailyRecords: value } }), 'cloud', 'cloud'), /Invalid records/);
    assert.throws(() => m.loadSource(f.write('bad-list.json', { _meta: { trips: { list: value } } }), 'cloud', 'cloud'), /destinasi/);
  }
  const nested = { ...record(), sideJobs: [{ awb: 'TEST-AWB', type: 'susun', unexpected: 'keep in original source' }] };
  assert.throws(() => m.loadSource(f.write('nested.json', device({ '2026-10-19': nested })), 'device', 'device-1'), /Unsupported sideJobs/);
  assert.throws(() => m.loadSource(f.write('salary.json', device({}, { settings: { salarySettings: { basicSalary: 1000, unknown: 10 } } })), 'device', 'device-1'), /Unsupported settings salary/);
});

test('cloud snapshots recover RTDB-omitted empty holiday maps without changing calculations', async t => {
  const m = await ready, f = fixture(t);
  const value = cloud();value.users.default.settings.monthSettings = { 'Oktober 2026': {
    otSettings: { weekdayAfter: '17:00', saturdayAfter: '13:00' }, salarySettings: { basicSalary: 2000, hoursPerMonth: 208 }, capturedAt: '2026-10-01T00:00:00.000Z'
  } };
  const source = m.loadSource(f.write('cloud.json', value), 'cloud', 'cloud');
  const artifacts = m.buildArtifacts(m.createPlan([source]), 'owner-test');
  const snapshot = artifacts['owner-subtree.json'].settings.monthSettings['Oktober 2026'];
  assert.deepEqual(snapshot.observedHolidays, {});
  assert.deepEqual(snapshot.customHolidays, {});
  assert.equal(snapshot.salarySettings.basicSalary, 2000);
});

test('comparison treats Firebase-omitted empty settings maps as the same approved payload', async t => {
  const m = await ready, f = fixture(t), a = cloud(), b = cloud();
  delete b.users.default.settings.observedHolidays;
  delete b.users.default.settings.customHolidays;
  delete b.users.default.settings.monthSettings;
  assert.equal(m.compareSources(m.loadSource(f.write('explicit.json', a), 'cloud', 'cloud'), m.loadSource(f.write('firebase.json', b), 'cloud', 'firebase')).identical, true);
});

test('settings outside the deployed schema bounds or conflicting OT aliases stop migration', async t => {
  const m = await ready, f = fixture(t);
  for (const salarySettings of [{ hoursPerMonth: 745 }, { uplDivisor: 367 }, { weekdayMult: 11 }, { basicSalary: 100000001 }]) {
    assert.throws(() => m.loadSource(f.write('salary.json', device({}, { settings: { salarySettings } })), 'device', 'device-1'), /outside Firebase schema/);
  }
  assert.throws(() => m.loadSource(f.write('ot.json', device({}, { settings: { otSettings: { weekdayAfter: '17:00', weekdayStart: '18:00', saturdayAfter: '13:00' } } })), 'device', 'device-1'), /Conflicting settings OT aliases/);
});

test('source changes and plan edits are rejected, preserving a reviewable source fingerprint', async t => {
  const m = await ready, f = fixture(t), filename = f.write('cloud.json', cloud());
  const plan = m.createPlan([m.loadSource(filename, 'cloud', 'cloud')]);
  const edited = structuredClone(plan);edited.entries[0].variants[0].value.clock_out = '23:00';
  assert.throws(() => m.buildArtifacts(edited, 'owner-test'), /Plan integrity failed/);
  fs.writeFileSync(filename, JSON.stringify({ changed: true }));
  assert.throws(() => m.buildArtifacts(plan, 'owner-test'), /Source changed/);
});

test('compare detects changed values even when counts match and ignores transport metadata', async t => {
  const m = await ready, f = fixture(t), a = cloud(), b = cloud();
  b.users.default['Oktober 2026'].revision = 'transport-only';b.users.default['Oktober 2026'].lastUpdated = '2999-01-01T00:00:00Z';
  const before = m.loadSource(f.write('before.json', a), 'cloud', 'before');
  assert.equal(m.compareSources(before, m.loadSource(f.write('after.json', b), 'cloud', 'after')).identical, true);
  b.users.default['Oktober 2026'].dailyRecords['2026-10-19'].clock_out = '23:00';
  const changed = m.compareSources(before, m.loadSource(f.write('after.json', b), 'cloud', 'after'));
  assert.equal(changed.before.recordCount, changed.after.recordCount);
  assert.equal(changed.identical, false);
  assert.equal(changed.months.find(m => m.month === 'Oktober 2026').identical, false);
});

test('empty destinations/maps are preserved and local appearance preferences stay outside cloud output', async t => {
  const m = await ready, f = fixture(t), value = cloud();value.users.default._meta.trips.list = [];
  const data = device({ '2026-10-19': record(), '2026-10-20': record('17:00', 'KLIA Cargo (TEST-1) *') }, { trips: [], settings: { darkMode: 'system', rezaot_lang: 'en' } });
  const plan = m.createPlan([m.loadSource(f.write('cloud.json', value), 'cloud', 'cloud'),m.loadSource(f.write('device.json', data), 'device', 'device-1')]);
  const artifacts = m.buildArtifacts(plan, 'owner-test');
  assert.deepEqual(artifacts['app-backup.json'].trips, []);
  assert.deepEqual(artifacts['app-backup.json'].settings.observedHolidays, {});
  assert.deepEqual(artifacts['owner-subtree.json']._meta.trips.list, []);
  assert.equal(artifacts['owner-subtree.json'].settings.darkMode, undefined);
  assert.equal(artifacts['quarantine.json'].deviceLocalPreferences['device-1'].darkMode, 'system');
});

test('CLI writes private artifacts only into a new directory and refuses overwrite or incomplete input', async t => {
  const m = await ready, f = fixture(t), filename = f.write('cloud.json', cloud());
  const output = path.join(f.root, 'plan');
  const run = (...args) => cp.spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  assert.equal(run('plan', '--cloud', filename, '--out', output).status, 0);
  assert.equal(run('plan', '--cloud', filename, '--out', output).status, 2);
  assert.equal(run('plan', '--out', path.join(f.root, 'incomplete')).status, 2);
  assert.equal(fs.existsSync(path.join(f.root, 'incomplete')), false);
  const built = path.join(f.root, 'built');
  const result = run('build', '--plan', path.join(output, 'plan.json'), '--owner', 'owner-test', '--out', built);
  assert.equal(result.status, 0, result.stderr);
  const files = fs.readdirSync(built).sort();
  assert.deepEqual(files, ['app-backup.json', 'manifest.json', 'owner-subtree.json', 'quarantine.json']);
  assert.equal(fs.statSync(path.join(built, 'owner-subtree.json')).mode & 0o777, 0o600);
  const plan = JSON.parse(fs.readFileSync(path.join(output, 'plan.json')));
  assert.throws(() => m.buildArtifacts(plan, 'default'), /non-default/);
  assert.equal(run('compare', '--before', filename, '--after', path.join(built, 'owner-subtree.json')).status, 0);
  const changed = cloud();changed.users.default['Oktober 2026'].dailyRecords['2026-10-19'].clock_out = '23:00';
  assert.equal(run('compare', '--before', filename, '--after', f.write('changed.json', changed)).status, 3);
});
