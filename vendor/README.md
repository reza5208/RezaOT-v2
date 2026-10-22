These local assets allow startup and exports without a third-party CDN at runtime.

- Firebase compat app/database/auth 10.14.1: Apache-2.0, official npm `firebase` package.
- html2pdf.js 0.12.1: MIT, official npm package; bundled dependency notices remain in the artifact.
- SheetJS CE xlsx 0.18.5: Apache-2.0, latest version on its original npm package. The app uses it for workbook creation/export and does not accept spreadsheet uploads. This is not the latest upstream CE release or a security-audit claim. A newer release requires obtaining the official artifact and validating compatibility before changing the pin; `cdn.sheetjs.com` was denied by the setup network policy.
- `../styles-base.css`: the repository's own stylesheet from commit `81d9af1125e1aadd9bd837abda445647ba318d3b`, retained locally rather than imported at runtime.

`manifest.json` records source package URLs, pinned versions, npm SHA-512 package integrity and SHA-256 artifact hashes. Artifacts were extracted only after checking package integrity over verified HTTPS. Do not remove license headers or disable TLS/integrity checks.

Run `python3 scripts/vendor.py` from the repository to verify retained files. `python3 scripts/vendor.py --restore` restores the exact recorded artifacts; it never changes expected checksums to match a download. Dependency upgrades require deliberately reviewing new upstream metadata and updating the manifest and release version.

Firebase license copy: https://raw.githubusercontent.com/firebase/firebase-js-sdk/firebase@10.14.1/LICENSE (upstream 10.14.1 tag). The Firebase bundles are retained unchanged from the integrity-checked npm package.
