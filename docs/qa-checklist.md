RezaOT v72 regression and release checklist

Run the automated suites from the repository root:

```sh
node --test tests/*.test.js
python3 tests/ui_browser.py
python3 tests/integration_browser.py
python3 tests/detail_browser.py
python3 tests/redesign_browser.py
python3 tests/pdf_report_browser.py
```

The browser suite needs Python Playwright and a Chromium executable. Tests use isolated local data and a fake Firebase backend; they must not read or write the owner's production records. Package/runtime installation is only needed for the test tooling, not to serve the app.

Check these behaviors against the local development server before publishing an app update:

- Startup with existing local records and an empty remote snapshot retains the records. A queued edit remains pending across reload; incoming remote data does not silently discard it. Edits immediately after a snapshot also reach the queue/cloud.
- Offline changes to attendance, trips, destinations, salary, OT, company holidays and supervisor name survive reload/reconnect. A deliberately empty destination list remains empty on another device. Invalid/corrupt local JSON is retained for recovery while the app stays usable.
- Saving a September date while October is selected is rejected or explicitly switches to the correct month. Changing month updates form bounds and does not write into the previous month's path.
- ANN and UPL can be saved with empty clock times and contribute zero OT in desktop, mobile, salary, print, PDF and Excel. Editing a leave day restores its flags accurately.
- Monday 08:00–19:00 gives 2 OT hours; Saturday 08:00–17:00 gives 3; Sunday 08:00–17:00 gives 9 without a rest deduction; Monday 08:00–02:00 gives 9. Equal clock-in/out gives 0. KLIA Cargo on a normal weekday gives 0 OT. Only company-observed holidays use the holiday rule.
- Susun contributes RM100/AWB and Pallets RM50/AWB in the separate side-income section. Canceling a duplicate warning changes nothing. Editing/deleting a trip keeps its structured metadata and sideJobs consistent; deleting its last matching AWB removes the side income.
- PDF exported from a 390 px viewport contains the report table, readable headers, signature columns, one total-OT row and the one-line footer. Repeat in Portrait and Landscape. Salary, app controls and duplicate mobile cards are absent. Canceling or failing an export restores the normal screen and clears busy status.
- Export both a short month and all 31 days with multiple trips/long AWBs per day. Portrait and landscape must each produce exactly one A4 page containing every record, signature column, total OT and footer. Check native printing too. Denser months scale proportionally after compact formatting; no records may be cropped or hidden to meet the page limit. Screen-only height limits and search filters must not truncate the PDF.
- Excel works on the first click after a fresh load without opening PDF first. Its OT values and Susun/Pallets marks match the report. Failing the PDF dependency must not prevent Excel, and vice versa.
- Backup v2 includes all locally retained months and calculation/settings snapshots. Invalid record shapes, dates, times or side jobs are rejected before mutation. Import preview identifies the source month(s), counts and merge/replace choice. A recovery snapshot exists before replacement; canceling leaves current data unchanged. Legacy single-month backups still restore to their declared month.
- Salary input rejects nonfinite/negative values and invalid divisors/rates while accepting supported zero values. OT start times accept real HH:MM only. Changing global salary settings does not silently recalculate a retained month's captured snapshot; replacing that snapshot is explicit.
- Custom company holidays can be added/corrected and selected. Catalog dates marked estimated remain visibly estimated. No test assumes unofficial dates or turns estimated payroll into a legal filing.
- Mobile cards provide per-trip Edit/Delete plus whole-day actions. Dialogs trap keyboard focus, return focus after closing, support Escape/cancel, and expose labels/status to assistive technology. BM/EN, dark mode and PIN locking remain usable.
- After one online visit, offline reload starts without an external Firebase CDN response. A failed mandatory asset prevents a new service worker from replacing the prior complete cache. Activation deletes only obsolete RezaOT caches, preserving another app's cache on the same origin.
- No missing required module is reported as ready. Startup and sync statuses distinguish local/offline, pending, permission denied, authentication and complete state.
- Optional Auth mode leaves legacy default behavior unchanged until configured. In Auth mode, signed-out and unapproved accounts make no cloud writes; sign-out closes listeners while keeping local data. Follow `firebase-security.md` for emulator/staging rules and migration tests before production rollout.

Automated unit/browser checks demonstrate the application paths they exercise; they do not establish payroll-law compliance, production database authorization, successful publication or device-specific printing behavior. Record any manual platform/browser checks separately from automated results.
