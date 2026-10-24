# Rujukan formula anggaran gaji

Dokumen ini merumuskan pemerhatian daripada tiga payslip rasmi untuk pembangunan estimator. Ia tidak memuatkan payslip, data gaji bulanan, nama, nombor pengenalan atau akaun bank pemilik. Data sumber dan rekonsiliasi terperinci kekal dalam rujukan lokal di luar repository.

Rujukan ini belum mengubah formula gaji yang dijalankan app. Kadar yang dicetak, formula yang sepadan dengan sampel dan polisi syarikat yang disahkan ialah tahap bukti yang berbeza; persamaan aritmetik sahaja tidak mengesahkan semua aturan payroll.

## Kadar asas, elaun dan cuti

Gunakan `B` untuk gaji pokok dan `R` untuk kadar asas sejam.

- `R = B / 208` sepadan dengan kadar asas yang dicetak dalam sampel; pembahagi itu tidak dicetak sebagai polisi berasingan.
- Elaun KLIA sepadan dengan `unit KLIA yang diluluskan × RM70`.
- Aturan app sedia ada ialah RM70 bagi satu hari yang mempunyai trip KLIA, bukan bagi setiap AWB. Payslip agregat tidak mempunyai tarikh trip untuk mengesahkan pemetaan unit itu sendiri.
- UPL sepadan dengan `round2(B / 30 × unit hari UPL)`, termasuk pecahan hari.
- Baris cuti berbayar menunjukkan tambahan sifar dengan gaji pokok dikekalkan. Kelayakan dan proses kelulusan cuti perlu datang daripada aturan syarikat.

## Kategori bayaran OT

`U` di bawah bermaksud unit payroll yang telah diluluskan bagi kategori berkenaan.

| Kategori pada payslip | Pengganda | Status bukti |
| --- | ---: | --- |
| Normal Overtime | 1.5 | Unit dan amaun terisi dalam semua sampel |
| Basic Overtime | 1.0 | Kadar dicetak; unit dan amaun kosong |
| Regular Rest Day OT | 1.0 | Unit dan amaun terisi dalam semua sampel |
| A.Regular Rest Day OT | 2.0 | Kadar dicetak; unit dan amaun kosong |
| Regular Public Holiday OT | 2.0 | Unit dan amaun terisi dalam satu sampel |
| A.Regular Public Holiday OT | 3.0 | Kadar dicetak; unit dan amaun kosong |
| Regular Special Public Holiday OT | 2.0 | Kadar dicetak; unit dan amaun kosong |
| A.Regular Special Public Holiday OT | 3.0 | Kadar dicetak; unit dan amaun kosong |

Amaun setiap kategori ialah `round2(U × R × pengganda)`. Kekalkan ketepatan kadar semasa mendarab unit; bulatkan amaun baris kepada dua tempat perpuluhan dengan kaedah half-up, kemudian jumlahkan amaun baris tersebut.

Kategori Regular Rest Day OT yang terisi menggunakan 1×. App semasa mempunyai satu kumpulan jam rehat dengan `restMult: 2`; kategori biasa dan tambahan perlu diasingkan sebelum formula itu diselaraskan.

Payslip bulanan tidak membuktikan ambang jam kategori tambahan, pemotongan waktu rehat, waktu mula OT atau cut-off payroll. Jangan menukar semua jam Ahad kepada 1×, menganggap lapan jam pertama sentiasa kategori biasa, atau mereka tarikh kerja daripada jumlah unit bulanan.

## Pendapatan, potongan dan caruman

```text
gross = gaji pokok + elaun + jumlah amaun OT + pendapatan tambahan yang sah
net   = gross − jumlah potongan pekerja
```

Caruman EPF, SOCSO dan EIS majikan perlu dipaparkan berasingan; ia tidak ditolak daripada net pekerja walaupun dicetak dalam kawasan deductions. Side income Susun/Pallets kekal berasingan mengikut aturan app sedia ada.

Model EPF calon berikut menghasilkan padanan dalam julat sampel:

```text
asas calon = max(0, gaji pokok + KLIA − UPL − pelarasan yang menjejaskan EPF)
bucket     = ceil(asas calon / 20) × 20
pekerja    = ceil(bucket × 11%)
majikan    = ceil(bucket × 13%)
```

Ini ialah model yang sepadan dengan sampel, bukan jadual EPF lengkap. Kategori pekerja, ambang, kadar dan tarikh kuat kuasa mesti disahkan sebelum menggunakannya di luar julat yang diperiksa.

SOCSO, EIS dan SKBBK berubah antara payslip. Nilai tetap daripada satu bulan tidak mewakili semua bulan. Pola band yang sepadan dengan sampel juga belum membuktikan jadual penuh, caps atau semua asas caruman yang terpakai.

Pelarasan **Medical Claim Over** ialah potongan pekerja yang tercatat. Mengurangkannya daripada asas caruman menghasilkan padanan bagi satu sampel, tetapi kesan itu masih inferens; ia belum mengesahkan bahawa semua medical claim atau potongan lain mesti mengurangkan asas EPF/SOCSO/EIS/SKBBK.

Estimator seterusnya perlu menggunakan jadual caruman yang disahkan serta override bulanan, dengan asas dan sumber kadar yang boleh disemak. Pelarasan tambahan perlu mempunyai layanan asas caruman yang jelas, bukan menjadi potongan tetap berulang.

## Keperluan sebelum perubahan formula runtime

1. Asingkan kategori OT biasa dan tambahan; sahkan pemetaan daripada clock harian kepada unit payroll. Sediakan unit diluluskan atau override sehingga aturan tersebut diketahui.
2. Sokong unit cuti pecahan dan elakkan kiraan berganda antara rekod harian dengan UPL tambahan.
3. Kekalkan jumlah jam laporan kehadiran asal; jangan mengubah rekod hanya untuk memaksa net sama dengan payslip.
4. Tambah versi formula/profil payroll kepada snapshot bulan. Snapshot tetapan sahaja tidak mengasingkan algoritma lama daripada algoritma baharu; `_v` sedia ada belum menjadi suis formula.
5. Semak validator gaji, backup/import, sync dan pemulihan apabila medan atau versi formula ditambah. Penggunaan formula baharu pada sejarah mesti menjadi tindakan yang jelas.
6. Uji setiap kategori daripada unit × kadar hingga pendapatan, potongan, caruman majikan dan net. Semakan yang memasukkan jumlah OT tetap tidak menguji derivasi kategori OT.

Fixture peribadi hendaklah kekal lokal. Ujian yang diterbitkan perlu menggunakan data sintetik dan tidak menyertakan dokumen atau pengenal pemilik. Rujukan ini membantu anggaran peribadi; ia tidak mengesahkan pematuhan payroll rasmi.
