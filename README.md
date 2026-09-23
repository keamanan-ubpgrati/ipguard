# IP GUARD V3 — Frontend

Sistem Manajemen Pengamanan PT PLN Indonesia Power UBP Grati.

- **Frontend:** file statis ini (GitHub Pages)
- **Backend:** Google Apps Script Web App (`Kode.gs` + `Api.gs`, tidak disimpan di repo ini)

## Struktur
| File | Fungsi |
|---|---|
| `index.html` | Kerangka halaman |
| `css/style.css` | Seluruh tampilan & design token |
| `js/config.js` | **URL backend (GAS_URL)** — satu-satunya konfigurasi |
| `js/gas-bridge.js` | Penerjemah `google.script.run` → `fetch()` (tidak perlu diedit) |
| `js/app.js` | Seluruh logika aplikasi |

## Update
```
git add .
git commit -m "keterangan"
git push
```
Panduan lengkap: `PANDUAN-MIGRASI.md`.
