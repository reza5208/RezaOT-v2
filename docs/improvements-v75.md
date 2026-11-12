# RezaOT v75 improvements and security review

## Changes

- Keeps existing attendance, OT, payroll, PDF/Excel, backup/import and recovery formulas/workflows. New advisory warnings flag zero/>16-hour shifts and overlapping overnight attendance. They require confirmation, then recheck the original date context. Duplicate AWB checks now include retained local months and trip edits, with confirmation. Months not downloaded to this device are not searched.
- Favorite destinations and repeat-last-trip fill the form only. Recheck date/AWB before saving. Favorites, actual payslip reviews and imported income summaries are device-local and included in JSON backups. These private extras do not expand the cloud settings schema.
- Undo restores the deleted day/trip snapshot only if the current month, owner and post-deletion record remain unchanged. Normal sync conflict safeguards still apply; a concurrent cloud change is not force-overwritten.
- Last cloud acknowledgement is persisted per cloud root and displayed with connection/pending status on Today.
- Salary shows selected work month and expected next-month OT/allowance payment month. Actual net payslip + additional side receipts are recorded separately by payment month. It can compare actual net with a payment-month estimate only when both that month's and the previous month's records are available on this device. It uses payment-month basic/unpaid leave/deductions and previous month's OT/allowance. Existing estimation assumptions remain; tax and employer-specific adjustments are not inferred. No official payroll result is claimed.
- Export a reviewed received-income summary for RezaDrive and import RezaDrive's before-fuel balance. Per-month reimports replace rather than add again. No raw trips/payslips/credentials travel in these summary files. The combined total remains before Lalamove fuel, service and depreciation; it is not fully costed profit.

## Read-only production finding, 13 November 2026 MYT

An unauthenticated GET to an intentionally nonexistent descendant of the legacy `users/default` namespace returned HTTP 200 (null). This demonstrates read permission at that probe path; no actual records were requested or printed, and no production write was attempted. The exact deployed rules were not retrieved. It does not prove every child path is open or determine write permission.

Production `cloud-config.js` still has `requireAuth: false`, and the legacy root is required by existing clients. Closing it without a verified migration risks loss of access. Source target rules enforce owner UID and `rezaot_owner` claim; 15 existing target-rules/Auth tests passed in the local demo emulator. This is evidence for target rules, not evidence of production deployment.

### Prepared cutover sequence

1. On every device, export all-month JSON plus pending/conflict recovery copies. Finish or explicitly reconcile offline work. Retain the originals outside browser storage.
2. Enable the Firebase Auth provider, create the owner's account and obtain its UID in Firebase Console. Do not paste passwords or service-account keys in chat or GitHub.
3. Use the existing trusted-admin provisioning tool (`scripts/firebase-owner.mjs`) to assign the owner claim, and existing offline inventory/migration tooling (`scripts/firebase-migration.mjs`) with its documented dry-run mode. Confirm source inventory and target ownership. See `firebase-operations.md` and `firebase-migration.md`; do not infer unsupported CLI flags.
4. Test rules and account isolation in staging/demo. Stage a reviewed target copy, verify month/settings/destination counts and sample calculations against backup, and confirm login/owner binding on two devices before changing the production client gate.
5. Deploy reviewed UID rules and opt-in Auth configuration as a coordinated migration; close legacy access only after the owner client works. Do not leave both namespaces writable with independent client histories.
6. Recheck anonymous, non-owner and owner access at actual used child paths; retain rollback backup and reconciliation evidence. Do not reopen public access as a routine rollback.

No production database/rules/Auth changes were made for this release. A privileged Firebase connection and a verified owner UID/cutover are required to finish live hardening; the GitHub connection alone cannot do it.

## Validation

- `node --test tests/*.test.js`: existing suite plus payment-month, overlap, summary and local-extra validation tests.
- `npm --prefix firebase test`: demo Auth/RTDB target-rule tests, no production credentials.
- `.github/workflows/app-qa.yml`: unit tests, new fake-cloud improvements UI tests and existing responsive/recovery/PDF regression suites. Local Chromium launch in the agent command sandbox was blocked by `socket() Operation not permitted`; shared Chrome was used for manual fixture checks instead.

The existing monthly PDF/Excel layout remains unchanged. Personal payslip/combined-income panels are app-only and excluded from the official OT print report.
