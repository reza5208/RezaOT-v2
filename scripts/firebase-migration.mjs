#!/usr/bin/env node
/** Offline Firebase migration rehearsal. This module has no networking or Admin SDK. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLOUD_SETTINGS = ['otSettings', 'salarySettings', 'observedHolidays', 'customHolidays', 'monthSettings', 'supervisorName'];
const LOCAL_SETTINGS = ['darkMode', 'rezaot_lang', 'rezaot_print_orientation'];
const META = ['revision', 'lastUpdated', 'lastUpdatedServer', 'deviceId'];
const SALARY_LIMITS = {
  basicSalary: [0, 100000000], hoursPerMonth: [Number.MIN_VALUE, 744], kliaPerDay: [0, 100000000],
  epfEmployeeRate: [0, 1], epfEmployerRate: [0, 1], weekdayMult: [0, 10], restMult: [0, 10], phMult: [0, 10],
  uplDivisor: [1, 366], socso: [0, 100000000], eis: [0, 100000000], skim: [0, 100000000],
  restBreakHours: [0, 24], _v: [0, 1000000]
};
const plain = value => JSON.parse(JSON.stringify(value));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const fail = message => { throw new Error(message); };
function onlyFields(value, allowed, label) {
  if (!object(value)) fail('Invalid ' + label);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('Unsupported ' + label + ' field ' + key + '; review the source before migration');
}
const context = { console, Date, Math, Map, Set, JSON, Number, Object, Array };
context.window = context;
vm.createContext(context);
for (const file of ['model.js', 'backup.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
const model = context.RezaOT_model, backup = context.RezaOT_backup;

export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export const digest = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const normalizedRecords = (records, month) => {
  if (!object(records)) fail('Invalid records for ' + month);
  const allowed = ['clock_in', 'clock_out', 'trips', 'tripDetails', 'sideJobs', 'unpaid', 'annual'];
  for (const [date, record] of Object.entries(records)) {
    onlyFields(record, allowed, 'record ' + month + '/' + date);
    for (const [key, fields] of [['sideJobs', ['awb', 'type']], ['tripDetails', ['id', 'label', 'awb', 'sideJob']]]) {
      if (record[key] != null && Array.isArray(record[key])) for (const item of record[key]) onlyFields(item, fields, key + ' ' + date);
    }
  }
  return plain(model.validateRecords(records, month));
};
const destinations = value => plain(model.validateDestinations(value));
function settings(value, firebase = false) {
  onlyFields(value, [...CLOUD_SETTINGS, ...LOCAL_SETTINGS], 'setting');
  const input = plain(value);
  const calculations = (entry, label) => {
    if (entry.otSettings != null) {
      onlyFields(entry.otSettings, ['weekdayAfter', 'saturdayAfter', 'weekdayStart', 'saturdayStart'], label + ' OT');
      for (const day of ['weekday', 'saturday']) if (entry.otSettings[day + 'After'] != null && entry.otSettings[day + 'Start'] != null && entry.otSettings[day + 'After'] !== entry.otSettings[day + 'Start']) fail('Conflicting ' + label + ' OT aliases');
    }
    if (entry.salarySettings != null) {
      onlyFields(entry.salarySettings, Object.keys(SALARY_LIMITS), label + ' salary');
      for (const [key, number] of Object.entries(entry.salarySettings)) {
        const [min, max] = SALARY_LIMITS[key];
        if (typeof number !== 'number' || !Number.isFinite(number) || number < min || number > max) fail('Salary field outside Firebase schema limits: ' + label + '/' + key);
      }
    }
  };
  calculations(input, 'settings');
  if (input.monthSettings != null) {
    if (!object(input.monthSettings)) fail('Invalid monthSettings');
    for (const [month, snapshot] of Object.entries(input.monthSettings)) {
      onlyFields(snapshot, ['otSettings', 'salarySettings', 'observedHolidays', 'customHolidays', 'capturedAt'], 'snapshot ' + month);
      calculations(snapshot, month);
      if (firebase && snapshot.observedHolidays == null) snapshot.observedHolidays = {};
      if (typeof snapshot.capturedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(snapshot.capturedAt)) fail('Invalid snapshot timestamp ' + month);
    }
  }
  return plain(backup.validateSettings(input));
}
function cleanSettings(value) {
  if (!object(value)) fail('Invalid cloud settings');
  for (const key of Object.keys(value)) if (![...CLOUD_SETTINGS, ...META].includes(key)) fail('Unsupported cloud setting ' + key);
  const input = Object.fromEntries(Object.entries(value).filter(([key]) => CLOUD_SETTINGS.includes(key)));
  // RTDB removes empty maps. A settings node with these maps omitted has the
  // same meaning as the app's explicit empty collections, including clears.
  for (const key of ['observedHolidays', 'customHolidays', 'monthSettings']) if (input[key] == null) input[key] = {};
  return settings(input, true);
}
function normalizeNode(target, data) {
  if (!object(data)) fail('Invalid payload at ' + target);
  if (model.monthValue(target)) {
    if (data.deleted === true) fail('Deleted cloud month ' + target + ' requires a separate deletion review; no live month will be reconstructed from a tombstone');
    for (const key of Object.keys(data)) if (!['dailyRecords', 'trips', ...META].includes(key)) fail('Unsupported month field ' + target + '/' + key);
    return { months: { [target]: normalizedRecords(data.dailyRecords ?? {}, target) }, legacyTrips: data.trips == null ? [] : destinations(data.trips) };
  }
  if (target === 'settings') return { settings: cleanSettings(data) };
  if (target === '_meta/trips') {
    for (const key of Object.keys(data)) if (!['list', ...META].includes(key)) fail('Unsupported destination metadata ' + key);
    return { trips: destinations(data.list ?? []) };
  }
  fail('Unsupported sync target ' + target);
}
function selectScope(input, scope) {
  if (object(input) && own(input, 'users')) {
    let current = input;
    for (const key of scope.split('/')) current = object(current) ? current[key] : undefined;
    if (current === undefined) fail('Scope ' + scope + ' is absent from the full database export');
    return current;
  }
  return input;
}
function normalizeCloud(input, scope) {
  const node = selectScope(input, scope);
  if (node === null) return { months: {}, settings: {}, trips: undefined, notes: ['The exported subtree is null.'] };
  if (!object(node)) fail('Expected a Firebase export object');
  const result = { months: {}, settings: {}, trips: undefined, notes: [] };
  const historicalTrips = [];
  for (const [key, value] of Object.entries(node)) {
    if (model.monthValue(key)) {
      const clean = normalizeNode(key, value);
      result.months[key] = clean.months[key];
      historicalTrips.push(...clean.legacyTrips);
    } else if (key === 'settings') result.settings = cleanSettings(value);
    else if (key === '_meta') {
      if (!object(value)) fail('Invalid _meta');
      for (const name of Object.keys(value)) if (!['trips', 'months'].includes(name)) fail('Unsupported metadata _meta/' + name);
      if (own(value, 'trips')) result.trips = normalizeNode('_meta/trips', value.trips).trips;
      if (value.months != null) {
        if (!object(value.months)) fail('Invalid month manifest');
        for (const [month, flag] of Object.entries(value.months)) {
          model.validateMonthKey(month);
          if (flag !== true) fail('Invalid month manifest entry ' + month);
          if (!own(result.months, month) && !own(node, month)) result.notes.push('Manifest references absent month: ' + month);
        }
      }
    } else fail('Unsupported cloud node ' + key + '; no unrecognized data is silently discarded');
  }
  if (result.trips === undefined && historicalTrips.length) {
    result.trips = [...new Set(historicalTrips)];
    result.notes.push('Shared destinations derived from the union of legacy month destination lists; review removal intent.');
  }
  return result;
}
function normalizeBackup(input) {
  if (!object(input) || input.schemaVersion !== 2) fail('Device input must be an app backup schemaVersion 2');
  for (const key of Object.keys(input)) if (!['schemaVersion', 'app', 'exportedAt', 'months', 'trips', 'settings', 'syncState'].includes(key)) fail('Unsupported backup field ' + key);
  for (const key of Object.keys(input.settings || {})) if (![...CLOUD_SETTINGS, ...LOCAL_SETTINGS].includes(key)) fail('Unsupported backup setting ' + key);
  const validatedSettings = settings(input.settings || {});
  const parsed = plain(backup.parse(input));
  parsed.settings = validatedSettings;
  for (const [month, records] of Object.entries(input.months || {})) parsed.months[month] = normalizedRecords(records, month);
  parsed.localPreferences = Object.fromEntries(Object.entries(parsed.settings).filter(([key]) => LOCAL_SETTINGS.includes(key)));
  parsed.settings = Object.fromEntries(Object.entries(parsed.settings).filter(([key]) => CLOUD_SETTINGS.includes(key)));
  parsed.notes = [];
  return parsed;
}
export function inventory(data) {
  const months = Object.entries(data.months || {}).sort(([a], [b]) => model.monthValue(a).localeCompare(model.monthValue(b))).map(([month, records]) => ({
    month, records: Object.keys(records).length,
    trips: Object.values(records).reduce((n, r) => n + r.trips.length, 0),
    sideJobs: Object.values(records).reduce((n, r) => n + r.sideJobs.length, 0),
    annualDays: Object.values(records).filter(r => r.annual).length,
    unpaidDays: Object.values(records).filter(r => r.unpaid).length,
    sha256: digest(records)
  }));
  return { monthCount: months.length, recordCount: months.reduce((n, m) => n + m.records, 0),
    tripCount: months.reduce((n, m) => n + m.trips, 0), sideJobCount: months.reduce((n, m) => n + m.sideJobs, 0),
    snapshotMonths: Object.keys(data.settings?.monthSettings || {}).sort(),
    settingsSha256: digest(data.settings || {}), destinationsSha256: digest(data.trips ?? null), months };
}
export function loadSource(filename, kind, id, scope = 'users/default') {
  const full = path.resolve(filename), raw = fs.readFileSync(full, 'utf8');
  const input = JSON.parse(raw);
  const data = kind === 'cloud' ? normalizeCloud(input, scope) : normalizeBackup(input);
  return { id, kind, filename: full, label: path.basename(full), scope: kind === 'cloud' ? scope : null,
    sha256: digest(raw), data, inventory: inventory(data), requiresAcknowledgement: data.notes?.some(note => note.includes('derived from')) || false, syncState: kind === 'device' ? input.syncState || null : null };
}
function stateRows(state) {
  if (state == null) return [];
  if (!object(state) || state.version !== 1) fail('Unsupported syncState version');
  if (state.pending != null && !Array.isArray(state.pending)) fail('syncState.pending must be an array');
  if (state.dirty != null && !Array.isArray(state.dirty)) fail('syncState.dirty must be an array');
  if (state.conflicts != null && !Array.isArray(state.conflicts)) fail('syncState.conflicts must be an array');
  return [['pending', state.pending || []], ['dirty', state.dirty || []], ['conflict', state.conflicts || []]].flatMap(([type, values]) => values.map((value, index) => ({ type, index, value })));
}
function inspectState(source, scope) {
  const quarantine = [], candidates = [];
  for (const row of stateRows(source.syncState)) {
    const id = source.id + ':' + row.type + ':' + row.index;
    const item = row.value;
    if (!object(item)) fail('Invalid sync state item ' + id);
    let target = null, ownerHint = null, disposition = 'review_only_not_replayed';
    if (row.type === 'pending' && typeof item.path === 'string') {
      if (item.path.startsWith(scope + '/')) {
        target = item.path.slice(scope.length + 1);
        ownerHint = scope === 'users/default' ? null : scope;
      } else disposition = 'foreign_namespace_quarantined_not_imported';
    } else if (row.type === 'dirty') {
      target = item.target;
      ownerHint = item.owner || null;
    }
    let candidate = null;
    if (target && (model.monthValue(target) || ['settings', '_meta/trips'].includes(target))) {
      try {
        candidate = normalizeNode(target, item.data);
        candidates.push({ id, kind: row.type, label: id, ownerHint, requiresAcknowledgement: true,
          data: { months: {}, settings: {}, ...candidate }, inventory: inventory(candidate), notes: ['Recovered sync-state candidate. Explicit source acknowledgement is required.'] });
      } catch (error) { disposition = 'invalid_or_unknown_payload_quarantined: ' + error.message; }
    }
    quarantine.push({ id, source: source.id, type: row.type, disposition, ownerHint,
      candidateSource: candidate ? id : null, sha256: digest(item), item: plain(item) });
  }
  return { quarantine, candidates };
}
function variantsFor(sources) {
  const entries = [], months = [...new Set(sources.flatMap(s => Object.keys(s.data.months || {})))].sort();
  const add = (target, variants) => {
    const hashes = new Set(variants.filter(v => v.present).map(v => v.sha256));
    const missing = variants.some(v => !v.present);
    entries.push({ id: 'c_' + digest(target).slice(0, 20), path: target, variants,
      reviewRequired: hashes.size > 1 || missing,
      reason: missing ? 'absence_is_not_proof_of_deletion' : hashes.size > 1 ? 'different_values' : 'same_or_single_value' });
  };
  const variant = (source, present, value) => present ? { source: source.id, present: true, value: plain(value), sha256: digest(value) } : { source: source.id, present: false };
  for (const month of months) {
    const participating = sources.filter(s => own(s.data.months || {}, month));
    const dates = [...new Set(participating.flatMap(s => Object.keys(s.data.months[month])))].sort();
    for (const date of dates) add(['months', month, date], participating.map(s => variant(s, own(s.data.months[month], date), s.data.months[month][date])));
  }
  for (const key of CLOUD_SETTINGS) {
    const participating = sources.filter(s => own(s.data.settings || {}, key));
    if (!participating.length) continue;
    if (['monthSettings', 'observedHolidays', 'customHolidays'].includes(key)) {
      const keys = [...new Set(participating.flatMap(s => Object.keys(s.data.settings[key])))].sort();
      for (const child of keys) {
        const selected = key === 'monthSettings' ? participating.filter(s => own(s.data.settings[key], child)) : participating;
        add(['settings', key, child], selected.map(s => variant(s, own(s.data.settings[key], child), s.data.settings[key][child])));
      }
    } else add(['settings', key], participating.map(s => variant(s, true, s.data.settings[key])));
  }
  const tripSources = sources.filter(s => s.data.trips !== undefined);
  if (tripSources.length) add(['trips'], tripSources.map(s => variant(s, true, s.data.trips)));
  return entries;
}
const planBody = plan => Object.fromEntries(Object.entries(plan).filter(([key]) => !['integrity', 'createdAt'].includes(key)));
export function createPlan(sources, scope = 'users/default') {
  if (!sources.length || sources[0].kind !== 'cloud') fail('A full cloud export is required before device reconciliation');
  const quarantine = [], candidates = [];
  for (const source of sources) {
    const result = inspectState(source, scope);quarantine.push(...result.quarantine);candidates.push(...result.candidates);
  }
  const all = sources.concat(candidates);
  const plan = { schemaVersion: 1, kind: 'rezaot-offline-migration-plan', createdAt: new Date().toISOString(), sourceScope: scope,
    sources: all.map(s => ({ id: s.id, kind: s.kind, label: s.label, filename: s.filename || null, sha256: s.sha256 || null,
      ownerHint: s.ownerHint || null, requiresAcknowledgement: !!s.requiresAcknowledgement,
      inventory: s.inventory, notes: s.data.notes || s.notes || [], localPreferences: s.data.localPreferences || {} })),
    monthSources: Object.fromEntries([...new Set(all.flatMap(s => Object.keys(s.data.months || {})))].sort().map(month => [month, all.filter(s => own(s.data.months || {}, month)).map(s => s.id)])),
    settingMapSources: Object.fromEntries(['observedHolidays', 'customHolidays', 'monthSettings'].map(key => [key, all.filter(s => own(s.data.settings || {}, key)).map(s => s.id)])),
    entries: variantsFor(all), quarantine,
    policies: { automaticNetworkWrites: false, missingRecordMeansDeletion: false, foreignQueueRebinding: false,
      fullCloudExportRequired: true, privateOutputs: true } };
  plan.integrity = digest(planBody(plan));
  return plan;
}
function validateOwner(uid) {
  if (typeof uid !== 'string' || !uid || uid === 'default' || uid.length > 128 || /[.#$\[\]/\x00-\x1f\x7f]/.test(uid)) fail('Provide a valid non-default Firebase owner UID');
}
function assign(target, keys, value) {
  let current = target;
  for (const key of keys.slice(0, -1)) current = current[key] ||= {};
  current[keys[keys.length - 1]] = plain(value);
}
export function buildArtifacts(plan, uid, resolutions = {}, options = {}) {
  validateOwner(uid);
  if (!object(plan) || plan.kind !== 'rezaot-offline-migration-plan' || plan.schemaVersion !== 1 || plan.integrity !== digest(planBody(plan))) fail('Plan integrity failed; regenerate the plan instead of editing it');
  for (const source of plan.sources) if (source.filename) {
    if (digest(fs.readFileSync(source.filename, 'utf8')) !== source.sha256) fail('Source changed since planning: ' + source.label);
  }
  if (!object(resolutions)) fail('Invalid resolutions');
  const excluded = resolutions.excludeSources || {}, acknowledged = new Set(resolutions.acknowledgeSources || []), choices = resolutions.choices || {};
  if (!object(excluded) || !object(choices)) fail('Invalid resolution maps');
  const sourceIds = new Set(plan.sources.map(s => s.id));
  for (const [id, reason] of Object.entries(excluded)) if (!sourceIds.has(id) || typeof reason !== 'string' || reason.trim().length < 5) fail('Excluded sources need a valid ID and reason');
  for (const id of acknowledged) if (!sourceIds.has(id)) fail('Unknown acknowledged source ' + id);
  for (const source of plan.sources) {
    if (own(excluded, source.id)) continue;
    if (source.requiresAcknowledgement && !acknowledged.has(source.id)) fail('Explicitly acknowledge or exclude recovered source ' + source.id);
    if (source.ownerHint && source.ownerHint !== 'users/' + uid) fail('Recovered source owner differs from target UID: ' + source.id + '; exclude it and review separately');
  }
  if (plan.quarantine.length && !options.acknowledgeQuarantine) fail('Review quarantined sync state and pass --ack-quarantine; it will be preserved, never replayed');
  const ids = new Set(plan.entries.map(e => e.id));
  for (const id of Object.keys(choices)) if (!ids.has(id)) fail('Unknown conflict choice ' + id);
  const merged = { months: {}, settings: {} };
  for (const [month, ids] of Object.entries(plan.monthSources)) if (ids.some(id => !own(excluded, id))) merged.months[month] = {};
  for (const [key, ids] of Object.entries(plan.settingMapSources || {})) if (ids.some(id => !own(excluded, id))) merged.settings[key] = {};
  const unresolved = [];
  for (const entry of plan.entries) {
    const variants = entry.variants.filter(v => !own(excluded, v.source));
    if (!variants.length) continue;
    const hashes = new Set(variants.filter(v => v.present).map(v => v.sha256));
    const review = hashes.size > 1 || variants.some(v => !v.present);
    const choice = choices[entry.id];
    let selected;
    if (choice) {
      if (!object(choice)) fail('Invalid choice ' + entry.id);
      if (choice.delete === true) {
        if (typeof choice.reason !== 'string' || choice.reason.trim().length < 5) fail('Explicit deletion requires a reason: ' + entry.id);
        continue;
      }
      selected = variants.find(v => v.source === choice.source && v.present);
      if (!selected) fail('Choose a present source or explicit deletion: ' + entry.id);
    } else if (review) { unresolved.push(entry.id + ' ' + entry.path.join('/'));continue; }
    else selected = variants.find(v => v.present);
    if (selected) assign(merged, entry.path, selected.value);
  }
  if (unresolved.length) fail('Unresolved conflicts (' + unresolved.length + '):\n' + unresolved.join('\n'));
  const appBackup = plain(backup.parse({ schemaVersion: 2, months: merged.months, settings: merged.settings, ...(merged.trips !== undefined ? { trips: merged.trips } : {}) }));
  const stamp = { revision: 'migration-' + plan.integrity.slice(0, 24), deviceId: 'migration-rehearsal', lastUpdated: new Date().toISOString() };
  const owner = { _meta: { months: Object.fromEntries(Object.keys(appBackup.months).map(month => [month, true])) } };
  for (const [month, records] of Object.entries(appBackup.months)) owner[month] = { dailyRecords: records, ...(appBackup.trips !== undefined ? { trips: appBackup.trips } : {}), ...stamp };
  if (Object.keys(appBackup.settings).length) owner.settings = { ...appBackup.settings, ...stamp };
  if (appBackup.trips !== undefined) owner._meta.trips = { list: appBackup.trips, ...stamp };
  appBackup.app = 'RezaOT';appBackup.exportedAt = stamp.lastUpdated;
  const summary = inventory({ months: appBackup.months, settings: appBackup.settings, trips: appBackup.trips });
  return {
    'owner-subtree.json': owner,
    'app-backup.json': appBackup,
    'quarantine.json': { version: 1, replayed: false, entries: plan.quarantine, excludedSources: excluded,
      deviceLocalPreferences: Object.fromEntries(plan.sources.filter(s => Object.keys(s.localPreferences).length).map(s => [s.id, s.localPreferences])) },
    'manifest.json': { schemaVersion: 1, targetPath: 'users/' + uid, productionWritten: false, sourceScope: plan.sourceScope,
      sourcePlanSha256: plan.integrity, sourceHashes: plan.sources.filter(s => s.sha256).map(s => ({ id: s.id, sha256: s.sha256 })),
      ownerSubtreeSha256: digest(owner), reviewChoices: choices, acknowledgedSources: [...acknowledged], excludedSources: excluded, inventory: summary }
  };
}
export function compareSources(before, after) {
  const a = inventory(before.data), b = inventory(after.data);
  const months = [...new Set([...a.months, ...b.months].map(m => m.month))].sort().map(month => {
    const left = a.months.find(m => m.month === month), right = b.months.find(m => m.month === month);
    return { month, before: left || null, after: right || null, identical: !!left && !!right && left.sha256 === right.sha256 };
  });
  const equal = months.every(m => m.identical) && a.settingsSha256 === b.settingsSha256 && a.destinationsSha256 === b.destinationsSha256;
  return { identical: equal, before: a, after: b, months, settingsIdentical: a.settingsSha256 === b.settingsSha256,
    destinationsIdentical: a.destinationsSha256 === b.destinationsSha256,
    note: 'Hashes compare normalized records/settings/destinations; transport timestamps and revisions are excluded.' };
}
export function writeNewDirectory(directory, artifacts) {
  const out = path.resolve(directory);
  if (fs.existsSync(out)) fail('Output directory already exists; refusing to overwrite: ' + out);
  fs.mkdirSync(path.dirname(out), { recursive: true, mode: 0o700 });
  fs.mkdirSync(out, { mode: 0o700 });
  for (const [name, value] of Object.entries(artifacts)) fs.writeFileSync(path.join(out, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
const help = `Offline Firebase migration rehearsal (no network or deployment):
  node scripts/firebase-migration.mjs inventory --cloud export.json [--scope users/default] [--device backup.json ...]
  node scripts/firebase-migration.mjs plan --cloud export.json [--device backup.json ...] --out NEW_DIRECTORY
  node scripts/firebase-migration.mjs build --plan plan.json --owner OWNER_UID [--resolutions choices.json] [--ack-quarantine] --out NEW_DIRECTORY
  node scripts/firebase-migration.mjs compare --before export.json --after owner-subtree.json [--before-scope users/default] [--after-scope users/OWNER_UID]
Outputs contain private records. Prefer .firebase/migration/ (Git-ignored) or a private directory outside the repo.
`;
function argumentsOf(args) {
  const out = { device: [] };
  const allowed = ['cloud', 'scope', 'device', 'out', 'plan', 'owner', 'resolutions', 'ack-quarantine', 'before', 'after', 'before-scope', 'after-scope'];
  for (let i = 0; i < args.length; i++) {
    const key = args[i].startsWith('--') ? args[i].slice(2) : '';
    if (!allowed.includes(key)) fail('Unknown argument ' + args[i]);
    const value = key === 'ack-quarantine' ? true : args[++i];
    if (value === undefined || typeof value === 'string' && value.startsWith('--')) fail('Missing --' + key + ' value');
    if (key === 'device') out.device.push(value);else if (own(out, key)) fail('Duplicate --' + key);else out[key] = value;
  }
  return out;
}
export function main(args) {
  const command = args.shift();
  if (!command || command === '--help' || command === 'help') { console.log(help);return; }
  const flags = argumentsOf(args);
  if (['inventory', 'plan'].includes(command)) {
    if (!flags.cloud) fail('--cloud full export is required; a device backup cannot establish cloud completeness');
    const scope = flags.scope || 'users/default';
    if (!/^users\/[^/.#$\[\]\x00-\x1f]+$/.test(scope)) fail('Invalid --scope; use users/UID or users/default');
    const sources = [loadSource(flags.cloud, 'cloud', 'cloud', scope), ...flags.device.map((file, i) => loadSource(file, 'device', 'device-' + (i + 1)))];
    const plan = createPlan(sources, scope);
    const summary = { sourceScope: scope, sources: plan.sources.map(s => ({ id: s.id, kind: s.kind, sha256: s.sha256, inventory: s.inventory, notes: s.notes })),
      conflicts: plan.entries.filter(e => e.reviewRequired).map(e => ({ id: e.id, path: e.path, reason: e.reason })),
      recoveredSourcesRequiringAcknowledgement: plan.sources.filter(s => s.requiresAcknowledgement).map(s => s.id),
      quarantinedStateCount: plan.quarantine.length, completeness: 'Selected cloud subtree plus explicitly supplied device backups only; offline devices must be inventoried separately.' };
    if (command === 'inventory') console.log(JSON.stringify(summary, null, 2));
    else {
      if (!flags.out) fail('--out is required');
      const choices = Object.fromEntries(plan.entries.filter(e => e.reviewRequired).map(e => [e.id, { source: 'REVIEW_REQUIRED', path: e.path }]));
      const review = '# Offline migration review\n\nNo Firebase writes have occurred. Review every conflict and missing-record ambiguity. Do not infer deletion from absence.\n\n' +
        plan.entries.filter(e => e.reviewRequired).map(e => '- `' + e.id + '` ' + e.path.join('/') + ': ' + e.reason).join('\n') +
        '\n\nRecovered sync state stays in quarantine; acknowledge or exclude candidate sources explicitly. Owner mismatches are blocked. Local appearance preferences are not uploaded.\n';
      writeNewDirectory(flags.out, { 'plan.json': plan, 'inventory.json': summary, 'review.md': review,
        'resolutions.example.json': { acknowledgeSources: [], excludeSources: {}, choices } });
      console.log('Prepared offline plan in ' + path.resolve(flags.out));
    }
  } else if (command === 'build') {
    if (!flags.plan || !flags.owner || !flags.out) fail('--plan, --owner and --out are required');
    const plan = JSON.parse(fs.readFileSync(flags.plan, 'utf8'));
    const resolutions = flags.resolutions ? JSON.parse(fs.readFileSync(flags.resolutions, 'utf8')) : {};
    writeNewDirectory(flags.out, buildArtifacts(plan, flags.owner, resolutions, { acknowledgeQuarantine: !!flags['ack-quarantine'] }));
    console.log('Built offline rehearsal artifacts for users/' + flags.owner + '; no Firebase writes occurred.');
  } else if (command === 'compare') {
    if (!flags.before || !flags.after) fail('--before and --after are required');
    const result = compareSources(loadSource(flags.before, 'cloud', 'before', flags['before-scope'] || 'users/default'),
      loadSource(flags.after, 'cloud', 'after', flags['after-scope'] || 'users/default'));
    console.log(JSON.stringify(result, null, 2));
    if (!result.identical) process.exitCode = 3;
  } else fail('Unknown command ' + command);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) { console.error('Migration rehearsal stopped: ' + error.message);process.exitCode = 2; }
}
