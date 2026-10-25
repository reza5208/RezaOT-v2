# Offline Firebase migration rehearsal

`scripts/firebase-migration.mjs` prepares a reviewed move from `users/default` to `users/<owner UID>`. It has no networking, Firebase Admin dependency or deployment command. Running it never changes Firebase, account claims, application configuration or the source files.

Use the full legacy cloud export and a current backup from **every device**. An app backup contains locally stored months, not every month listed in cloud history. Devices that are offline or still have unsent edits must be inventoried before cutover. The [operations guide](firebase-operations.md) covers Auth, rules, staging, cutover and rollback.

## Capture the sources

1. Pause legacy edits on every device during the final capture. Record the project, database, selected namespace and capture time.
2. Export the complete `users/default` subtree in Firebase Console. A full database export containing `users.default` is also accepted. Exporting only the currently displayed month is incomplete.
3. Download the app's all-month JSON backup from each browser/device. Keep each original file. v74 backups also contain `syncState` evidence for pending revisions, signed-out edits and unresolved conflicts. Older backups remain accepted, but do not establish whether that device had an unexported queue.
4. Keep copies in a private directory. `.firebase/` is Git-ignored; the example uses `.firebase/migration/`. Do not commit actual exports, generated plans, quarantine files or account UIDs used with real records.

The tool accepts schema-version-2 app backups and Console JSON exports. A Console subtree and an app backup are different formats. Invalid dates, unknown record/settings fields, malformed collections and values outside the server schema stop the rehearsal instead of being discarded. A month marked `deleted: true` also stops planning for a separate deletion review; the tool never reconstructs a live month from a tombstone.

## Inventory and plan

Run from the repository root with Node 22 or newer:

```sh
node scripts/firebase-migration.mjs inventory \
  --cloud .firebase/migration/legacy-export.json \
  --device .firebase/migration/phone-backup.json \
  --device .firebase/migration/laptop-backup.json

node scripts/firebase-migration.mjs plan \
  --cloud .firebase/migration/legacy-export.json \
  --device .firebase/migration/phone-backup.json \
  --device .firebase/migration/laptop-backup.json \
  --out .firebase/migration/review-1
```

The cloud scope defaults to `users/default`; use `--scope users/UID` for a different existing namespace. Source IDs are `cloud`, `device-1`, `device-2`, and so on, in the supplied order.

The new output directory contains:

| File | Purpose |
| --- | --- |
| `inventory.json` | Per-source month, daily-record, trip and side-job counts; settings/snapshot coverage; normalized SHA-256 hashes. |
| `plan.json` | Source fingerprints, all variants and quarantined sync evidence. Keep this unchanged. |
| `review.md` | Paths that need a choice or an explicit deletion decision. |
| `resolutions.example.json` | Template to copy and edit as the separate resolution file. |

Every cloud-only month remains in the plan. Two devices that contain the same month but disagree about a date require review. An absent date is not interpreted as a deletion. Different records on the same date require a choice even if one device timestamp appears newer. Separate dates can be retained together.

Settings snapshots are reconciled by month; holiday maps are reconciled by date. Destination lists require an explicit choice when they differ. Without shared destination metadata, a union derived from legacy month lists requires source acknowledgement because removals cannot be inferred. Empty maps omitted by RTDB are normalized to the same empty collections the app uses.

## Resolve the review

Copy `resolutions.example.json` to a separate file and replace every `REVIEW_REQUIRED` value. Use the conflict IDs from `review.md`/`plan.json`; do not edit the plan. A resolution has this shape:

```json
{
  "acknowledgeSources": ["device-1:pending:0"],
  "excludeSources": {},
  "choices": {
    "c_ID_FROM_PLAN": { "source": "device-1" },
    "c_ANOTHER_ID_FROM_PLAN": {
      "delete": true,
      "reason": "Confirmed deletion against the signed-off device records"
    }
  }
}
```

