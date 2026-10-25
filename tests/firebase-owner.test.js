const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const modulePromise = import('../scripts/firebase-owner.mjs');

test('owner provisioning defaults to a credential-free local review', async () => {
  const { ownerPlan } = await modulePromise;
  const plan = ownerPlan(['--project', 'demo-rezaot', '--uid', 'owner-test'], {});
  assert.equal(plan.mode, 'dry-run'); assert.equal(plan.grant, true);
  const output = execFileSync(process.execPath, [path.resolve(__dirname, '../scripts/firebase-owner.mjs'), '--project', 'demo-rezaot', '--uid', 'owner-test'],
    { env: { PATH: process.env.PATH }, encoding: 'utf8' });
  assert.equal(JSON.parse(output).mode, 'dry-run');
});

test('owner tool rejects ambiguous targets and unsafe emulator routing', async () => {
  const { ownerPlan } = await modulePromise;
  for (const args of [[], ['--project', 'demo-rezaot'], ['--project', 'demo-rezaot', '--uid', 'default'],
    ['--project', 'demo-rezaot', '--uid', 'a/b'], ['--project', 'demo-rezaot', '--uid', 'owner', '--unknown'],
    ['--project', 'real-project', '--uid', 'owner', '--emulator', '127.0.0.1:9099'],
    ['--project', 'demo-rezaot', '--uid', 'owner', '--emulator', 'public.example:9099']]) assert.throws(() => ownerPlan(args, {}));
  assert.throws(() => ownerPlan(['--project', 'real-project', '--uid', 'owner'], { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }));
  assert.throws(() => ownerPlan(['--project', 'demo-rezaot', '--uid', 'owner', '--emulator', 'localhost:9099'], { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }));
});

test('owner grant preserves other claims and checks the explicit Admin project', async () => {
  const { ownerPlan, applyOwnerPlan } = await modulePromise;
  const plan = ownerPlan(['--project', 'demo-rezaot', '--uid', 'owner-test', '--apply'], {});
  const writes = [];
  const auth = { app: { options: { projectId: 'demo-rezaot' } }, getUser: async () => ({ customClaims: { existingRole: 'kept' } }),
    setCustomUserClaims: async (uid, claims) => writes.push({ uid, claims }) };
  const result = await applyOwnerPlan(plan, auth);
  assert.deepEqual(writes, [{ uid: 'owner-test', claims: { existingRole: 'kept', rezaot_owner: true } }]);
  assert.equal(result.clientTokenRefreshRequired, true);
  await assert.rejects(applyOwnerPlan({ ...plan, mode: 'dry-run' }, auth), /--apply/);
  await assert.rejects(applyOwnerPlan(plan, { ...auth, app: { options: { projectId: 'other-project' } } }), /project/);
});

test('owner revoke removes future access and revokes refresh tokens without deleting the account', async () => {
  const { ownerPlan, applyOwnerPlan } = await modulePromise;
  const plan = ownerPlan(['--project', 'demo-rezaot', '--uid', 'owner-test', '--revoke', '--apply'], {});
  const calls = [];
  const auth = { getUser: async () => ({ disabled: true, customClaims: { rezaot_owner: true, other: 5 } }),
    setCustomUserClaims: async (uid, claims) => calls.push(['claims', uid, claims]),
    revokeRefreshTokens: async uid => calls.push(['revoke', uid]) };
  await applyOwnerPlan(plan, auth);
  assert.deepEqual(calls, [['claims', 'owner-test', { rezaot_owner: false, other: 5 }], ['revoke', 'owner-test']]);
  await assert.rejects(applyOwnerPlan({ ...plan, grant: true }, auth), /Enable/);
});
