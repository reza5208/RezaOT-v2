# Firebase operations (v74)

This app is a static PWA using Firebase Realtime Database, not Firestore or Cloud Functions. Firebase tooling is isolated in `firebase/`; it is not needed to run the app. Production Auth, rules, migration and App Check enforcement require access to the selected Firebase project and have not been applied by this source change.

## Local tools and emulators

Use Node 22 or newer and Java 21 for the Firebase CLI/Database emulator. Install the pinned development tools from the lockfile:

```sh
npm --prefix firebase ci
npm --prefix firebase run rules:check
npm --prefix firebase test
```

`firebase.json` binds Auth to `127.0.0.1:9099`, Database to `127.0.0.1:9000`, and the emulator hub to loopback. `.firebaserc` defaults to `demo-rezaot`. The runner explicitly selects this demo project and runs `tests/firebase-rules.test.cjs`; it preserves a failing exit code. The test file refuses non-demo projects or nonloopback endpoints. No real project or credential is needed for these tests. The first emulator run downloads an official Google artifact and needs HTTPS access to `storage.googleapis.com` in addition to npm registry access. The runner selects writable temporary config and emulator-cache locations when `XDG_CONFIG_HOME` and `FIREBASE_EMULATORS_PATH` have not already been supplied, keeping the home directory untouched. On this cloud environment those defaults are `/tmp/rezaot-firebase-config` and `/tmp/rezaot-firebase-emulators`.

Managed environments may inject an HTTP proxy into both Firebase CLI fetches and the Node Database SDK WebSocket, even for loopback requests. The local test preloader removes that proxy option only for HTTP loopback ports 9000/9099/4400 and WebSocket loopback port 9000. It preserves proxy credentials, policy and remote requests; it does not enable remote emulator endpoints.

To keep emulators running for local browser testing, use the pinned CLI:

```sh
cd firebase
XDG_CONFIG_HOME=/tmp/rezaot-firebase-config FIREBASE_EMULATORS_PATH=/tmp/rezaot-firebase-emulators node --require ./local-emulator-http.cjs ./node_modules/firebase-tools/lib/bin/firebase.js emulators:start --only database,auth --project demo-rezaot --config ../firebase.json
```

In a separate local test copy/profile, use the public configuration from `firebase-config.emulator.example.js`. Serve the static app on a loopback hostname. `cloud-runtime.js` accepts emulator endpoints only when the browser hostname is loopback, the project starts with `demo-`, and **both** Auth and Database endpoints are explicitly local. It rejects project/transport changes after initialization. A hosted app cannot enable these emulator settings.

Create a test account through the local Auth emulator API/UI, then grant its UID the claim with the CLI below using `--project demo-rezaot --emulator 127.0.0.1:9099 --apply`. Keep App Check disabled for emulator testing. If emulators are already running, execute their tests with:

```sh
FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 GCLOUD_PROJECT=demo-rezaot npm --prefix firebase run test:running
```

## Provision an authenticated staging owner

1. Select a separate staging project in Firebase Console, register a Web app and enable RTDB. Enable **Authentication → Email/Password** and create the owner's account in the Console. Record the UID; do not put the password in Git or a shell command.
2. Add the deployment hostname to Authentication's authorized domains, without protocol or port. Inspect the password-reset email template, sender and link destination. Browser/network access requires HTTPS to `identitytoolkit.googleapis.com`, `securetoken.googleapis.com` and the project's RTDB hostname. The SDK files are pinned locally in `vendor/`.
3. Copy the **public** configuration fields from `firebase-config.example.js` into the staging `cloud-config.js`. Set `requireAuth: true` and `requireOwnerClaim: true`. Keep the production legacy config until the cutover is ready.
4. Review and test `database.rules.example.json` in emulators, then deploy it to staging with an explicit project ID. Never rely on the default alias to select a real project.
5. Grant the owner claim using trusted Admin SDK access. Application Default Credentials must be supplied securely by the operator's environment. This cloud coding environment has no configured Firebase Admin identity; no production claim changes were attempted.

The owner CLI is read-only by default. It prints a review plan without loading credentials or making a network request:

```sh
node scripts/firebase-owner.mjs --project YOUR_STAGING_PROJECT --uid OWNER_UID
```

After checking the project and UID, apply that exact change:

```sh
node scripts/firebase-owner.mjs --project YOUR_STAGING_PROJECT --uid OWNER_UID --apply
```

The command preserves unrelated custom claims and refuses to grant access to a disabled account. `npm --prefix firebase run owner -- ...` invokes the same canonical script. `--emulator 127.0.0.1:9099` accepts only a `demo-*` project and never targets a real Auth backend. To remove owner access, review and then apply the revoke plan:

```sh
node scripts/firebase-owner.mjs --project YOUR_STAGING_PROJECT --uid OWNER_UID --revoke
node scripts/firebase-owner.mjs --project YOUR_STAGING_PROJECT --uid OWNER_UID --revoke --apply
```

Revocation also revokes refresh tokens, but an existing ID token may remain valid until expiry/refresh. It is not an immediate lost-device kill switch. After granting or changing claims, use **Semak akses semula / Check access again** in the app or sign in again. An account without the boolean owner claim must remain unable to approve sync.

For a reviewed rules deployment, run this from `firebase/`, replacing the project placeholder deliberately:

```sh
npx --no-install firebase deploy --only database --project YOUR_STAGING_PROJECT --config ../firebase.json
```

The client owner binding and the PIN do not authorize database access. Keep [the security boundary](firebase-security.md) in mind when inspecting any permission error.

