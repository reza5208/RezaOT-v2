# RezaOT v27 — Rekod OT & Trips

Web app rekod kehadiran & overtime untuk kerja transport (**WH3 / MBG Fruits**).
Clock-in/out, trip, OT automatik, cuti umum, export, PWA, anggaran gaji, PIN.

**Live:** [https://reza5208.github.io/RezaOT-v2/](https://reza5208.github.io/RezaOT-v2/)

**No. pekerja:** M-264 · **Nama:** Khairul Reza · **Dept:** WH3 Transport

---

## Ciri-ciri

### Rekod harian
- Clock-in/out (default 08:00–17:00) + butang **Sekarang**
- **Simpan Hari Ini (8–5)** — satu klik
- Trip + **KLIA Cargo + AWB** (amaran jika AWB duplicate)
- Flag **Cuti tanpa gaji (UPL)**
- Edit / padam rekod & trip (confirm jelas)

### OT & cuti
- OT automatik (Isnin–Jumaat / Sabtu / Ahad / cuti)
- Katalog cuti umum MY + picker company
- Settings OT (masa mula)

### Laporan
- Print A4 formal hitam-putih + T/T
- Export PDF / Excel / JSON backup
- Ringkasan KLIA, AWB, trip

### Anggaran gaji (app sahaja)
- Gaji pokok, OT (pecahan jam × rate), KLIA **RM70/hari trip**
- EPF 11%, SOCSO, EIS, SKIM SKBBK
- Banding OT app vs payslip

### App
- BM / EN, dark mode, PWA
- Firebase realtime + offline queue
- **PIN lock** (🔑), kunci nama ketua (🔓/🔒)
- FAB + trip (mobile), sejarah bulan cepat
- Skeleton loading semasa sync

---

## Peraturan OT (default)

| Hari | Peraturan |
|------|-----------|
| Isnin–Jumaat | OT selepas 17:00 |
| Sabtu | OT selepas 14:00 |
| Ahad / Cuti | Semua jam = OT |
| KLIA Cargo | Tiada OT hari biasa/Sabtu |
| Allowance KLIA | **RM70 × bilangan hari** ada trip KLIA Cargo |

Base rate: `pokok ÷ 208` (contoh 2905.76 → RM13.97/jam)

---

## Firebase (penting)

API key dalam client adalah normal untuk Firebase web.
**Keselamatan bergantung pada Realtime Database Rules**, bukan menyembunyikan key.

Cadangan rules (peribadi multi-device):

```json
{
  "rules": {
    "users": {
      "default": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

Jika URL dikongsi awam, guna Firebase Auth + `auth != null`.
Jangan commit service account / private keys.

---

## Fail utama

```
index.html, styles*.css
main.js → main-app-1/2 + print-lang-fix + salary-estimator + extras-v27
i18n.js, constants.js, utils.js, holiday-picker.js
sw.js, manifest.json, assets/icons/
```

---

## Install PWA

Android Chrome → Add to Home screen.
Jika UI lama: Unregister Service Worker → hard refresh.

---

## Versi

**v27** — AWB dupe, UPL, month history, skeleton, FAB, supervisor lock, PIN, salary breakdown + payslip compare, README.
