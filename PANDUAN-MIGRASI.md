# Panduan Migrasi IP GUARD V3 → GitHub Pages

Frontend pindah ke GitHub Pages, backend tetap di Google Apps Script (Google Sheets + Drive + Gmail tidak berubah sama sekali).

```
SEBELUM                                   SESUDAH
Browser → script.google.com/.../exec      Browser → USERNAME.github.io/ipguard-v3
          (HTML + google.script.run)                (index.html, css/, js/)
                                                     │ fetch() POST
                                                     ▼
                                          script.google.com/.../exec  (Api.gs → Kode.gs)
```

**Aplikasi lama tidak disentuh.** Versi GitHub memakai *deployment baru* (URL /exec baru) di proyek Apps Script yang sama. Deployment lama tetap mengunci versi kodenya sendiri, jadi aplikasi lama berjalan persis seperti sekarang sebagai cadangan.

Kedua versi memakai **Google Sheets yang sama**: data yang diinput di versi lama langsung terlihat di versi GitHub, dan sebaliknya. Jadi kalau GitHub Pages bermasalah, petugas cukup membuka URL lama dan pekerjaan tetap tercatat di tempat yang sama.

```
Proyek Apps Script (satu proyek, satu database)
├── Deployment LAMA  → URL /exec lama  → UI HTML lama   (dibiarkan, cadangan)
└── Deployment BARU  → URL /exec baru  → API untuk GitHub Pages
```

---

## BAGIAN A — Backend (Apps Script) · ±15 menit

**A1. Backup dulu.** Buka proyek Apps Script → ikon ⓘ *Overview* → **Make a copy**. Salinan ini cadangan kalau ada yang salah.

**A2. Tambah file Api.gs.** Di editor, klik **+** di samping *Files* → **Script** → beri nama `Api` → hapus isi bawaan → tempel seluruh isi `Api.gs`.

**A3. Ganti isi Kode.gs** dengan `Kode.gs` versi baru. Perubahannya hanya 3 tempat kecil:
- `doGet()` — permintaan `?action=ping` dijawab JSON oleh Api.gs
- `requestPasswordReset()` — link email mengarah ke frontend baru (setelah langkah D1)
- `getAllData()` — hash password, salt, token reset, dan tabel SESSIONS/AUDIT_TRAIL tidak lagi terkirim ke browser

**A4. Sesuaikan role admin** (kalau perlu). Di Api.gs baris `const API_ADMIN_ROLES = ['ADMIN'];` — tambahkan role lain yang boleh menyetujui akun dan mengubah akses menu, misalnya `['ADMIN', 'SPS_KEAMANAN']`.

**A5. Buat deployment BARU khusus API** (deployment lama jangan disentuh).
1. **Deploy** → **New deployment**
2. Ikon ⚙️ di samping *Select type* → **Web app**
3. **Description:** `API GitHub Pages`
4. **Execute as: Me** · **Who has access: Anyone** (bukan "Anyone with Google account" — itu akan memblokir GitHub Pages)
5. **Deploy** → salin **Web app URL** (berakhiran `/exec`). Ini URL **baru**, berbeda dari URL aplikasi lama.

> Cek di **Manage deployments**: sekarang ada 2 deployment. Yang lama tetap di versi lamanya — itulah yang membuat aplikasi lama tidak berubah.

**A6. Tes API.** Buka di browser: `URL_EXEC_ANDA?action=ping`
Hasil yang benar: `{"ok":true,"result":{"app":"IP GUARD V3 API",...}}`

---

## BAGIAN B — Siapkan folder frontend · ±5 menit

**B1.** Ekstrak ZIP ke `Documents`. Hasilnya folder:
```
C:\Users\NAMA-ANDA\Documents\ipguard-v3-frontend\    ← folder inilah yang di-git init
├── index.html
├── README.md
├── PANDUAN-MIGRASI.md
├── css\style.css
└── js\config.js, gas-bridge.js, app.js
```
Tidak ada file `.gs` di sini — memang sengaja, backend tidak ikut ke GitHub.

