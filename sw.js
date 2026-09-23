/**
 * IP GUARD V3 — Service Worker
 * Tujuan: syarat aplikasi terinstal (PWA/APK) + halaman offline yang jelas.
 * Strategi "network-first": selalu ambil versi terbaru dari server, cache hanya
 * dipakai saat internet putus. Jadi setiap git push langsung terasa di HP.
 * Permintaan ke Apps Script (data) dan CDN TIDAK pernah disimpan di cache.
 *
 * Saat mengubah daftar file di SHELL, naikkan CACHE_VERSION.
 */
const CACHE_VERSION = 'ipguard-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/config.js', 'js/gas-bridge.js', 'js/app.js',
               'offline.html', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Hanya file milik aplikasi sendiri (GET). Apps Script, CDN, Google Fonts: langsung ke jaringan.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('offline.html') : undefined))
      )
  );
});