Choose a source where the value is present. Selecting a source where it is absent is rejected; a deliberate deletion needs `delete: true` and a written reason. The example IDs above are placeholders, not valid choices for an actual plan.

Sync-state handling is explicit:

- A pending legacy revision can become an additional candidate such as `device-1:pending:0`. A signed-out dirty revision can become `device-1:dirty:0`. Acknowledge or exclude each recovered candidate before building.
- Dirty candidates bound to an owner UID cannot be used for a different target owner. Exclude them with a reason and review them separately.
- Pending paths in another namespace stay in quarantine and do not become import candidates. Conflict evidence and invalid/unknown queue payloads also stay in quarantine.
- `excludeSources` maps a source ID to a reason of at least five characters. Exclusion is a deliberate review decision; it can remove unique values from the resulting data.
- `--ack-quarantine` confirms review of that evidence. It never executes, repaths or deletes the raw queue.

No winner is selected from a client clock. An edited plan or a source file changed after planning is rejected; regenerate the plan when a source changes. The hashes detect changes during the review workflow, not the authenticity of an untrusted export.

## Build private artifacts

```sh
node scripts/firebase-migration.mjs build \
  --plan .firebase/migration/review-1/plan.json \
  --resolutions .firebase/migration/resolutions.json \
  --owner OWNER_UID \
  --ack-quarantine \
  --out .firebase/migration/rehearsal-1
```

Use the actual approved Firebase UID in place of `OWNER_UID`. The target cannot be `default`. If no quarantine exists, `--ack-quarantine` is unnecessary. The build stops while any conflict or required source acknowledgement remains unresolved.

The output is created only in a **new** directory. Files have mode `0600`; the new directory has mode `0700`. Existing directories/files are never overwritten.

| Artifact | Purpose |
| --- | --- |
| `owner-subtree.json` | Validated data for the single `users/OWNER_UID` subtree, with `_meta/months` and transport metadata. |
| `app-backup.json` | Schema-version-2 local restore/rehearsal backup of the approved records and cloud settings. |
| `quarantine.json` | Original sync evidence, excluded-source reasons and per-device appearance/language preferences. Raw queue paths are retained as evidence only. |
| `manifest.json` | Target path, source/output hashes, counts, review choices and acknowledgements; `productionWritten` remains `false`. |

PINs and Firebase sessions are not input settings. Device appearance and language preferences stay outside the cloud output. Generated `app-backup.json` does not replay sync-state paths when imported into the app.

## Rehearse and compare

First import the approved owner subtree into an isolated staging project's `users/OWNER_UID` node using authorized Firebase administration. Select that node explicitly; the artifact is not a whole-database or `users` export. Keep staging browser storage separate from production. This import is a separate operation; the offline CLI does not perform it.

Export the staging owner subtree again and compare it with the approved artifact:

```sh
node scripts/firebase-migration.mjs compare \
  --before .firebase/migration/rehearsal-1/owner-subtree.json \
  --after .firebase/migration/staging-owner-export.json \
  --after-scope users/OWNER_UID
```

Exit codes are `0` for equivalent normalized content, `3` for a content difference, and `2` for invalid input or an incomplete review. Comparison includes record values and settings/destination hashes, not just counts. Revisions and transport timestamps are excluded. A deliberate local correction can differ from the original legacy export, so compare the staging readback against the **approved** artifact as well as reviewing its original-source inventory.

Verify the app on two isolated staging clients: all months, month settings, salary estimates, trips/side jobs, PDF output, offline edits, same-date conflict resolution, signed-out edits, login/logout, and reconnect. Keep the source exports, choices, manifest and staging readback together. Only after this rehearsal should a fresh final capture and coordinated production cutover begin. Returning to an old release alone does not restore data, account claims or rules; retain the rollback material described in the operations guide.

Run the offline tool's regression suite with:

```sh
node --test tests/firebase-migration.test.js
```
