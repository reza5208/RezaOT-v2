# RezaOT v2 — Attendance & Overtime Tracking

Web app rekod kehadiran & overtime khas untuk kerja transport (**WH3**).  
Clock-in/out, trip, pengiraan OT automatik, export Excel, dan boleh install sebagai PWA.

**Live:** [https://reza5208.github.io/RezaOT-v2/](https://reza5208.github.io/RezaOT-v2/)

---

## Ciri-ciri utama

- Clock-in & clock-out harian
- Butang **⏱️ Sekarang** — isi masa semasa terus
- Rekod trip (termasuk **KLIA Cargo + Airway Bill**)
- Padam trip individu (butang ×) atau padam seluruh hari
- Edit rekod (muat semula ke form)
- Pengiraan **OT automatik** mengikut hari
- Highlight **Sabtu** (kuning) & **Ahad** (merah)
- Ringkasan bulanan: hari berkerja, KLIA, AWB, total trip
- Export **Excel** (.xlsx) + backup/import **JSON**
- Cetak laporan A4 (lajur signature untuk print)
- **Dark mode** (disimpan dalam browser)
- Toast notification (UI lebih kemas)
- **PWA** — install di phone macam app
- Offline-friendly melalui **LocalStorage** (+ Service Worker cache)

> **Nota data:** Sumber utama ialah LocalStorage pada device kamu.  
> Firebase Realtime Database dikonfigurasi, tetapi rules semasa menolak akses awam (`permission_denied`) — ini disengajakan untuk keselamatan. App kekal berfungsi tanpa Firebase.

---

## Peraturan OT (ikut syarikat)

| Hari | Peraturan |
|------|-----------|
| **Isnin–Jumaat** | OT selepas **5:00 PM**. Tiada OT jika ada trip KLIA Cargo. |
| **Sabtu** | OT selepas **2:00 PM**. Tiada OT jika ada trip KLIA Cargo. |
| **Ahad** | Semua jam dikira sebagai OT. |

---

## Cara guna

1. Buka [RezaOT-v2](https://reza5208.github.io/RezaOT-v2/)
2. Pilih bulan (jika perlu)
3. Isi tarikh, clock-in/out (atau tekan **Sekarang**), simpan kehadiran
4. Tambah trip; untuk KLIA Cargo, isi Airway Bill jika ada
5. Lihat laporan + ringkasan di bawah
6. **Export Excel** / **Cetak** / **Export Data (Backup)** mengikut keperluan

### Install sebagai app (PWA)

- **Android Chrome:** menu → Add to Home screen / Install app  
- **Desktop Chrome/Edge:** ikon install dalam address bar  

Jika UI nampak versi lama: DevTools → Application → Service Workers → **Unregister**, kemudian hard refresh.

---

## Struktur projek

```
RezaOT-v2/
├── index.html          # UI
├── styles.css          # Light + dark + print
├── main.js             # State, forms, report, export, dark mode
├── utils.js            # OT calculation, trips UI helpers
├── constants.js        # defaultTrips, monthNames
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker (v9)
├── assets/icons/       # Favicon & PWA icons
├── README.md
└── .gitignore
```

---

## Teknologi

- HTML, CSS, JavaScript (vanilla)
- Firebase Realtime Database (optional; rules-dependent)
- [SheetJS (xlsx)](https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js) — export Excel
- PWA: `manifest.json` + Service Worker (`rezaot-v9`)

---

## Backup & keselamatan (personal use)

- Export JSON sekali-sekala sebagai backup
- Data sensitif tidak disimpan (hanya rekod OT kerja)
- Render UI menggunakan `textContent` (elak XSS dari nama trip)
- Firebase API key dalam client adalah normal untuk web SDK; lindungi dengan **Security Rules**

---

## Todo / idea masa depan

- Firebase Authentication + data per-user (jika nak sync merentas device)
- Carta ringkasan mingguan/bulanan
- Export PDF dedicated (selain print browser)
- Icon PWA 512×512 native

---

## Author

Dibuat oleh **Khairul Reza** ([reza5208](https://github.com/reza5208))
