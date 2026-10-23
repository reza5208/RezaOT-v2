# RezaOT v72

PWA peribadi untuk rekod **Clock-In/Out**, **Trip**, **OT**, dan **anggaran gaji**  
WH3 Transport — **Khairul Reza** (M-264)

**Live:** GitHub Pages / hosting yang sama dengan repo ini.

---

## Ciri utama

### Kehadiran & trip
- Clock-in/out (default **08:00–17:00**) + butang **Sekarang**
- **Simpan Hari Ini (8–5)** — satu klik
- Trip + **KLIA Cargo + AWB** (amaran jika AWB duplicate)
- **Side job** selepas AWB:
  - **Susun (RM100)** → tanda `*` (contoh: `KLIA Cargo (ABC123) *`)
  - **Pallets (RM50)** → tanda `#` (contoh: `KLIA Cargo (ABC123) #`)
- Flag **UPL** (cuti tanpa gaji) / **ANN** (cuti tahunan) → OT = 0
- Edit / padam trip individu pada kad mobile; side job diselaraskan bersama trip
- Edit / padam rekod & trip (modal confirm)

### OT & cuti

| Hari | Peraturan OT |
|------|----------------|
| Isnin–Jumaat | Selepas **17:00** (×1.5) |
| Sabtu | Selepas **14:00** (×1.5) |
| Ahad | Semua jam (×2) |
| Cuti company | Semua jam (×2.0) |
| KLIA Cargo | Tiada OT (hari biasa / Sabtu) |
| Overnight | Sokong (cth. 08:00 → 02:00 keesokan hari) |

- Katalog cuti umum Malaysia (KL / Selangor) + **picker** cuti yang company ambil
- Cuti company tersuai; tarikh katalog yang dianggarkan mesti disemak sebelum digunakan
- Settings OT (masa mula weekday / Sabtu) boleh diubah
- Base rate anggaran: `gaji pokok ÷ 208`

### Laporan
- Print / PDF **satu helaian A4 untuk sebulan**, portrait atau landscape; saiz disesuaikan mengikut kandungan
- Kolum **T/T pekerja** & **T/T ketua**
- Baris **JUMLAH OT** (bold) — **print/PDF sahaja**, tak keluar di UI
- Footer ringkas: `OT · Trip · KLIA · AWB`
- Tarikh format **dd/mm/yy**
- Export **Excel** (auto-fit + T/T + tanda Susun/Pallets)
- **JSON backup v2** semua bulan lokal + settings, preview import, merge/replace dan recovery snapshot
- Snapshot tetapan mengikut bulan supaya anggaran sejarah tidak berubah tanpa tindakan jelas; edit defaults melindungi bulan lokal lama sebelum perubahan

### Anggaran gaji *(app sahaja — tidak keluar print)*
- Gaji pokok, OT (pecahan weekday / Ahad / cuti)
- Allowance KLIA **RM70 / hari** (hari ada trip KLIA Cargo)
- EPF 11%, SOCSO, EIS
- **Side income** berasingan dari **sideJobs list only**: Susun RM100/AWB · Pallets RM50/AWB (**bukan** digabung ke gaji bersih)
- Side job default: **Tiada**

### App
- Dashboard responsive: **Hari ini / Rekod / Gaji / Tetapan**, sidebar desktop dan navigasi bawah telefon
- Bahasa **BM / EN**, dark mode, PWA (installable), font Manrope lokal
- Firebase Realtime Database + offline queue
- **PIN lock** — kunci UI lokal; bukan authorization database
- Firebase Auth email/password **pilihan opt-in**, dengan pengesahan pemilikan data lokal sebelum sync
- Sejarah bulan cepat, FAB tambah trip (mobile)
- Multi-device sync

---

## Run dan test

App ini ialah HTML/CSS/JavaScript statik, tanpa build atau pemasangan package aplikasi.

```sh
cd RezaOT-v2
python3 -m http.server 8000 --bind 127.0.0.1
```

Buka melalui web server; service worker memerlukan HTTPS pada hosting atau localhost untuk pembangunan. Dependency startup dan base CSS disimpan secara lokal supaya offline reload tidak bergantung pada CDN luar. Excel/PDF mempunyai loader berasingan.

```sh
python3 scripts/vendor.py
node --test tests/*.test.js
python3 tests/ui_browser.py
python3 tests/integration_browser.py
python3 tests/detail_browser.py
python3 tests/redesign_browser.py
python3 tests/pdf_report_browser.py
```

