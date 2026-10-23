# Redesign workspace v71

RezaOT v71 membahagikan kerja harian kepada empat paparan: **Hari ini**, **Rekod**, **Gaji** dan **Tetapan**. Sidebar desktop bertukar kepada navigasi bawah pada telefon. Warna cobalt, kad yang lebih lapang, ikon konsisten dan font Manrope lokal digunakan dalam tema cerah dan gelap.

## Perubahan utama

- **Hari ini:** ringkasan OT, hari bekerja, trip dan KLIA; borang kehadiran dengan pilihan bekerja/ANN/UPL; input masa, pengesahan dalam borang dan catatan terkini. Input yang belum disimpan kekal apabila bertukar paparan.
- **Rekod:** carian dan penapis KLIA/cuti, ringkasan bulan, kad mobile dan menu eksport. Carian hanya menyembunyikan baris pada skrin; jumlah serta eksport PDF/Excel tetap menggunakan keseluruhan bulan yang dipilih.
- **Gaji:** anggaran bersih ditonjolkan, pendapatan dan potongan diasingkan, butiran kiraan boleh dibuka, dan side income kekal berasingan daripada gaji bersih.
- **Tetapan:** profil, tetapan OT/cuti/PIN, destinasi, backup/import, bahasa dan tema dikumpulkan. Panel akaun cloud dipaparkan di sini apabila authenticated mode diaktifkan.
- **Aksesibiliti:** fokus papan kekunci, status navigasi, label kawalan, mesej ralat dan sasaran sentuhan diperkemas. Popover boleh ditutup dengan Escape.
- **Offline:** versi cache PWA dinaikkan kepada 71; stylesheet, dashboard dan font lokal dimasukkan dalam senarai asset wajib. App kekal statik tanpa proses build.

Peraturan OT, formula gaji, struktur rekod dan mod sync cloud sedia ada dikekalkan. Redesign ini tidak melaksanakan migrasi data atau deployment Firebase rules.

## Pengesahan

Kesemua **109 ujian lulus**, tanpa kegagalan atau skip:

| Suite | Ujian |
| --- | ---: |
| Node: data, sync, kiraan, eksport dan PWA | 74 |
| UI browser regression | 8 |
| Full app integration | 13 |
| Kad rekod dan paparan gaji | 4 |
| Navigasi dan redesign browser | 10 |

Semakan visual meliputi 32 kombinasi: empat paparan pada lebar 320, 390, 768 dan 1440 piksel, dalam kedua-dua tema. Tiada ralat halaman atau overflow mendatar dikesan, termasuk borang cuti tersuai dan side job KLIA.

Ujian merangkumi input yang belum disimpan, pertukaran bahasa/tema/bulan, edit rekod, carian, penapis, optional cloud account, reload offline dan eksport ketika paparan Rekod tersembunyi. PDF mengekalkan metadata, tandatangan, jumlah OT dan keseluruhan rekod walaupun penapis skrin aktif. Sampel 31 hari menghasilkan satu halaman A4 portrait dan dua halaman A4 landscape; panjang kandungan sebenar boleh mengubah bilangan halaman.

Dependency dan font disahkan melalui `python3 scripts/vendor.py`: tujuh asset dengan checksum yang dipinkan. Semua ujian browser menggunakan fixture dan Firebase palsu; ujian ini tidak menulis ke data production dan tidak membuktikan konfigurasi Firebase production.

Arahan menjalankan semua suite tersedia dalam [README](../README.md#run-dan-test).
