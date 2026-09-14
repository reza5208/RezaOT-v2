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
| Isnin–Jumaat | Selepas **17:00** (×1.5) |
| Sabtu | Selepas **14:00** (×1.5) |
| Ahad | Semua jam (×2) |
| Cuti company | Semua jam (×3) |
| KLIA Cargo | Tiada OT (hari biasa / Sabtu) |
| Overnight | Sokong (cth. 08:00 → 02:00 keesokan hari) |

- Katalog cuti umum Malaysia (KL / Selangor) + **picker** cuti yang company ambil
- Settings OT (masa mula weekday / Sabtu) boleh diubah
- Base rate anggaran: `gaji pokok ÷ 208`

### Laporan
- Print / PDF **A4 portrait** formal hitam-putih
- Kolum **T/T pekerja** & **T/T ketua**
- Baris **JUMLAH OT** (bold) — **print/PDF sahaja**, tak keluar di UI
- Footer ringkas: `OT · Trip · KLIA · AWB`
- Tarikh format **dd/mm/yy**
- Export **Excel** (auto-fit + T/T) / **JSON backup**

### Anggaran gaji *(app sahaja — tidak keluar print)*
- Gaji pokok, OT (pecahan weekday / Ahad / cuti)
- Allowance KLIA **RM70 / hari** (hari ada trip KLIA Cargo)
- EPF 11%, SOCSO, EIS
- **Side income** berasingan: Susun RM100/AWB · Pallets RM50/AWB (**bukan** digabung ke gaji bersih)

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

## Struktur fail (v58)

| Fail | Peranan |
|------|----------|
| `index.html` | UI shell |
| `main.js` | Bootstrap loader (`?v=58`) |
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

## AI / Grok context (for other agents)

> **Purpose:** Ground any future Grok/coding agent so it can edit RezaOT without rediscovering rules from chat history.

### What this app is
- **Name:** RezaOT (ship target **v58**)
- **Stack:** Personal **PWA** — static HTML/CSS/**vanilla JS** (not React/Vue)
- **Owner:** Khairul Reza, emp **M-264**, dept **WH3 Transport**; supervisor default **Talib** (editable)
- **Repo:** `reza5208/RezaOT-v2`, branch `main`, static host + service worker
- **Chat language with owner:** mostly **Bahasa Malaysia**; UI has BM/EN toggle

### Domain rules (do not simplify away)
1. **OT hours** (`calculateOT` in `utils.js`):
   - Missing clock in/out → 0
   - **Overnight:** if out-minutes ≤ in-minutes, add 24h to out
   - **Sunday OR company-observed PH:** OT = full span (out − in)
   - **KLIA Cargo** on Mon–Sat → OT hours **0** (allowance is separate money)
   - Sat OT after **14:00**; weekday after **17:00** (from settings)
2. **Pay multipliers** (salary estimator only): Mon–Sat ×1.5, Sun ×2, PH ×3; base = pokok ÷ 208
3. **KLIA allowance:** **RM70 per day** with ≥1 KLIA Cargo trip (not per AWB)
4. **Side jobs** (NOT added into net salary):
   - Susun **RM100**/AWB → mark `*`
   - Pallets **RM50**/AWB → mark `#`
   - Persist in `sideJobs[]` **and** on trip label string
5. **UPL:** forces OT = 0 that date
6. **Public holidays:** catalog in `constants.js`; only **observed** (holiday picker) count for OT/highlight

### Data model (per month)
- Month key: Malay name + year, e.g. `Ogos 2026`, `September 2026`
- `dailyRecords[YYYY-MM-DD] = { clock_in, clock_out, trips: string[], sideJobs?: {awb, type}[], unpaid?: boolean }`
- Local: `localStorage`; remote: Firebase RTDB `users/default/{monthKey}`
- Sync: last-write-wins; **never clear local when remote empty** — push local up

### UI / export constraints (user-enforced)
- Print/PDF: **A4 portrait only** (landscape was tried and **rejected**)
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

### When changing code
- User says commit/push → **commit and push `main`**
- After print CSS or OT logic change → bump SW cache
- Retest: overnight OT, KLIA weekday (0 OT hours), Sunday full OT, UPL, side marks in table/print/Excel
- **Do not** reintroduce: landscape print, emoji-heavy print headers, salary on printed report — unless user asks

### Out of scope unless asked
- Native apps, custom backend, real payroll filing, multi-user auth, company-wide rollout
