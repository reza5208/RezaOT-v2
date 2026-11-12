# v77 — Read-only HR report links

Owner flow: Records → choose month → Export → Share with HR. Create a 7, 30 (default) or 90 day link, copy it, then send it manually to HR. Manage links for that month in the same panel from any authenticated owner device. Update replaces the snapshot and renews its expiry using the selected duration; revoke deletes the public report and its private index atomically. Updating preserves the link. Records are not published automatically.

The snapshot includes the entire selected month's print-facing table (including rows hidden by a search/filter), employee/report header, OT total, footer, and two blank signature columns. It excludes salary, account information, application settings, other months and editing controls. It contains JSON-encoded text, never raw HTML or the app's local/cloud state. The viewer writes textContent only. It does not load the application, Firebase Auth or the Firebase SDK, and does not access local app records.

## Firebase Console step (required before creating a working link)

Publish the complete `database.rules.owner.json` in project **reza-ot → Realtime Database → Rules**. Preserve the pinned owner UID. This change extends v76 with a separate `sharedReports/<256-bit-random-token>` namespace. The existing `users/default` data remains owner-only. Publishing source to GitHub Pages does not publish Firebase rules.

- Public reads require an existing exact 64-hex token and server-side expiry in the future. No read permission is granted on the report collection or database root. Listing and unknown/revoked/expired tokens are denied.
- Only the pinned owner can create/update/delete a shared report. Payload fields and size are validated; expiry is bounded at 90 days plus five minutes of clock tolerance, and the update timestamp must be within five minutes of server time.
- A private month/token index under `users/default/_meta/hrShares` allows cross-device management. Only the pinned owner can write/delete this metadata, including when its removal would empty the private namespace. Whole `users/default` deletion is still denied.
- Creating/updating/revoking uses one acknowledged multipath update. Sharing is not placed into the app's durable offline queue. No link is announced until Firebase acknowledges the write. Offline sharing controls report an error.
- The standalone `hr.html#token` viewer uses anonymous, no-store GET requests only, with no credentials/referrer. No analytics, third-party assets or token persistence. It is excluded from service-worker app-shell navigation fallback.
- The viewer refreshes every 30 seconds while visible, on returning to the tab, and before a new export. Denial, expiry or network failure clears the displayed data. Revocation closes future reads, not copies already obtained. This is bearer-link access: anyone receiving/forwarded the link can read the snapshot. It is not HR identity verification, approval tracking or DRM. Native browser print/screenshot/save cannot be prevented.

HR opens the link without logging in, reads the snapshot and its update/expiry timestamps, and chooses A4 portrait/landscape to print or download a PDF. The existing fitted single-page renderer is reused. Viewer chrome supports BM/EN; the report text preserves the owner's language at publication.

## Validation

157 Node unit tests and 17 Auth/Database emulator tests pass locally, including anonymous/other-user write denial, private-data denial, listing denial, server expiry, revocation, malformed/oversized payloads, and atomic report/index publish/update/revoke. Browser regression coverage is in `tests/hr_share_browser.py`, run by App regression QA in GitHub Actions. Local Chromium launch is blocked by this execution environment's Unix socket permissions; shared browser cannot reach its localhost server. CI runs the browser tests without production requests.

No production report, private record or Firebase rules were modified as part of source implementation. Console publication and an owner-created live link remain the final production checks.