## Staging acceptance

Use a separate browser profile with test records. Check all of these before production cutover:

- Signed-out local entry, reload and login; the retained record must survive an older cloud value and expose a conflict when necessary.
- Owner claim absent/present, consent cancelled/approved, logout, token refresh, a different UID, and a saved login after reload.
- Both devices editing different dates, both editing the same date, and edits queued during another write; check visible data and final cloud records.
- Offline/online reconnect, denied rules and failed index writes; pending work must remain recoverable and online status must reflect an acknowledged connection.
- Recovery preview/download, conflict choice and archive removal; exported backups must contain all local months and calculation snapshots.
- Monthly history uses `_meta/months`; a legacy namespace without an index is discovered once and the index is bootstrapped without repeatedly downloading the full owner subtree.
- Known cloud deletion and an empty initial namespace are treated distinctly. Verify totals, trips, side jobs and one-page monthly PDFs after import/sync.

Unit/browser fakes cannot establish these results against deployed Firebase. Keep the real emulator outcome and the staging-project acceptance evidence separate from the client tests.

## Inventory, migration and production cutover

Follow [offline migration](firebase-migration.md) to collect a **complete Firebase Console export** plus a fresh all-month backup from every device. Keep inputs and outputs in a private directory or Git-ignored `.firebase/migration/`. The offline tool inventories cloud-only months, detects differences, requires review choices and emits a proposed owner subtree, app backup, quarantine and comparison manifest. It never uploads data, changes rules, creates accounts or replays raw queue entries into another UID.

For production, use this order after staging acceptance:

1. Pause edits on every device and take fresh database/device backups. Keep the previous deployment available. Rebuild and review the migration artifacts from these final inputs.
2. Enable the intended Auth provider, create the owner, and grant the reviewed owner claim on the real project. Confirm the project/UID independently.
3. Import the reviewed `owner-subtree.json` at **exactly `users/<OWNER_UID>`**, not database root. Console/Admin imports bypass client validation and may replace the selected subtree; check the destination and preserve its current export first. Include `_meta/months` and shared settings/destinations from the artifact.
4. Export the destination and compare normalized record/settings/destination hashes and counts. Review intentional differences against the migration choices, including archived/conflicting work. Do not treat a matching count alone as matching records.
5. Publish the authenticated client configuration and reviewed rules together in a coordinated cutover. Rules intentionally deny `users/default`; old clients must stop writing. Increment `release.js` for any cloud config/asset change so installed PWAs load the new config.
6. On each device, install/reload the release, check the signed-in identity and approve only data that belongs to that owner. Resolve retained legacy queues using the reviewed migration evidence rather than changing their paths by hand.
7. Verify a second device, complete history, settings snapshots, report totals and sync acknowledgements. Retain the old namespace and private backups until the result is accepted; source changes do not automatically delete it.

If acceptance fails, pause edits and export both the owner namespace and every device's new pending work before rollback. Recover from the reviewed snapshot/previous deployment in an isolated staging copy first, then reconcile any post-cutover edits. Reopening unauthenticated rules is not a data-recovery strategy. Record which deployment, rules and migration manifest were used.

## Optional App Check

`firebase-config.example.js` leaves App Check disabled. `cloud-runtime.js` supports the pinned compat SDK with a public **reCAPTCHA v3** site key and optional automatic refresh. If enabled, activation runs before Database/Auth initialization. Configure it only after the app is registered in Firebase App Check and the allowed site domains are ready:

```js
appCheck: {
  enabled: true,
  provider: "recaptcha-v3",
  siteKey: "YOUR_PUBLIC_RECAPTCHA_V3_SITE_KEY",
  autoRefresh: true
}
```

The pinned SDK uses `content-firebaseappcheck.googleapis.com` and `www.google.com/recaptcha/`; reCAPTCHA also loads assets from `www.gstatic.com`. A restricted network must allow those services before opting in. The default Firebase environment draft does not enable this optional network access.

Do not commit debug tokens or a private reCAPTCHA secret. Start with Firebase's metrics/monitoring, test installed PWAs, offline reloads and every deployment domain, then enable enforcement only for supported Firebase resources after valid traffic is confirmed. Loading this client SDK does not enable enforcement on a project. App Check adds abuse protection; Auth claims and rules still protect ownership. Keep it disabled in demo emulator config.

## Current external prerequisites

Check the real project's RTDB Usage page for stored bytes, downloads and simultaneous connections, and configure available Google Cloud budget/usage alerts for its billing plan. An alert does not cap spending. Record the normal usage after cutover so an unexpected full-subtree download or connection increase can be investigated.

Inspect the project's supported automated RTDB backup options and retention under its actual plan. Keep periodic full Console exports in private storage when managed backups are unavailable, and keep device backups separately because cloud exports omit unsynced edits. Assign a backup schedule and retention period, then rehearse restoration into an isolated staging database and compare hashes, monthly counts, settings snapshots and report totals. No scheduled server backup or billing alert has been configured by this release.

Validation on 2026-10-25 passed **15/15 real Auth/RTDB emulator cases** using the official Database emulator, writable development cache and loopback-only proxy handling. There were no failed, cancelled or skipped cases. This result does not validate a production rules deployment or migrate real records. Real Firebase project access is still required for account provisioning, deployed-rule evaluation, migration and App Check enrollment/enforcement. A saved environment draft lists the relevant Google/Auth hosts, but saving a draft does not change the running environment or deploy Firebase configuration. No production changes are claimed by this release.
