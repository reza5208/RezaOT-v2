#!/usr/bin/env node
// Review an owner-claim change locally; only --apply makes an Admin SDK request.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function ownerPlan(args, environment = process.env) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const [key, inline] = args[i].split(/=(.*)/s);
    if (['--apply', '--revoke', '--help'].includes(key)) {
      if (inline !== undefined) throw new Error('Flags do not accept values: ' + key);
      options[key.slice(2)] = true;
    } else if (['--project', '--uid', '--emulator'].includes(key)) {
      const value = inline === undefined ? args[++i] : inline;
      if (!value || value.startsWith('--')) throw new Error('Missing value for ' + key);
      if (options[key.slice(2)] !== undefined) throw new Error('Duplicate option: ' + key);
      options[key.slice(2)] = value;
    } else throw new Error('Unknown option: ' + key);
  }
  if (options.help) return { help: true };
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(options.project || '')) throw new Error('Pass an explicit Firebase --project ID');
  if (typeof options.uid !== 'string' || !options.uid.trim() || options.uid.length > 128 ||
      /[.#$\[\]/\u0000-\u001f\u007f]/.test(options.uid) || options.uid === 'default') throw new Error('Pass a valid owner --uid, excluding default and RTDB key delimiters');
  const inherited = environment.FIREBASE_AUTH_EMULATOR_HOST;
  if (options.emulator && inherited && options.emulator !== inherited) throw new Error('Explicit emulator conflicts with the inherited Auth emulator host');
  const emulator = options.emulator || inherited || null;
  if (emulator) {
    let endpoint;
    try { endpoint = new URL('http://' + emulator); } catch (_) { throw new Error('Invalid Auth emulator host'); }
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) ||
        !endpoint.port || Number(endpoint.port) < 1 || Number(endpoint.port) > 65535 ||
        endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash ||
        !/^demo-[a-z0-9-]+$/.test(options.project)) throw new Error('Auth emulator changes require a loopback host:port and demo-* project');
  }
  return { mode: options.apply ? 'apply' : 'dry-run', projectId: options.project, uid: options.uid,
    emulator, claim: 'rezaot_owner', grant: !options.revoke };
}

export async function applyOwnerPlan(plan, auth) {
  if (plan.mode !== 'apply') throw new Error('Owner changes require explicit --apply');
  if (auth.app && auth.app.options && auth.app.options.projectId !== plan.projectId) throw new Error('Admin project does not match the reviewed plan');
  const user = await auth.getUser(plan.uid);
  if (user.disabled && plan.grant) throw new Error('Enable the owner account before granting access');
  const claims = { ...(user.customClaims || {}), [plan.claim]: plan.grant };
  await auth.setCustomUserClaims(plan.uid, claims);
  if (!plan.grant) await auth.revokeRefreshTokens(plan.uid);
  return { mode: 'applied', projectId: plan.projectId, uid: plan.uid, ownerAccess: plan.grant,
    otherClaimsPreserved: true, clientTokenRefreshRequired: true };
}

async function main() {
  const plan = ownerPlan(process.argv.slice(2));
  if (plan.help) {
    process.stdout.write('Usage: node scripts/firebase-owner.mjs --project PROJECT --uid UID [--emulator 127.0.0.1:9099] [--revoke] [--apply]\nDefault is a local dry run. --apply uses Firebase Admin SDK credentials or the local Auth emulator.\n');
    return;
  }
  if (plan.mode === 'dry-run') { process.stdout.write(JSON.stringify(plan, null, 2) + '\n'); return; }
  if (plan.emulator) process.env.FIREBASE_AUTH_EMULATOR_HOST = plan.emulator;
  const require = createRequire(new URL('../firebase/package.json', import.meta.url));
  const { initializeApp, applicationDefault } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const app = initializeApp({ projectId: plan.projectId, ...(plan.emulator ? {} : { credential: applicationDefault() }) });
  process.stdout.write(JSON.stringify(await applyOwnerPlan(plan, getAuth(app)), null, 2) + '\n');
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { process.stderr.write('Owner setup failed: ' + error.message + '\n'); process.exitCode = 1; });
}
