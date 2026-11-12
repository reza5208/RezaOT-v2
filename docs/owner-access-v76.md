# v76: owner login without moving legacy records

The existing owner supplied the current production rules: `users/default` has unconditional read/write access. The app backup was validated (four months, 73 days); the owner chose to skip a complete cloud export. This release therefore secures the existing namespace **in place** rather than moving data based on an incomplete cloud inventory.

`cloud-config.js` now requires email/password Firebase Auth and pins the provided owner UID. No custom claim/Admin SDK action is needed for this single-owner mode. The UID is an identifier, not a credential. Firebase-signed ID tokens and deployed RTDB rules enforce authorization; the client UID check alone is not a security boundary.

- Signed-out, wrong-UID, and unapproved-local-data sessions cannot obtain a cloud root.
- The approved pinned owner continues using `users/default`.
- Existing cached data, revisions, baselines and queued paths stay unchanged.
- New signed-out edits are durably retained and bind to that same root only after the matching owner's explicit local-data approval. Other accounts cannot take over that approval.
- Generic multi-owner/claim mode remains available when no `legacyOwnerUid` is set.

## User cutover

1. Update every device to v76 (use the app's update prompt if shown).
2. Settings → Account cloud: sign in to the already-created owner account with its own password; approve local-data ownership. Check historical months and sync acknowledgement. If password is unknown, use the app's reset option; enter passwords only into Firebase/app, never chat.
3. Replace the currently open database rules with `database.rules.owner.json` in the Firebase Console and Publish. All old unauthenticated clients then lose cloud access until updated and signed in, while their local records remain.
4. Verify the owner can read/update its data on two devices, and that anonymous reads fail after Publish. Do not restore public rules to resolve a login issue.

These owner rules restrict **access**, retaining the existing flexible record schema for legacy compatibility. They deny other database paths and deletion of the entire legacy namespace. The separately tested strict UID/claim schema in `database.rules.example.json` is a future migration target, not the rules to paste for this cutover.

No production rules or data are changed by the GitHub commit. Production access remains open until the owner publishes the exact owner rules in Firebase Console.

## Tests

`node --test tests/*.test.js`, `npm --prefix firebase test`, and fake-cloud browser tests in `tests/owner_access_browser.py` plus the existing regression workflows. The emulator verifies owner read/write at real legacy child paths, rejection of anonymous/other UIDs, sibling-path isolation, and denial of whole-namespace deletion. Browser tests verify sign-out, wrong-owner rejection, local-data approval, signed-out queued edits, and reading existing history without relocation.
