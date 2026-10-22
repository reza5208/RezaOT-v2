Pembaikan review RezaOT v70

Semua 22 isu kod daripada review telah ditangani dalam working tree. Tiada commit, push, deployment rules atau migrasi database production dibuat.

| Review | Pembaikan |
| --- | --- |
| 1–2 | Satu listener sync sejak startup; snapshot kosong tidak memadam lokal; tiada lock 300 ms yang menggugurkan simpanan pengguna. |
| 3–4 | Edit/padam/tambah trip dan sideJobs diselaraskan selepas modal berjaya; Batal AWB duplicate tidak mengubah data; metadata trip mempunyai ID tetap. |
| 5 | ANN/UPL disimpan dalam handler utama, saling eksklusif dan boleh tanpa waktu kerja. |
| 6 | PDF menggunakan lebar A4 khusus, memaparkan jadual pada telefon dan membersihkan layout selepas berjaya/gagal. |
| 7 | Excel memuatkan library sendiri pada klik pertama, berasingan daripada PDF. |
| 8–9 | Backup v2 semua bulan/settings; validasi schema penuh; pratonton sumber dan merge/replace; backup lama dipulihkan ke bulan asal; recovery snapshot dan queue disimpan secara selamat. |
| 10 | Tarikh kehadiran/trip mesti dalam bulan aktif; input tarikh mempunyai min/max; modal tertangguh tidak boleh menulis ke bulan lain. |
| 11 | Firebase SDK, base CSS dan library eksport disimpan lokal dengan provenance/integrity yang direkod. |
| 12 | Asset wajib mesti lengkap sebelum worker baharu boleh aktif; versi lama kekal jika install gagal. |
| 13–14 | Settings, destinasi kosong dan snapshot bulan menggunakan durable queue; perubahan serta revision queue disimpan dalam transaksi sama. |
| 15 | Fungsi OT per rekod dikongsi oleh gaji, jadual, mobile dan eksport; ANN/UPL menghasilkan 0. |
| 16 | Excel mengekalkan tanda Susun/Pallets. |
| 17 | Masa, nombor finite, julat gaji/rate dan divisor divalidasi; nilai sifar yang sah diterima. |
| 18 | JSON rosak diarkib sebelum penggantian; kegagalan arkib menghalang overwrite; butang Muat turun pemulihan menyediakan salinan raw yang dikekalkan. |
| 19 | Kad mobile mempunyai Edit/Padam per trip; kontras butang diperbaiki. |
| 20 | Worker hanya memadam cache versi lama dengan prefix RezaOT. |
| 21–22 | release.js menentukan urutan modul wajib; kegagalan startup kelihatan dengan retry; render i18n menunggu state sedia. |

Penambahbaikan tambahan yang disediakan:

- State API bersama dan event lifecycle menggantikan lapisan override/timer.
- Backup/import mempunyai schema version, validasi snapshot bersarang, rollback dan recovery download.
- Tetapan gaji/OT/cuti disnapshot per bulan pada simpanan rekod. Edit defaults juga melindungi bulan legacy lokal yang belum mempunyai snapshot. Membaca laporan tidak menulis snapshot. Gunakan tindakan **Kemas kini tetapan bulan ini** untuk menggunakan defaults baharu pada bulan yang sudah dibekukan.
- Cuti company boleh ditambah atau dibetulkan melalui UI. Katalog lama dipaparkan sebagai belum disahkan; tiada tarikh rasmi direka.
- BM/EN diperluas, input belum disimpan dikekalkan semasa tukar bahasa, dialog mempunyai label/focus trap/restore dan permintaan bertindih diurus mengikut giliran.
- Mode Firebase Auth pilihan, explicit consent pemilik, pengasingan akaun lokal dan rules contoh disediakan dalam [panduan security](firebase-security.md). Default legacy dikekalkan sehingga migrasi diuji.
- Status membezakan offline, pending, permission denied, auth dan conflict. Data konflik boleh dimuat turun sebagai recovery.

Pengesahan pada working tree:

- 74 ujian Node: lulus, 0 gagal, 0 skipped.
- 8 ujian browser UI terasing: lulus.
- 13 ujian browser aplikasi penuh: lulus, termasuk fail XLSX dan PDF sebenar, ANN/UPL, batal duplicate, import, quick-save, BM/EN, kontras, offline reload dan offline Excel.
- Laporan 31 hari diperiksa secara visual dan muat satu halaman A4; portrait dan landscape mobile masing-masing menjana PDF satu halaman untuk fixture yang diuji.
- Syntax semua fail JS aplikasi, JSON rules contoh, git diff whitespace dan integrity enam asset vendor/base CSS: lulus.

Ujian cloud menggunakan Firebase palsu dan tidak menulis ke data pemilik sebenar. Hasil ini tidak membuktikan live multi-device sync, authorization production atau tingkah laku cetakan semua peranti.

Perkara luar source yang belum dilakukan:

- Rules Firebase production tidak dideploy; akaun dan migrasi sebenar memerlukan console/emulator/staging, backup dan ujian pemilik mengikut panduan. Auth ialah opt-in supaya pemilik tidak terkunci keluar.
- Katalog cuti belum disahkan dengan kalender rasmi kerana sumber kabinet.gov.my ditolak policy rangkaian. Semak tarikh sebelum guna untuk payroll; pembetulan company kini boleh dibuat tanpa mengubah kod.
- SheetJS CE kekal pada npm 0.18.5 untuk eksport sahaja. Distribusi upstream baharu cdn.sheetjs.com ditolak policy rangkaian. Library dipin dan integrity diperiksa; ini bukan dakwaan bahawa versinya terkini atau telah diaudit keselamatan. Lihat [provenance vendor](../vendor/README.md).

Untuk release: review diff dan backup sebenar dahulu; jalankan [QA](qa-checklist.md) dan semakan staging. Perubahan mana-mana asset atau cloud-config.js selepas versi ini perlu menaikkan version dalam release.js supaya PWA memasang satu release lengkap. Tiada proses commit/push automatik.
