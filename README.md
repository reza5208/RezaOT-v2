# RezaOT v58

PWA peribadi untuk rekod **Clock-In/Out**, **Trip**, **OT**, dan **anggaran gaji**  
WH3 Transport — **Khairul Reza** (M-264)

**Live:** GitHub Pages / hosting yang sama dengan repo ini.

---

## Ciri utama

### Kehadiran & trip
- Clock-in/out (default **08:00–17:00**) + butang **Sekarang**
- **Simpan Hari Ini (8–5)** — satu klik
- Trip + **KLIA Cargo + AWB** (amaran jika AWB duplicate)
- **Side job** selepas AWB:
  - **Susun (RM100)** → tanda `*` (contoh: `KLIA Cargo (ABC123) *`)
  - **Pallets (RM50)** → tanda `#` (contoh: `KLIA Cargo (ABC123) #`)
- Flag **UPL** (cuti tanpa gaji → OT = 0)
- Edit / padam rekod & trip (modal confirm)

### OT & cuti
| Hari | Peraturan OT |
|------|----------------|
| Isnin–Jumaat | Selepas **17:00** (kadar ×1.5) |
| Sabtu | Selepas **14:00** (kadar ×1.5) |
| Ahad | Semua jam (×2) |
| Cuti company | Semua jam (×3) |
| KLIA Cargo | Tiada OT (hari biasa / Sabtu) |
| Overnight | Sokong (cth. 08:00 → 02:00 keesokan hari) |

- Katalog cuti umum Malaysia (KL / Selangor) + **picker** cuti yang company ambil
- Settings OT (masa mula weekday / Sabtu) boleh diubah

Base rate anggaran: `gaji pokok ÷ 208`

### Laporan
- Print / PDF **A4 portrait** formal hitam-putih
- Kolum **T/T pekerja** & **T/T ketua**
- Baris **JUMLAH OT** (bold) — **print/PDF sahaja**, tak keluar di UI
- Footer ringkas: `OT · Trip · KLIA · AWB`
- Tarikh format **dd/mm/yy**
- Export **Excel** (auto-fit kolum + T/T) / **JSON backup**

### Anggaran gaji *(app sahaja — tidak keluar print)*
- Gaji pokok, OT (pecahan weekday / Ahad / cuti)
- Allowance KLIA **RM70 / hari** (hari ada trip KLIA Cargo)
- EPF 11%, SOCSO, EIS
- **Side income** berasingan: Susun RM100/AWB · Pallets RM50/AWB (**bukan** digabung ke gaji bersih)

### App
- Bahasa **BM / EN** (satu butang)
- Dark mode, PWA (boleh install)
- Firebase Realtime Database + offline queue
- **PIN lock** — auto login bila PIN betul (tanpa tekan OK)
- Sejarah bulan cepat, FAB tambah trip (mobile)
- Multi-device sync

---

## Multi-device / Firebase

- Path: `users/default/{Bulan Tahun}` contoh `Ogos 2026`
- Last-write-wins per bulan — elak edit tarikh sama pada 2 device serentak
- Jika cloud kosong, **data local tidak dipadam** — di-push naik
- Backup berkala: **Export Data (JSON)**

### Rules (peribadi)

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

API key client adalah normal untuk Firebase web.  
**Keselamatan bergantung pada Realtime Database Rules.** Jangan kongsi URL awam tanpa Auth.

---

## Struktur fail (v58)

| Fail | Peranan |
|------|----------|
| `index.html` | UI shell |
| `main.js` | Bootstrap loader (cache-bust `?v=58`) |
| `main-app-1.js` / `main-app-2.js` | Core: storage, forms, report, Excel |
| `app-p1.js` | PIN, print/PDF, FAB, sync |
| `app-p1-extra.js` | Loader patch tambahan |
| `side-job-patch.js` | Susun `*` / Pallets `#` |
| `ot-total-patch.js` | Baris JUMLAH OT (print-only) |
| `print-fix-v51.js` | Print/PDF A4 portrait |
| `salary-estimator.js` | Anggaran gaji + side income |
| `holiday-picker.js` | Pilih cuti company |
| `modal.js` / `i18n.js` / `utils.js` / `constants.js` | Sokongan |
| `styles.css` + `styles-print.css` | Skrin + print |
| `sw.js` | Service worker **v58** |
| `manifest.json` | PWA manifest |

---

## Versi terkini

**v58**
- Fix label **JUMLAH OT** (bukan `totalOTRow`) + nilai total betul pada print/PDF
- Baris jumlah OT **print-only** (sembunyi di UI)
- Side job `*` / `#` disimpan pada label trip
- OT overnight (melebihi tengah malam)
- Footer print ringkas (bukan table)
- A4 portrait restored (bukan landscape)

---

## Nota penggunaan

1. Install sebagai PWA (Add to Home Screen) untuk akses pantas.
2. Tukar bulan melalui picker atau sejarah bulan.
3. Untuk side job: pilih **Susun** atau **Pallets** selepas isi AWB, kemudian tambah trip.
4. Trip lama tanpa side job tidak auto dapat `*`/`#` — tambah semula jika perlu.
5. Cetak / Export PDF untuk laporan bulanan kepada ketua.
