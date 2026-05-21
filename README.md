# RezaOT - Attendance & Overtime Tracking

Web-based attendance & overtime tracking app khas untuk kerja transport (WH3). Rekod clock-in/out, trip, dan OT automatik dengan mudah.

![Demo](https://reza5208.github.io/RezaOT/assets/icons/preview.png) 

## 🚀 Ciri-Ciri Utama

- Clock-in & Clock-out harian
- Rekod Trip (dengan special handling KLIA Cargo + Airway Bill)
- Pengiraan OT automatik mengikut hari (Biasa, Sabtu, Ahad)
- Data disimpan setiap bulan secara berasingan
- Auto-save ke **Firebase** + LocalStorage (offline friendly)
- Highlight Sabtu (kuning) & Ahad (merah)
- Export laporan ke **PDF** + Print friendly
- PWA — boleh install di phone macam app

## 🎯 Peraturan OT (ikut syarikat)

**Hari Biasa (Isnin–Jumaat)**  
OT selepas 5:00 PM. Tiada OT jika trip ke KLIA Cargo.

**Hari Sabtu**  
OT selepas 2:00 PM. Tiada OT jika trip ke KLIA Cargo.

**Hari Ahad**  
Semua jam dikira sebagai OT.

## 📥 Cara Guna

1. Buka [Link](https://reza5208.github.io/RezaOT-v2/)
2. Clock-in/clock-out, tambah trip, dan simpan.
3. Laporan auto update. Tekan **Cetak** atau **Export PDF**.

**Nota**: Data disimpan selamat di Firebase (akan di-update dengan Authentication).

## 📂 Struktur Projek
RezaOT/
├── index.html
├── styles.css
├── main.js              # Logik utama
├── utils.js             # Helper & OT calculation
├── constants.js         # Data destinasi & config
├── manifest.json
├── sw.js                # Service Worker (PWA)
├── assets/icons/        # Icon PWA
├── README.md
└── .gitignore

## 🛠 Teknologi

- HTML, CSS, JavaScript (Vanilla)
- Firebase Realtime Database
- PWA (Progressive Web App)
- html2pdf.js / jsPDF (PDF Export)

## 📌 Todo / Improvement (akan datang)

- Firebase Authentication + private data
- Full PDF Export yang berfungsi
- Edit/Delete rekod
- Dark mode
- Weekly/Monthly summary chart

## 👨‍💻 Author

Dibuat oleh **Khairul Reza** (reza5208)
