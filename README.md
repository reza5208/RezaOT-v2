# RezaOT v68

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
| Isnin–Jumaat | Selepas **17:00** (×1.5) |
| Sabtu | Selepas **14:00** (×1.5) |
| Ahad | Semua jam (×2) |
| Cuti company | Semua jam (×2.0) |
| KLIA Cargo | Tiada OT (hari biasa / Sabtu) |
| Overnight | Sokong (cth. 08:00 → 02:00 keesokan hari) |

- Katalog cuti umum Malaysia (KL / Selangor) + **picker** cuti yang company ambil
- Settings OT (masa mula weekday / Sabtu) boleh diubah
- Base rate anggaran: `gaji pokok ÷ 208`

### Laporan
- Print / PDF **A4 Portrait default**; **Landscape option available**
- Kolum **T/T pekerja** & **T/T ketua**
- Baris **JUMLAH OT** (bold) — **print/PDF sahaja**, tak keluar di UI
- Footer ringkas: `OT · Trip · KLIA · AWB`
- Tarikh format **dd/mm/yy**
- Export **Excel** (auto-fit + T/T) / **JSON backup**

### Anggaran gaji *(app sahaja — tidak keluar print)*
- Gaji pokok, OT (pecahan weekday / Ahad / cuti)
- Allowance KLIA **RM70 / hari** (hari ada trip KLIA Cargo)
- EPF 11%, SOCSO, EIS
- **Side income** berasingan dari **sideJobs list only**: Susun RM100/AWB · Pallets RM50/AWB (**bukan** digabung ke gaji bersih)
- Side job default: **Tiada**

### App
- Bahasa **BM / EN**, dark mode, PWA (installable)
- Firebase Realtime Database + offline queue
- **PIN lock** — auto login bila PIN betul
- Sejarah bulan cepat, FAB tambah trip (mobile)
- Multi-device sync

---

## Multi-device / Firebase

- Path: `users/default/{Bulan Tahun}` contoh `Ogos 2026`
- Last-write-wins per bulan
- Jika cloud kosong, **data local tidak dipadam** — di-push naik
- Backup: **Export Data (JSON)**
- **Security:** Realtime Database rules are currently open (`.read`/`.write` true). To be locked down in a future batch. Do not change until owner approves.

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

---

## Struktur fail (v68)

| Fail | Peranan |
|------|----------|
| `index.html` | UI shell |
| `main.js` | Bootstrap loader (`?v=68`) |
| `main-app-1.js` / `main-app-2.js` | Core: storage, forms, report, export |
| `salary-estimator.js` | Anggaran gaji + EPF bracket |
| `app-p1.js` | PIN, print/PDF, month history, sync merge |
| `app-p1-extra.js` | Loads patch scripts |
| `constants.js` / `utils.js` | Holidays, OT calc |
| `holiday-picker.js` | Cuti company observed |
| `side-job-patch.js` | Susun/Pallets marks |
| `sync-cross-v66.js` | Cross-device settings + never-wipe |
| `print-orient-v67.js` | Portrait/Landscape choice |
| `sw.js` | Service worker cache `rezaot-v68` |

---

## AI / Grok context

### Domain rules (do not invent payroll law)
1. **OT clock rules** (hours for table):
   - Mon–Fri after **17:00**; Sat after **14:00**; Sun full span; PH (observed only) full span ×2.0 pay
   - KLIA Cargo Mon–Sat → OT hours **0** (allowance is separate money)
   - Sat OT after **14:00**; weekday after **17:00** (from settings)
2. **Pay multipliers** (salary estimator only): Mon–Sat ×1.5, Sun ×2, PH ×2.0; base = pokok ÷ 208
3. **KLIA allowance:** **RM70 per day** with ≥1 KLIA Cargo trip (not per AWB)
4. **Side jobs** (NOT added into net salary):
   - Susun **RM100**/AWB → mark `*`
   - Pallets **RM50**/AWB → mark `#`
   - Side income comes from the **sideJobs list only** (not trip-label markers)
   - Side job default is **Tiada** (empty)
   - Persist in `sideJobs[]` **and** on trip label string for display
5. **UPL:** forces OT = 0 that date
6. **Public holidays:** catalog in `constants.js`; **NOT taken by default** — user ticks the ones the company takes; only checked days count for OT/highlight

### Data model (per month)
- Month key: Malay name + year, e.g. `Ogos 2026`, `September 2026`
- `dailyRecords[YYYY-MM-DD] = { clock_in, clock_out, trips: string[], sideJobs?: {awb, type}[], unpaid?: boolean }`
- Local: `localStorage`; remote: Firebase RTDB `users/default/{monthKey}`
- Sync: last-write-wins; **never clear local when remote empty** — push local up

### UI / export constraints (user-enforced)
- Print/PDF: **A4 Portrait default**; **Landscape option available** (print-orient modal)
- Table row **JUMLAH OT**: **print/PDF only**, hidden in normal UI; label must be human (`JUMLAH OT` / `TOTAL OT`), never raw i18n key like `totalOTRow`
- Print footer: **one-line** note (`OT · Trip · KLIA · AWB`), not a summary table
- Report dates: **dd/mm/yy**
- Sign columns: short **T/T pekerja**, **T/T ketua**
- Salary panel: **app-only**, never on print/PDF
- Avoid double PDF download / empty PDF (busy flags in print handlers)

### Architecture
- Boot: `main.js` → `main-app-1.js` + `main-app-2.js` → `salary-estimator.js` + `app-p1.js` → `app-p1-extra.js` (loads patches)
- Prefer small **patches** for incremental fixes; bump `?v=NN` + `sw.js` `CACHE_NAME`
- OT settings keys: UI stores `weekdayAfter` / `saturdayAfter`; `getOtSettings` must also expose `weekdayStart` / `saturdayStart` aliases for `calculateOT`
- Firebase web API key in client is expected; hardening must not lock owner out without explicit request
- **Security:** Realtime Database rules are currently open (`.read`/`.write` true). To be locked down in a future batch. Do not change until owner approves.

### When changing code
- User says commit/push → **commit and push `main`**
- After print CSS or OT logic change → bump SW cache
- Retest: overnight OT, KLIA weekday (0 OT hours), Sunday full OT, UPL, side marks in table/print/Excel
- **Do not** reintroduce: emoji-heavy print headers, salary on printed report — unless user asks. Landscape print is an allowed option.

### Out of scope unless asked
- Native apps, custom backend, real payroll filing, multi-user auth, company-wide rollout
