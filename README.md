# RezaOT v35 — Rekod OT & Trips

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
- Katalog cuti umum MY + picker company (sync multi-device)
- Settings OT (masa mula)

### Laporan
- Print A4 formal hitam-putih + T/T
- Export PDF / Excel / JSON backup
- Ringkasan KLIA, AWB, trip

### Anggaran gaji (app sahaja, tak keluar print)
- Gaji pokok, OT (pecahan jam × rate), KLIA **RM70/hari trip**
- EPF 11%, SOCSO, EIS, SKIM SKBBK
- Banding OT app vs payslip

### App
- BM / EN, dark mode, PWA
- Firebase realtime + offline queue (delete ikut multi-device)
- **PIN lock** — auto buka bila PIN betul penuh (tak perlu tekan Buka)
- Kunci nama ketua (🔓/🔒)
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

## Multi-device

- Save / delete / trip sync realtime (last-write-wins per bulan)
- Setting cuti company + OT rules di `users/default/settings`
- Offline queue tidak overwrite cloud yang lebih baru

**Tip:** Elak edit tarikh sama pada 2 device serentak.

---

## Firebase (penting)

API key dalam client adalah normal untuk Firebase web.
**Keselamatan bergantung pada Realtime Database Rules.**

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

## Struktur fail (v35)

| Fail | Peranan |
|------|--------|
| `index.html` | UI shell |
| `main.js` | Bootstrap (load app scripts) |
| `main-app-1.js` / `main-app-2.js` | Core logic |
| `app-p1.js` | Feature layer: PIN, print mobile, FAB, sync full-replace, settings |
| `salary-estimator.js` | Anggaran gaji |
| `holiday-picker.js` | Pilih cuti company |
| `sw.js` | Service worker v35 |

---

## Versi

**v35** — PIN auto-unlock, overlay digabung ke `app-p1`, multi-device delete sync, header desktop fix, cuti settings sync.
