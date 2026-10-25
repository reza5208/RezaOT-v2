# Firebase v74 — pelaksanaan dan pengesahan

Perubahan ini menyediakan sync dan alatan cutover. Konfigurasi yang dihantar masih `requireAuth: false`; tiada akaun, rules, data production atau enforcement App Check diubah dalam sesi ini.

## Perubahan

- Simpanan sebelum login mempunyai dirty state durable mengikut pemilik. Consent diperlukan untuk data belum terikat; UID lain tidak boleh mengambil alihnya.
- RTDB transaction membandingkan baseline, menggabung edit tarikh berlainan dan meminta pilihan untuk konflik tarikh sama. Jam peranti tidak memilih pemenang. Pilihan konflik yang sudah lapuk ditolak.
- Pending kekal sehingga acknowledgement, termasuk indeks bulan. Null/tombstone yang diketahui memerlukan keputusan jelas. Callback lama selepas reconnect/pertukaran akaun diabaikan.
- Sejarah bulan membaca `_meta/months`, dengan bootstrap legacy sekali bagi root/sesi. Status membezakan sambungan sebenar, pending, konflik dan acknowledgement terakhir.
- Panel **Tetapan → Data anda → Semak sync & pemulihan** menyediakan preview, pilihan konflik, download dan pemadaman salinan dengan pengesahan. Rekod aktif dilindungi daripada tindakan membuang arkib.
- Backup v2 menyertakan bukti pending/dirty/konflik. Import tidak memainkan semula UID/path daripada backup.
- Auth pilihan menyemak claim pemilik, menyediakan reset password dan refresh akses. Runtime Firebase dikongsi, emulator dihadkan kepada loopback/projek demo, dan App Check reCAPTCHA v3 tersedia secara opt-in. Kegagalan App Check menutup akses cloud sambil membenarkan rekod lokal digunakan.
- Rules sasaran memvalidasi schema/UID/claim. CLI owner, migrasi offline, lockfile tooling, suite emulator dan CI disediakan bersama panduan operasi.

## Ujian setempat

| Semakan | Hasil |
| --- | --- |
| `node --test tests/*.test.js` | 147 lulus |
| `tests/ui_browser.py` | 8 lulus |
| `tests/integration_browser.py` | 13 lulus |
| `tests/detail_browser.py` | 4 lulus |
| `tests/redesign_browser.py` | 10 lulus |
| `tests/pdf_report_browser.py` | 6 lulus |
| `tests/theme_browser.py` | 5 lulus |
| `tests/recovery_browser.py` | 9 lulus |
| `npm --prefix firebase test` | 15 rules/Auth emulator lulus |
| `python3 scripts/vendor.py` | 8 artifact pinned disahkan |

Jumlah **217 ujian lulus**: 147 Node, 55 browser dan 15 rules/Auth emulator. Suite PDF menguji bulan penuh dan bulan padat 31 hari/248 trip, portrait/landscape satu A4. UI Auth/konflik turut diuji pada 320 px dalam BM/EN dan tema cerah/gelap; badge status mengekalkan susun atur header tanpa memotong teks untuk pembaca skrin. Semua ujian menggunakan fixture/projek demo terasing, bukan database production.

Semakan rules terjana mengesahkan artifact sepadan dengan generator. Emulator rasmi berjaya dimuat turun dan checksum disahkan. Diagnosis awal muat turun/rangkaian diselesaikan dengan cache boleh tulis serta routing HTTP/WebSocket loopback yang khusus; proksi dan TLS untuk host luar dikekalkan. Ujian engine sebenar menerima payload sah dan menolak akses/payload tidak sah. CI disediakan; kejayaan CI/deployment belum disahkan oleh laporan setempat ini.

## Baki di luar kod

1. Draf environment menyimpan arahan pemasangan/startup serta domain Firebase yang diperlukan. Review/Save/Publish melalui Environment settings menerapkan konfigurasi bagi environment seterusnya; penyimpanan draf tidak menerapkannya pada sesi berjalan. Emulator sudah disahkan dalam sesi semasa.
2. Sediakan akses admin Firebase, staging, provider/domain Auth dan claim owner. Uji rules serta dua peranti pada staging.
3. Ambil export cloud lengkap dan backup setiap peranti, semak pelan migrasi, import staging dan bandingkan readback. Cutover production memerlukan backup akhir serta koordinasi semua peranti.
4. Semak usage/budget, backup server dan restore; pantau App Check sebelum enforcement.

Langkah terperinci: [rules dan sempadan data](firebase-security.md), [operasi/cutover/rollback](firebase-operations.md), [migrasi offline](firebase-migration.md).