**B2.** Buka `js\config.js` dengan Notepad, ganti `GAS_URL` dengan URL /exec dari langkah A5. Simpan.

---

## BAGIAN C — Upload ke GitHub Pages · ±20 menit (sekali saja)

**C1. Install Git** dari https://git-scm.com/download/win (klik Next terus). Buka **PowerShell**, cek:
```powershell
git --version
```

**C2. Buat akun** di https://github.com (kalau belum). Username menjadi bagian alamat situs: `username.github.io`.

**C3. Setup identitas** (sekali seumur komputer):
```powershell
git config --global user.name "Nama Anda"
git config --global user.email "email-akun-github@contoh.com"
```

**C4. Buat repository:** github.com → **+** → **New repository** → nama `ipguard-v3` → **Public** → **JANGAN** centang README/.gitignore/license → **Create**.

**C5. Masuk ke folder yang benar & cek isinya:**
```powershell
cd "$HOME\Documents\ipguard-v3-frontend"
dir
```
`index.html` **wajib** terlihat di daftar, bersama folder `css` dan `js`. Kalau yang terlihat justru folder `ipguard-v3-frontend` lagi, masuk sekali lagi (`cd ipguard-v3-frontend`). Git tidak akan memperingatkan kalau foldernya salah — situs cuma akan 404.

**C6. Kirim ke GitHub** (jalankan satu per satu):
```powershell
git init
git add .
git commit -m "Upload pertama IP GUARD V3"
git branch -M main
git remote add origin https://github.com/USERNAME/ipguard-v3.git
git push -u origin main
```
Saat `git push` minta password: **bukan password GitHub**, tapi **Personal Access Token**:
https://github.com/settings/tokens → *Generate new token (classic)* → centang **repo** → *Generate* → salin `ghp_...` → paste di terminal (layar tetap kosong saat di-paste, itu normal) → Enter.

Tanda berhasil: `* [new branch] main -> main`

**C7. Aktifkan Pages:** repo di github.com → **Settings** → **Pages** → Source **Deploy from a branch** → Branch **main** / **(root)** → **Save**. Tunggu 1–2 menit sampai muncul *"Your site is live at https://USERNAME.github.io/ipguard-v3/"*.

---

## BAGIAN D — Sambungkan & uji · ±10 menit

**D1. Arahkan email reset password ke situs baru.** Di Apps Script, buka Api.gs, cari fungsi `setFrontendUrl()`, ganti alamatnya dengan URL situs dari C7, pilih `setFrontendUrl` di dropdown → ▶ **Run**. (Tidak perlu deploy ulang — ini disimpan di Script Properties.)

**D2. Checklist uji** — buka situs baru, tekan F12 → tab **Console** agar error terlihat:

| # | Uji | Hasil yang diharapkan |
|---|---|---|
| 1 | Login | Masuk dashboard |
| 2 | Dashboard | Angka KPI & grafik muncul |
| 3 | Isi Jurnal Pos / Mutasi Jaga | Tersimpan, muncul di Sheets |
| 4 | Upload foto (incident/profil) | Foto tampil |
| 5 | Ekspor laporan Excel & PDF | File terunduh |
| 6 | Approval (login sebagai Danru/TL) | Status berubah |
| 7 | Menu Administrasi (login admin) | Daftar user tampil, tanpa kolom hash |
| 8 | Lupa password | Email berisi link ke github.io, reset berhasil |
| 9 | Buka di HP | Tampilan normal, login lancar |

**D3. Uji juga aplikasi lama** — buka URL /exec lama, login, pastikan semuanya masih normal. Coba input satu data di versi lama, lalu cek data itu muncul di versi GitHub.

**D4.** Setelah semua lolos, bagikan URL GitHub ke pengguna, dan simpan URL lama sebagai cadangan (misalnya dicetak di pos jaga).

---

## BAGIAN E — Pemeliharaan rutin

