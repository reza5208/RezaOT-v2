# RezaOT v54

PWA peribadi untuk rekod **Clock-In/Out**, **Trip**, **OT**, dan **anggaran gaji** (WH3 Transport — Khairul Reza, M-264).

**Live:** gunakan GitHub Pages / hosting yang sama dengan repo ini.

---

## Ciri utama

### Kehadiran & trip
- Clock-in/out (default 08:00–17:00) + butang **Sekarang**
- **Simpan Hari Ini (8–5)** — satu klik
- Trip + **KLIA Cargo + AWB** (amaran jika AWB duplicate)
- **Side job** selepas AWB:
  - **Susun (RM100)** → tanda `*` pada trip (contoh: `KLIA Cargo (ABC123) *`)
  - **Pallets (RM50)** → tanda `#` pada trip (contoh: `KLIA Cargo (ABC123) #`)
- Flag **UPL** (cuti tanpa gaji)
- Edit / padam rekod & trip (modal confirm)

### OT & cuti
- OT automatik (Isnin–Sabtu ×1.5, Ahad ×2, cuti ×3)
- Katalog cuti umum MY + picker company (sync multi-device)
- Settings OT (masa mula weekday / Sabtu)
- **Overnight** (cth. 08:00 → 02:00 keesokan hari) dikira dengan betul

### Laporan
- Print / PDF **A4 portrait** formal + kolum T/T pekerja & ketua
- Footer ringkas: `OT · Trip · KLIA · AWB` (bukan table)
- Export Excel / JSON backup

### Anggaran gaji *(app sahaja — tidak keluar print)*
- Gaji pokok, OT (pecahan), allowance KLIA **RM70/hari**
- EPF 11%, SOCSO, EIS
- **Side income** berasingan: Susun RM100/AWB, Pallets RM50/AWB (bukan gaji)

### App
- BM / EN, dark mode, PWA (installable)
- Firebase realtime + offline queue
- **PIN lock** — auto unlock bila PIN betul
- Sejarah bulan cepat, FAB tambah trip (mobile)

---

## Peraturan OT (default)

| Hari | Peraturan |
|------|-----------|
| Isnin–Jumaat | OT selepas 17:00 |
| Sabtu | OT selepas 14:00 (kadar ×1.5 seperti weekday) |
| Ahad / Cuti | Semua jam = OT (×2 / ×3) |
| KLIA Cargo | Tiada OT hari biasa/Sabtu |
| Allowance KLIA | **RM70 × bilangan hari** ada trip KLIA |
| Side job | Susun **RM100** (`*`) · Pallets **RM50** (`#`) — bukan gaji |

Base rate: `pokok ÷ 208`

---

## Multi-device

- Path Firebase: `users/default/{Bulan Tahun}` contoh `Ogos 2026`
- Last-write-wins per bulan — elak edit tarikh sama pada 2 device serentak
- Jika cloud kosong, **local tidak dipadam** — data local di-push naik
- Backup: **Export Data (JSON)** secara berkala

---

## Firebase (penting)

API key client adalah normal untuk Firebase web.  
**Keselamatan bergantung pada Realtime Database Rules.**

Untuk peribadi:

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

Jangan kongsi URL awam tanpa Auth.

---

## Struktur fail (v54)

| Fail | Peranan |
|------|----------|
| `index.html` | UI shell |
| `main.js` | Bootstrap loader |
| `main-app-1.js` / `main-app-2.js` | Core (storage, report, forms) |
| `app-p1.js` + `app-p1-extra.js` | PIN, print/PDF, FAB, sync, side-job |
| `side-job-patch.js` | Susun `*` / Pallets `#` |
| `salary-estimator.js` | Anggaran gaji + side income |
| `holiday-picker.js` | Pilih cuti company |
| `modal.js` / `i18n.js` / `utils.js` / `constants.js` | Sokongan |
| `styles.css` + `styles-print.css` | Skrin + print |
| `sw.js` | Service worker v54 |
| `manifest.json` | PWA manifest |

---

## Versi

**v54** — Tanda side job pada trip: `*` Susun · `#` Pallets (table, print, Excel).
