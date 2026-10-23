const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SCOPE = 'https://example.test/RezaOT-v2/';
const releaseContext = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'release.js'), 'utf8'), releaseContext);
const VERSION = releaseContext.REZAOT_RELEASE.version;
const CURRENT_CACHE = 'rezaot-v' + VERSION;
const PRIOR_CACHE = 'rezaot-v' + (Number(VERSION) - 1);

// Exercise the actual worker and release manifest in their own worker-like VM.
// Cache keys are URLs so tests also cover deployments below a GitHub Pages path.
function workerHarness(options = {}) {
  const handlers = new Map();
  const stores = new Map();
  const deleted = [];
  const network = [];
  const state = { skipped: 0, claimed: 0, installed: [] };
  const absolute = input => new URL(typeof input === 'string' ? input : input.url, SCOPE).href;
  function cache(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return {
      async match(input) { return entries.get(absolute(input)); },
      async addAll(inputs) {
        state.installed.push(...inputs);
        if (options.failAsset && inputs.some(value => value.startsWith(options.failAsset))) {
          throw new Error('Asset unavailable: ' + options.failAsset);
        }
        for (const input of inputs) entries.set(absolute(input), { body: input });
      }
    };
  }
  for (const name of options.cacheNames || []) cache(name);
  const context = {
    URL, Set, Array, console,
    fetch: async request => {
      network.push(request.url);
      if (options.offline) throw new Error('offline');
      return { body: 'network response' };
    },
    caches: {
      async open(name) { return cache(name); },
      async keys() { return Array.from(stores.keys()); },
      async delete(name) { deleted.push(name); return stores.delete(name); }
    }
  };
  context.self = {
    location: { origin: new URL(SCOPE).origin }, registration: { scope: SCOPE },
    clients: { async claim() { state.claimed++; } },
    skipWaiting() { state.skipped++; },
    addEventListener(name, handler) { handlers.set(name, handler); }
  };
  context.importScripts = file => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), context, { filename: 'sw.js' });
  return {
    context, stores, deleted, network, state,
    async lifecycle(name) {
      let operation;
      handlers.get(name)({ waitUntil(promise) { operation = promise; } });
      assert.ok(operation, name + ' must extend worker lifetime');
      await operation;
    },
    message(data) { handlers.get('message')({ data }); },
    async request(relative, mode = 'cors', method = 'GET') {
      let response;
      handlers.get('fetch')({
        request: { url: absolute(relative), mode, method },
        respondWith(promise) { response = promise; }
      });
      return response ? await response : undefined;
    },
    seed(name, relative, response) { cache(name); stores.get(name).set(absolute(relative), response); }
  };
}

test('release declares only existing local assets and requires both local Firebase SDKs', () => {
  const h = workerHarness();
  const release = h.context.REZAOT_RELEASE;
  for (const asset of [...release.assets, ...release.scripts]) {
    const local = asset === './' ? 'index.html' : asset;
    assert.ok(fs.statSync(path.join(ROOT, local)).isFile(), local + ' must be a file');
    assert.ok(!/^https?:/.test(asset), 'offline assets must be local');
  }
  assert.ok(release.scripts.includes('vendor/firebase-app-compat.js'));
  assert.ok(release.scripts.includes('vendor/firebase-database-compat.js'));
  assert.ok(release.assets.includes('vendor/xlsx.full.min.js'));
  assert.ok(release.assets.includes('vendor/html2pdf.bundle.min.js'));
});

test('missing core asset rejects install while retaining the prior offline release', async () => {
  const h = workerHarness({ failAsset: 'main-app-1.js', cacheNames: [PRIOR_CACHE] });
  h.seed(PRIOR_CACHE, 'index.html', { body: 'working old shell' });
  await assert.rejects(h.lifecycle('install'), /main-app-1/);
  assert.equal(h.state.skipped, 0);
  assert.equal(h.state.claimed, 0);
  assert.deepEqual(h.deleted, []);
  assert.equal(h.stores.get(PRIOR_CACHE).get(SCOPE + 'index.html').body, 'working old shell');
});

test('successful install precaches versioned core and waits for explicit activation', async () => {
  const h = workerHarness();
  await h.lifecycle('install');
  const version = h.context.REZAOT_RELEASE.version;
  assert.ok(h.state.installed.includes('main-app-1.js?v=' + version));
  assert.ok(h.state.installed.includes('styles-base.css'));
  assert.equal(h.state.skipped, 0);
  h.message({ type: 'unknown' });
  assert.equal(h.state.skipped, 0);
  h.message({ type: 'SKIP_WAITING' });
  assert.equal(h.state.skipped, 1);
});

test('activation deletes only older RezaOT caches and preserves other applications', async () => {
  const h = workerHarness({ cacheNames: ['rezaot-v1', PRIOR_CACHE, CURRENT_CACHE, 'another-app-v1', 'firebase-cache'] });
  await h.lifecycle('activate');
  assert.deepEqual(h.deleted, ['rezaot-v1', PRIOR_CACHE]);
  assert.ok(h.stores.has(CURRENT_CACHE));
  assert.ok(h.stores.has('another-app-v1'));
  assert.ok(h.stores.has('firebase-cache'));
  assert.equal(h.state.claimed, 1);
});

test('offline navigation in a nested deployment returns the cached application shell', async () => {
  const h = workerHarness({ offline: true });
  const shell = { body: 'offline app shell' };
  h.seed(CURRENT_CACHE, 'index.html', shell);
  assert.equal(await h.request('history/October', 'navigate'), shell);
  assert.deepEqual(h.network, []);
});

test('versioned lazy export request uses its verified precached local artifact offline', async () => {
  const h = workerHarness({ offline: true });
  const library = { body: 'offline export library' };
  h.seed(CURRENT_CACHE, 'vendor/xlsx.full.min.js', library);
  assert.equal(await h.request('vendor/xlsx.full.min.js?v=' + VERSION), library);
  assert.deepEqual(h.network, []);
});

test('a different release query does not silently receive the current lazy library', async () => {
  const h = workerHarness();
  h.seed(CURRENT_CACHE, 'vendor/xlsx.full.min.js', { body: 'current library' });
  assert.equal((await h.request('vendor/xlsx.full.min.js?v=' + (Number(VERSION) + 1))).body, 'network response');
  assert.equal(h.network.length, 1);
});

test('cross-origin requests, other application paths and non-GET operations are untouched', async () => {
  const h = workerHarness();
  assert.equal(await h.request('https://database.example.test/users.json'), undefined);
  assert.equal(await h.request('https://example.test/OtherPWA/index.html', 'navigate'), undefined);
  assert.equal(await h.request('backup.json', 'cors', 'POST'), undefined);
  assert.deepEqual(h.network, []);
  assert.equal(h.stores.size, 0);
});