### Ubah tampilan / logika frontend (HTML, CSS, JS)
Edit file di `Documents\ipguard-v3-frontend`, lalu dari PowerShell di folder itu:
```powershell
git add .
git commit -m "Keterangan singkat perubahan"
git push
```
Live dalam 1–2 menit. Kalau masih tampil versi lama: **Ctrl+Shift+R**.
Setiap commit tercatat di tab **Commits** GitHub — versi lama bisa dilihat dan dikembalikan kapan saja.

### Ubah backend (Kode.gs / Api.gs)
Edit di editor Apps Script → **Deploy → Manage deployments** → pilih deployment **"API GitHub Pages"** → ✏️ **Edit** → **Version: New version** → **Deploy**. URL tetap sama, config.js tidak perlu diubah.

> **Aturan emas:** yang di-*Edit → New version* hanya deployment API. Deployment lama dibiarkan di versinya, sehingga aplikasi cadangan tidak ikut berubah.
>
> Catatan: trigger terjadwal (pengingat KTA, arsip data) selalu memakai kode terbaru di editor, bukan versi deployment. Perubahan di Kode.gs versi ini aman untuk trigger — tetapi saat mengubah fungsi yang dipakai trigger, uji dulu.

### ⚠️ Menambah fungsi server BARU
Kalau Anda (atau Claude) menambah fungsi baru di Kode.gs yang dipanggil dari app.js, **nama fungsinya wajib ditambahkan** ke `API_PRIVATE_FNS` di Api.gs (atau `API_PUBLIC_FNS` kalau dipanggil sebelum login). Kalau lupa, muncul pesan *"Fungsi tidak diizinkan: namaFungsi"* — itu tanda whitelist belum diperbarui, bukan kode rusak.

Contoh:
```javascript
const API_PRIVATE_FNS = {
  ...
  submitLaporanBaru: true,   // ← tambahkan di sini
  ...
};
```

### Cara menulis kode baru di app.js
Pola lama `google.script.run.withSuccessHandler(...).namaFungsi(...)` tetap boleh dipakai. Untuk kode baru, versi async lebih ringkas:
```javascript
const res = await ipgCallApi('getAllData', ['SOP_DOCS']);
```

---

## BAGIAN F — Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Halaman 404 | `index.html` tidak di root repo | Buka repo di github.com; kalau terlihat folder `ipguard-v3-frontend/`, push ulang dari folder dalamnya |
| Tampilan tanpa warna/layout | Folder `css/`/`js/` tidak terbawa | Jangan pakai "Upload files" di web; push lewat terminal |
| "GAS_URL belum diisi dengan benar" | config.js masih berisi placeholder | Isi URL /exec, lalu `git add .` / `commit` / `push` |
| "Respons server tidak valid" | Deployment tidak "Anyone", atau belum deploy ulang | Ulangi langkah A5 |
| "Fungsi tidak diizinkan: X" | Fungsi X belum ada di whitelist Api.gs | Tambahkan ke `API_PRIVATE_FNS`, deploy New version |
| "Hanya admin yang dapat..." | Role tidak ada di `API_ADMIN_ROLES` | Tambahkan role di Api.gs (langkah A4) |
| Langsung terlempar ke login | Sesi 8 jam habis | Normal — login ulang |
| Link reset di email masih ke /exec | `setFrontendUrl()` belum dijalankan | Langkah D1 (email dari aplikasi lama memang tetap ke URL lama — itu normal) |
| Aplikasi lama ikut berubah | Deployment lama ter-*Edit → New version* | Manage deployments → deployment lama → Edit → pilih nomor versi lamanya lagi |
| `Password authentication is not supported` | GitHub menolak password biasa | Pakai Personal Access Token (C6) |
| Perubahan tidak muncul | Cache browser | Ctrl+Shift+R atau jendela Incognito |

---

## BAGIAN G — Opsional: pindah ke Vercel nanti

Karena kode sudah di GitHub, pindah ke Vercel tidak perlu mengulang apa pun: vercel.com → *Add New Project* → *Import* repo `ipguard-v3` → *Deploy*. Setiap `git push` otomatis ter-deploy di Vercel juga. Setelah itu jalankan ulang `setFrontendUrl()` dengan alamat Vercel.
