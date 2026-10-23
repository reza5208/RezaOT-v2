# PDF export correction v72

A reported portrait PDF split a short ten-day report across two pages, cut the final row and omitted its total OT and footer. A local fixture with multiple trips and long sample AWBs reproduced the problem without accessing the owner's Firebase data.

The phone table's `max-height: 70vh` also applied to the portrait canvas clone. Overflowing rows extended beyond their wrapper, so the footer overlapped the table and the export canvas stopped before the report ended. Responsive cell padding and the default 15px cell font also changed the layout between pagebreak calculation and rendering at A4 width.

The document stylesheet now removes the wrapper height limit, sets consistent PDF cell sizing and column widths, allows complete weekday words, and removes sticky positions. Cell fonts inherit the document's density setting. Longer months use a compact trip list with visible separators before the final page fitting. The release/cache version is 72 so devices can receive the corrected stylesheet together with the app.

The entire selected month is rendered without pagination spacers, then fitted proportionally inside one A4 page with the selected orientation and margins. The complete source image is used, including all dates, trips, signatures, total OT and footer; no records are truncated to achieve the page limit. Text becomes smaller for denser months. PNG output keeps report lines and text sharp. Native printing uses the same fitted image so it follows the one-sheet rule as well. Record data, OT calculations and salary formulas are unchanged.

The PDF regressions cover a short ten-day report, a full 31-day month, a dense month with eight trips per day (248 trips), native printing and failure cleanup. Both orientations must produce exactly one physical A4 page. Tests inspect the complete source and its proportional mapping into the final page, including painted footer content, to detect cropping or omitted trips.

Validation: 115 passing checks across 74 Node tests, 8 isolated UI tests, 13 full-app integration tests, 4 detail-layout tests, 10 redesign tests and 6 PDF/print regressions. The generated 31-day sample PDFs were also visually reviewed in portrait and landscape.

`tests/pdf_report_browser.py` inspects the final html2canvas clone and raster canvas, including the last row, total, footer placement and actual footer ink. It also checks that export preserves the selected view, theme, search, scroll position and unsaved input. Tests use fake Firebase and block outbound connections. Run this suite together with the existing Node and browser suites listed in the [QA checklist](qa-checklist.md).