Suite browser memerlukan Python Playwright dan Chromium (`/usr/bin/chromium` pada environment ini). Pada mesin lain, jalankan `python3 -m pip install -r requirements-dev.txt` dan `python3 -m playwright install chromium`; tetapkan `CHROMIUM_PATH` jika perlu memilih browser tertentu. Ujian menggunakan fixture/Firebase palsu dan tidak menulis ke database production. Lihat [senarai QA](docs/qa-checklist.md) untuk pemeriksaan manual sebelum release.

Salinan dependency dalam `vendor/` mempunyai versi dan checksum/integrity yang direkod dalam manifest vendor: Firebase app/database/auth 10.14.1, html2pdf 0.12.1, dan SheetJS CE npm 0.18.5. Versi SheetJS ini ialah versi yang tersedia melalui registry npm; sumber distribusi CE yang lebih baharu tidak dapat dicapai melalui policy rangkaian environment semasa. App menggunakannya untuk **menulis eksport Excel sahaja**, bukan membaca spreadsheet yang dimuat naik. Pengesahan integrity membuktikan provenance artifact yang dipilih, bukan audit keselamatan atau jaminan bahawa versi itu terkini.

## Multi-device / Firebase

- Mode sedia ada menggunakan `users/default/{Bulan Tahun}`, contoh `Ogos 2026`; mod ini dikekalkan secara default supaya akses pemilik tidak terputus.
- Model rekod cloud kekal last-write-wins per bulan. Pending writes, conflict recovery dan queue perlu diperiksa apabila dua peranti mengedit bulan yang sama serentak.
- Jika cloud kosong, data lokal tidak dipadam. Perubahan pending disimpan secara durable; kegagalan sync dipaparkan sebagai pending/offline/permission error.
- Tetapan, destinasi dan snapshot bulan turut mempunyai aliran sync. Senarai destinasi kosong ialah nilai yang sah.
- Export backup semua bulan sebelum import, pertukaran akaun atau migrasi. Recovery snapshot sebelum replace melindungi operasi import lokal; ia bukan pengganti backup berasingan.
- Deployment Firebase rules sebenar tidak diaudit atau diubah oleh perubahan source ini. Jangan anggap PIN lokal melindungi cloud.

Untuk memilih authenticated mode, gunakan `cloud-config.js` dan contoh [firebase-config.example.js](firebase-config.example.js). Mode ini menggunakan `users/<uid>` dan memerlukan login serta pengesahan bahawa data lokal milik akaun tersebut. Account lain tidak boleh mengambil alih binding data lokal dalam browser yang sama.

[database.rules.example.json](database.rules.example.json) ialah **contoh rules sasaran**, bukan deployment automatik. Menutup `users/default` sebelum migrasi akan memutuskan client lama. Ikuti [panduan staging, migration dan rollback](docs/firebase-security.md), sediakan akaun pemilik dan uji rules terlebih dahulu. Password, service-account JSON dan private key tidak boleh dimasukkan ke repo atau backup.

## Struktur fail (v72)

| Fail | Peranan |
|------|----------|
| `index.html` / `cloud-config.js` | UI shell dan konfigurasi cloud public / mode opt-in |
| `main.js` | Bootstrap modul wajib secara teratur; loader dependency eksport berasingan |
| `storage.js` / `sync-cross-v66.js` | Storage dengan recovery, durable queue dan sync deterministik |
| `model.js` / `backup.js` | Validasi data, metadata trip dan backup/import berversi |
| `main-app-1.js` / `main-app-2.js` | State bersama, forms, report dan Excel |
| `salary-estimator.js` / `utils.js` | Kiraan gaji/OT bersama dan snapshot tetapan |
| `constants.js` / `holiday-picker.js` | Katalog serta cuti company tersuai / observed |
| `mobile-cards.js` / `modal.js` / `i18n.js` | UI mobile, dialog accessible dan BM/EN |
| `dashboard.js` / `styles-dashboard.css` | Navigasi empat paparan, ringkasan, carian dan susun atur responsive |
| `styles-detail.css` | Kad rekod mobile dan pecahan gaji |
| `app-p1.js` | PIN lokal, nama ketua dan tindakan tambahan |
| `firebase-auth.js` | Login cloud pilihan, consent dan pengasingan pemilik lokal |
| `print-orient-v67.js` | Cetak/PDF Portrait dan Landscape |
| `sw.js` | PWA cache berversi; asset wajib mesti lengkap sebelum aktivasi |
| `tests/` / `docs/` | Regression tests dan panduan QA/security |

---

## AI / Grok context

### Domain rules (do not invent payroll law)
1. **OT clock rules** (hours for table):
   - Mon–Fri after **17:00**; Sat after **14:00**; Sun full span; PH (observed only) full span ×2.0 pay
   - KLIA Cargo Mon–Sat → OT hours **0** (allowance is separate money)
   - Sat OT after **14:00**; weekday after **17:00** (from settings)
