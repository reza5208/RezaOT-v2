# RezaOT v18 — Rekod OT & Trips

Web app rekod kehadiran & overtime untuk kerja transport (**WH3**).  
Clock-in/out, trip, pengiraan OT automatik (termasuk cuti umum), export Excel/PDF, print A4, dan install sebagai **PWA**.

**Live:** [https://reza5208.github.io/RezaOT-v2/](https://reza5208.github.io/RezaOT-v2/)

---

## Ciri-ciri utama

### Rekod harian
- Clock-in & clock-out (default **08:00–17:00**)
- Butang **⏱️ Sekarang** — isi masa semasa
- **⚡ Simpan Hari Ini (8–5)** — satu klik untuk hari ini
- Rekod trip (termasuk **KLIA Cargo + Airway Bill**)
- Edit trip inline (klik nama trip) atau padam trip (×)
- Edit / padam rekod hari

### OT & cuti
- Pengiraan **OT automatik** mengikut hari & trip
- **Cuti umum** Malaysia (Nasional + WP KL + Selangor) 2025–2027
- Badge cuti bila tarikh dipilih
- Highlight **Sabtu** / **Ahad** / **cuti** dalam table
- **⚙️ Settings OT** — ubah masa mula OT (Isnin–Jumaat & Sabtu)

### Laporan & export
- Ringkasan bulanan: hari berkerja, KLIA, AWB, total trip
- Cetak laporan **A4** (lajur T/T pekerja & ketua)
- **📄 Export PDF** (html2pdf)
- Export **Excel** (.xlsx)
- Backup / import **JSON**

### App & sync
- **Dark mode**
- **PWA** — install di phone/desktop
- Icon modern (lori + jam + RezaOT)
- **Firebase Realtime Database** — sync multi-device
- **Offline queue** — tulis bila offline, auto-sync bila online
- Nama ketua boleh edit (klik nama)

---

## Peraturan OT (default)

| Hari | Peraturan |
|------|-----------|
| **Isnin–Jumaat** | OT selepas **17:00** (boleh ubah dalam ⚙️ Settings) |
| **Sabtu** | OT selepas **14:00** (boleh ubah dalam ⚙️ Settings) |
| **Ahad / Cuti umum** | Semua jam dikira sebagai OT |
| **KLIA Cargo** | Tiada OT pada hari biasa & Sabtu |

---

## Cara guna

1. Buka [RezaOT-v2](https://reza5208.github.io/RezaOT-v2/)
2. Pilih bulan (confirm dialog bila tukar)
3. Isi tarikh + clock-in/out, atau tekan **⚡ Simpan Hari Ini**
4. Tambah trip; untuk KLIA Cargo, isi Airway Bill
5. Lihat laporan + ringkasan
6. **Cetak** / **Export PDF** / **Excel** / **Backup JSON**

### Install sebagai app (PWA)

- **Android Chrome:** menu → Add to Home screen / Install app  
- **Desktop Chrome/Edge:** ikon install dalam address bar  

Jika UI versi lama: DevTools → Application → Service Workers → **Unregister**, kemudian hard refresh.

---

## Struktur projek

```
RezaOT-v2/
├── index.html              # UI
├── styles.css              # Light + dark + print
├── styles-v18-extra.css    # UI upgrades v18
├── main.js                 # State, forms, report, sync, export
├── utils.js                # OT calculation (rules dari Settings)
├── constants.js            # Trips, cuti 2025–2027, OT defaults
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (v18)
├── assets/icons/           # PNG + SVG icons
├── README.md
└── .gitignore
```

---

## Teknologi

- HTML, CSS, JavaScript (vanilla)
- Firebase Realtime Database (multi-device sync + offline queue)
- [SheetJS (xlsx)](https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js) — Excel
- [html2pdf.js](https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js) — PDF
- PWA: `manifest.json` + Service Worker (`rezaot-v18`)

---

## Firebase & keselamatan

- Sync path: `users/default/{Bulan Tahun}`
- Offline queue disimpan dalam LocalStorage; flush bila online
- **Cadangan:** hadkan API key HTTP referrer ke `https://reza5208.github.io/*` di Firebase Console
- Render UI guna `textContent` (elak XSS)
- Kegunaan **peribadi** — buka Realtime Database rules dengan teliti

---

## Changelog ringkas

### v18
- Offline write queue + auto-sync
- Quick-save hari ini (08:00–17:00)
- Edit trip inline, edit nama ketua
- Badge cuti umum + cuti 2027
- OT rules configurable (⚙️)
- Export PDF
- Confirm sebelum tukar bulan
- SW cache PNG icons

### v16–v17
- Icon PWA baharu, print layout polish, multi-device Firebase listener

### v9–v15
- Print A4, XSS fix, dark mode, Excel OT fix, PWA base

---

## Author

Dibuat oleh **Khairul Reza** ([reza5208](https://github.com/reza5208))
