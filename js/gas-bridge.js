/**
 * ============================================================
 * IP GUARD V3 — gas-bridge.js
 * ------------------------------------------------------------
 * Meniru API google.script.run, tapi di belakang layar memakai fetch()
 * ke Google Apps Script (Api.gs → doPost). Hasilnya: kode di app.js yang
 * menulis
 *     google.script.run.withSuccessHandler(fn).withFailureHandler(fn2).getAllData('USERS')
 * tetap jalan TANPA diubah, walaupun halaman sekarang di-host di GitHub Pages.
 *
 * Tidak perlu diedit. Konfigurasi URL ada di js/config.js.
 * ============================================================
 */
(function () {
  'use strict';

  const TIMEOUT_MS = 5 * 60 * 1000; // ekspor laporan bisa lama; batas eksekusi GAS 6 menit

  function getToken() {
    try { return sessionStorage.getItem('ipg_token') || ''; } catch (e) { return ''; }
  }

  function handleAuthExpired(message) {
    try { sessionStorage.removeItem('ipg_token'); sessionStorage.removeItem('ipg_user'); } catch (e) {}
    if (window.__ipgAuthRedirecting) return;
    window.__ipgAuthRedirecting = true;
    alert(message || 'Sesi Anda sudah berakhir. Silakan login ulang.');
    location.href = location.pathname; // buang query, kembali ke layar login
  }

  /** Panggil satu fungsi server. Mengembalikan Promise berisi nilai return fungsi tsb. */
  async function callApi(fn, args) {
    const url = window.IPG_CONFIG && window.IPG_CONFIG.GAS_URL;
    if (!url || url.indexOf('/exec') === -1) {
      throw new Error('GAS_URL belum diisi dengan benar di js/config.js');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        // WAJIB text/plain: application/json memicu CORS preflight yang ditolak GAS
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ fn: fn, args: args, token: getToken() }),
        signal: controller.signal,
        redirect: 'follow'
      });
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Server terlalu lama merespons. Coba lagi.');
      throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet.');
    } finally {
      clearTimeout(timer);
    }

    let data;
    try { data = await res.json(); }
    catch (e) { throw new Error('Respons server tidak valid (cek deployment Apps Script: akses harus "Anyone").'); }

    if (data.ok) return data.result;
    if (data.code === 'AUTH' && fn !== 'doLogin') handleAuthExpired(data.error);
    throw new Error(data.error || 'Terjadi kesalahan di server.');
  }

  /** Runner berantai: .withSuccessHandler() / .withFailureHandler() / .withUserObject() / .namaFungsi() */
  function makeRunner(onSuccess, onFailure, userObj) {
    return new Proxy({}, {
      get: function (_t, prop) {
        if (prop === 'withSuccessHandler') return fn => makeRunner(fn, onFailure, userObj);
        if (prop === 'withFailureHandler') return fn => makeRunner(onSuccess, fn, userObj);
        if (prop === 'withUserObject') return obj => makeRunner(onSuccess, onFailure, obj);
        if (typeof prop !== 'string' || prop === 'then') return undefined;
        return function () {
          const args = Array.prototype.slice.call(arguments);
          callApi(prop, args).then(
            result => { if (onSuccess) onSuccess(result, userObj); },
            err => {
              if (onFailure) onFailure(err, userObj);
              else console.error('[IPG API] ' + prop + ':', err);
            }
          );
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', {
    get: function () { return makeRunner(null, null, undefined); },
    configurable: true
  });
  window.ipgCallApi = callApi; // bisa dipakai langsung: await ipgCallApi('getAllData', ['SOP_DOCS'])
})();
