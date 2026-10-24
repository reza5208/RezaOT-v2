# Tema ikut sistem v73

Pilihan **Ikut sistem / Cerah / Gelap** tersedia dalam Tetapan → Paparan & bahasa. Tanpa pilihan tersimpan, app menggunakan `prefers-color-scheme` dan mengikuti perubahan peranti semasa app dibuka. Pilihan manual mengatasi tetapan sistem sehingga pengguna memilih Ikut sistem semula. Butang header kekal sebagai pintasan menukar cerah/gelap secara manual.

`theme.js` dimuatkan sebelum stylesheet dan menerapkan tema pada awal body supaya tema peranti tersedia sebelum modul utama selesai dimuatkan. Warna kawalan native, ikon tema dan warna bar browser turut dikemaskini. Pendengar perubahan sistem dan storage dipasang sekali; perubahan pilihan daripada tab lain turut diterapkan.

Storage masih menggunakan `darkMode`: `0` untuk cerah, `1` untuk gelap dan `system` untuk ikut peranti. Nilai manual lama dikekalkan. Backup/import menerima ketiga-tiga nilai dan mengaplikasikan pilihan selepas transaksi import berjaya. Tema kekal pilihan lokal; import yang mengandungi pilihan paparan sahaja tidak memasukkan penulisan settings cloud ke queue.

Rujukan formula payslip ditambah dalam [payroll-reference.md](payroll-reference.md). Hanya formula umum dan batasan bukti dimasukkan; tiada payslip atau data gaji bulanan peribadi diterbitkan. Formula gaji runtime tidak berubah dalam release ini.

Semakan khusus meliputi tema sistem semasa startup, pertukaran sistem secara langsung, pilihan manual/reload, legacy 0/1, pertukaran antara tab, backup/import serta pemulihan pilihan tanpa perubahan pada rekod atau cloud. Suite PDF/print turut memastikan dokumen A4 kekal lengkap dan putih dalam tema gelap.

Pengesahan release: 121 ujian lulus — 75 Node, 8 UI, 13 integrasi, 4 paparan detail, 10 redesign, 6 PDF/cetakan dan 5 tema. Semakan visual Tetapan pada 320, 390, 768 dan 1440 piksel dalam kedua-dua tema tidak menemui overflow mendatar. Semua ujian browser menggunakan Firebase palsu dan menyekat sambungan luar.