2. **Pay multipliers** (salary estimator only): Mon–Sat ×1.5, Sun ×2, PH ×2.0; base = pokok ÷ 208
3. **KLIA allowance:** **RM70 per day** with ≥1 KLIA Cargo trip (not per AWB)
4. **Side jobs** (NOT added into net salary):
   - Susun **RM100**/AWB → mark `*`
   - Pallets **RM50**/AWB → mark `#`
   - Side income comes from the **sideJobs list only** (not trip-label markers)
   - Side job default is **Tiada** (empty)
   - Persist in `sideJobs[]` **and** on trip label string for display
5. **UPL / ANN:** forces OT = 0 that date in report, salary, mobile and every export
6. **Public holidays:** catalog in `constants.js`; **NOT taken by default** — user ticks the ones the company takes; only checked days count for OT/highlight

### Data model (per month)
- Month key: Malay name + year, e.g. `Ogos 2026`, `September 2026`
- `dailyRecords[YYYY-MM-DD] = { clock_in, clock_out, trips: string[], tripDetails?: object[], sideJobs?: {awb, type}[], unpaid?: boolean, annual?: boolean }`
- Legacy trip labels kekal disokong; metadata trip berstruktur mengekalkan identiti dan hubungan AWB/side job
- Local: `localStorage`; remote legacy: Firebase RTDB `users/default/{monthKey}`; authenticated opt-in: `users/<uid>/{monthKey}`
- `monthSettings` menyimpan snapshot tetapan pengiraan; capture/replace ialah operasi jelas, bukan side effect membaca laporan
- Sync: last-write-wins; **never clear local when remote empty** — push local up

### UI / export constraints (user-enforced)
- Print/PDF: **A4 Portrait default**; **Landscape option available** (print-orient modal)
- Laporan seluruh bulan mesti muat **satu helaian A4** dalam kedua-dua orientasi. Padatkan susun atur dan skalakan kandungan penuh secara berkadar; jangan potong rekod, trip, jumlah OT, footer atau kolum tandatangan.
- Table row **JUMLAH OT**: **print/PDF only**, hidden in normal UI; label must be human (`JUMLAH OT` / `TOTAL OT`), never raw i18n key like `totalOTRow`
- Print footer: **one-line** note (`OT · Trip · KLIA · AWB`), not a summary table
- Report dates: **dd/mm/yy**
- Sign columns: short **T/T pekerja**, **T/T ketua**
- Salary panel: **app-only**, never on print/PDF
- Avoid double PDF download / empty PDF (busy flags in print handlers)

### Architecture
- Boot: `main.js` memuatkan dependency/modul wajib mengikut urutan, kemudian mengeluarkan `rezaot-ready`. Render data mengeluarkan `rezaot-report`; feature tidak memerlukan timer yang menimpa fungsi core.
- Gunakan state dan fungsi kiraan bersama; jangan tambah lapisan patch yang bergantung pada masa. Naikkan `version` dalam `release.js` selepas perubahan asset atau cloud-config.js; cache service worker mengikuti versi itu.
- OT settings keys: UI stores `weekdayAfter` / `saturdayAfter`; `getOtSettings` must also expose `weekdayStart` / `saturdayStart` aliases for `calculateOT`
- Firebase web API key in client is expected; hardening must not lock owner out without explicit request
- **Security:** jangan deploy production rules atau migrasi akaun tanpa backup, staging checks dan arahan pemilik. Rules contoh adalah persediaan sahaja; akses production sebenar mesti diuji pada child path yang digunakan.

### When changing code
- Commit/push hanya selepas arahan eksplisit pengguna; perubahan lokal dan test tidak membenarkan push secara automatik
- After print CSS or OT logic change → bump SW cache
- Retest: overnight OT, KLIA weekday (0 OT hours), Sunday full OT, UPL, side marks in table/print/Excel
- **Do not** reintroduce: emoji-heavy print headers, salary on printed report — unless user asks. Landscape print is an allowed option.

### Out of scope unless asked
- Native apps, custom backend, real payroll filing, company-wide rollout
- Deployment authenticated production dan migrasi database kekal langkah berasingan daripada menyediakan source/configuration

Status pembaikan dan bukti ujian: [review v70](docs/review-fixes.md).

Redesign workspace v71: [susun atur dan pengesahan](docs/redesign-v71.md). Carian/filter hanya mempengaruhi paparan; PDF/Excel tetap merangkumi keseluruhan bulan.

Pembaikan eksport v72: [jadual penuh, jumlah OT dan footer](docs/pdf-export-v72.md).
