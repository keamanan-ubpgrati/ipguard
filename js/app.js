/**
 * ============================================================
 * IP GUARD V3 — Frontend Logic (JavaScript.html)
 * ============================================================
 */

// ════════════════════════════════════════════════════════
// STATE GLOBAL
// ════════════════════════════════════════════════════════
const AppState = {
  token: null,
  user: null,        // { Username, Role, Nama, ... }
  config: {},
  laporanHeaderConfig: {}, // diisi loadLaporanHeaderConfig() — { jenisLaporanKey: {JudulFormulir, NoDokumen, TanggalTerbit, Revisi} }
  roleMenuAccess: {}, // diisi dari getAppBootstrapData() — { menuId: { ROLE: true/false, ... } }
  chart: null
};

// Label & ikon menu sidebar, dikelompokkan sesuai referensi desain
const MENU = [
  { group: '', items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'bi-grid-1x2-fill', roles: 'ALL', aliases: ['home','beranda'] },
  ]},
  { group: 'OPERASIONAL JAGA', items: [
    { id: 'mutasiJaga', label: 'Mutasi Jaga Pos', icon: 'bi-arrow-left-right', roles: ['SATPAM','DANRU','TL_KEAMANAN','SPS_KEAMANAN','ADMIN'], aliases: ['mutasi','jurnal','serah terima','ba'] },
    { id: 'checklistSarpras', label: 'Checklist Sarpras', icon: 'bi-clipboard-check', roles: ['SATPAM','DANRU','TL_KEAMANAN','SPS_KEAMANAN','ADMIN'], aliases: ['checklist','sarana','prasarana'] },
    { id: 'patroli', label: 'Patroli QR & GPS', icon: 'bi-geo-alt', roles: ['SATPAM','DANRU','TL_KEAMANAN','SPS_KEAMANAN','ADMIN'], aliases: ['patroli','qr','gps','rounds'] },
  ]},
  { group: 'KONTROL AKSES & LOGISTIK', items: [
    { id: 'izinTamu', label: 'Izin Tamu Masuk', icon: 'bi-person-badge', roles: 'ALL', aliases: ['tamu','visitor'] },
    { id: 'kendaraan', label: 'Izin Kendaraan Masuk A', icon: 'bi-truck', roles: 'ALL', aliases: ['kendaraan','mobil','gerbang'] },
    { id: 'barangKeluar', label: 'Barang Keluar', icon: 'bi-box-arrow-up-right', badge:'v3.2', roles: 'ALL', aliases: ['barang','surat pas'] },
  ]},
  { group: 'KEAMANAN & MONITORING', items: [
    { id: 'incident', label: 'Incident / Gangguan', icon: 'bi-exclamation-triangle', roles: 'ALL', aliases: ['incident','insiden','gangguan'] },
    { id: 'kta', label: 'KTA Monitoring', icon: 'bi-person-vcard', roles: 'ALL', aliases: ['kta','kartu tanda anggota'] },
    { id: 'petaKeamanan', label: 'Peta Keamanan', icon: 'bi-map', roles: 'ALL', aliases: ['peta','denah','map'] },
  ]},
  { group: 'PUSAT INFORMASI', items: [
    { id: 'sopCenter', label: 'SOP Center', icon: 'bi-journal-text', roles: 'ALL', aliases: ['sop','regulasi','prosedur','dokumen'] },
    { id: 'awarenessCenter', label: 'Awareness Center', icon: 'bi-megaphone', roles: 'ALL', aliases: ['awareness','flyer','kuis','berita'] },
    { id: 'teleponPenting', label: 'Telepon Penting', icon: 'bi-telephone-fill', roles: 'ALL', aliases: ['telepon','darurat','emergency','kontak','wa'] },
  ]},
  { group: 'PENGATURAN', items: [
    { id: 'masterData', label: 'Master Data', icon: 'bi-collection', roles: ['ADMIN','TL_KEAMANAN','SPS_KEAMANAN'], aliases: ['master','personel','pos','titik'] },
    { id: 'administrasi', label: 'Administrasi Akun', icon: 'bi-gear', roles: ['ADMIN'], aliases: ['admin','akun','user'] },
  ]}
];

const ROLE_LABEL = {
  ADMIN: 'Admin', SPS_KEAMANAN: 'SPS Keamanan', TL_KEAMANAN: 'TL Keamanan', SATPAM: 'Satpam',
  DANRU: 'Danru', PEGAWAI: 'Pegawai', MANAJEMEN: 'Manajemen', SPS_BIDANG: 'SPS Bidang'
};

// ════════════════════════════════════════════════════════
// INISIALISASI
// ════════════════════════════════════════════════════════
// PDF.js worker — dipakai untuk render thumbnail halaman pertama PDF Peta Keamanan.
// pdf.js sekarang dimuat "async" (biar tidak menghalangi tampilnya halaman login), jadi
// pengaturan worker-nya dipindah ke fungsi ensurePdfJsReady_() — dipanggil tepat saat
// benar-benar mau dipakai (bukan sekali di awal, karena library-nya bisa belum siap saat itu).
function ensurePdfJsReady_() {
  if (typeof pdfjsLib === 'undefined') return false;
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  return true;
}
// Mode gelap — diterapkan sedini mungkin (sebelum render) agar tidak ada kedip warna terang
(function applyStoredTheme() {
  const saved = localStorage.getItem('ipg_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();
function toggleDarkMode() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ipg_theme', next);
  updateThemeToggleIcon(next);
}
function updateThemeToggleIcon(theme) {
  const icon = document.getElementById('themeToggleIcon');
  if (!icon) return;
  icon.className = theme === 'dark' ? 'bi bi-moon-stars-fill' : 'bi bi-sun-fill';
}
document.addEventListener('DOMContentLoaded', () => {
  updateThemeToggleIcon(document.documentElement.getAttribute('data-theme'));
  AppState.token = sessionStorage.getItem('ipg_token');
  const cachedUser = sessionStorage.getItem('ipg_user');
  if (window.IPG_RESET_TOKEN) {
    hideLoadingOverlay();
    document.getElementById('loginScreen').style.display = 'flex';
    initResetPasswordScreen(window.IPG_RESET_TOKEN);
  } else if (AppState.token && cachedUser) {
    AppState.user = JSON.parse(cachedUser);
    enterApp();
  } else {
    hideLoadingOverlay();
    document.getElementById('loginScreen').style.display = 'flex';
  }
  setInterval(updateClock, 1000);
  updateClock();
});

function updateClock() {
  const el = document.getElementById('topbarClock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
  updateTopbarGreeting();
}
function updateTopbarGreeting() {
  const el = document.getElementById('topbarGreeting');
  if (!el || !AppState.user) return;
  const hour = new Date().getHours();
  let waktu = 'Malam';
  if (hour >= 4 && hour < 11) waktu = 'Pagi';
  else if (hour >= 11 && hour < 15) waktu = 'Siang';
  else if (hour >= 15 && hour < 18) waktu = 'Sore';
  el.textContent = `Selamat ${waktu}, ${AppState.user.Nama}`;
}

function hideLoadingOverlay() {
  const el = document.getElementById('loadingOverlay');
  if (el) { el.style.opacity = '0'; setTimeout(() => el.style.display = 'none', 250); }
}

/**
 * compressImageFile_ - Kompres/kecilkan file gambar via canvas (maks
 * 1600px sisi terpanjang, kualitas JPEG 80%) sebelum dikonversi base64.
 * Dipakai untuk upload foto Incident & KTA - foto asli dari kamera HP
 * bisa 8-15MB, terlalu besar untuk dikirim lewat google.script.run
 * (bisa terasa "macet" lama atau gagal total, terutama di koneksi
 * seluler). Hasil kompresi biasanya turun jadi beberapa ratus KB.
 */
function compressImageFile_(file) {
  return new Promise(function (resolve, reject) {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = function () { resolve({ base64: reader.result.split(',')[1], mimeType: file.type, fileName: file.name }); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIM = 1600;
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const targetW = Math.round(img.width * scale);
      const targetH = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = targetW; canvas.height = targetH;
      canvas.getContext('2d').drawImage(img, 0, 0, targetW, targetH);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', fileName: file.name.replace(/\.[^.]+$/, '') + '.jpg' });
    };
    img.onerror = function () { URL.revokeObjectURL(objectUrl); reject(new Error('Gagal memuat gambar untuk dikompres.')); };
    img.src = objectUrl;
  });
}

// ════════════════════════════════════════════════════════
// AUTENTIKASI
// ════════════════════════════════════════════════════════
function togglePasswordVisibility() {
  const input = document.getElementById('loginPassword');
  const icon = document.getElementById('loginPasswordEyeIcon');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  icon.className = showing ? 'bi bi-eye' : 'bi bi-eye-slash';
}
function handleLogin(evt) {
  evt.preventDefault();
  const btn = document.getElementById('loginBtn');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Memproses...';
  btn.disabled = true;

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  google.script.run
    .withSuccessHandler(res => {
      btn.innerHTML = orig; btn.disabled = false;
      if (res && res.success) {
        AppState.token = res.data.token;
        AppState.user = res.data.user;
        sessionStorage.setItem('ipg_token', AppState.token);
        sessionStorage.setItem('ipg_user', JSON.stringify(AppState.user));
        enterApp();
      } else {
        showToast('Gagal Login', res.message, 'danger');
      }
    })
    .withFailureHandler(err => {
      btn.innerHTML = orig; btn.disabled = false;
      showToast('Error', err.message, 'danger');
    })
    .doLogin(username, password);
  return false;
}

function showRegisterForm() {
  document.getElementById('loginFormWrap').style.display = 'none';
  document.getElementById('forgotPasswordFormWrap').style.display = 'none';
  document.getElementById('registerFormWrap').style.display = 'block';
}
function showLoginForm() {
  document.getElementById('registerFormWrap').style.display = 'none';
  document.getElementById('forgotPasswordFormWrap').style.display = 'none';
  document.getElementById('resetPasswordFormWrap').style.display = 'none';
  document.getElementById('loginFormWrap').style.display = 'block';
}
function showForgotPasswordForm() {
  document.getElementById('loginFormWrap').style.display = 'none';
  document.getElementById('registerFormWrap').style.display = 'none';
  document.getElementById('forgotPasswordResult').innerHTML = '';
  document.getElementById('forgotPasswordFormWrap').style.display = 'block';
}
function handleForgotPassword(evt) {
  evt.preventDefault();
  const btn = document.getElementById('forgotPasswordBtn');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Mengirim...';
  btn.disabled = true;
  const email = document.getElementById('forgotEmail').value;
  google.script.run
    .withSuccessHandler(res => {
      btn.innerHTML = orig; btn.disabled = false;
      const resultEl = document.getElementById('forgotPasswordResult');
      if (res.success) {
        resultEl.innerHTML = `<div class="alert alert-success small mb-0">${res.message}</div>`;
        document.getElementById('forgotPasswordForm').reset();
      } else {
        resultEl.innerHTML = `<div class="alert alert-danger small mb-0">${res.message}</div>`;
      }
    })
    .withFailureHandler(err => {
      btn.innerHTML = orig; btn.disabled = false;
      document.getElementById('forgotPasswordResult').innerHTML = `<div class="alert alert-danger small mb-0">${err.message}</div>`;
    })
    .requestPasswordReset(email);
  return false;
}
function initResetPasswordScreen(token) {
  document.getElementById('loginFormWrap').style.display = 'none';
  document.getElementById('registerFormWrap').style.display = 'none';
  document.getElementById('forgotPasswordFormWrap').style.display = 'none';
  document.getElementById('resetPasswordFormWrap').style.display = 'block';
  google.script.run
    .withSuccessHandler(res => {
      document.getElementById('resetPasswordValidating').style.display = 'none';
      if (res.success) {
        document.getElementById('resetPasswordValid').style.display = 'block';
      } else {
        document.getElementById('resetPasswordInvalidMsg').textContent = res.message;
        document.getElementById('resetPasswordInvalid').style.display = 'block';
      }
    })
    .withFailureHandler(err => {
      document.getElementById('resetPasswordValidating').style.display = 'none';
      document.getElementById('resetPasswordInvalidMsg').textContent = err.message;
      document.getElementById('resetPasswordInvalid').style.display = 'block';
    })
    .validateResetToken(token);
}
function handleResetPassword(evt) {
  evt.preventDefault();
  const pass1 = document.getElementById('resetNewPassword').value;
  const pass2 = document.getElementById('resetNewPasswordConfirm').value;
  const resultEl = document.getElementById('resetPasswordResult');
  if (pass1 !== pass2) {
    resultEl.innerHTML = `<div class="alert alert-danger small mb-0">Password dan ulangi password tidak sama.</div>`;
    return false;
  }
  const btn = document.getElementById('resetPasswordBtn');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
  btn.disabled = true;
  google.script.run
    .withSuccessHandler(res => {
      btn.innerHTML = orig; btn.disabled = false;
      if (res.success) {
        document.getElementById('resetPasswordForm').style.display = 'none';
        resultEl.innerHTML = `<div class="alert alert-success small mb-0">${res.message}</div>
          <div class="text-center mt-3"><a href="javascript:void(0)" onclick="location.href=location.pathname" class="small-link">Kembali ke Login</a></div>`;
      } else {
        resultEl.innerHTML = `<div class="alert alert-danger small mb-0">${res.message}</div>`;
      }
    })
    .withFailureHandler(err => {
      btn.innerHTML = orig; btn.disabled = false;
      resultEl.innerHTML = `<div class="alert alert-danger small mb-0">${err.message}</div>`;
    })
    .resetPasswordWithToken(window.IPG_RESET_TOKEN, pass1);
  return false;
}

function handleRegister(evt) {
  evt.preventDefault();
  const payload = {
    nama: document.getElementById('regNama').value,
    username: document.getElementById('regUsername').value,
    password: document.getElementById('regPassword').value,
    nip: document.getElementById('regNip').value,
    noHp: document.getElementById('regHp').value,
    email: document.getElementById('regEmail').value,
    role: document.getElementById('regRole').value
  };
  google.script.run
    .withSuccessHandler(res => {
      showToast(res.success ? 'Berhasil' : 'Gagal', res.message, res.success ? 'success' : 'danger');
      if (res.success) showLoginForm();
    })
    .withFailureHandler(err => showToast('Error', err.message, 'danger'))
    .registerAccount(payload);
  return false;
}

function handleLogoutClick() {
  openConfirmModal('Yakin ingin keluar dari IP GUARD?', () => {
    const returnToLogin = () => {
      sessionStorage.clear();
      AppState.token = null;
      AppState.user = null;
      // Tidak reload/navigasi URL sama sekali — cukup tampilkan ulang layar login secara langsung,
      // persis seperti kondisi awal sebelum login. Menghindari isu blank page dari reload di web app Apps Script.
      document.getElementById('appShell').style.display = 'none';
      showLoginForm();
      document.getElementById('loginScreen').style.display = 'flex';
      const loginForm = document.getElementById('loginForm');
      if (loginForm) loginForm.reset();
    };
    google.script.run
      .withSuccessHandler(returnToLogin)
      .withFailureHandler(err => {
        showToast('Error', 'Gagal logout di server: ' + err.message, 'danger');
        returnToLogin(); // tetap kembali ke login supaya user tidak macet
      })
      .doLogout(AppState.token);
  });
}

function enterApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'block';
  hideLoadingOverlay();

  document.getElementById('userNameTop').textContent = AppState.user.Nama;
  updateTopbarGreeting();
  document.getElementById('userRoleTop').textContent = ROLE_LABEL[AppState.user.Role] || AppState.user.Role;
  renderUserAvatar();

  google.script.run.withSuccessHandler(res => {
    if (res.success) {
      AppState.config = res.data.config || {};
      const lhMap = {};
      (res.data.laporanHeaderConfig || []).forEach(r => { lhMap[r.ID] = r; });
      AppState.laporanHeaderConfig = lhMap;
      const raMap = {};
      (res.data.roleMenuAccess || []).forEach(r => {
        const roles = {};
        Object.keys(ROLE_LABEL).forEach(roleKey => { roles[roleKey] = (r[roleKey] === true || r[roleKey] === 'TRUE'); });
        raMap[r.ID] = roles;
      });
      AppState.roleMenuAccess = raMap;
      renderSidebar(); // render ulang sekarang sudah pakai data akses yang akurat
    }
  }).getAppBootstrapData();
  loadPersonelNamaDatalist();
  loadNotifikasiApproval();
  loadDefaultPrintLogo(); // prioritas rendah, di belakang layar — baru dipakai kalau ada yang mencetak dokumen

  renderSidebar();
  const initialSection = getValidSectionFromHash_();
  history.replaceState({ section: initialSection }, '', '#' + initialSection); // history awal biar konsisten
  navigateTo(initialSection, true);
}
/** Baca #namamodul dari URL saat baru masuk (misal setelah refresh) — cuma dipakai kalau modulnya
    memang ada di menu DAN role user boleh akses; kalau tidak valid, jatuh ke Dashboard. */
/** Halaman terakhir untuk dipulihkan saat refresh — sessionStorage diutamakan (murni di skrip kita
    sendiri, tidak bergantung pada bagaimana iframe pembungkus Apps Script meneruskan hash URL, yang
    ternyata tidak selalu konsisten terutama di HP). Hash tetap dibaca sebagai pelengkap untuk kasus
    dari tombol back/forward browser. */
function getValidSectionFromHash_() {
  const hash = location.hash ? location.hash.slice(1) : '';
  let stored = '';
  try { stored = sessionStorage.getItem('ipg_last_section') || ''; } catch (e) {}
  const candidate = hash || stored;
  if (!candidate) return 'dashboard';
  for (const group of MENU) {
    for (const it of group.items) {
      if (it.id === candidate && canAccess(it)) return candidate;
    }
  }
  return 'dashboard';
}

// ════════════════════════════════════════════════════════
// SIDEBAR & NAVIGASI (RBAC 8 role — PRD Bab 4)
// ════════════════════════════════════════════════════════
/** Daftar saran nama dari Master Data Personel (aktif saja) — datalist bersama dipakai lintas modul.
    Tetap bisa ketik manual (hasil diskusi lanjutan: dropdown gabungan, kecuali field Pengemudi). */
function loadPersonelNamaDatalist() {
  google.script.run.withSuccessHandler(res => {
    const names = (res.data || []).filter(p => p.Status === 'Aktif').map(p => p.Nama).filter(Boolean);
    let dl = document.getElementById('personelNamaOptions');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'personelNamaOptions';
      document.body.appendChild(dl);
    }
    dl.innerHTML = names.map(n => `<option value="${n}">`).join('');
  }).getAllData('MASTER_PERSONEL');
}
/** Konfigurasi header dokumen cetak per jenis laporan — dimuat sekali saat login, dipakai buildLetterheadHTML() */
function loadLaporanHeaderConfig() {
  google.script.run.withSuccessHandler(res => {
    const map = {};
    (res.data || []).forEach(r => { map[r.ID] = r; });
    AppState.laporanHeaderConfig = map;
  }).getAllData('LAPORAN_HEADER_CONFIG');
}
/** Logo PLN default untuk kop surat cetak — sengaja diminta belakangan (bukan ditanam langsung di
    JavaScript.html) supaya tidak ikut membebani setiap kali halaman login dimuat. */
function loadDefaultPrintLogo() {
  google.script.run.withSuccessHandler(res => {
    if (res.success) PLN_PRINT_LOGO = res.data;
  }).getDefaultPrintLogo();
}
let notifApprovalItems = [];
function loadNotifikasiApproval() {
  google.script.run.withSuccessHandler(res => {
    notifApprovalItems = res.success ? (res.data || []) : [];
    const badge = document.getElementById('notifBadge');
    if (notifApprovalItems.length > 0) {
      badge.textContent = notifApprovalItems.length > 99 ? '99+' : notifApprovalItems.length;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
    renderDashboardNotifWrap();
  }).getPendingApprovalsForRole(AppState.user.Role);
}
function renderDashboardNotifWrap() {
  const wrap = document.getElementById('dashboardNotifWrap');
  if (!wrap) return;
  if (!notifApprovalItems.length) { wrap.innerHTML = '<div class="small text-muted">Tidak ada pengajuan menunggu approval.</div>'; return; }
  wrap.innerHTML = notifApprovalItems.slice(0, 3).map(it => `
    <div class="py-2" style="border-bottom:1px solid var(--border-subtle);cursor:pointer;" onclick="navigateTo('${it.target}')">
      <div class="small fw-bold" style="color:var(--primary);">${it.judul}</div>
      <div class="small text-muted">${it.deskripsi} &middot; ${it.tanggal}</div>
    </div>`).join('')
    + (notifApprovalItems.length > 3 ? `<button type="button" class="btn btn-outline-ip btn-sm-ip w-100 mt-2" onclick="toggleNotifDropdown()">Lihat Semua (${notifApprovalItems.length})</button>` : '');
}
function toggleNotifDropdown() {
  const dd = document.getElementById('notifDropdown');
  const showing = dd.style.display === 'block';
  if (showing) { dd.style.display = 'none'; return; }
  loadNotifikasiApproval(); // refresh tiap dibuka
  renderNotifDropdown();
  dd.style.display = 'block';
  setTimeout(() => document.addEventListener('click', closeNotifDropdownOutside), 0);
}
function closeNotifDropdownOutside(evt) {
  const dd = document.getElementById('notifDropdown');
  const btn = document.getElementById('notifBtn');
  if (dd.contains(evt.target) || btn.contains(evt.target)) return;
  dd.style.display = 'none';
  document.removeEventListener('click', closeNotifDropdownOutside);
}
function renderNotifDropdown() {
  const dd = document.getElementById('notifDropdown');
  if (!notifApprovalItems.length) {
    dd.innerHTML = `<div class="p-3 text-muted small text-center">Tidak ada pengajuan menunggu approval.</div>`;
    return;
  }
  dd.innerHTML = `<div style="padding:.75rem 1rem;border-bottom:1px solid var(--border-subtle);font-weight:700;font-size:.85rem;">Menunggu Approval (${notifApprovalItems.length})</div>` +
    notifApprovalItems.map(it => `
      <div onclick="navigateTo('${it.target}'); document.getElementById('notifDropdown').style.display='none';"
           style="padding:.65rem 1rem;border-bottom:1px solid var(--border-subtle);cursor:pointer;font-size:.82rem;" onmouseover="this.style.background='#F9FBFE'" onmouseout="this.style.background=''">
        <div style="font-weight:700;color:var(--primary);">${it.judul}</div>
        <div class="text-muted">${it.deskripsi} &middot; ${it.tanggal}</div>
      </div>`).join('');
}
function renderUserAvatar() {
  const el = document.getElementById('userAvatar');
  if (AppState.user.FotoUrl) {
    el.innerHTML = `<img src="${AppState.user.FotoUrl}" style="width:100%;height:100%;object-fit:cover;">`;
  } else {
    el.textContent = (AppState.user.Nama || '?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  }
}
function openProfilePhotoModal() {
  openFormModal('Ganti Foto Profil', `
    <div class="text-center mb-3">
      <div style="width:96px;height:96px;border-radius:50%;overflow:hidden;margin:0 auto;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.8rem;font-weight:700;" id="profilePhotoPreview">
        ${AppState.user.FotoUrl ? `<img src="${AppState.user.FotoUrl}" style="width:100%;height:100%;object-fit:cover;">` : (AppState.user.Nama||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}
      </div>
    </div>
    <input type="file" accept="image/png, image/jpeg, image/webp" class="form-control" id="profilePhotoInput" onchange="handleProfilePhotoUpload(event)">
    <div class="small text-muted mt-2" id="profilePhotoStatus"></div>
    <hr class="my-3">
    <button type="button" class="btn btn-outline-ip w-100" onclick="openChangePasswordModal()"><i class="bi bi-key"></i> Ganti Password</button>
  `);
}
function openChangePasswordModal() {
  openFormModal('Ganti Password', `
    <form onsubmit="return handleChangePassword(event)">
      <div class="mb-2">
        <label class="form-label">Password Lama</label>
        <input type="password" class="form-control" id="cpOldPassword" required autofocus>
      </div>
      <div class="mb-2">
        <label class="form-label">Password Baru</label>
        <input type="password" class="form-control" id="cpNewPassword" minlength="6" required>
      </div>
      <div class="mb-3">
        <label class="form-label">Ulangi Password Baru</label>
        <input type="password" class="form-control" id="cpNewPasswordConfirm" minlength="6" required>
      </div>
      <div id="cpResult" class="mb-2"></div>
      <button type="submit" class="btn btn-primary-ip w-100" id="cpSubmitBtn"><i class="bi bi-check2-circle"></i> Simpan Password Baru</button>
    </form>
  `);
}
function handleChangePassword(evt) {
  evt.preventDefault();
  const oldPass = val('cpOldPassword'), newPass = val('cpNewPassword'), newPassConfirm = val('cpNewPasswordConfirm');
  const resultEl = document.getElementById('cpResult');
  if (newPass !== newPassConfirm) {
    resultEl.innerHTML = `<div class="alert alert-danger small mb-0">Password baru dan ulangi password tidak sama.</div>`;
    return false;
  }
  const btn = document.getElementById('cpSubmitBtn');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
  btn.disabled = true;
  google.script.run
    .withSuccessHandler(res => {
      btn.innerHTML = orig; btn.disabled = false;
      if (res.success) {
        resultEl.innerHTML = `<div class="alert alert-success small mb-0">${res.message}</div>`;
        showToast('Berhasil', 'Password berhasil diubah.', 'success');
        setTimeout(closeFormModal, 1200);
      } else {
        resultEl.innerHTML = `<div class="alert alert-danger small mb-0">${res.message}</div>`;
      }
    })
    .withFailureHandler(err => {
      btn.innerHTML = orig; btn.disabled = false;
      resultEl.innerHTML = `<div class="alert alert-danger small mb-0">${err.message}</div>`;
    })
    .changePasswordSelf(AppState.user.Username, oldPass, newPass);
  return false;
}
async function handleProfilePhotoUpload(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('profilePhotoStatus');
  statusEl.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Mengunggah...';
  try {
    const compressed = await compressImageFile_(file);
    const uploadRes = await gsRun('uploadProfilePhoto', compressed.base64, compressed.fileName, compressed.mimeType);
    if (!uploadRes.success) throw new Error(uploadRes.message);
    const photoUrl = uploadRes.data.directUrl;
    const updateRes = await gsRun('updateFieldById', 'USERS', AppState.user.ID, { FotoUrl: photoUrl });
    if (!updateRes.success) throw new Error(updateRes.message);
    AppState.user.FotoUrl = photoUrl;
    sessionStorage.setItem('ipg_user', JSON.stringify(AppState.user));
    renderUserAvatar();
    document.getElementById('profilePhotoPreview').innerHTML = `<img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;">`;
    statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> Foto profil diperbarui.';
    showToast('Berhasil', 'Foto profil diperbarui.', 'success');
  } catch (err) {
    statusEl.innerHTML = `<span class="text-danger">${err.message}</span>`;
  }
}
function canAccess(item) {
  const dbCfg = AppState.roleMenuAccess[item.id];
  if (dbCfg && Object.prototype.hasOwnProperty.call(dbCfg, AppState.user.Role)) {
    return !!dbCfg[AppState.user.Role];
  }
  // fallback ke default statis kalau data akses dari server belum termuat
  if (item.roles === 'ALL') return true;
  return item.roles.includes(AppState.user.Role);
}

function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  let html = '';
  MENU.forEach(group => {
    const visibleItems = group.items.filter(it => canAccess(it));
    if (visibleItems.length === 0) return;
    if (group.group) html += `<li class="sidebar-group-label">${group.group}</li>`;
    visibleItems.forEach(it => {
      html += `<li><a class="nav-link" data-section="${it.id}" onclick="navigateTo('${it.id}')">
        <i class="bi ${it.icon}"></i> <span>${it.label}</span>
        ${it.badge ? `<span class="pill pill-warning ms-auto" style="font-size:.6rem;">${it.badge}</span>` : ''}
      </a></li>`;
    });
  });
  nav.innerHTML = html;
}

const SECTION_TITLES = {
  dashboard: 'Dashboard Operasional Pengamanan', mutasiJaga: 'Mutasi Jaga Pos — Serah Terima',
  checklistSarpras: 'Checklist Sarana & Prasarana', patroli: 'Patroli QR & GPS',
  izinTamu: 'Izin Tamu Masuk', kendaraan: 'Izin Kendaraan Masuk A',
  barangKeluar: 'Pengajuan Barang Keluar', incident: 'Incident & Gangguan Keamanan',
  kta: 'KTA Monitoring', petaKeamanan: 'Peta Keamanan', sopCenter: 'SOP Center',
  awarenessCenter: 'Awareness Center', masterData: 'Master Data', administrasi: 'Administrasi Akun'
};

function navigateTo(sectionId, fromHistory) {
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.classList.toggle('active', l.dataset.section === sectionId));
  closeSidebar();
  const loaders = {
    dashboard: loadDashboard, mutasiJaga: loadMutasiJaga, checklistSarpras: loadChecklistSarpras,
    patroli: loadPatroli, izinTamu: loadIzinTamu, kendaraan: loadKendaraan, barangKeluar: loadBarangKeluar,
    incident: loadIncident, kta: loadKta, petaKeamanan: loadPetaKeamanan, sopCenter: loadSopCenter,
    awarenessCenter: loadAwareness, teleponPenting: loadTeleponPenting, masterData: loadMasterData, administrasi: loadAdministrasi
  };
  (loaders[sectionId] || (() => {}))();
  // Catat ke history browser (kecuali kalau navigasi ini memang DIPICU oleh tombol back/forward browser
  // atau pemuatan awal — supaya tidak dobel-catat / bikin loop) — ini yang bikin tombol back browser
  // & refresh-kembali-ke-halaman-terakhir bisa berfungsi.
  if (!fromHistory) history.pushState({ section: sectionId }, '', '#' + sectionId);
  try { sessionStorage.setItem('ipg_last_section', sectionId); } catch (e) {}
  updateBackButtonVisibility();
}
window.addEventListener('popstate', evt => {
  const sectionId = (evt.state && evt.state.section) || 'dashboard';
  navigateTo(sectionId, true);
});
function updateBackButtonVisibility() {
  const btn = document.getElementById('topbarBackBtn');
  if (btn) btn.style.display = (history.state && history.state.section && history.state.section !== 'dashboard') ? 'inline-block' : 'none';
}

/** Pencarian topbar — navigasi cepat ke modul (cocokkan label & alias, sesuai role) */
function onTopbarSearchInput() {
  const q = val('topbarSearchInput').trim().toLowerCase();
  const dd = document.getElementById('topbarSearchResults');
  if (!q) { dd.style.display = 'none'; dd.innerHTML = ''; return; }
  const matches = [];
  MENU.forEach(group => group.items.forEach(it => {
    if (!canAccess(it)) return;
    const hay = [it.label, ...(it.aliases || [])].join(' ').toLowerCase();
    if (hay.includes(q)) matches.push(it);
  }));
  if (!matches.length) { dd.innerHTML = '<div class="p-3 text-muted small text-center">Tidak ditemukan.</div>'; dd.style.display = 'block'; return; }
  dd.innerHTML = matches.map(it => `
    <div onclick="goToTopbarSearchResult('${it.id}')" style="padding:.6rem 1rem;cursor:pointer;font-size:.85rem;display:flex;align-items:center;gap:.6rem;" onmouseover="this.style.background='var(--hover-bg)'" onmouseout="this.style.background=''">
      <i class="bi ${it.icon}" style="color:var(--primary);"></i> ${it.label}
    </div>`).join('');
  dd.style.display = 'block';
}
function goToTopbarSearchResult(id) {
  document.getElementById('topbarSearchInput').value = '';
  document.getElementById('topbarSearchResults').style.display = 'none';
  navigateTo(id);
}
function onTopbarSearchKeydown(evt) {
  if (evt.key === 'Enter') {
    const first = document.querySelector('#topbarSearchResults > div[onclick]');
    if (first) first.click();
  } else if (evt.key === 'Escape') {
    document.getElementById('topbarSearchResults').style.display = 'none';
  }
}
document.addEventListener('click', evt => {
  const box = document.querySelector('.search-box');
  const dd = document.getElementById('topbarSearchResults');
  if (dd && box && !box.contains(evt.target)) dd.style.display = 'none';
});
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('show');
  document.querySelector('.sidebar-overlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('show');
  document.querySelector('.sidebar-overlay').classList.remove('show');
}

// ════════════════════════════════════════════════════════
// UTILITAS UI (toast, saving overlay — PRD Bab 8, modal)
// ════════════════════════════════════════════════════════
function showToast(title, message, type) {
  const el = document.getElementById('appToast');
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastBody').textContent = message;
  el.style.borderLeft = `4px solid ${ type==='danger' ? '#E53935' : type==='success' ? '#00C853' : '#0C7A94' }`;
  new bootstrap.Toast(el, { delay: 3500 }).show();
}

function showSaving(msg) {
  let el = document.getElementById('savingOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'savingOverlay'; el.className = 'saving-overlay';
    el.innerHTML = `<div class="saving-box"><span class="spinner-border spinner-border-sm" style="color:#0C7A94;"></span> <span id="savingMsg">Sedang menyimpan...</span></div>`;
    document.body.appendChild(el);
  }
  document.getElementById('savingMsg').textContent = msg || 'Sedang menyimpan...';
  el.style.display = 'flex';
}
function hideSaving() {
  const el = document.getElementById('savingOverlay');
  if (el) el.style.display = 'none';
}

function openConfirmModal(message, onConfirm) {
  document.getElementById('confirmModalBody').textContent = message;
  const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
  const btn = document.getElementById('confirmModalBtn');
  const clone = btn.cloneNode(true); btn.parentNode.replaceChild(clone, btn);
  clone.onclick = () => { modal.hide(); onConfirm(); };
  modal.show();
}

function openFormModal(title, bodyHtml) {
  document.getElementById('formModalTitle').innerHTML = title;
  document.getElementById('formModalBody').innerHTML = bodyHtml;
  new bootstrap.Modal(document.getElementById('formModal')).show();
  IPG_DINAS_FORMS.forEach(p => { if (document.getElementById(p + 'DinasInfo')) ipgUpdateDinas(p); });
}
function closeFormModal() {
  bootstrap.Modal.getInstance(document.getElementById('formModal'))?.hide();
}

/** Format tanggal Indonesia panjang (21 September 2026) — dipakai baris ringkasan kop surat dokumen cetak */
function fmtTanggalIndo(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function statusPill(status) {
  const map = {
    'Baru':'pill-danger','Diajukan':'pill-warning','Menunggu Danru':'pill-warning','Menunggu Danru Lama':'pill-warning',
    'Menunggu Danru Baru':'pill-warning','Menunggu TL Keamanan':'pill-warning',
    'Menunggu TL/SPS Keamanan':'pill-warning','Menunggu Approval':'pill-warning','Ditindaklanjuti':'pill-info',
    'Disetujui':'pill-success','Selesai':'pill-success','Barang Keluar':'pill-info','Kembali':'pill-success',
    'Menunggu Check-In':'pill-warning','Di Area':'pill-info','Ditolak':'pill-danger','Aktif':'pill-success',
    'Pending':'pill-warning'
  };
  return `<span class="pill ${map[status] || 'pill-neutral'}">${status || '-'}</span>`;
}

/** Bungkus google.script.run jadi Promise — dipakai alur async/await (mis. upload Peta Keamanan) */
function gsRun(fnName, ...args) {
  return new Promise((resolve, reject) => {
    google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[fnName](...args);
  });
}
function callServer(fnName, args, successMsg, afterFn, savingMsg) {
  showSaving(savingMsg);
  google.script.run
    .withSuccessHandler(res => {
      hideSaving();
      if (res.success) { showToast('Berhasil', successMsg || res.message, 'success'); if (afterFn) afterFn(res); }
      else showToast('Gagal', res.message, 'danger');
    })
    .withFailureHandler(err => { hideSaving(); showToast('Error', err.message, 'danger'); })
    [fnName](...args);
}

// ════════════════════════════════════════════════════════
// DASHBOARD — 4 KPI (PRD Bab 6 #1)
// ════════════════════════════════════════════════════════
const STATUS_KEAMANAN_ICON = { hijau: 'bi-shield-fill-check', kuning: 'bi-shield-fill-exclamation', merah: 'bi-shield-fill-exclamation' };
const STATUS_KEAMANAN_COLOR = { hijau: '#00C853', kuning: '#FFC107', merah: '#E53935' };
function openStatusKeamananDrilldown() {
  openFormModal('Detail Status Keamanan Hari Ini — Jurnal Pos', `
    <p class="section-sub mb-2">Berdasarkan entri Jurnal Pos yang dicatat hari ini.</p>
    ${dashboardJurnalPosHariIni.length ? `<div class="table-responsive-ip"><table class="table-ip">
        <thead><tr><th>Pos</th><th>Shift</th><th>Petugas</th><th>Kondisi</th><th>Catatan</th></tr></thead>
        <tbody>${dashboardJurnalPosHariIni.map(j => `<tr>
          <td>${j.PosJaga}</td><td>${j.Shift}</td><td>${j.PetugasLama} → ${j.PetugasBaru}</td>
          <td>${kondisiJurnalPill(j.Kondisi)}</td><td>${j.Catatan || '-'}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<div class="text-muted small text-center py-3">Belum ada entri Jurnal Pos hari ini.</div>'}
  `);
}
function loadDashboard() {
  const c = document.getElementById('app-container');
  c.innerHTML = `<div class="text-center py-5"><div class="spinner-border" style="color:#0C7A94"></div></div>`;
  google.script.run.withSuccessHandler(renderDashboard).withFailureHandler(e=>showToast('Error',e.message,'danger')).getDashboardData();
}
let dashboardJurnalPosHariIni = [];
function renderDashboard(res) {
  if (!res.success) { showToast('Error', res.message, 'danger'); return; }
  const d = res.data;
  dashboardJurnalPosHariIni = d.jurnalPosHariIni || [];
  document.getElementById('app-container').innerHTML = `
    <div class="section-title">
      <div><h3>Dashboard Operasional Pengamanan</h3><div class="section-sub">PT PLN Indonesia Power UBP Grati — Real-time Monitoring Sistem Manajemen Pengamanan</div></div>
    </div>
    <div class="row g-3 mb-3">
      ${statCard('bi-exclamation-triangle-fill', '#E53935', d.incidentBulanIni, 'Incident Bulan Ini')}
      ${statCard('bi-person-vcard-fill', '#FFC107', d.ktaMendekatiKedaluwarsa, 'KTA Mendekati Kedaluwarsa')}
      ${statCard('bi-box-arrow-up-right', '#0C7A94', d.barangKeluarHariIni, 'Barang Keluar Hari Ini')}
      <div class="col-6 col-lg-3"><div class="stat-card" style="cursor:pointer;" onclick="openStatusKeamananDrilldown()">
        <div class="stat-icon" style="background:${STATUS_KEAMANAN_COLOR[d.statusKeamanan.level]}"><i class="bi ${STATUS_KEAMANAN_ICON[d.statusKeamanan.level]}"></i></div>
        <div><div class="stat-value">${d.statusKeamanan.label}</div><div class="stat-label">Status Keamanan Hari Ini</div></div>
      </div></div>
    </div>
    <div class="card-ip mb-3">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <h6 class="mb-0"><i class="bi bi-geo-alt"></i> Status Pengisian Jurnal Pos Hari Ini <span id="posComplianceShiftBadge" class="badge-prd"></span></h6>
        <button class="btn btn-outline-ip btn-sm-ip" onclick="loadPosCompliance()"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
      </div>
      <div id="posComplianceGrid" class="row g-2"><div class="text-center text-muted py-3">Memuat status pos...</div></div>
    </div>
    <div class="card-ip mb-3">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <h6 class="mb-0"><i class="bi bi-shield-check"></i> Kepatuhan Patroli Hari Ini <span id="patroliComplianceShiftBadge" class="badge-prd"></span></h6>
        <button class="btn btn-outline-ip btn-sm-ip" onclick="loadPatroliCompliance()"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
      </div>
      <div id="patroliComplianceGrid"><div class="text-center text-muted py-3">Memuat status patroli...</div></div>
    </div>
    <div class="card-ip mb-3">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <h6 class="mb-0"><i class="bi bi-clipboard-check"></i> Checklist Sarpras Hari Ini</h6>
        <button class="btn btn-outline-ip btn-sm-ip" onclick="loadChecklistSarprasDashboard()"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
      </div>
      <div id="checklistSarprasDashboardGrid"><div class="text-center text-muted py-3">Memuat status checklist...</div></div>
    </div>
    <div class="row g-3">
      <div class="col-lg-4">
        <div class="card-ip">
          <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
            <div>
              <h6 class="mb-0">Tren Insiden Bulanan</h6>
              <div class="section-sub">Distribusi volume insiden Jan–Des ${new Date().getFullYear()}</div>
            </div>
            <span class="badge-prd" style="background:${d.selisihPersenChart<=0?'#E3F9EC':'#FDE8E8'};color:${d.selisihPersenChart<=0?'#00913E':'#E53935'};">
              ${d.selisihPersenChart>0?'+':''}${d.selisihPersenChart}% vs bulan lalu
            </span>
          </div>
          <canvas id="chartIncidentBulanan" height="110"></canvas>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card-ip" style="background:var(--accent-tint-bg); color:var(--text-dark);">
          <h6 style="color:var(--primary);"><i class="bi bi-lightbulb"></i> Ringkasan Operasional</h6>
          <ul style="padding-left:1.1rem; font-size:.85rem; color:var(--text-dark);">
            ${d.insights.map(i=>`<li class="mb-2">${i}</li>`).join('')}
            <li>Total titik patroli tercatat hari ini: <b style="color:var(--text-dark);">${d.totalTitikPatroliHariIni}</b></li>
          </ul>
        </div>
      </div>
      <div class="col-lg-4" id="petaDashboardCol">
        <div class="card-ip"><div class="text-center text-muted small py-5"><span class="spinner-border spinner-border-sm"></span></div></div>
      </div>
    </div>
    <div class="row g-3 mt-1">
      <div class="col-lg-4">
        <div class="card-ip">
          <h6 class="mb-3 text-uppercase" style="font-size:.8rem;letter-spacing:.03em;">Notifikasi</h6>
          <div id="dashboardNotifWrap"><div class="text-muted small text-center py-3"><span class="spinner-border spinner-border-sm"></span></div></div>
        </div>
      </div>
      <div class="col-lg-4" id="awarenessDashboardCol">
        <div class="card-ip"><div class="text-center text-muted small py-5"><span class="spinner-border spinner-border-sm"></span></div></div>
      </div>
      <div class="col-lg-4" id="sopDashboardCol">
        <div class="card-ip"><div class="text-center text-muted small py-5"><span class="spinner-border spinner-border-sm"></span></div></div>
      </div>
    </div>`;
  renderIncidentBulananChart(d.incidentPerBulan, d.bulanIniIdx);
  loadPosCompliance();
  loadPatroliCompliance();
  loadChecklistSarprasDashboard();
  loadDashboardWidgets();
  loadNotifikasiApproval();
}
function loadDashboardWidgets() {
  google.script.run.withSuccessHandler(res => {
    if (!res.success) {
      const msg = `<div class="card-ip text-danger small">${res.message}</div>`;
      document.getElementById('petaDashboardCol').innerHTML = msg;
      document.getElementById('awarenessDashboardCol').innerHTML = msg;
      document.getElementById('sopDashboardCol').innerHTML = msg;
      return;
    }
    const { peta, flyerTerbaru, kuisTerbaru, beritaTerbaru, sopList } = res.data;
    document.getElementById('petaDashboardCol').innerHTML = `<div class="card-ip">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0 text-uppercase" style="font-size:.8rem;letter-spacing:.03em;">Peta Keamanan Area</h6>
          <a href="javascript:void(0)" onclick="navigateTo('petaKeamanan')" class="small" style="color:var(--primary);font-weight:600;text-decoration:none;">Lihat Peta Penuh <i class="bi bi-chevron-right"></i></a>
        </div>
        ${peta ? `<img src="${peta.ThumbnailUrl}" style="width:100%;height:220px;object-fit:cover;border-radius:var(--radius-md);">` : `<div class="text-muted small text-center py-5">Belum ada peta diunggah.</div>`}
      </div>`;
    document.getElementById('awarenessDashboardCol').innerHTML = `<div class="card-ip">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h6 class="mb-0 text-uppercase" style="font-size:.8rem;letter-spacing:.03em;">Awareness Center</h6>
          <a href="javascript:void(0)" onclick="navigateTo('awarenessCenter')" class="small" style="color:var(--primary);font-weight:600;text-decoration:none;">Buka <i class="bi bi-chevron-right"></i></a>
        </div>
        <div class="small text-muted fw-bold mb-1">FLYER TERBARU</div>
        ${flyerTerbaru ? `<div class="d-flex gap-2 align-items-center mb-3">
            <img src="${flyerTerbaru.ImageUrl}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0;">
            <div class="flex-grow-1"><div class="small fw-bold">${flyerTerbaru.Judul}</div>${flyerTerbaru.Deskripsi ? `<div class="small text-muted">${flyerTerbaru.Deskripsi}</div>` : ''}<div class="small text-muted">${flyerTerbaru.Kategori||'-'} &middot; ${(flyerTerbaru.Tanggal||'').toString().slice(0,10)}</div></div>
          </div>` : '<div class="small text-muted mb-3">Belum ada flyer.</div>'}
        <div class="small text-muted fw-bold mb-1">KUIS TERBARU</div>
        ${kuisTerbaru ? `<div class="small mb-3"><i class="bi bi-patch-question-fill" style="color:#FFC107;"></i> <b>${kuisTerbaru.Judul}</b>${kuisTerbaru.Deskripsi ? `<div class="text-muted">${kuisTerbaru.Deskripsi}</div>` : ''}</div>` : '<div class="small text-muted mb-3">Belum ada kuis.</div>'}
        <div class="small text-muted fw-bold mb-1">BERITA TERBARU</div>
        ${beritaTerbaru ? `<div class="small"><b>${beritaTerbaru.Judul}</b>${beritaTerbaru.Deskripsi ? `<div class="text-muted">${beritaTerbaru.Deskripsi}</div>` : ''}<div class="text-muted">${beritaTerbaru.Kategori||'-'} &middot; ${(beritaTerbaru.Tanggal||'').toString().slice(0,10)}</div></div>` : '<div class="small text-muted">Belum ada berita.</div>'}
      </div>`;
    document.getElementById('sopDashboardCol').innerHTML = `<div class="card-ip">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0 text-uppercase" style="font-size:.8rem;letter-spacing:.03em;">Dokumen SOP Terbaru</h6>
          <a href="javascript:void(0)" onclick="navigateTo('sopCenter')" class="small" style="color:var(--primary);font-weight:600;text-decoration:none;">Lihat Semua <i class="bi bi-chevron-right"></i></a>
        </div>
        ${sopList.length ? sopList.map(s => `
          <div class="d-flex align-items-center gap-2 py-2" style="border-bottom:1px solid var(--border-subtle);">
            <div style="width:34px;height:34px;border-radius:8px;background:#FDE8E8;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="bi bi-file-earmark-pdf-fill" style="color:#E53935;"></i></div>
            <div class="flex-grow-1"><div class="small fw-bold">${s.Judul}</div><div class="small text-muted">Th. ${s.Tahun||'-'}</div></div>
            <a href="${s.DownloadUrl||s.FileUrl}" target="_blank" class="btn btn-outline-ip btn-sm-ip">Download</a>
          </div>`).join('') : '<div class="small text-muted">Belum ada dokumen SOP.</div>'}
      </div>`;
  }).withFailureHandler(e => {
    const msg = `<div class="card-ip text-danger small">${e.message}</div>`;
    document.getElementById('petaDashboardCol').innerHTML = msg;
    document.getElementById('awarenessDashboardCol').innerHTML = msg;
    document.getElementById('sopDashboardCol').innerHTML = msg;
  }).getDashboardWidgetsData();
}
function loadPatroliCompliance() {
  google.script.run.withSuccessHandler(res => {
    const grid = document.getElementById('patroliComplianceGrid');
    if (!res.success) { grid.innerHTML = `<div class="text-danger small">${res.message}</div>`; return; }
    const { shift, putaran, totalTitik } = res.data;
    document.getElementById('patroliComplianceShiftBadge').textContent = `Shift Aktif: ${shift}`;
    if (!totalTitik) { grid.innerHTML = `<div class="text-muted small">Belum ada Titik Patroli terdaftar di Master Data.</div>`; return; }
    grid.innerHTML = `<div class="row g-2">${putaran.map((p,i) => `
      <div class="col-6 col-lg-3">
        <div class="card-ip" style="padding:.85rem;">
          <div style="font-size:.72rem;color:var(--text-muted);font-weight:700;">PUTARAN ${i+1} &middot; ${p.jam}</div>
          <div style="font-size:1.3rem;font-weight:700;font-family:'Poppins',sans-serif;margin:.2rem 0;">${p.persen}%</div>
          <div style="height:8px;background:#EEF2F8;border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${p.persen}%;background:${p.persen===100?'#00C853':p.persen>0?'#FFC107':'#E53935'};"></div>
          </div>
          <div style="font-size:.68rem;color:var(--text-muted);margin-top:.3rem;">${p.scanned}/${p.total} titik discan</div>
        </div>
      </div>`).join('')}</div>`;
  }).withFailureHandler(e=>{ document.getElementById('patroliComplianceGrid').innerHTML = `<div class="text-danger small">${e.message}</div>`; }).getPatroliCompliance();
}
function loadChecklistSarprasDashboard() {
  google.script.run.withSuccessHandler(res => {
    const grid = document.getElementById('checklistSarprasDashboardGrid');
    if (!res.success) { grid.innerHTML = `<div class="text-danger small">${res.message}</div>`; return; }
    const d = res.data;
    const SHIFT_ICONS = { 'Pagi': 'bi-sun-fill', 'Sore': 'bi-cloud-sun-fill', 'Malam': 'bi-moon-stars-fill' };
    const shiftCards = ['Pagi','Sore','Malam'].map(s => {
      const st = d.shiftStatus[s];
      const color = st.done ? '#00913E' : '#E53935';
      const bg = st.done ? 'var(--tint-green)' : 'var(--tint-red)';
      const statusIcon = st.done ? 'bi-check-circle-fill' : 'bi-x-circle-fill';
      return `<div class="col-6 col-md-4"><div class="stat-card" style="background:${bg}; border-color:transparent;">
        <div class="stat-icon" style="background:${color}"><i class="bi ${SHIFT_ICONS[s]}"></i></div>
        <div>
          <div class="stat-value" style="font-size:1.15rem;">${s}</div>
          <div class="stat-label" style="text-transform:none; display:flex; align-items:center; gap:.25rem;">
            <i class="bi ${statusIcon}" style="color:${color};"></i> ${st.done ? 'Sudah diperiksa' : 'Belum diperiksa'}
          </div>
        </div>
      </div></div>`;
    }).join('');
    grid.innerHTML = `
      <div class="row g-2 mb-3">${shiftCards}</div>
      <div class="row g-2">
        ${pastelStatCard('bi-box-seam', 'var(--tint-blue)', '#0C7A94', d.totalItems, 'Total Item Sarpras')}
        ${pastelStatCard('bi-check2-square', 'var(--tint-green)', '#00913E', d.totalBaik, 'Kondisi Baik (Hari Ini)')}
        ${pastelStatCard('bi-exclamation-triangle', 'var(--tint-red)', '#E53935', d.totalRusak, 'Kondisi Rusak (Hari Ini)')}
      </div>`;
  }).withFailureHandler(e=>{ document.getElementById('checklistSarprasDashboardGrid').innerHTML = `<div class="text-danger small">${e.message}</div>`; }).getChecklistSarprasDashboard();
}
function loadPosCompliance() {
  google.script.run.withSuccessHandler(res => {
    if (!res.success) { document.getElementById('posComplianceGrid').innerHTML = `<div class="text-danger small">${res.message}</div>`; return; }
    const { shift, checkpoints, posStatus } = res.data;
    document.getElementById('posComplianceShiftBadge').textContent = `Shift Aktif: ${shift} (${checkpoints.join(', ')})`;
    const grid = document.getElementById('posComplianceGrid');
    grid.innerHTML = OPT_POS.filter(pos => posStatus[pos]).map(pos => {
      const s = posStatus[pos];
      const complete = s.count === s.total;
      const partial = s.count > 0 && !complete;
      const color = complete ? '#00C853' : partial ? '#FFC107' : '#E53935';
      const icon = complete ? 'bi-shield-check' : partial ? 'bi-shield-exclamation' : 'bi-shield-x';
      const dots = s.filled.map((f,i) => `<span title="${checkpoints[i]}" style="display:inline-block;width:9px;height:9px;border-radius:50%;margin:0 2px;background:${f?'#00C853':'#E0E4EA'};"></span>`).join('');
      return `<div class="col-6 col-md-4 col-lg-2">
        <div class="card-ip text-center" style="padding:.85rem;">
          <i class="bi ${icon}" style="font-size:1.5rem;color:${color};"></i>
          <div style="font-size:.8rem;font-weight:700;margin-top:.25rem;">${pos}</div>
          <div style="font-size:.68rem;color:var(--text-muted);margin:.2rem 0;">${s.count}/${s.total} checkpoint</div>
          <div>${dots}</div>
        </div>
      </div>`;
    }).join('');
  }).withFailureHandler(e=>{ document.getElementById('posComplianceGrid').innerHTML = `<div class="text-danger small">${e.message}</div>`; }).getPosJagaCompliance();
}
function statCard(icon, color, value, label) {
  return `<div class="col-6 col-lg-3"><div class="stat-card">
    <div class="stat-icon" style="background:${color}">${`<i class="bi ${icon}"></i>`}</div>
    <div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>
  </div></div>`;
}
/** Varian statCard dengan background pastel — dipakai kartu Checklist Sarpras Dashboard */
function pastelStatCard(icon, bg, iconColor, value, label) {
  return `<div class="col-6 col-md-4"><div class="stat-card" style="background:${bg}; border-color:transparent;">
    <div class="stat-icon" style="background:${iconColor}">${`<i class="bi ${icon}"></i>`}</div>
    <div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>
  </div></div>`;
}
function renderIncidentBulananChart(perBulan, bulanIniIdx) {
  const ctx = document.getElementById('chartIncidentBulanan');
  if (!ctx) return;
  if (AppState.chart) AppState.chart.destroy();
  const labels = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const colors = perBulan.map((_, i) => i === bulanIniIdx ? '#0C7A94' : '#C7DBF5');
  AppState.chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data: perBulan, backgroundColor: colors, borderRadius: 5, maxBarThickness: 28 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, color: '#8A94A6' }, grid: { color: '#EEF2F8' } },
        x: { grid: { display: false }, ticks: { color: '#8A94A6' } }
      }
    }
  });
}

// ════════════════════════════════════════════════════════
// GENERIC TABLE RENDERER
// ════════════════════════════════════════════════════════
function renderGenericTable(containerId, columns, rows, actionsFn) {
  const el = document.getElementById(containerId);
  if (!el) return; // halaman sudah berganti sebelum data datang (mis. pindah menu saat menyimpan)
  if (!rows || rows.length === 0) {
    el.innerHTML = `<div class="text-center text-muted py-5"><i class="bi bi-inbox fs-2"></i><p class="mt-2">Belum ada data.</p></div>`;
    return;
  }
  el.innerHTML = `<div class="table-responsive-ip"><table class="table-ip">
    <thead><tr>${columns.map(c=>`<th>${c.label}</th>`).join('')}${actionsFn ? '<th>Aksi</th>' : ''}</tr></thead>
    <tbody>${rows.map(row => `<tr>${columns.map(c => `<td>${c.render ? c.render(row) : (row[c.key] ?? '-')}</td>`).join('')}${actionsFn ? `<td>${actionsFn(row)}</td>` : ''}</tr>`).join('')}</tbody>
  </table></div>`;
}

function sectionHeader(title, sub, badge) {
  return `<div class="section-title"><div><h3>${title}${badge ? ` <span class="badge-prd">${badge}</span>`:''}</h3><div class="section-sub">${sub||''}</div></div></div>`;
}

// ════════════════════════════════════════════════════════
// MODUL: MUTASI JAGA POS — 5 Section (PRD Bab 7.2)
// ════════════════════════════════════════════════════════
function loadMutasiJaga() {
  const c = document.getElementById('app-container');
  c.innerHTML = sectionHeader('Mutasi Jaga Pos — Serah Terima 5 Section', 'Jurnal ringkas tiap 2 jam (referensi) + Berita Acara di akhir shift (Danru → TL Keamanan)')
    + `<div class="mb-3 d-flex justify-content-end gap-2 flex-wrap">
         <button class="btn btn-outline-ip" onclick="openJurnalForm()"><i class="bi bi-journal-plus"></i> Catat Jurnal</button>
         <button class="btn btn-outline-ip" onclick="openUnduhLaporanModal('jurnal_pos')"><i class="bi bi-file-earmark-arrow-down"></i> Unduh Laporan</button>
         <button class="btn btn-primary-ip" onclick="openMutasiJagaForm()"><i class="bi bi-plus-lg"></i> Buat Berita Acara Baru</button>
       </div>
       <div class="row g-2 mb-3" id="mjDashboardWrap"></div>
       <div class="card-ip mb-3">
         <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
           <h6 class="mb-0"><i class="bi bi-journal-text"></i> Jurnal Pos Jaga <span class="badge-prd">tanpa approval</span></h6>
           <label class="small text-muted mb-0" for="jurnalListTanggalInput">Tanggal dinas</label><input type="date" class="form-control form-control-sm" id="jurnalListTanggalInput" style="width:auto;" title="Hari operasional: Malam (malam sebelumnya) + Pagi + Sore. Contoh: Malam 24/25 → pilih 25" value="${jurnalListTanggal}" onchange="onJurnalListTanggalChange()">
         </div>
         <div id="tblJurnalPos"></div>
       </div>
       <div class="card-ip">
         <h6 class="mb-2"><i class="bi bi-file-earmark-text"></i> BA Serah Terima Jurnal Pos Jaga <span class="badge-prd">Approval Danru Lama → Danru Baru → TL Keamanan</span></h6>
         <div id="tblMutasiJaga"></div>
       </div>`;
  loadJurnalList();
  google.script.run.withSuccessHandler(res => {
    renderMutasiJagaDashboard(res.data || []);
    renderGenericTable('tblMutasiJaga',
      [ {label:'Nomor BA', key:'NoBA'},
        {label:'Tanggal', render:r=>(r.Tanggal||'').slice(0,10)},
        {label:'Jam', render:r=>jamRangeFromSectionA(r.SectionA_Jurnal)},
        {label:'Pos', key:'PosJaga'}, {label:'Shift', key:'Shift'}, {label:'Regu', key:'Regu'},
        {label:'Danru Lama → Baru', render:r=>`${r.DanruLamaBy || '-'} → ${r.DanruBaruBy || '-'}`},
        {label:'Temuan (Sec D)', render: r => r.SectionD_Temuan ? `<span class="pill pill-danger">Ada</span>` : `<span class="pill pill-neutral">Nihil</span>`},
        {label:'Status', render: r => statusPill(r.StatusApproval)} ],
      (res.data||[]).sort((a,b)=> new Date(b.WaktuInput)-new Date(a.WaktuInput)),
      row => mutasiJagaActions(row)
    );
  }).getAllData('MUTASI_JAGA');
}
function jamRangeFromSectionA(json) {
  try {
    const entries = JSON.parse(json || '[]');
    if (!entries.length) return '-';
    const mulai = entries.map(e=>e.JamRolling).sort()[0];
    const selesai = entries.map(e=>e.JamRolling).sort().slice(-1)[0];
    return `${mulai}–${selesai}`;
  } catch(e) { return '-'; }
}

// ── Tanggal & shift (jam WIB perangkat) — OPSI C (hasil diskusi lanjutan) ──
// • Kolom "Tanggal"      = tanggal KALENDER asli (yang dilihat & diisi petugas, tercetak di dokumen).
// • Kolom "TanggalDinas" = kunci pengikat satu shift utuh, dihitung otomatis.
//   Shift Malam milik tanggal PAGI saat shift itu berakhir: Malam 24→25 Sep = dinas 25 ("Dinas Malam 24/25 Sep").
//   Hari operasional 25 = Malam 24/25 + Pagi 25 + Sore 25 (24 Sep 21.00 s.d. 25 Sep 21.00).
// • Aturan hitung dinas sama persis dengan server (resolveTanggalDinas_ di Kode.gs).
// Catatan: dulu dipakai toISOString() yang berbasis UTC, sehingga pukul 00.00–06.59 WIB tanggalnya mundur 1 hari.
const IPG_BULAN_PENDEK = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const IPG_BULAN_PANJANG = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const IPG_HARI = ['Minggu','Senin','Selasa','Rabu','Kamis',"Jum'at",'Sabtu'];
const IPG_DINAS_FORMS = ['jp', 'mj', 'cs', 'pt', 'rp']; // Jurnal, BA Mutasi, Checklist, Patroli, Rekap

function ipgYmd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function ipgParseYmd(ymd) { const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12); }
function ipgAddDays(ymd, n) { const d = ipgParseYmd(ymd); d.setDate(d.getDate() + n); return ipgYmd(d); }
/** Tanggal kalender hari ini (WIB perangkat) */
function ipgToday() { return ipgYmd(new Date()); }
/** Shift berjalan. graceMin: dokumen akhir shift (BA, Rekap) — pukul 06.15 dengan tenggang 60 menit masih Malam */
function ipgShiftNow(graceMin) {
  const h = new Date(Date.now() - (graceMin || 0) * 60000).getHours();
  return h >= 6 && h < 14 ? 'Pagi' : h >= 14 && h < 21 ? 'Sore' : 'Malam';
}
/** Tanggal dinas shift yang sedang berjalan (default daftar harian, laporan). Pukul 21.00 pindah ke hari berikutnya. */
function ipgTanggalDinas(shift) {
  const d = new Date();
  if (shift === 'Malam' && d.getHours() >= 12) d.setDate(d.getDate() + 1);
  return ipgYmd(d);
}
/** Putaran patroli terdekat sesuai jadwal (Pagi 06/08/10/12, Sore 14/16/18/20, Malam 22/00/02/04) */
function ipgPutaranNow() {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return Math.min(4, Math.floor((h - 6) / 2) + 1);
  if (h >= 14 && h < 21) return Math.min(4, Math.floor((h - 14) / 2) + 1);
  if (h >= 21) return 1;
  return Math.min(4, Math.floor(h / 2) + 2);
}
/**
 * Hitung tanggal dinas dari tanggal KALENDER + shift (+ putaran/rolling). Sama persis dengan hitungDinas_ di Kode.gs.
 *  - Pagi/Sore: sama dengan tanggal.
 *  - Malam, diisi saat malam berjalan (tanggal = hari ini, pukul 21.00–11.59):
 *      21.00–23.59 → besok (malam yang baru dimulai) · 00.00–11.59 → tanggal itu (malam yang sedang/baru berakhir).
 *  - Malam, susulan (tanggal lain, atau hari ini pukul 12.00–20.59):
 *      Putaran/Rolling 1 (22.00) → besok · Putaran/Rolling 2–4 (setelah 00.00) → tanggal itu ·
 *      BA/Rekap/Checklist → tanggal itu (dibuat pagi saat serah terima).
 * Kalau keterangan dinas tidak sesuai, petugas cukup membetulkan kolom Tanggal ke tanggal kejadian sebenarnya.
 */
function ipgHitungDinas(tanggal, shift, bagian) {
  if (!tanggal) return '';
  if (shift !== 'Malam') return tanggal;
  const besok = ipgAddDays(tanggal, 1);
  const jam = new Date().getHours();
  if (tanggal === ipgToday() && (jam >= 21 || jam < 12)) return jam >= 21 ? besok : tanggal;
  if (bagian) return Number(bagian) === 1 ? besok : tanggal;
  return tanggal;
}
/** Tanggal dinas sebuah baris data; data lama (sebelum kolom TanggalDinas ada) memakai kolom Tanggal */
function ipgDinasOf(r) { return String((r && (r.TanggalDinas || r.Tanggal)) || '').slice(0, 10); }
function ipgTglPendek(ymd) {
  if (!ymd) return '-';
  const d = ipgParseYmd(ymd);
  return isNaN(d) ? ymd : d.getDate() + ' ' + IPG_BULAN_PENDEK[d.getMonth()];
}
/** "Malam 24/25 Sep" (dinas 25) · "Malam 30 Sep/1 Okt" (dinas 1 Okt) · "Pagi 25 Sep" */
function ipgLabelDinas(dinas, shift) {
  if (!dinas) return '-';
  if (shift !== 'Malam') return (shift ? shift + ' ' : '') + ipgTglPendek(dinas);
  const a = ipgParseYmd(ipgAddDays(dinas, -1)), b = ipgParseYmd(dinas);
  const kiri = a.getMonth() === b.getMonth() ? String(a.getDate()) : a.getDate() + ' ' + IPG_BULAN_PENDEK[a.getMonth()];
  return 'Malam ' + kiri + '/' + b.getDate() + ' ' + IPG_BULAN_PENDEK[b.getMonth()];
}
/** Untuk dokumen cetak: "Kamis–Jum'at, 24–25 September 2026" (Malam dinas 25) · "Jum'at, 25 September 2026" */
function ipgTanggalDinasPanjang(r) {
  const dinas = ipgDinasOf(r);
  if (!dinas) return '-';
  if (r.Shift !== 'Malam') {
    const d = ipgParseYmd(dinas);
    return IPG_HARI[d.getDay()] + ', ' + d.getDate() + ' ' + IPG_BULAN_PANJANG[d.getMonth()] + ' ' + d.getFullYear();
  }
  const a = ipgParseYmd(ipgAddDays(dinas, -1)), b = ipgParseYmd(dinas);
  const hari = IPG_HARI[a.getDay()] + '–' + IPG_HARI[b.getDay()];
  if (a.getFullYear() !== b.getFullYear())
    return `${hari}, ${a.getDate()} ${IPG_BULAN_PANJANG[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${IPG_BULAN_PANJANG[b.getMonth()]} ${b.getFullYear()}`;
  if (a.getMonth() !== b.getMonth())
    return `${hari}, ${a.getDate()} ${IPG_BULAN_PANJANG[a.getMonth()]} – ${b.getDate()} ${IPG_BULAN_PANJANG[b.getMonth()]} ${b.getFullYear()}`;
  return `${hari}, ${a.getDate()}–${b.getDate()} ${IPG_BULAN_PANJANG[a.getMonth()]} ${a.getFullYear()}`;
}

// ── Keterangan dinas di 5 form (id: <prefix>DinasInfo) — hanya konfirmasi, dihitung ulang setiap isian berubah ──
function _ipgBagian(pre) {
  if (pre === 'jp') return val('jpRollingKe');
  if (pre === 'pt') return val('ptPutaran');
  return null; // BA / Checklist / Rekap: dokumen per shift
}
function ipgUpdateDinas(pre) {
  const info = document.getElementById(pre + 'DinasInfo');
  if (!info) return;
  const shift = val(pre + 'Shift');
  const dinas = ipgHitungDinas(val(pre + 'Tanggal'), shift, _ipgBagian(pre));
  info.dataset.value = dinas;
  info.innerHTML = dinas ? `<span class="pill pill-info"><i class="bi bi-calendar-check"></i> Dinas ${ipgLabelDinas(dinas, shift)}</span>` : '';
}
function ipgGetDinas(pre) {
  const info = document.getElementById(pre + 'DinasInfo');
  return (info && info.dataset.value) || ipgHitungDinas(val(pre + 'Tanggal'), val(pre + 'Shift'), _ipgBagian(pre));
}
// Tanggal / Shift / Rolling / Putaran berubah → keterangan dinas dihitung ulang.
// Fase capture: dinas sudah benar sebelum pencarian Section A / Rekap (listener bawaan form) berjalan.
document.addEventListener('change', e => {
  const m = /^(jp|mj|cs|pt|rp)(Tanggal|Shift|RollingKe|Putaran)$/.exec(e.target && e.target.id || '');
  if (m) ipgUpdateDinas(m[1]);
}, true);

// Pilihan baku — konsisten dipakai di Jurnal Pos & Mutasi Jaga (hasil diskusi lanjutan)
const OPT_SHIFT = ['Pagi', 'Sore', 'Malam'];
const KONDISI_JURNAL_PILL = { 'Aman': 'pill-success', 'Waspada': 'pill-warning', 'Bahaya': 'pill-danger' };
function kondisiJurnalPill(kondisi) { return `<span class="pill ${KONDISI_JURNAL_PILL[kondisi] || 'pill-neutral'}">${kondisi || '-'}</span>`; }
const OPT_REGU = ['A', 'B', 'C', 'D'];
const OPT_POS = ['Pos I','Pos II','Pos III','Pos IV','Pos V','Pos VI','Pos VII','Pos VIII','Pos IX','Pos Utama','Pos SCC','Pos Kanal Timur'];
// Checkpoint jurnal tetap per shift (hasil diskusi lanjutan) — jam resmi shift Satpam PLN IP UBP Grati:
// Pagi 06.00-14.00 | Sore 14.00-21.00 | Malam 21.00-06.00
// Label rentang jam checkpoint Pos Jaga — dipakai server (SHIFT_CHECKPOINTS_MAP) utk grid kepatuhan Dashboard
// Label rentang jam Putaran Patroli (khusus tampilan — Putaran dipilih manual 1-4 oleh Satpam)
const PATROLI_PUTARAN_LABELS = {
  'Pagi': ['06.00-07.00', '08.00-09.00', '10.00-11.00', '12.00-13.00'],
  'Sore': ['14.00-15.00', '16.00-17.00', '18.00-19.00', '20.00-21.00'],
  'Malam': ['22.00-23.00', '00.00-01.00', '02.00-03.00', '04.00-05.00']
};
function selectOptions(list, selected) {
  return list.map(o => `<option ${o===selected?'selected':''}>${o}</option>`).join('');
}

let jurnalListTanggal = ipgTanggalDinas(ipgShiftNow());
function loadJurnalList() {
  google.script.run.withSuccessHandler(res => {
    jurnalListAllData = res.data || [];
    renderJurnalListTable();
  }).getAllData('JURNAL_POS');
}
let jurnalListAllData = [];
function renderJurnalListTable() {
  const rows = jurnalListAllData.filter(r => ipgDinasOf(r) === jurnalListTanggal)
    .sort((a,b)=> new Date(b.WaktuInput)-new Date(a.WaktuInput));
  renderGenericTable('tblJurnalPos',
    [ {label:'Tanggal', render:r=>ipgTglPendek(r.Tanggal)}, {label:'Dinas', render:r=>ipgLabelDinas(ipgDinasOf(r), r.Shift)}, {label:'Rolling ke', render:r=>`Rolling ${r.RollingKe}`}, {label:'Jam Rolling', key:'JamRolling'},
      {label:'Pos', key:'PosJaga'}, {label:'Shift', key:'Shift'}, {label:'Regu', key:'Regu'},
      {label:'Petugas', render:r=>`${r.PetugasLama} → ${r.PetugasBaru}`},
      {label:'Kondisi', render:r=> kondisiJurnalPill(r.Kondisi)},
      {label:'Catatan', key:'Catatan'} ],
    rows
  );
}
function onJurnalListTanggalChange() {
  jurnalListTanggal = val('jurnalListTanggalInput');
  renderJurnalListTable();
}

// ════════════════════════════════════════════════════════
// MODAL "UNDUH LAPORAN" — generik, dipakai lintas modul (Jurnal Pos, Patroli, dst.)
// ════════════════════════════════════════════════════════
const REPORT_MODULE_CONFIG = {
  jurnal_pos: { title: 'Jurnal Pos & Mutasi Jaga', countFn: 'countJurnalPosLaporan', excelFn: 'exportJurnalPosLaporanExcel', pdfFn: 'exportJurnalPosLaporanPdf' },
  patroli: { title: 'Patroli QR & GPS', countFn: 'countPatroliLaporan', excelFn: 'exportPatroliLaporanExcel', pdfFn: 'exportPatroliLaporanPdf' },
  checklist_sarpras: { title: 'Checklist Sarpras', countFn: 'countChecklistSarprasLaporan', excelFn: 'exportChecklistSarprasLaporanExcel', pdfFn: 'exportChecklistSarprasLaporanPdf', dailyOnly: true },
  izin_tamu: { title: 'Izin Tamu Masuk', countFn: 'countIzinTamuLaporan', excelFn: 'exportIzinTamuLaporanExcel', pdfFn: 'exportIzinTamuLaporanPdf' },
  incident: { title: 'Incident & Gangguan Keamanan', countFn: 'countIncidentLaporan', excelFn: 'exportIncidentLaporanExcel', pdfFn: 'exportIncidentLaporanPdf' },
  kendaraan: { title: 'Izin Kendaraan Masuk A', countFn: 'countKendaraanLaporan', excelFn: 'exportKendaraanLaporanExcel', pdfFn: 'exportKendaraanLaporanPdf' }
};
let reportModalState = { moduleKey: null, periodLabel: null, format: 'excel' };

function openUnduhLaporanModal(moduleKey) {
  const cfg = REPORT_MODULE_CONFIG[moduleKey];
  const today = ipgTanggalDinas(ipgShiftNow());
  reportModalState = { moduleKey, periodType: 'Harian', periodValue: today, format: 'excel' };
  const periodSectionHtml = cfg.dailyOnly
    ? `<div class="mb-3"><label class="form-label">Tanggal Laporan</label><input type="date" class="form-control" id="reportPeriodInput" value="${today}" onchange="onReportPeriodChange()"></div>`
    : `<div class="mb-3">
      <label class="form-label">Periode Laporan</label>
      <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
        <div class="segmented-toggle">
          <button type="button" class="seg-btn active" id="segReportHarian" onclick="setReportPeriodType('Harian')">Harian</button>
          <button type="button" class="seg-btn" id="segReportBulanan" onclick="setReportPeriodType('Bulanan')">Bulanan</button>
        </div>
      </div>
      <div id="reportPeriodInputWrap"><input type="date" class="form-control" id="reportPeriodInput" value="${today}" onchange="onReportPeriodChange()"></div>
    </div>`;
  openFormModal(`<i class="bi bi-file-earmark-arrow-down-fill" style="color:#0C7A94;"></i> Unduh Laporan ${cfg.title}`, `
    ${periodSectionHtml}
    <div class="mb-3">
      <label class="form-label">Format Laporan</label>
      <div class="segmented-toggle">
        <button type="button" class="seg-btn active" id="fmtCardExcel" onclick="selectReportFormat('excel')"><i class="bi bi-filetype-xlsx"></i> Excel</button>
        <button type="button" class="seg-btn" id="fmtCardPdf" onclick="selectReportFormat('pdf')"><i class="bi bi-filetype-pdf"></i> PDF</button>
      </div>
    </div>
    <div id="reportSummaryWrap" class="small mb-3"><span class="spinner-border spinner-border-sm"></span> Memuat ringkasan data...</div>
    <div id="reportResultWrap"></div>
    <div class="d-flex gap-2 mt-2">
      <button type="button" class="btn btn-outline-ip" data-bs-dismiss="modal">Batal</button>
      <button type="button" class="btn btn-primary-ip flex-grow-1" id="btnUnduhLaporan" onclick="triggerUnduhLaporan()"><i class="bi bi-download"></i> Unduh Laporan</button>
    </div>`);
  updateReportSummary();
}
function setReportPeriodType(type) {
  reportModalState.periodType = type;
  document.getElementById('segReportHarian').classList.toggle('active', type === 'Harian');
  document.getElementById('segReportBulanan').classList.toggle('active', type === 'Bulanan');
  const wrap = document.getElementById('reportPeriodInputWrap');
  if (type === 'Harian') {
    const v = ipgTanggalDinas(ipgShiftNow());
    wrap.innerHTML = `<input type="date" class="form-control" id="reportPeriodInput" value="${v}" onchange="onReportPeriodChange()">`;
    reportModalState.periodValue = v;
  } else {
    const v = ipgToday().slice(0,7);
    wrap.innerHTML = `<input type="month" class="form-control" id="reportPeriodInput" value="${v}" onchange="onReportPeriodChange()">`;
    reportModalState.periodValue = v;
  }
  updateReportSummary();
}
function onReportPeriodChange() {
  reportModalState.periodValue = val('reportPeriodInput');
  updateReportSummary();
}
function selectReportFormat(fmt) {
  reportModalState.format = fmt;
  document.getElementById('fmtCardExcel').classList.toggle('active', fmt === 'excel');
  document.getElementById('fmtCardPdf').classList.toggle('active', fmt === 'pdf');
}
function updateReportSummary() {
  const cfg = REPORT_MODULE_CONFIG[reportModalState.moduleKey];
  const wrap = document.getElementById('reportSummaryWrap');
  const btn = document.getElementById('btnUnduhLaporan');
  wrap.className = 'small mb-3 text-muted';
  wrap.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Memuat ringkasan data...';
  document.getElementById('reportResultWrap').innerHTML = '';
  google.script.run.withSuccessHandler(res => {
    if (!res.success) { wrap.className = 'small mb-3 text-danger'; wrap.innerHTML = `<i class="bi bi-exclamation-circle"></i> ${res.message}`; btn.disabled = true; return; }
    const count = res.data.count;
    if (count === 0) {
      wrap.className = 'small mb-3 text-danger';
      wrap.innerHTML = `<i class="bi bi-exclamation-circle"></i> Tidak ada data pada periode ini.`;
      btn.disabled = true;
    } else {
      wrap.className = 'small mb-3';
      wrap.innerHTML = `<i class="bi bi-info-circle" style="color:#0C7A94;"></i> <b>${count}</b> data akan dimasukkan ke laporan periode ini.`;
      btn.disabled = false;
    }
  }).withFailureHandler(e => { wrap.className = 'small mb-3 text-danger'; wrap.innerHTML = `<i class="bi bi-exclamation-circle"></i> ${e.message}`; btn.disabled = true; })[cfg.countFn](reportModalState.periodType, reportModalState.periodValue);
}
function triggerUnduhLaporan() {
  const cfg = REPORT_MODULE_CONFIG[reportModalState.moduleKey];
  const btn = document.getElementById('btnUnduhLaporan');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyiapkan laporan...';
  const fnName = reportModalState.format === 'pdf' ? cfg.pdfFn : cfg.excelFn;
  const mime = reportModalState.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  google.script.run.withSuccessHandler(res => {
    btn.disabled = false; btn.innerHTML = orig;
    if (!res.success) { showToast('Gagal', res.message, 'danger'); return; }
    const byteChars = atob(res.data.base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArray], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = res.data.filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    document.getElementById('reportResultWrap').innerHTML =
      `<div style="background:#E3F9EC;border:1px solid #00C853;border-radius:var(--radius-md);padding:.65rem .85rem;font-size:.82rem;color:#00913E;">
        <i class="bi bi-check-circle-fill"></i> Laporan berhasil dibuat. Kalau unduhan tidak otomatis berjalan,
        <a href="${url}" download="${res.data.filename}" style="color:#00913E;font-weight:700;">klik di sini untuk buka file</a>.
      </div>`;
    showToast('Berhasil', `Laporan (${reportModalState.format.toUpperCase()}) berhasil diunduh.`, 'success');
  }).withFailureHandler(e => {
    btn.disabled = false; btn.innerHTML = orig;
    showToast('Error', e.message, 'danger');
  })[fnName](reportModalState.periodType, reportModalState.periodValue);
}
function openJurnalForm() {
  const defaultShift = OPT_SHIFT[0];
  openFormModal('Catat Jurnal Penjagaan', `
    <form onsubmit="return submitJurnalForm(event)">
      <p class="section-sub mb-2"><i class="bi bi-info-circle"></i> Jam shift resmi Satpam PLN IP UBP Grati: Pagi 06.00–14.00, Sore 14.00–21.00, Malam 21.00–06.00.</p>
      <div class="row g-2">
        <div class="col-6"><label class="form-label">Tanggal</label><input type="date" class="form-control" id="jpTanggal" required value="${ipgToday()}"></div>
        <div class="col-6"><label class="form-label">Shift</label><select class="form-select" id="jpShift" required>${selectOptions(OPT_SHIFT, ipgShiftNow())}</select></div>
        <div class="col-12"><div class="small" id="jpDinasInfo"></div></div>
        <div class="col-6"><label class="form-label">Rolling ke</label><select class="form-select" id="jpRollingKe" required><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
        <div class="col-6"><label class="form-label">Jam Rolling</label><input type="text" class="form-control" value="Otomatis saat disimpan" disabled></div>
        <div class="col-6"><label class="form-label">Regu</label><select class="form-select" id="jpRegu" required>${selectOptions(OPT_REGU)}</select></div>
        <div class="col-6"><label class="form-label">Pos Jaga</label><select class="form-select" id="jpPos" required>${selectOptions(OPT_POS)}</select></div>
        <div class="col-6"><label class="form-label">Nama Petugas Lama</label><input type="text" class="form-control" id="jpPetugasLama" list="personelNamaOptions" required></div>
        <div class="col-6"><label class="form-label">Nama Petugas Baru</label><input type="text" class="form-control" id="jpPetugasBaru" list="personelNamaOptions" required></div>
        <div class="col-12"><label class="form-label">Kondisi</label>
          <select class="form-select" id="jpKondisi"><option>Aman</option><option>Waspada</option><option>Bahaya</option></select></div>
        <div class="col-12"><label class="form-label">Catatan (opsional)</label><textarea class="form-control" id="jpCatatan" rows="2" placeholder="Terutama isi kalau kondisi Waspada/Bahaya"></textarea></div>
      </div>
      <button type="submit" class="btn btn-primary-ip w-100 mt-3"><i class="bi bi-check2"></i> Simpan Jurnal</button>
    </form>`);
}
function submitJurnalForm(evt) {
  evt.preventDefault();
  const payload = { tanggal: val('jpTanggal'), tanggalDinas: ipgGetDinas('jp'), rollingKe: val('jpRollingKe'),
    shift: val('jpShift'), regu: val('jpRegu'), posJaga: val('jpPos'),
    petugasLama: val('jpPetugasLama'), petugasBaru: val('jpPetugasBaru'),
    kondisi: val('jpKondisi'), catatan: val('jpCatatan'), createdBy: AppState.user.Nama };
  closeFormModal();
  callServer('submitJurnalPos', [payload], null, () => { loadJurnalList(); }, 'Menyimpan jurnal...');
  return false;
}

function mutasiJagaActions(row) {
  let btns = `<button class="btn btn-outline-ip btn-sm-ip" onclick="cetakBAMutasiJaga('${row.ID}')"><i class="bi bi-printer"></i></button> `;
  if (row.StatusApproval === 'Menunggu Danru Lama' && ['DANRU','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-primary-ip btn-sm-ip" onclick="callServer('approveMutasiJagaStage',['${row.ID}','DANRU_LAMA','${AppState.user.Nama}'],'Diverifikasi Danru Lama',loadMutasiJaga)">Verifikasi Danru Lama</button>`;
  if (row.StatusApproval === 'Menunggu Danru Baru' && ['DANRU','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-primary-ip btn-sm-ip" onclick="callServer('approveMutasiJagaStage',['${row.ID}','DANRU_BARU','${AppState.user.Nama}'],'Diverifikasi Danru Baru',loadMutasiJaga)">Verifikasi Danru Baru</button>`;
  if (row.StatusApproval === 'Menunggu TL Keamanan' && ['TL_KEAMANAN','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-primary-ip btn-sm-ip" onclick="callServer('approveMutasiJagaStage',['${row.ID}','TL','${AppState.user.Nama}'],'Disetujui TL Keamanan',loadMutasiJaga)">Approve Final</button>`;
  return btns || '-';
}
// Item baku Section B — Kondisi Pos (hasil diskusi lanjutan)
const SECTION_B_ITEMS = [
  { name: 'Kebersihan Ruangan', opts: ['Bersih','Kotor'] },
  { name: 'Kebersihan KM', opts: ['Bersih','Kotor'] },
  { name: 'Perimeter', opts: ['Baik','Rusak'] },
  { name: 'APAR', opts: ['Baik','Rusak','Kadaluarsa'] },
  { name: 'Lampu', opts: ['Baik','Rusak'] },
  { name: 'Papan Informasi', opts: ['Baik','Rusak'] },
  { name: 'Dokumen Pos', opts: ['Baik','Rusak','Kadaluarsa'] }
];
function renderSectionBTable() {
  return `<div class="table-responsive-ip"><table class="table-ip">
    <thead><tr><th>Item</th><th>Kondisi</th><th>Keterangan</th></tr></thead>
    <tbody>${SECTION_B_ITEMS.map((it,i) => `<tr>
      <td>${it.name}</td>
      <td><select class="form-select form-select-sm sb-kondisi" data-item="${it.name}" onchange="this.classList.toggle('rusak-alert', this.value!=='Baik')">
            ${it.opts.map(o=>`<option>${o}</option>`).join('')}
          </select></td>
      <td><input type="text" class="form-control form-control-sm sb-keterangan" placeholder="Keterangan (opsional)"></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function openMutasiJagaForm() {
  openFormModal('Mutasi Jaga Pos — Serah Terima', `
    <form id="formMutasiJaga" onsubmit="return submitMutasiJagaForm(event)">
      <div class="row g-2">
        <div class="col-6"><label class="form-label">Tanggal</label><input type="date" class="form-control" id="mjTanggal" required value="${ipgToday()}"></div>
        <div class="col-6"><label class="form-label">Shift</label><select class="form-select" id="mjShift" required>${selectOptions(OPT_SHIFT, ipgShiftNow(60))}</select></div>
        <div class="col-12"><div class="small" id="mjDinasInfo"></div></div>
        <div class="col-6"><label class="form-label">Regu</label><select class="form-select" id="mjRegu" required>${selectOptions(OPT_REGU)}</select></div>
        <div class="col-6"><label class="form-label">Pos Jaga</label><select class="form-select" id="mjPos" required>${selectOptions(OPT_POS)}</select></div>
        <div class="col-12">
          <span class="section-chip">A</span><b>Informasi Shift & Regu Petugas</b>
          <span class="pill pill-info">Otomatis dari Jurnal Pos yang sudah dicatat</span>
          <div id="jurnalTerkaitWrap" class="mt-2"></div>
        </div>
        <div class="col-12"><hr><span class="section-chip">B</span><b>Kondisi Pos</b>
          <div id="sectionBWrap" class="mt-2">${renderSectionBTable()}</div>
        </div>
        <div class="col-12"><span class="section-chip">C</span><b>Inventaris Tersedia di Pos</b>
          <textarea class="form-control mt-1" id="mjSectionC" rows="3" placeholder="Contoh: Catat sarana yang tersedia di Pos, misal: alat kebersihan, HT, teropong, dll. Kosongkan jika tidak tersedia."></textarea></div>
        <div class="col-12"><span class="section-chip">D</span><b>Temuan & Anomali Keamanan Pos</b> <span class="pill pill-warning">Otomatis jadi Incident jika diisi</span>
          <div class="row g-2 mt-1">
            <div class="col-4"><label class="form-label small">Kategori Temuan</label><select class="form-select" id="mjSectionDKategori">${selectOptions(KATEGORI_INCIDENT)}</select></div>
            <div class="col-8"><label class="form-label small">Uraian</label><textarea class="form-control" id="mjSectionD" rows="2" placeholder="Kosongkan jika nihil/tidak ada gangguan"></textarea></div>
          </div>
        </div>
        <div class="col-12"><span class="section-chip">E</span><b>Catatan Operasional Shift Berikutnya</b>
          <textarea class="form-control mt-1" id="mjSectionE" rows="2" placeholder="Contoh: Situasi aman dan terkendali. Sarpras lengkap dan dalam kondisi baik. Tidak terdapat gangguan maupun insiden. Kebersihan area terjaga dan piket kebersihan telah dilaksanakan."></textarea></div>
      </div>
      <button type="submit" class="btn btn-primary-ip w-100 mt-3"><i class="bi bi-send"></i> Kirim Berita Acara Mutasi Jaga</button>
    </form>`);
  ['mjTanggal','mjShift','mjRegu','mjPos'].forEach(id => document.getElementById(id).addEventListener('change', cariJurnalTerkait));
  cariJurnalTerkait();
}
let lastJurnalRowsForBA = [];
function cariJurnalTerkait() {
  const tanggal = ipgGetDinas('mj'), shift = val('mjShift'), pos = val('mjPos'), regu = val('mjRegu');
  const wrap = document.getElementById('jurnalTerkaitWrap');
  wrap.innerHTML = '<div class="small text-muted">Mencari...</div>';
  google.script.run.withSuccessHandler(res => {
    const rows = (res.data||[]).filter(r => ipgDinasOf(r)===tanggal && r.Shift===shift && r.PosJaga===pos && r.Regu===regu)
      .sort((a,b)=> Number(a.RollingKe||0) - Number(b.RollingKe||0));
    lastJurnalRowsForBA = rows;
    if (rows.length === 0) { wrap.innerHTML = '<div class="small text-muted">Belum ada jurnal tercatat untuk kombinasi Dinas/Shift/Regu/Pos ini.</div>'; return; }
    wrap.innerHTML = `<div class="pill pill-info mb-1">${rows.length} entri jurnal ditemukan — akan tersimpan sebagai Section A</div>
      <div class="table-responsive-ip"><table class="table-ip"><thead><tr><th>Rolling</th><th>Jam</th><th>Petugas</th><th>Kondisi</th><th>Catatan</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td>Rolling ${r.RollingKe}</td><td>${ipgTglPendek(r.Tanggal)} ${r.JamRolling}</td><td>${r.PetugasLama} → ${r.PetugasBaru}</td><td>${kondisiJurnalPill(r.Kondisi)}</td><td>${r.Catatan||'-'}</td></tr>`).join('')}</tbody></table></div>`;
  }).getAllData('JURNAL_POS');
}
function submitMutasiJagaForm(evt) {
  evt.preventDefault();
  const sectionBItems = [];
  document.querySelectorAll('#sectionBWrap tbody tr').forEach(tr => {
    const kondisiEl = tr.querySelector('.sb-kondisi');
    sectionBItems.push({
      item: kondisiEl.dataset.item,
      kondisi: kondisiEl.value,
      keterangan: tr.querySelector('.sb-keterangan').value
    });
  });
  const payload = {
    tanggal: val('mjTanggal'), tanggalDinas: ipgGetDinas('mj'), shift: val('mjShift'), posJaga: val('mjPos'), regu: val('mjRegu'),
    sectionAEntries: lastJurnalRowsForBA,
    sectionBItems, sectionC: { catatan: val('mjSectionC') },
    sectionD: val('mjSectionD'), sectionDKategori: val('mjSectionDKategori'), sectionE: val('mjSectionE'), createdBy: AppState.user.Nama
  };
  closeFormModal();
  callServer('submitMutasiJaga', [payload], null, loadMutasiJaga, 'Menyimpan berita acara...');
  return false;
}
function val(id) { return document.getElementById(id).value; }

// ════════════════════════════════════════════════════════
// MODUL: CHECKLIST SARPRAS (PRD Bab 7.2)
// ════════════════════════════════════════════════════════
function loadChecklistSarpras() {
  const c = document.getElementById('app-container');
  c.innerHTML = sectionHeader('Checklist Sarana & Prasarana', 'Item diambil otomatis dari Master Data — tinggal update kondisi & jumlah. Approval Danru → TL Keamanan.')
    + `<div class="mb-3 d-flex justify-content-end gap-2 flex-wrap">
         <button class="btn btn-outline-ip" onclick="openUnduhLaporanModal('checklist_sarpras')"><i class="bi bi-file-earmark-arrow-down"></i> Unduh Laporan</button>
         <button class="btn btn-primary-ip" onclick="openChecklistForm()"><i class="bi bi-plus-lg"></i> Buat Checklist Baru</button>
       </div>
       <div class="row g-2 mb-3" id="csDashboardWrap"></div>
       <div class="card-ip mb-3">
         <h6 class="mb-2"><i class="bi bi-box-seam"></i> Kondisi Sarpras Terkini <span class="badge-prd">Semua item, status checklist terakhir</span></h6>
         <div id="tblKondisiSarpras"></div>
       </div>
       <div class="card-ip">
         <h6 class="mb-2"><i class="bi bi-clipboard-check"></i> Riwayat Pemeriksaan</h6>
         <div id="tblChecklist"></div>
       </div>`;
  loadKondisiSarprasTerkini();
  google.script.run.withSuccessHandler(res => {
    renderChecklistSarprasModuleDashboard(res.data || []);
    renderGenericTable('tblChecklist',
      [ {label:'Tanggal', render:r=>(r.Tanggal||'').slice(0,10)}, {label:'Shift', key:'Shift'}, {label:'Regu', key:'Regu'}, {label:'Pemeriksa', key:'Pemeriksa'},
        {label:'Jml Item', render:r=>{ try{return JSON.parse(r.ItemsJSON||'[]').length;}catch(e){return 0;} }},
        {label:'Item Rusak', render:r=>{ try{return JSON.parse(r.ItemsJSON||'[]').filter(it=>Number(it.rusak)>0).length;}catch(e){return 0;} }},
        {label:'Status', render:r=>statusPill(r.StatusApproval)} ],
      (res.data||[]).sort((a,b)=> new Date(b.WaktuInput)-new Date(a.WaktuInput)),
      row => checklistSarprasActions(row)
    );
  }).getAllData('CHECKLIST_SARPRAS');
}
function loadKondisiSarprasTerkini() {
  google.script.run.withSuccessHandler(res => {
    if (!res.success) { document.getElementById('tblKondisiSarpras').innerHTML = `<div class="text-danger small">${res.message}</div>`; return; }
    const statusMap = { 'Rusak': 'pill-danger', 'Baik': 'pill-success', 'Belum Pernah Diperiksa': 'pill-neutral' };
    renderGenericTable('tblKondisiSarpras',
      [ {label:'Nama Sarpras', key:'NamaSarana'}, {label:'Lokasi', key:'Lokasi'},
        {label:'Status', render:r=>`<span class="pill ${statusMap[r.Status]}">${r.Status}</span>`},
        {label:'Jml Baik', key:'JumlahBaik'}, {label:'Jml Rusak', key:'JumlahRusak'},
        {label:'Terakhir Diperiksa', key:'TerakhirDiperiksa'},
        {label:'Foto', render:r=> r.FotoUrl ? `<a href="${r.FotoUrl}" target="_blank" class="pill pill-info"><i class="bi bi-camera-fill"></i> Lihat</a>` : '-'},
        {label:'Keterangan', render:r=>r.Keterangan || '-'} ],
      res.data || []
    );
  }).getSarprasKondisiTerkini();
}
function checklistSarprasActions(row) {
  let btns = `<button class="btn btn-outline-ip btn-sm-ip" onclick="cetakChecklistSarpras('${row.ID}')"><i class="bi bi-printer"></i></button> `;
  if (row.StatusApproval === 'Menunggu Danru' && ['DANRU','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-primary-ip btn-sm-ip" onclick="callServer('approveChecklistSarprasStage',['${row.ID}','DANRU','${AppState.user.Nama}'],'Diverifikasi Danru',loadChecklistSarpras)">Verifikasi Danru</button>`;
  if (row.StatusApproval === 'Menunggu TL Keamanan' && ['TL_KEAMANAN','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-primary-ip btn-sm-ip" onclick="callServer('approveChecklistSarprasStage',['${row.ID}','TL','${AppState.user.Nama}'],'Disetujui TL Keamanan',loadChecklistSarpras)">Approve Final</button>`;
  return btns || '-';
}

function openChecklistForm() {
  openFormModal('Checklist Sarana & Prasarana', `
    <form id="formChecklist" onsubmit="return submitChecklistForm(event)">
      <div class="row g-2 mb-2">
        <div class="col-6"><label class="form-label">Tanggal</label><input type="date" class="form-control" id="csTanggal" required value="${ipgToday()}"></div>
        <div class="col-6"><label class="form-label">Shift</label><select class="form-select" id="csShift" required>${selectOptions(OPT_SHIFT, ipgShiftNow())}</select></div>
        <div class="col-12"><div class="small" id="csDinasInfo"></div></div>
        <div class="col-6"><label class="form-label">Regu</label><select class="form-select" id="csRegu" required>${selectOptions(OPT_REGU)}</select></div>
        <div class="col-6"><label class="form-label">Pemeriksa</label><input type="text" class="form-control" id="csPemeriksa" list="personelNamaOptions" required value="${AppState.user.Nama}"></div>
      </div>
      <div id="csItemsWrap"><div class="text-center text-muted py-3"><span class="spinner-border spinner-border-sm"></span> Memuat daftar Sarpras dari Master Data...</div></div>
      <button type="submit" class="btn btn-primary-ip w-100 mt-3"><i class="bi bi-send"></i> Kirim Checklist</button>
    </form>`);
  google.script.run.withSuccessHandler(res => {
    const items = res.data || [];
    const wrap = document.getElementById('csItemsWrap');
    if (items.length === 0) { wrap.innerHTML = '<div class="text-muted small">Belum ada data Sarpras di Master Data. Tambahkan dulu di menu Master Data → Sarpras.</div>'; return; }
    wrap.innerHTML = `<div class="table-responsive-ip"><table class="table-ip">
      <thead><tr><th>Nama Sarpras</th><th>Lokasi</th><th>Jumlah</th><th>Baik</th><th>Rusak</th><th>Foto</th><th>Keterangan</th></tr></thead>
      <tbody>${items.map((it,i) => `<tr data-idx="${i}" data-nama="${it.NamaSarana}" data-lokasi="${it.PosJaga||'-'}">
        <td>${it.NamaSarana}</td>
        <td>${it.PosJaga || '-'}</td>
        <td><input type="number" class="form-control form-control-sm cs-jumlah" value="${it.StandarQty||0}" min="0" style="width:70px;"></td>
        <td><input type="number" class="form-control form-control-sm cs-baik" value="${it.StandarQty||0}" min="0" style="width:70px;"></td>
        <td><input type="number" class="form-control form-control-sm cs-rusak" value="0" min="0" style="width:70px;" oninput="this.classList.toggle('rusak-alert', Number(this.value)>0)"></td>
        <td>
          <input type="file" accept="image/png, image/jpeg, image/gif, image/webp" class="form-control form-control-sm cs-foto-input" style="font-size:.68rem;" onchange="handleFotoSarprasUpload(event, ${i})">
          <div class="small text-muted cs-foto-status" id="csFotoStatus${i}"></div>
        </td>
        <td><input type="text" class="form-control form-control-sm cs-keterangan" placeholder="Opsional"></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }).getAllData('MASTER_SARPRAS');
}
const csFotoUrls = {};
function handleFotoSarprasUpload(evt, idx) {
  const file = evt.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('csFotoStatus' + idx);
  statusEl.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Mengompres & mengunggah...';
  compressImageFile_(file).then(function (compressed) {
    google.script.run.withSuccessHandler(res => {
      if (res.success) {
        csFotoUrls[idx] = res.data.url;
        statusEl.innerHTML = `<a href="${res.data.url}" target="_blank"><i class="bi bi-check-circle text-success"></i> Foto terlampir</a>`;
      } else {
        statusEl.innerHTML = `<span class="text-danger">${res.message}</span>`;
      }
    }).withFailureHandler(e => { statusEl.innerHTML = `<span class="text-danger">${e.message}</span>`; })
      .uploadFotoSarpras(compressed.base64, compressed.fileName, compressed.mimeType);
  }).catch(function (err) {
    statusEl.innerHTML = `<span class="text-danger">${err.message}</span>`;
  });
}
function submitChecklistForm(evt) {
  evt.preventDefault();
  const items = [];
  document.querySelectorAll('#csItemsWrap tbody tr').forEach(tr => {
    const idx = tr.dataset.idx;
    items.push({
      namaSarpras: tr.dataset.nama, lokasi: tr.dataset.lokasi,
      jumlah: tr.querySelector('.cs-jumlah').value, baik: tr.querySelector('.cs-baik').value,
      rusak: tr.querySelector('.cs-rusak').value, fotoUrl: csFotoUrls[idx] || '',
      keterangan: tr.querySelector('.cs-keterangan').value
    });
  });
  const payload = { tanggal: val('csTanggal'), tanggalDinas: ipgGetDinas('cs'), shift: val('csShift'), regu: val('csRegu'), pemeriksa: val('csPemeriksa'), items, createdBy: AppState.user.Nama };
  closeFormModal();
  callServer('submitChecklistSarpras', [payload], null, loadChecklistSarpras, 'Menyimpan checklist...');
  return false;
}
function cetakChecklistSarpras(id) {
  google.script.run.withSuccessHandler(res => {
    if (!res.success) { showToast('Gagal', res.message, 'danger'); return; }
    const r = (res.data||[]).find(x => x.ID === id);
    if (!r) { showToast('Gagal', 'Data tidak ditemukan.', 'danger'); return; }
    let items = []; try { items = JSON.parse(r.ItemsJSON || '[]'); } catch(e) {}
    const rowsHtml = items.map(it => `<tr>
        <td style="border:1px solid #ccc;padding:5px;">${it.namaSarpras}</td>
        <td style="border:1px solid #ccc;padding:5px;">${it.lokasi||'-'}</td>
        <td style="border:1px solid #ccc;padding:5px;text-align:center;">${it.jumlah}</td>
        <td style="border:1px solid #ccc;padding:5px;text-align:center;">${it.baik}</td>
        <td style="border:1px solid #ccc;padding:5px;text-align:center;${Number(it.rusak)>0?'color:#E53935;font-weight:700;':''}">${it.rusak}</td>
        <td style="border:1px solid #ccc;padding:5px;">${it.keterangan||'-'}</td>
        <td style="border:1px solid #ccc;padding:5px;">${it.fotoUrl?`<a href="${it.fotoUrl}" target="_blank">Lihat</a>`:'-'}</td>
      </tr>`).join('');
    const body = buildLetterheadHTML('checklistSarpras',
        `Tanggal: ${ipgTanggalDinasPanjang(r)} &nbsp;|&nbsp; Shift ${r.Shift} &nbsp;|&nbsp; Regu ${r.Regu} &nbsp;|&nbsp; Pemeriksa: ${r.Pemeriksa}`) + `
      <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:11px;">
        <thead><tr>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;">Nama Sarpras</th>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;">Lokasi</th>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;">Jumlah</th>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;">Baik</th>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;">Rusak</th>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;">Keterangan</th>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;">Foto</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>` + buildApprovalTable([
        { label: 'Danru', name: r.DanruBy },
        { label: 'TL Keamanan', name: r.TLBy }
      ], `Checklist Sarpras ${ipgTanggalDinasPanjang(r)} Shift ${r.Shift} Regu ${r.Regu}`);
    openPrintDocument(body);
  }).withFailureHandler(e=>showToast('Error',e.message,'danger')).getAllData('CHECKLIST_SARPRAS');
}

// ════════════════════════════════════════════════════════
// MODUL: PATROLI — 2 lapis: Log Titik (tanpa approval) + Rekap Shift (Danru→TL), PRD 7.2
// ════════════════════════════════════════════════════════
function loadPatroli() {
  const c = document.getElementById('app-container');
  c.innerHTML = sectionHeader('Patroli QR & GPS', 'Log titik tiap checkpoint (referensi) + Rekap per shift (Danru → TL Keamanan)')
    + `<div class="mb-3 d-flex justify-content-end gap-2 flex-wrap">
         <button class="btn btn-outline-ip" onclick="openLogPatroliForm()"><i class="bi bi-geo-alt"></i> Scan Titik Patroli</button>
         <button class="btn btn-outline-ip" onclick="openUnduhLaporanModal('patroli')"><i class="bi bi-file-earmark-arrow-down"></i> Unduh Laporan</button>
         <button class="btn btn-primary-ip" onclick="openRekapPatroliForm()"><i class="bi bi-plus-lg"></i> Buat Rekap Patroli Shift Ini</button>
       </div>
       <div id="patroliDashboardWrap"><div class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm"></span> Memuat dashboard patroli...</div></div>
       <div class="card-ip mb-3">
         <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
           <h6 class="mb-0"><i class="bi bi-geo-alt-fill"></i> Log Titik Patroli <span class="badge-prd">Referensi, tanpa approval</span></h6>
           <label class="small text-muted mb-0" for="logPatroliTanggalInput">Tanggal dinas</label><input type="date" class="form-control form-control-sm" id="logPatroliTanggalInput" style="width:auto;" title="Hari operasional: Malam (malam sebelumnya) + Pagi + Sore. Contoh: Malam 24/25 → pilih 25" value="${logPatroliTanggal}" onchange="onLogPatroliTanggalChange()">
         </div>
         <div id="tblLogPatroli"></div>
       </div>
       <div class="card-ip">
         <h6 class="mb-2"><i class="bi bi-file-earmark-text"></i> Rekap Patroli per Shift <span class="badge-prd">Danru → TL Keamanan</span></h6>
         <div id="tblRekapPatroli"></div>
       </div>`;
  loadPatroliDashboardDetail();
  loadLogPatroliList();
  google.script.run.withSuccessHandler(res => {
    renderGenericTable('tblRekapPatroli',
      [ {label:'Nomor Rekap', key:'NoRekap'}, {label:'Tanggal', render:r=>(r.Tanggal||'').slice(0,10)}, {label:'Shift', key:'Shift'}, {label:'Regu', key:'Regu'},
        {label:'Jml Titik Discan', render:r=>{ try{return JSON.parse(r.TitikEntries||'[]').length;}catch(e){return 0;} }},
        {label:'Status', render:r=>statusPill(r.StatusApproval)} ],
      (res.data||[]).sort((a,b)=> new Date(b.WaktuInput)-new Date(a.WaktuInput)),
      row => rekapPatroliActions(row)
    );
  }).getAllData('REKAP_PATROLI');
}
const SHIFT_ICON_PATROLI = { 'Pagi': 'bi-sun-fill', 'Sore': 'bi-cloud-sun-fill', 'Malam': 'bi-moon-stars-fill' };
const SHIFT_JAM_PATROLI = { 'Pagi': '06.00 - 14.00', 'Sore': '14.00 - 21.00', 'Malam': '21.00 - 06.00' };
const PUTARAN_STATUS_META = {
  active:  { badge: 'Sedang Berlangsung (Aktif)', pill: 'pill-info' },
  completed: { badge: null, pill: 'pill-success' }, // teks ditentukan dinamis (tepat waktu/terlewat)
  upcoming: { badge: 'Menunggu Jadwal', pill: 'pill-neutral' }
};
const CHECKPOINT_STATE_COLOR = { done: '#00C853', active: '#0C7A94', pending: '#C7CFDB', missed: '#E53935' };
const CHECKPOINT_STATE_BG    = { done: '#E3F9EC', active: '#E8F1FC', pending: '#F4F6F9', missed: '#FDE8E8' };

function loadPatroliDashboardDetail() {
  google.script.run.withSuccessHandler(res => {
    const wrap = document.getElementById('patroliDashboardWrap');
    if (!res.success) { wrap.innerHTML = `<div class="text-danger small">${res.message}</div>`; return; }
    const d = res.data;
    const selisihColor = d.selisihVsKemarin >= 0 ? '#00913E' : '#E53935';
    const selisihIcon = d.selisihVsKemarin >= 0 ? 'bi-arrow-up-short' : 'bi-arrow-down-short';

    const kpiHtml = `
      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3"><div class="stat-card">
          <div class="stat-icon" style="background:#0C7A94;"><i class="bi bi-graph-up-arrow"></i></div>
          <div><div class="stat-value">${d.rerataHariIni}%</div><div class="stat-label">Rerata Kepatuhan Shift</div>
            <div style="font-size:.7rem;color:${selisihColor};font-weight:700;"><i class="bi ${selisihIcon}"></i> ${Math.abs(d.selisihVsKemarin)}% vs Kemarin</div>
          </div>
        </div></div>
        <div class="col-6 col-lg-3"><div class="stat-card">
          <div class="stat-icon" style="background:#00AEEF;"><i class="bi bi-geo-alt-fill"></i></div>
          <div><div class="stat-value">${d.titikTerverifikasiTotal}<span style="font-size:.9rem;color:var(--text-muted);"> / ${d.totalTitik}</span></div><div class="stat-label">Titik Terverifikasi</div>
            <div style="font-size:.7rem;color:var(--text-muted);">${d.totalTitik ? Math.round(d.titikTerverifikasiTotal / d.totalTitik * 100) : 0}% titik tercakup hari ini</div>
          </div>
        </div></div>
        <div class="col-6 col-lg-3"><div class="stat-card">
          <div class="stat-icon" style="background:#FFC107;"><i class="bi bi-arrow-repeat"></i></div>
          <div><div class="stat-value">Putaran ${d.putaranAktifNomor}</div><div class="stat-label">Jadwal Putaran Aktif</div>
            <div style="font-size:.7rem;color:var(--text-muted);">${d.selesaiCount} Selesai · ${d.berjalanCount} Berjalan · ${d.menungguCount} Menunggu</div>
          </div>
        </div></div>
        <div class="col-6 col-lg-3"><div class="stat-card">
          <div class="stat-icon" style="background:#023B4A;"><i class="bi ${SHIFT_ICON_PATROLI[d.shift] || 'bi-clock-fill'}"></i></div>
          <div><div class="stat-value">${d.shift}</div><div class="stat-label">Shift Aktif</div>
            <div style="font-size:.7rem;color:var(--text-muted);">${SHIFT_JAM_PATROLI[d.shift] || ''}</div>
          </div>
        </div></div>
      </div>
      <div class="card-ip mb-3" style="padding:.85rem 1.1rem;">
        <div class="d-flex flex-wrap gap-3 align-items-center" style="font-size:.75rem;">
          <b style="font-size:.8rem;">Status Titik (1–${d.totalTitik}):</b>
          <span><i class="bi bi-square-fill" style="color:${CHECKPOINT_STATE_COLOR.done};"></i> Sudah Scan (Valid)</span>
          <span><i class="bi bi-square-fill" style="color:${CHECKPOINT_STATE_COLOR.active};"></i> Sedang Berlangsung</span>
          <span><i class="bi bi-square-fill" style="color:${CHECKPOINT_STATE_COLOR.pending};"></i> Belum Discan</span>
          <span><i class="bi bi-square-fill" style="color:${CHECKPOINT_STATE_COLOR.missed};"></i> Lewat Waktu / Anomali</span>
        </div>
      </div>
      <div id="putaranCardsWrap"></div>`;
    wrap.innerHTML = kpiHtml;
    document.getElementById('putaranCardsWrap').innerHTML = d.putaranData.map(p => renderPutaranCard(p)).join('');
  }).withFailureHandler(e => { document.getElementById('patroliDashboardWrap').innerHTML = `<div class="text-danger small">${e.message}</div>`; }).getPatroliDashboardDetail();
}

function renderPutaranCard(p) {
  const isActive = p.status === 'active';
  const borderColor = isActive ? 'var(--primary)' : 'var(--border-subtle)';
  let badgeText, badgePill;
  if (p.status === 'active') { badgeText = 'Sedang Berlangsung (Aktif)'; badgePill = 'pill-info'; }
  else if (p.status === 'upcoming') { badgeText = 'Menunggu Jadwal'; badgePill = 'pill-neutral'; }
  else { badgeText = p.persen === 100 ? 'Selesai Tepat Waktu' : 'Terlewat / Tidak Lengkap'; badgePill = p.persen === 100 ? 'pill-success' : 'pill-danger'; }

  let subInfo = '';
  if (p.status === 'completed') {
    subInfo = p.petugas !== '-' ? `<i class="bi bi-person-badge"></i> Petugas: ${p.petugas}` : '';
    if (p.durasiInfo) subInfo += `${subInfo ? ' &nbsp;·&nbsp; ' : ''}Durasi Tempuh: ${p.durasiInfo}`;
  } else if (p.status === 'active') {
    subInfo = p.petugas !== '-' ? `<i class="bi bi-person-badge"></i> Petugas: ${p.petugas}` : 'Belum ada petugas mulai scan';
    if (p.titikTerakhir) subInfo += ` &nbsp;·&nbsp; Titik terakhir discan: <b>${p.titikTerakhir.nama}</b>, jam ${p.titikTerakhir.jam}`;
  } else {
    subInfo = p.menitMulai !== null && p.menitMulai >= 0 ? `Mulai dalam: <b>${p.menitMulai} menit lagi</b>` : 'Menunggu jadwal';
  }

  const barColor = p.status === 'upcoming' ? '#C7CFDB' : (p.persen === 100 ? '#00C853' : (p.status === 'active' ? '#0C7A94' : '#E53935'));
  const grid = p.checkpoints.map(cp => `
    <div title="${cp.nama}" style="width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;
      background:${CHECKPOINT_STATE_BG[cp.state]};color:${CHECKPOINT_STATE_COLOR[cp.state]};font-family:'Poppins',sans-serif;font-weight:700;font-size:.85rem;">
      ${cp.state==='done' ? '<i class="bi bi-check-lg"></i>' : cp.nomor}
    </div>`).join('');

  return `
    <div class="card-ip mb-3" style="border:${isActive ? '2px' : '1px'} solid ${borderColor};">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
        <div>
          <div style="font-weight:700;color:var(--primary);font-size:.85rem;">PUTARAN ${p.putaran} &nbsp; <span style="color:var(--text-dark);">${p.label.replace('-',' - ')} WIB</span></div>
          <span class="pill ${badgePill}" style="margin-top:.3rem;display:inline-block;">${badgeText}</span>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.4rem;">${subInfo}</div>
        </div>
        <div class="text-end">
          <div class="stat-value" style="font-size:1.4rem;">${p.persen}%</div>
          <div style="font-size:.68rem;color:var(--text-muted);">${p.scannedCount}/${p.totalTitik} titik discan</div>
        </div>
      </div>
      <div style="height:8px;background:#EEF2F8;border-radius:4px;overflow:hidden;margin-bottom:1rem;">
        <div style="height:100%;width:${p.persen}%;background:${barColor};"></div>
      </div>
      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;margin-bottom:.5rem;">STATUS CHECKPOINT TITIK 1 S.D ${p.totalTitik}:</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${grid}</div>
    </div>`;
}

let logPatroliTanggal = ipgTanggalDinas(ipgShiftNow());
let logPatroliAllData = [];
function loadLogPatroliList() {
  google.script.run.withSuccessHandler(res => {
    logPatroliAllData = res.data || [];
    renderLogPatroliTable();
  }).getAllData('LOG_PATROLI');
}
function renderLogPatroliTable() {
  const rows = logPatroliAllData.filter(r => ipgDinasOf(r) === logPatroliTanggal)
    .sort((a,b)=> new Date(b.WaktuInput)-new Date(a.WaktuInput));
  renderGenericTable('tblLogPatroli',
    [ {label:'Tanggal', render:r=>ipgTglPendek(r.Tanggal)}, {label:'Jam Scan', key:'JamScan'}, {label:'Putaran', render:r=>`#${r.Putaran}`}, {label:'Dinas', render:r=>ipgLabelDinas(ipgDinasOf(r), r.Shift)}, {label:'Regu', key:'Regu'},
      {label:'Titik Patroli', key:'TitikPatroli'}, {label:'Metode', render:r=>patroliMetodePill(r.Metode)},
      {label:'Jarak', render:r=> r.JarakMeter!=='' && r.JarakMeter!==undefined ? `${r.JarakMeter} m` : '-'},
      {label:'Status', render:r=> patroliStatusPill(r.StatusVerifikasi)} ],
    rows
  );
}
/** Status log patroli: On Site / On Site (QR) = hijau, Perlu Cek = kuning, Off Site = merah */
function patroliStatusPill(status) {
  const cls = { 'On Site': 'pill-success', 'On Site (QR)': 'pill-success', 'Perlu Cek': 'pill-warning' }[status] || 'pill-danger';
  return `<span class="pill ${cls}">${status || 'Off Site'}</span>`;
}
/** Log lama (sebelum ada mode QR) tidak punya kolom Metode — semuanya GPS */
function patroliMetodePill(metode) {
  return metode === 'QR' ? '<span class="pill pill-info"><i class="bi bi-qr-code"></i> QR</span>'
                         : '<span class="pill pill-neutral"><i class="bi bi-geo-alt"></i> GPS</span>';
}
function onLogPatroliTanggalChange() {
  logPatroliTanggal = val('logPatroliTanggalInput');
  renderLogPatroliTable();
}
function rekapPatroliActions(row) {
  let btns = `<button class="btn btn-outline-ip btn-sm-ip" onclick="cetakRekapPatroli('${row.ID}')"><i class="bi bi-printer"></i></button> `;
  if (row.StatusApproval === 'Menunggu Danru' && ['DANRU','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-primary-ip btn-sm-ip" onclick="callServer('approveRekapPatroli',['${row.ID}','DANRU','${AppState.user.Nama}'],'Rekap diverifikasi Danru',loadPatroli)">Verifikasi Danru</button>`;
  if (row.StatusApproval === 'Menunggu TL Keamanan' && ['TL_KEAMANAN','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-primary-ip btn-sm-ip" onclick="callServer('approveRekapPatroli',['${row.ID}','TL_KEAMANAN','${AppState.user.Nama}'],'Rekap disetujui TL Keamanan',loadPatroli)">Approve Final</button>`;
  return btns || '-';
}

// ── Log Titik Patroli — 2 mode: Scan QR (kamera) atau GPS, dipilih bebas petugas tiap scan ──
// Titik pada mode QR ditentukan SERVER dari isi QR; GPS di mode QR hanya bukti tambahan (tidak wajib).
const QR_TITIK_PREFIX = 'IPGUARD:TP:';
const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
let patroliMode = 'QR';
let patroliTitikList = [];
let lastGPS = null;
let lastQrText = null;

function openLogPatroliForm() {
  try { patroliMode = localStorage.getItem('ipg_patroli_mode') === 'GPS' ? 'GPS' : 'QR'; } catch (e) { patroliMode = 'QR'; }
  openFormModal('Scan Titik Patroli', `
    <p class="section-sub mb-2"><i class="bi bi-info-circle"></i> Jam tercatat otomatis saat tombol "Verifikasi & Simpan" diklik.</p>
    <form onsubmit="return submitLogPatroliForm(event)">
      <div class="row g-2">
        <div class="col-6"><label class="form-label">Tanggal</label><input type="date" class="form-control" id="ptTanggal" required value="${ipgToday()}"></div>
        <div class="col-6"><label class="form-label">Shift</label><select class="form-select" id="ptShift" required>${selectOptions(OPT_SHIFT, ipgShiftNow())}</select></div>
        <div class="col-12"><div class="small" id="ptDinasInfo"></div></div>
        <div class="col-6"><label class="form-label">Regu</label><select class="form-select" id="ptRegu" required>${selectOptions(OPT_REGU)}</select></div>
        <div class="col-6"><label class="form-label">Putaran</label><select class="form-select" id="ptPutaran" required>
          <option value="1">Putaran 1</option><option value="2">Putaran 2</option><option value="3">Putaran 3</option><option value="4">Putaran 4</option>
        </select></div>
        <div class="col-12"><label class="form-label">Metode verifikasi</label>
          <div class="segmented-toggle d-flex w-100" role="group">
            <button type="button" class="seg-btn flex-fill" id="ptModeQR" onclick="setPatroliMode('QR')"><i class="bi bi-qr-code-scan"></i> Scan QR</button>
            <button type="button" class="seg-btn flex-fill" id="ptModeGPS" onclick="setPatroliMode('GPS')"><i class="bi bi-geo-alt"></i> GPS</button>
          </div>
        </div>

        <div class="col-12" id="ptPanelQR">
          <button type="button" class="btn btn-outline-ip w-100" id="qrOpenBtn" onclick="startQrScan()"><i class="bi bi-camera"></i> Buka Kamera &amp; Scan QR</button>
          <div id="qrScanArea" style="display:none;" class="mt-2">
            <div style="position:relative;border-radius:var(--radius-md);overflow:hidden;background:#000;">
              <video id="qrVideo" playsinline muted style="width:100%;aspect-ratio:1/1;object-fit:cover;display:block;"></video>
              <div style="position:absolute;inset:18%;border:3px solid var(--pln-yellow);border-radius:14px;pointer-events:none;"></div>
            </div>
            <div class="small text-muted mt-1" id="qrScanStatus">Menyalakan kamera...</div>
            <button type="button" class="btn btn-outline-ip btn-sm-ip w-100 mt-1" onclick="stopQrScan()">Tutup Kamera</button>
          </div>
          <div id="qrResult" class="mt-2"></div>
          <div id="gpsResultQR" class="small text-muted mt-1"></div>
        </div>

        <div class="col-12" id="ptPanelGPS" style="display:none;">
          <label class="form-label">Titik Patroli</label>
          <select class="form-select mb-2" id="ptTitik"><option>Memuat...</option></select>
          <button type="button" class="btn btn-outline-ip w-100" onclick="ambilGPS('gpsResult')"><i class="bi bi-geo-alt"></i> Ambil Lokasi GPS Saat Ini</button>
          <div id="gpsResult" class="small text-muted mt-1"></div>
          <div class="small text-muted mt-1">Toleransi GPS ±10 meter untuk status On Site.</div>
        </div>
      </div>
      <button type="submit" class="btn btn-primary-ip w-100 mt-3"><i class="bi bi-check2-circle"></i> Verifikasi &amp; Simpan Titik</button>
    </form>`);
  lastGPS = null; lastQrText = null;
  document.getElementById('ptPutaran').value = String(ipgPutaranNow()); // otomatis sesuai jadwal, tetap bisa diubah
  ipgUpdateDinas('pt');
  google.script.run.withSuccessHandler(res => {
    patroliTitikList = res.data || [];
    const sel = document.getElementById('ptTitik');
    if (!sel) return;
    sel.innerHTML = patroliTitikList.length
      ? patroliTitikList.map(t => `<option value="${t.NamaTitik}">${t.NamaTitik}</option>`).join('')
      : `<option value="">Belum ada Titik Patroli terdaftar</option>`;
  }).getAllData('MASTER_TITIK_PATROLI');
  setPatroliMode(patroliMode);
}

function setPatroliMode(mode) {
  patroliMode = mode === 'GPS' ? 'GPS' : 'QR';
  try { localStorage.setItem('ipg_patroli_mode', patroliMode); } catch (e) {}
  document.getElementById('ptModeQR').classList.toggle('active', patroliMode === 'QR');
  document.getElementById('ptModeGPS').classList.toggle('active', patroliMode === 'GPS');
  document.getElementById('ptPanelQR').style.display = patroliMode === 'QR' ? '' : 'none';
  document.getElementById('ptPanelGPS').style.display = patroliMode === 'GPS' ? '' : 'none';
  if (patroliMode === 'QR') {
    if (!lastGPS) ambilGPS('gpsResultQR', true); // bukti tambahan, diam-diam, tidak menghambat
  } else {
    stopQrScan();
  }
}

function ambilGPS(elId, silent) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!navigator.geolocation) { el.textContent = silent ? '' : 'GPS tidak didukung perangkat ini.'; return; }
  el.textContent = silent ? 'Mengambil lokasi sebagai bukti tambahan...' : 'Mengambil lokasi...';
  navigator.geolocation.getCurrentPosition(pos => {
    lastGPS = { lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: pos.coords.accuracy };
    const txt = `Lat ${lastGPS.lat.toFixed(5)}, Lng ${lastGPS.lng.toFixed(5)} (akurasi ±${Math.round(lastGPS.akurasi)}m)`;
    const target = document.getElementById(elId);
    if (target) target.innerHTML = `<i class="bi bi-check-circle text-success"></i> ${silent ? 'Lokasi tercatat: ' : ''}${txt}`;
  }, err => {
    const target = document.getElementById(elId);
    if (!target) return;
    target.textContent = silent ? 'Lokasi tidak tersedia — scan QR tetap bisa disimpan.' : 'Gagal ambil GPS: ' + err.message;
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}

// ── Pemindai QR: BarcodeDetector bawaan Chrome Android, cadangan jsQR untuk browser lain ──
const _loadedScripts = {};
function loadScriptOnce(url) {
  if (!_loadedScripts[url]) {
    _loadedScripts[url] = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = url; sc.onload = resolve;
      sc.onerror = () => { delete _loadedScripts[url]; reject(new Error('Gagal memuat ' + url)); };
      document.head.appendChild(sc);
    });
  }
  return _loadedScripts[url];
}

const QrScanner = {
  stream: null, timer: null, detector: null, canvas: null, busy: false,
  async start(video, onText, onStatus) {
    this.stop();
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Kamera hanya bisa dipakai dari alamat https (versi GitHub Pages / Vercel / APK).');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = this.stream;
    await video.play();
    if ('BarcodeDetector' in window) {
      try {
        const formats = await BarcodeDetector.getSupportedFormats();
        if (formats.includes('qr_code')) this.detector = new BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) { this.detector = null; }
    }
    if (!this.detector) {
      onStatus('Menyiapkan pemindai...');
      await loadScriptOnce(JSQR_URL);
      if (typeof jsQR !== 'function') throw new Error('Pemindai QR gagal dimuat. Periksa koneksi internet.');
      this.canvas = document.createElement('canvas');
    }
    onStatus('Arahkan kamera ke stiker QR titik patroli, tahan sampai terbaca.');
    const tick = async () => {
      if (!this.stream) return;
      if (!this.busy && video.readyState >= 2) {
        this.busy = true;
        try {
          let text = null;
          if (this.detector) {
            const codes = await this.detector.detect(video);
            if (codes.length) text = codes[0].rawValue;
          } else {
            const w = video.videoWidth, h = video.videoHeight;
            if (w && h) {
              const sc = Math.min(1, 640 / Math.max(w, h));
              const cw = Math.round(w * sc), ch = Math.round(h * sc);
              this.canvas.width = cw; this.canvas.height = ch;
              const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(video, 0, 0, cw, ch);
              const found = jsQR(ctx.getImageData(0, 0, cw, ch).data, cw, ch, { inversionAttempts: 'dontInvert' });
              if (found) text = found.data;
            }
          }
          if (text) { this.stop(); onText(text); return; }
        } catch (e) { /* frame gagal dibaca — lanjut frame berikutnya */ }
        finally { this.busy = false; }
      }
      this.timer = setTimeout(tick, 180);
    };
    tick();
  },
  stop() {
    clearTimeout(this.timer); this.timer = null;
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    this.detector = null; this.busy = false;
  }
};
// Kamera selalu dimatikan saat form ditutup (tombol X, klik luar, atau setelah simpan)
document.getElementById('formModal')?.addEventListener('hidden.bs.modal', () => QrScanner.stop());

function qrCameraErrorMessage(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError')
    return 'Izin kamera ditolak. Ketuk ikon gembok/pengaturan di sebelah alamat → Izin → Kamera → Izinkan, lalu coba lagi.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Kamera tidak ditemukan di perangkat ini. Gunakan mode GPS.';
  if (n === 'NotReadableError') return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera, lalu coba lagi.';
  return (e && e.message) || 'Kamera tidak dapat dibuka.';
}

async function startQrScan() {
  const area = document.getElementById('qrScanArea');
  const status = document.getElementById('qrScanStatus');
  document.getElementById('qrResult').innerHTML = '';
  document.getElementById('qrOpenBtn').style.display = 'none';
  area.style.display = '';
  lastQrText = null;
  try {
    await QrScanner.start(document.getElementById('qrVideo'), onQrScanned, msg => { status.textContent = msg; });
  } catch (e) {
    QrScanner.stop();
    area.style.display = 'none';
    document.getElementById('qrOpenBtn').style.display = '';
    document.getElementById('qrResult').innerHTML = `<div class="alert alert-danger small mb-0">${qrCameraErrorMessage(e)}</div>`;
  }
}

function stopQrScan() {
  QrScanner.stop();
  const area = document.getElementById('qrScanArea');
  const btn = document.getElementById('qrOpenBtn');
  if (area) area.style.display = 'none';
  if (btn) btn.style.display = '';
}

function onQrScanned(text) {
  stopQrScan();
  if (navigator.vibrate) navigator.vibrate(120);
  let kode = String(text || '').trim();
  if (kode.toUpperCase().indexOf(QR_TITIK_PREFIX) === 0) kode = kode.slice(QR_TITIK_PREFIX.length);
  kode = kode.trim().toUpperCase();
  const titik = patroliTitikList.find(t => String(t.KodeQR || '').trim().toUpperCase() === kode);
  const btn = document.getElementById('qrOpenBtn');
  if (!titik) {
    lastQrText = null;
    document.getElementById('qrResult').innerHTML =
      `<div class="alert alert-danger small mb-0"><b>QR tidak dikenali.</b> Pastikan yang di-scan adalah stiker QR resmi titik patroli IP GUARD.</div>`;
    if (btn) btn.innerHTML = '<i class="bi bi-camera"></i> Scan Ulang';
    return;
  }
  lastQrText = String(text).trim();
  document.getElementById('qrResult').innerHTML =
    `<div class="alert alert-success small mb-0"><i class="bi bi-check-circle-fill"></i> Titik terdeteksi: <b>${titik.NamaTitik}</b>${titik.PosJaga ? ' — ' + titik.PosJaga : ''}</div>`;
  if (btn) btn.innerHTML = '<i class="bi bi-camera"></i> Scan Ulang';
}

function submitLogPatroliForm(evt) {
  evt.preventDefault();
  const base = {
    tanggal: val('ptTanggal'), tanggalDinas: ipgGetDinas('pt'), shift: val('ptShift'), regu: val('ptRegu'), putaran: val('ptPutaran'),
    createdBy: AppState.user.Nama
  };
  let payload;
  if (patroliMode === 'QR') {
    if (!lastQrText) { showToast('Peringatan', 'Scan stiker QR titik patroli terlebih dahulu.', 'danger'); return false; }
    payload = Object.assign(base, {
      metode: 'QR', qrText: lastQrText,
      lat: lastGPS ? lastGPS.lat : '', lng: lastGPS ? lastGPS.lng : '', akurasi: lastGPS ? lastGPS.akurasi : ''
    });
  } else {
    const titikPatroli = val('ptTitik');
    if (!titikPatroli) { showToast('Peringatan', 'Pilih Titik Patroli terlebih dahulu (daftarkan dulu di Master Data bila kosong).', 'danger'); return false; }
    if (!lastGPS) { showToast('Peringatan', 'Ambil lokasi GPS terlebih dahulu.', 'danger'); return false; }
    payload = Object.assign(base, { metode: 'GPS', titikPatroli, lat: lastGPS.lat, lng: lastGPS.lng, akurasi: lastGPS.akurasi });
  }
  closeFormModal();
  callServer('submitLogPatroli', [payload], null, loadLogPatroliList,
    patroliMode === 'QR' ? 'Memverifikasi QR titik...' : 'Memverifikasi titik & menghitung jarak GPS...');
  return false;
}

// ── Rekap Patroli per Shift ──
function openRekapPatroliForm() {
  openFormModal('Buat Rekap Patroli Shift Ini', `
    <form id="formRekapPatroli" onsubmit="return submitRekapPatroliForm(event)">
      <div class="row g-2">
        <div class="col-4"><label class="form-label">Tanggal</label><input type="date" class="form-control" id="rpTanggal" required value="${ipgToday()}"></div>
        <div class="col-4"><label class="form-label">Shift</label><select class="form-select" id="rpShift" required>${selectOptions(OPT_SHIFT, ipgShiftNow(60))}</select></div>
        <div class="col-4"><label class="form-label">Regu</label><select class="form-select" id="rpRegu" required>${selectOptions(OPT_REGU)}</select></div>
        <div class="col-12"><div class="small" id="rpDinasInfo"></div></div>
        <div class="col-12">
          <span class="pill pill-info">Matrix 4 Putaran × Titik Patroli — otomatis dikompilasi dari Log Titik</span>
          <div id="patroliLogTerkaitWrap" class="mt-2"></div>
        </div>
        <div class="col-12"><label class="form-label">Catatan Temuan (opsional)</label>
          <textarea class="form-control" id="rpCatatanTemuan" rows="2" placeholder="Kosongkan jika nihil. Temuan patroli tidak otomatis jadi Incident — laporkan manual di modul Incident bila perlu."></textarea></div>
      </div>
      <button type="submit" class="btn btn-primary-ip w-100 mt-3"><i class="bi bi-send"></i> Kirim Rekap Patroli</button>
    </form>`);
  ['rpTanggal','rpShift','rpRegu'].forEach(id => document.getElementById(id).addEventListener('change', cariLogPatroliTerkait));
  cariLogPatroliTerkait();
}
let lastPatroliLogsForRekap = [];

/** Bangun matrix HTML: baris = Titik Patroli terdaftar, kolom = Putaran 1-4 */
function buildPatroliMatrixHtml(shift, titikMaster, logs) {
  const checkpoints = PATROLI_PUTARAN_LABELS[shift];
  if (titikMaster.length === 0) return '<div class="small text-muted">Belum ada Titik Patroli terdaftar di Master Data.</div>';
  const rows = titikMaster.map(t => {
    const cells = checkpoints.map((cp, i) => {
      const entry = logs.find(l => l.TitikPatroli === t.NamaTitik && Number(l.Putaran) === i + 1);
      if (!entry) return `<td style="text-align:center;color:#E53935;">-</td>`;
      return `<td style="text-align:center;">${patroliStatusPill(entry.StatusVerifikasi)}<div style="font-size:.68rem;color:var(--text-muted);">${entry.JamScan} (${entry.Metode === 'QR' ? 'QR' : 'GPS'})</div></td>`;
    });
    return `<tr><td>${t.NamaTitik}</td>${cells.join('')}</tr>`;
  }).join('');
  return `<div class="table-responsive-ip"><table class="table-ip">
    <thead><tr><th>Titik Patroli</th>${checkpoints.map((cp,i)=>`<th>Putaran ${i+1}<br><small>${cp}</small></th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function cariLogPatroliTerkait() {
  const tanggal = ipgGetDinas('rp'), shift = val('rpShift'), regu = val('rpRegu');
  const wrap = document.getElementById('patroliLogTerkaitWrap');
  wrap.innerHTML = '<div class="small text-muted">Mencari...</div>';
  Promise.all([
    new Promise(resolve => google.script.run.withSuccessHandler(resolve).getAllData('LOG_PATROLI')),
    new Promise(resolve => google.script.run.withSuccessHandler(resolve).getAllData('MASTER_TITIK_PATROLI'))
  ]).then(([logRes, titikRes]) => {
    const logs = (logRes.data||[]).filter(r => ipgDinasOf(r)===tanggal && r.Shift===shift && r.Regu===regu);
    const titikMaster = titikRes.data || [];
    lastPatroliLogsForRekap = logs;
    wrap.innerHTML = `<div class="pill pill-info mb-1">${logs.length} titik discan dari ${titikMaster.length} titik terdaftar</div>` + buildPatroliMatrixHtml(shift, titikMaster, logs);
  });
}
function submitRekapPatroliForm(evt) {
  evt.preventDefault();
  const payload = {
    tanggal: val('rpTanggal'), tanggalDinas: ipgGetDinas('rp'), shift: val('rpShift'), regu: val('rpRegu'),
    titikEntries: lastPatroliLogsForRekap, catatanTemuan: val('rpCatatanTemuan'), createdBy: AppState.user.Nama
  };
  closeFormModal();
  callServer('submitRekapPatroli', [payload], null, loadPatroli, 'Menyimpan rekap patroli...');
  return false;
}
/** Versi cetak matrix Patroli — style ditulis inline karena jendela cetak tidak memuat CSS aplikasi */
function buildPatroliMatrixPrintHtml(shift, titikMaster, logs) {
  const checkpoints = PATROLI_PUTARAN_LABELS[shift];
  if (titikMaster.length === 0) return '<p style="color:#999;">Belum ada Titik Patroli terdaftar di Master Data.</p>';
  const thStyle = 'border:1px solid #ccc;padding:6px;background:#eef2f8;font-size:10.5px;text-align:center;';
  const tdStyle = 'border:1px solid #ccc;padding:6px;font-size:10.5px;';
  const rows = titikMaster.map(t => {
    const cells = checkpoints.map((cp, i) => {
      const entry = logs.find(l => l.TitikPatroli === t.NamaTitik && Number(l.Putaran) === i + 1);
      if (!entry) return `<td style="${tdStyle}text-align:center;color:#E53935;font-weight:700;">-</td>`;
      const st = entry.StatusVerifikasi;
      const [bg, fg] = (st === 'On Site' || st === 'On Site (QR)') ? ['#E3F9EC', '#00913E'] : st === 'Perlu Cek' ? ['#FFF6E0', '#A9760A'] : ['#FDE8E8', '#E53935'];
      const badgeStyle = `display:inline-block;padding:2px 9px;border-radius:10px;font-size:9.5px;font-weight:700;background:${bg};color:${fg};`;
      return `<td style="${tdStyle}text-align:center;">
        <span style="${badgeStyle}">${st}</span>
        <div style="font-size:9px;color:#888;margin-top:2px;">${entry.JamScan} (${entry.Metode === 'QR' ? 'QR' : 'GPS'})</div>
      </td>`;
    });
    return `<tr><td style="${tdStyle}">${t.NamaTitik}</td>${cells.join('')}</tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse;margin-top:6px;">
    <thead><tr>
      <th style="${thStyle}text-align:left;">Titik Patroli</th>
      ${checkpoints.map((cp, i) => `<th style="${thStyle}">Putaran ${i + 1}<br><span style="font-weight:400;">${cp}</span></th>`).join('')}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function cetakRekapPatroli(id) {
  Promise.all([
    new Promise(resolve => google.script.run.withSuccessHandler(resolve).getAllData('REKAP_PATROLI')),
    new Promise(resolve => google.script.run.withSuccessHandler(resolve).getAllData('MASTER_TITIK_PATROLI'))
  ]).then(([rekapRes, titikRes]) => {
    if (!rekapRes.success) { showToast('Gagal', rekapRes.message, 'danger'); return; }
    const r = (rekapRes.data||[]).find(x => x.ID === id);
    if (!r) { showToast('Gagal', 'Data tidak ditemukan.', 'danger'); return; }
    let logs = []; try { logs = JSON.parse(r.TitikEntries || '[]'); } catch(e) {}
    const titikMaster = titikRes.data || [];
    const body = buildLetterheadHTML('rekapPatroli',
        `No. Rekap: ${r.NoRekap} &nbsp;|&nbsp; Shift ${r.Shift} &nbsp;|&nbsp; Regu ${r.Regu} &nbsp;|&nbsp; ${ipgTanggalDinasPanjang(r)}`) + `
      <div>${buildPatroliMatrixPrintHtml(r.Shift, titikMaster, logs)}</div>
      <p style="font-size:12px; margin-top:10px;"><b>Catatan Temuan:</b> ${r.CatatanTemuan || 'Nihil'}</p>` + buildApprovalTable([
        { label: 'Danru', name: r.DanruBy },
        { label: 'TL Keamanan', name: r.TLBy }
      ], `Rekap Patroli No. ${r.NoRekap}`);
    openPrintDocument(body);
  });
}

// ════════════════════════════════════════════════════════
// MODUL: IZIN TAMU MASUK (PRD Bab 7.2 — tanpa QR/surat)
// ════════════════════════════════════════════════════════
function loadIzinTamu() {
  const c = document.getElementById('app-container');
  c.innerHTML = sectionHeader('Izin Tamu Masuk', 'Email notifikasi otomatis ke Admin saat diajukan → Approval TL Keamanan → Check-in/out oleh Satpam')
    + `<div class="mb-3 d-flex justify-content-end gap-2 flex-wrap">
         <button class="btn btn-outline-ip" onclick="openUnduhLaporanModal('izin_tamu')"><i class="bi bi-file-earmark-arrow-down"></i> Unduh Laporan</button>
         <button class="btn btn-primary-ip" onclick="openIzinTamuForm()"><i class="bi bi-plus-lg"></i> Ajukan Izin Tamu</button>
       </div>
       <div id="itDashboardWrap" class="row g-3 mb-3"></div>
       <div id="tblIzinTamu"></div>`;
  google.script.run.withSuccessHandler(res => {
    const rows = res.data || [];
    renderIzinTamuDashboard(rows);
    renderGenericTable('tblIzinTamu',
      [ {label:'No. Pengajuan', key:'NoPengajuan'}, {label:'Tempat/Masuk Ke', key:'TempatMasukKe'}, {label:'Zona', key:'Zona'},
        {label:'Jenis', key:'JenisTamu'}, {label:'Nama Perusahaan', render:r=>r.NamaPerusahaan||'-'}, {label:'Jumlah', key:'Jumlah'},
        {label:'Menemui', key:'MenemuiNama'},
        {label:'Email', render:r=> r.EmailTerkirim==='Ya' ? '<span class="pill pill-success">Terkirim</span>' : '<span class="pill pill-neutral">-</span>'},
        {label:'Approval', render:r=>statusPill(r.StatusApproval)}, {label:'Kunjungan', render:r=>statusPill(r.StatusKunjungan)} ],
      rows.sort((a,b)=> (b.NoPengajuan||'').localeCompare(a.NoPengajuan||'')),
      row => izinTamuActions(row)
    );
  }).getAllData('IZIN_TAMU');
}
function renderChecklistSarprasModuleDashboard(rows) {
  const todayStr = ipgToday();
  const rowsHariIni = rows.filter(r => (r.Tanggal||'').toString().slice(0,10) === todayStr);
  const itemRusakHariIni = rowsHariIni.reduce((sum, r) => {
    try { return sum + JSON.parse(r.ItemsJSON||'[]').filter(it=>Number(it.rusak)>0).length; } catch(e) { return sum; }
  }, 0);
  const cards = [
    { icon: 'bi-clipboard-plus', bg: 'var(--tint-blue)', color: '#0C7A94', value: rowsHariIni.length, label: 'Checklist Dibuat Hari Ini' },
    { icon: 'bi-hourglass-split', bg: 'var(--tint-yellow)', color: '#FFC107', value: rowsHariIni.filter(r=>r.StatusApproval==='Menunggu TL Keamanan').length, label: 'Menunggu Approval TL' },
    { icon: 'bi-check2-circle', bg: 'var(--tint-green)', color: '#00913E', value: rowsHariIni.filter(r=>r.StatusApproval==='Selesai').length, label: 'Selesai Hari Ini' },
    { icon: 'bi-exclamation-triangle', bg: 'var(--tint-red)', color: '#E53935', value: itemRusakHariIni, label: 'Item Rusak Ditemukan Hari Ini' }
  ];
  document.getElementById('csDashboardWrap').innerHTML = cards.map(c => `
    <div class="col-6 col-lg-3"><div class="stat-card" style="background:${c.bg};border-color:transparent;">
      <div class="stat-icon" style="background:${c.color};"><i class="bi ${c.icon}"></i></div>
      <div><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>
    </div></div>`).join('');
}
function renderMutasiJagaDashboard(rows) {
  const todayStr = ipgToday();
  const rowsHariIni = rows.filter(r => (r.Tanggal||'').toString().slice(0,10) === todayStr);
  const cards = [
    { icon: 'bi-file-earmark-plus', bg: 'var(--tint-blue)', color: '#0C7A94', value: rowsHariIni.length, label: 'BA Dibuat Hari Ini' },
    { icon: 'bi-hourglass-split', bg: 'var(--tint-yellow)', color: '#FFC107', value: rowsHariIni.filter(r=>(r.StatusApproval||'').startsWith('Menunggu')).length, label: 'Menunggu Approval' },
    { icon: 'bi-check2-circle', bg: 'var(--tint-green)', color: '#00913E', value: rowsHariIni.filter(r=>r.StatusApproval==='Selesai').length, label: 'Selesai Hari Ini' },
    { icon: 'bi-exclamation-triangle', bg: 'var(--tint-red)', color: '#E53935', value: rowsHariIni.filter(r=>r.SectionD_Temuan).length, label: 'Ada Temuan Hari Ini' }
  ];
  document.getElementById('mjDashboardWrap').innerHTML = cards.map(c => `
    <div class="col-6 col-lg-3"><div class="stat-card" style="background:${c.bg};border-color:transparent;">
      <div class="stat-icon" style="background:${c.color};"><i class="bi ${c.icon}"></i></div>
      <div><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>
    </div></div>`).join('');
}
function renderIzinTamuDashboard(rows) {
  const todayStr = ipgToday();
  const rowsHariIni = rows.filter(r => (r.Tanggal||'').toString().slice(0,10) === todayStr);
  const cards = [
    { icon: 'bi-person-badge', bg: 'var(--tint-blue)', color: '#0C7A94', value: rowsHariIni.length, label: 'Tamu Hari Ini' },
    { icon: 'bi-hourglass-split', bg: 'var(--tint-yellow)', color: '#FFC107', value: rows.filter(r=>r.StatusApproval==='Diajukan').length, label: 'Menunggu Approval' },
    { icon: 'bi-door-open', bg: 'var(--tint-cyan)', color: '#00AEEF', value: rows.filter(r=>r.StatusKunjungan==='Di Area').length, label: 'Sedang di Area' },
    { icon: 'bi-check2-circle', bg: 'var(--tint-green)', color: '#00913E', value: rowsHariIni.filter(r=>r.StatusKunjungan==='Selesai').length, label: 'Selesai Hari Ini' }
  ];
  document.getElementById('itDashboardWrap').innerHTML = cards.map(c => `
    <div class="col-6 col-lg-3"><div class="stat-card" style="background:${c.bg};border-color:transparent;">
      <div class="stat-icon" style="background:${c.color};"><i class="bi ${c.icon}"></i></div>
      <div><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>
    </div></div>`).join('');
}
function izinTamuActions(row) {
  let btns = `<button class="btn btn-outline-ip btn-sm-ip" onclick="cetakIzinTamu('${row.ID}')"><i class="bi bi-printer"></i></button> `;
  if (row.StatusApproval === 'Diajukan' && ['TL_KEAMANAN','ADMIN'].includes(AppState.user.Role)) {
    btns += `<button class="btn btn-primary-ip btn-sm-ip" onclick="callServer('approveIzinTamu',['${row.ID}',true,'${AppState.user.Nama}'],'Izin tamu disetujui',loadIzinTamu)">Setujui</button> `;
    btns += `<button class="btn btn-outline-ip btn-sm-ip" onclick="callServer('approveIzinTamu',['${row.ID}',false,'${AppState.user.Nama}'],'Izin tamu ditolak',loadIzinTamu)">Tolak</button> `;
  }
  if (row.StatusApproval === 'Disetujui' && row.StatusKunjungan === 'Menunggu Check-In' && ['SATPAM','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-outline-ip btn-sm-ip" onclick="callServer('checkInTamu',['${row.ID}','${AppState.user.Nama}'],'Tamu check-in',loadIzinTamu)">Check-In</button> `;
  if (row.StatusKunjungan === 'Di Area' && ['SATPAM','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-outline-ip btn-sm-ip" onclick="callServer('checkOutTamu',['${row.ID}'],'Tamu check-out',loadIzinTamu)">Check-Out</button>`;
  return btns || '-';
}
function openIzinTamuForm() {
  openFormModal('Ajukan Izin Tamu Masuk', `
    <form onsubmit="return submitIzinTamuForm(event)">
      <div class="row g-2">
        <div class="col-12"><label class="form-label"><b>1. Informasi Kegiatan</b></label></div>
        <div class="col-6"><label class="form-label">Nama Pemohon (Pegawai)</label><input type="text" class="form-control" id="itPemohon" list="personelNamaOptions" value="${AppState.user.Nama}" required></div>
        <div class="col-6"><label class="form-label">Zona</label><select class="form-select" id="itZona" required>${selectOptions(ZONA_LIST)}</select></div>
        <div class="col-6"><label class="form-label">Tempat/Masuk Ke</label>
          <input type="text" class="form-control" id="itTempat" list="tempatOptions" placeholder="misal: Area Desalinasi" required>
          <datalist id="tempatOptions"><option value="Area Desalinasi"><option value="Area Produksi"><option value="Ruang Rapat"><option value="Workshop"></datalist>
        </div>
        <div class="col-6"><label class="form-label">Keperluan Izin</label>
          <input type="text" class="form-control" id="itKeperluan" list="keperluanOptions" placeholder="misal: Meeting" required>
          <datalist id="keperluanOptions"><option value="Meeting"><option value="Survey"><option value="Pemeliharaan"><option value="Inspeksi"><option value="Instalasi"></datalist>
        </div>
        <div class="col-4"><label class="form-label">Hari/Tanggal</label><input type="date" class="form-control" id="itTanggal" value="${ipgToday()}" required></div>
        <div class="col-4"><label class="form-label">Jam Masuk</label><input type="time" class="form-control" id="itJamMasuk" required></div>
        <div class="col-4">
          <label class="form-label">Jam Keluar</label>
          <input type="time" class="form-control" id="itJamKeluar">
          <div class="form-check mt-1"><input type="checkbox" class="form-check-input" id="itJamSelesai" checked onchange="toggleJamKeluarInput()">
            <label class="form-check-label small" for="itJamSelesai">Sampai selesai</label></div>
        </div>

        <div class="col-12 mt-3"><hr><label class="form-label"><b>2. Data Tamu/Mitra</b></label></div>
        <div class="col-4"><label class="form-label">Jenis</label><select class="form-select" id="itJenis">
          <option>Tamu</option><option>Mitra</option><option>Instansi</option></select></div>
        <div class="col-8"><label class="form-label">Nama Perusahaan/Instansi</label><input type="text" class="form-control" id="itPerusahaan" placeholder="misal: PT Laser Jaya Sakti"></div>
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <label class="form-label mb-0">Daftar Nama Tamu/Pegawai</label>
            <button type="button" class="btn btn-outline-ip btn-sm-ip" onclick="addTamuNamaRow()"><i class="bi bi-plus"></i> Tambah Nama</button>
          </div>
          <div id="itNamaWrap"></div>
          <div class="small text-muted mt-1">Jumlah: <b id="itJumlahDisplay">0</b> orang</div>
        </div>

        <div class="col-12 mt-3"><hr><label class="form-label"><b>3. Menemui</b></label></div>
        <div class="col-4"><label class="form-label">Nama</label><input type="text" class="form-control" id="itMenemuiNama" list="personelNamaOptions" required></div>
        <div class="col-4"><label class="form-label">Jabatan</label><input type="text" class="form-control" id="itMenemuiJabatan"></div>
        <div class="col-4"><label class="form-label">No. HP</label><input type="text" class="form-control" id="itMenemuiHP"></div>
      </div>
      <p class="section-sub mt-2 mb-0"><i class="bi bi-info-circle"></i> Email notifikasi otomatis terkirim ke Admin begitu diajukan.</p>
      <button type="submit" class="btn btn-primary-ip w-100 mt-3">Ajukan Izin</button>
    </form>`);
  document.getElementById('itNamaWrap').innerHTML = '';
  addTamuNamaRow(); addTamuNamaRow();
}
function toggleJamKeluarInput() {
  document.getElementById('itJamKeluar').disabled = document.getElementById('itJamSelesai').checked;
}
function addTamuNamaRow() {
  const wrap = document.getElementById('itNamaWrap');
  const div = document.createElement('div');
  div.className = 'row g-2 mb-2 align-items-center it-nama-row';
  div.innerHTML = `
    <div class="col-10"><input type="text" class="form-control form-control-sm it-nama" placeholder="Nama lengkap" oninput="updateJumlahTamu()"></div>
    <div class="col-2"><button type="button" class="btn btn-outline-ip btn-sm-ip" onclick="this.closest('.it-nama-row').remove(); updateJumlahTamu();"><i class="bi bi-trash"></i></button></div>`;
  wrap.appendChild(div);
  updateJumlahTamu();
}
function updateJumlahTamu() {
  const count = Array.from(document.querySelectorAll('#itNamaWrap .it-nama')).filter(el => el.value.trim()).length;
  const el = document.getElementById('itJumlahDisplay');
  if (el) el.textContent = count;
}
function submitIzinTamuForm(evt) {
  evt.preventDefault();
  const daftarNama = Array.from(document.querySelectorAll('#itNamaWrap .it-nama')).map(el => el.value.trim()).filter(Boolean);
  if (daftarNama.length === 0) { showToast('Peringatan', 'Tambahkan minimal 1 nama.', 'danger'); return false; }
  const payload = {
    pemohon: val('itPemohon'), zona: val('itZona'), tempatMasukKe: val('itTempat'), keperluanIzin: val('itKeperluan'),
    tanggal: val('itTanggal'), jamMasuk: val('itJamMasuk'), jamKeluar: val('itJamKeluar'), jamKeluarSelesai: document.getElementById('itJamSelesai').checked,
    jenisTamu: val('itJenis'), namaPerusahaan: val('itPerusahaan'), daftarNama,
    menemuiNama: val('itMenemuiNama'), menemuiJabatan: val('itMenemuiJabatan'), menemuiNoHP: val('itMenemuiHP'),
    createdBy: AppState.user.Nama };
  closeFormModal();
  callServer('submitIzinTamu', [payload], null, loadIzinTamu, 'Mengirim pengajuan & email notifikasi...');
  return false;
}
function cetakIzinTamu(id) {
  google.script.run.withSuccessHandler(res => {
    if (!res.success) { showToast('Gagal', res.message, 'danger'); return; }
    const r = (res.data || []).find(x => x.ID === id);
    if (!r) { showToast('Gagal', 'Data tidak ditemukan.', 'danger'); return; }
    let daftarNama = []; try { daftarNama = JSON.parse(r.DaftarNamaJSON || '[]'); } catch(e) {}
    const namaRows = daftarNama.length
      ? daftarNama.map((n,i)=>`<tr><td style="border:1px solid #ccc;padding:5px;text-align:center;">${i+1}</td><td style="border:1px solid #ccc;padding:5px;">${n}</td></tr>`).join('')
      : `<tr><td colspan="2" style="text-align:center;padding:6px;color:#999;">Tidak ada nama tercatat.</td></tr>`;
    const jamKeluarText = r.JamKeluar === 'Selesai' ? 'Selesai' : (r.JamKeluar || 'Selesai');
    const body = buildLetterheadHTML('izinTamu',
        `No. Pengajuan: ${r.NoPengajuan} &nbsp;|&nbsp; Zona ${r.Zona} &nbsp;|&nbsp; Status: <b>${r.StatusApproval}</b> / <b>${r.StatusKunjungan}</b>`) + `
      <table style="width:100%; font-size:12px; margin-bottom:10px;">
        <tr><td style="width:35%; padding:4px 0;">Nama Pemohon</td><td>: ${r.Pemohon}</td></tr>
        <tr><td style="padding:4px 0;">Tempat/Masuk Ke</td><td>: ${r.TempatMasukKe}</td></tr>
        <tr><td style="padding:4px 0;">Keperluan Izin</td><td>: ${r.KeperluanIzin}</td></tr>
        <tr><td style="padding:4px 0;">Hari/Tanggal</td><td>: ${(r.Tanggal||'').slice(0,10)}</td></tr>
        <tr><td style="padding:4px 0;">Jam</td><td>: ${r.JamMasuk} - ${jamKeluarText}</td></tr>
        <tr><td style="padding:4px 0;">Jenis</td><td>: ${r.JenisTamu}${r.NamaPerusahaan ? ' — ' + r.NamaPerusahaan : ''}</td></tr>
        <tr><td style="padding:4px 0;">Menemui</td><td>: ${r.MenemuiNama} (${r.MenemuiJabatan || '-'}), ${r.MenemuiNoHP || '-'}</td></tr>
        <tr><td style="padding:4px 0;">Check-In / Check-Out</td><td>: ${fmtDate(r.WaktuMasuk)||'-'} / ${fmtDate(r.WaktuKeluar)||'-'}</td></tr>
      </table>
      <p style="font-size:12px;font-weight:700;margin-bottom:2px;">Daftar Nama (${r.Jumlah} orang)</p>
      <table style="width:100%;border-collapse:collapse;margin-top:4px;">
        <thead><tr>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;width:15%;">No</th>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;">Nama</th>
        </tr></thead>
        <tbody>${namaRows}</tbody>
      </table>` + buildApprovalTable([
        { label: 'Pemohon', name: r.Pemohon },
        { label: 'Menyetujui (TL Keamanan)', name: r.ApprovedBy },
        { label: 'Verifikasi Check-In (Satpam)', name: r.CheckInBy }
      ], `Izin Tamu No. ${r.NoPengajuan}`);
    openPrintDocument(body);
  }).withFailureHandler(e=>showToast('Error',e.message,'danger')).getAllData('IZIN_TAMU');
}

// ════════════════════════════════════════════════════════
// MODUL: KENDARAAN KELUAR-MASUK (PRD Bab 7.2 — 2 tahap)
// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// MODUL: IZIN KENDARAAN MASUK A — pra-approval SPS/TL Keamanan → Check-In/Out Satpam
// Menggantikan Kendaraan Keluar-Masuk, mengacu Form PB-GRT.13.01.13 (hasil diskusi lanjutan)
// ════════════════════════════════════════════════════════
const ZONA_LIST = ['Zona A', 'Zona B', 'Zona C', 'Zona D'];
const KATEGORI_IZIN_KENDARAAN = ['Diijinkan (dengan batas waktu)', 'Tidak Diijinkan', 'Sekedar Menurunkan Barang', 'Kendaraan/Alat Berat'];

function loadKendaraan() {
  const c = document.getElementById('app-container');
  c.innerHTML = sectionHeader('Izin Kendaraan Masuk A', 'Pengajuan → Approval SPS/TL Keamanan → Check-In/Out Satpam di gerbang')
    + `<div class="mb-3 d-flex justify-content-end gap-2 flex-wrap">
         <button class="btn btn-outline-ip" onclick="openUnduhLaporanModal('kendaraan')"><i class="bi bi-file-earmark-arrow-down"></i> Unduh Laporan</button>
         <button class="btn btn-primary-ip" onclick="openKendaraanForm()"><i class="bi bi-plus-lg"></i> Ajukan Izin Kendaraan</button>
       </div>
       <div id="kDashboardWrap" class="row g-3 mb-3"></div>
       <div id="tblKendaraan"></div>`;
  google.script.run.withSuccessHandler(res => {
    const rows = res.data || [];
    renderKendaraanDashboard(rows);
    renderGenericTable('tblKendaraan',
      [ {label:'No. Izin', key:'NoIzin'}, {label:'Plat', key:'PlatNomor'}, {label:'Pemohon', key:'Pemohon'}, {label:'Zona', key:'Zona'},
        {label:'Kategori', key:'Kategori'},
        {label:'Temuan', render:r=> r.AdaTemuan==='Ya' ? '<span class="pill pill-danger">Ya</span>':'<span class="pill pill-neutral">Tidak</span>'},
        {label:'Approval', render:r=>statusPill(r.StatusApproval)},
        {label:'Kunjungan', render:r=>statusPill(r.StatusKunjungan)} ],
      rows.sort((a,b)=> (b.NoIzin||'').localeCompare(a.NoIzin||'')),
      row => kendaraanActions(row)
    );
  }).getAllData('IZIN_KENDARAAN_MASUK');
}
function renderKendaraanDashboard(rows) {
  const todayStr = ipgToday();
  const rowsHariIni = rows.filter(r => (r.WaktuCheckIn||'').toString().slice(0,10) === todayStr);
  const cards = [
    { icon: 'bi-truck', bg: 'var(--tint-blue)', color: '#0C7A94', value: rowsHariIni.length, label: 'Check-In Hari Ini' },
    { icon: 'bi-hourglass-split', bg: 'var(--tint-yellow)', color: '#FFC107', value: rows.filter(r=>r.StatusApproval==='Diajukan').length, label: 'Menunggu Approval' },
    { icon: 'bi-door-open', bg: 'var(--tint-cyan)', color: '#00AEEF', value: rows.filter(r=>r.StatusKunjungan==='Di Area').length, label: 'Sedang di Area' },
    { icon: 'bi-exclamation-triangle', bg: 'var(--tint-red)', color: '#E53935', value: rowsHariIni.filter(r=>r.AdaTemuan==='Ya').length, label: 'Ada Temuan Hari Ini' }
  ];
  document.getElementById('kDashboardWrap').innerHTML = cards.map(c => `
    <div class="col-6 col-lg-3"><div class="stat-card" style="background:${c.bg};border-color:transparent;">
      <div class="stat-icon" style="background:${c.color};"><i class="bi ${c.icon}"></i></div>
      <div><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>
    </div></div>`).join('');
}
function kendaraanActions(row) {
  let btns = `<button class="btn btn-outline-ip btn-sm-ip" onclick="cetakIzinKendaraan('${row.ID}')"><i class="bi bi-printer"></i></button> `;
  if (row.StatusApproval === 'Diajukan' && ['SPS_KEAMANAN','TL_KEAMANAN','ADMIN'].includes(AppState.user.Role)) {
    btns += `<button class="btn btn-primary-ip btn-sm-ip" onclick="callServer('approveIzinKendaraan',['${row.ID}',true,'${AppState.user.Nama}'],'Izin disetujui',loadKendaraan)">Setujui</button> `;
    btns += `<button class="btn btn-outline-ip btn-sm-ip" onclick="callServer('approveIzinKendaraan',['${row.ID}',false,'${AppState.user.Nama}'],'Izin ditolak',loadKendaraan)">Tolak</button> `;
  }
  if (row.StatusApproval === 'Disetujui' && row.StatusKunjungan === 'Menunggu Check-In' && ['SATPAM','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-outline-ip btn-sm-ip" onclick="openCheckInKendaraanModal('${row.ID}')">Check-In</button> `;
  if (row.StatusKunjungan === 'Di Area' && ['SATPAM','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-outline-ip btn-sm-ip" onclick="callServer('checkOutKendaraan',['${row.ID}'],'Kendaraan check-out',loadKendaraan)">Check-Out</button>`;
  return btns || '-';
}
function openCheckInKendaraanModal(id) {
  openFormModal('Check-In Kendaraan di Gerbang', `
    <form onsubmit="return submitCheckInKendaraan(event, '${id}')">
      <div class="form-check mb-2">
        <input type="checkbox" class="form-check-input" id="ciTemuan"> <label class="form-check-label" for="ciTemuan">Tandai ada kejanggalan/muatan mencurigakan (otomatis buat Incident)</label>
      </div>
      <div id="ciCatatanWrap" style="display:none;"><textarea class="form-control mb-2" id="ciCatatan" placeholder="Uraikan kejanggalan..."></textarea></div>
      <button type="submit" class="btn btn-primary-ip w-100"><i class="bi bi-check2-circle"></i> Konfirmasi Check-In</button>
    </form>`);
  document.getElementById('ciTemuan').addEventListener('change', e => {
    document.getElementById('ciCatatanWrap').style.display = e.target.checked ? 'block' : 'none';
  });
}
function submitCheckInKendaraan(evt, id) {
  evt.preventDefault();
  const adaTemuan = document.getElementById('ciTemuan').checked;
  const catatan = val('ciCatatan');
  closeFormModal();
  callServer('checkInKendaraan', [id, adaTemuan, catatan, AppState.user.Nama], 'Kendaraan check-in.', loadKendaraan, 'Menyimpan...');
  return false;
}
function openKendaraanForm() {
  openFormModal('Ajukan Izin Kendaraan Masuk', `
    <form onsubmit="return submitKendaraanForm(event)">
      <div class="row g-2">
        <div class="col-6"><label class="form-label">Nama Pemohon</label><input type="text" class="form-control" id="kPemohon" list="personelNamaOptions" required value="${AppState.user.Nama}"></div>
        <div class="col-6"><label class="form-label">Perusahaan/Instansi PT/CV</label><input type="text" class="form-control" id="kPerusahaan"></div>
        <div class="col-6"><label class="form-label">Jabatan</label><input type="text" class="form-control" id="kJabatan"></div>
        <div class="col-6"><label class="form-label">Zona Tujuan</label><select class="form-select" id="kZona" required>${selectOptions(ZONA_LIST)}</select></div>
        <div class="col-6"><label class="form-label">Plat Nomor</label><input type="text" class="form-control" id="kPlat" required></div>
        <div class="col-6"><label class="form-label">Jenis & Warna Kendaraan</label><input type="text" class="form-control" id="kJenisWarna" placeholder="misal: Pickup Putih"></div>
        <div class="col-6"><label class="form-label">Nama Pengemudi</label><input type="text" class="form-control" id="kPengemudi" required></div>
        <div class="col-6"><label class="form-label">Lokasi Pekerjaan</label><input type="text" class="form-control" id="kLokasiPekerjaan"></div>
        <div class="col-12"><label class="form-label">Keperluan</label><textarea class="form-control" id="kKeperluan" rows="2" required></textarea></div>
        <div class="col-6"><label class="form-label">Berlaku Mulai</label><input type="date" class="form-control" id="kTglMulai" required value="${ipgToday()}"></div>
        <div class="col-6"><label class="form-label">Berlaku Sampai</label><input type="date" class="form-control" id="kTglSelesai" required value="${ipgToday()}"></div>
        <div class="col-6"><label class="form-label">Jam Masuk</label><input type="time" class="form-control" id="kJamMasuk"></div>
        <div class="col-6"><label class="form-label">Jam Keluar</label><input type="time" class="form-control" id="kJamKeluar"></div>
        <div class="col-8"><label class="form-label">Kategori</label><select class="form-select" id="kKategori" required onchange="toggleBatasWaktuInput()">${selectOptions(KATEGORI_IZIN_KENDARAAN)}</select></div>
        <div class="col-4" id="kBatasWaktuWrap"><label class="form-label">Batas Waktu (hari)</label><input type="number" class="form-control" id="kBatasWaktu" min="1" value="1"></div>
        <div class="col-12"><label class="form-label">Catatan Barang Bawaan</label><textarea class="form-control" id="kCatatanBarang" rows="2" placeholder="Periksa & sebutkan jenis barang yang dibawa"></textarea></div>
      </div>
      <button type="submit" class="btn btn-primary-ip w-100 mt-3">Ajukan Izin</button>
    </form>`);
}
function toggleBatasWaktuInput() {
  document.getElementById('kBatasWaktuWrap').style.display = val('kKategori') === KATEGORI_IZIN_KENDARAAN[0] ? 'block' : 'none';
}
function submitKendaraanForm(evt) {
  evt.preventDefault();
  const payload = {
    pemohon: val('kPemohon'), perusahaan: val('kPerusahaan'), jabatan: val('kJabatan'),
    zona: val('kZona'), platNomor: val('kPlat'), jenisWarnaKendaraan: val('kJenisWarna'), namaPengemudi: val('kPengemudi'),
    lokasiPekerjaan: val('kLokasiPekerjaan'), keperluan: val('kKeperluan'),
    tanggalMulai: val('kTglMulai'), tanggalSelesai: val('kTglSelesai'), jamMasuk: val('kJamMasuk'), jamKeluar: val('kJamKeluar'),
    kategori: val('kKategori'), batasWaktuHari: val('kBatasWaktu'), catatanBarangBawaan: val('kCatatanBarang'),
    createdBy: AppState.user.Nama
  };
  closeFormModal();
  callServer('ajukanIzinKendaraan', [payload], null, loadKendaraan, 'Mengajukan izin kendaraan...');
  return false;
}
function cetakIzinKendaraan(id) {
  google.script.run.withSuccessHandler(res => {
    if (!res.success) { showToast('Gagal', res.message, 'danger'); return; }
    const r = (res.data || []).find(x => x.ID === id);
    if (!r) { showToast('Gagal', 'Data tidak ditemukan.', 'danger'); return; }
    const kategoriChecks = KATEGORI_IZIN_KENDARAAN.map(k => `<div>[${k===r.Kategori?'X':' '}] ${k}${k===KATEGORI_IZIN_KENDARAAN[0] && k===r.Kategori ? ' — batas waktu: '+(r.BatasWaktuHari||'-')+' hari' : ''}</div>`).join('');
    const body = buildLetterheadHTML('izinKendaraan',
        `No. Izin: ${r.NoIzin} &nbsp;|&nbsp; ${r.Zona} &nbsp;|&nbsp; Status: <b>${r.StatusApproval}</b> / <b>${r.StatusKunjungan}</b>${r.AdaTemuan==='Ya' ? ' &nbsp;⚠️ Ada Temuan/Anomali':''}`) + `
      <table style="width:100%; font-size:12px; margin-bottom:8px;">
        <tr><td style="width:35%; padding:4px 0;">Nama Pemohon</td><td>: ${r.Pemohon}</td></tr>
        <tr><td style="padding:4px 0;">Perusahaan/Instansi</td><td>: ${r.Perusahaan || '-'}</td></tr>
        <tr><td style="padding:4px 0;">Jabatan</td><td>: ${r.Jabatan || '-'}</td></tr>
        <tr><td style="padding:4px 0;">No. Pol Kendaraan</td><td>: ${r.PlatNomor}</td></tr>
        <tr><td style="padding:4px 0;">Jenis & Warna Kendaraan</td><td>: ${r.JenisWarnaKendaraan || '-'}</td></tr>
        <tr><td style="padding:4px 0;">Nama Pengemudi</td><td>: ${r.NamaPengemudi}</td></tr>
        <tr><td style="padding:4px 0;">Lokasi Pekerjaan</td><td>: ${r.LokasiPekerjaan || '-'}</td></tr>
        <tr><td style="padding:4px 0;">Keperluan</td><td>: ${r.Keperluan}</td></tr>
        <tr><td style="padding:4px 0;">Berlaku</td><td>: ${(r.TanggalMulai||'').slice(0,10)} s/d ${(r.TanggalSelesai||'').slice(0,10)}</td></tr>
        <tr><td style="padding:4px 0;">Jam Masuk / Keluar (Rencana)</td><td>: ${r.JamMasuk||'-'} / ${r.JamKeluar||'-'}</td></tr>
        <tr><td style="padding:4px 0;">Check-In / Check-Out</td><td>: ${r.WaktuCheckIn||'-'} / ${r.WaktuCheckOut||'-'}</td></tr>
      </table>
      <p style="font-size:12px; margin-bottom:4px;"><b>Kategori Izin:</b></p>
      <div style="font-size:12px; margin-bottom:8px;">${kategoriChecks}</div>
      <p style="font-size:12px;"><b>Catatan Barang Bawaan:</b> ${r.CatatanBarangBawaan || '-'}</p>` + buildApprovalTable([
        { label: 'Pemohon', name: r.Pemohon },
        { label: 'Menyetujui (SPS/TL Keamanan)', name: r.ApprovedBy },
        { label: 'Diperiksa Petugas Jaga (Satpam)', name: '' }
      ], `Izin Kendaraan No. ${r.NoIzin}`);
    openPrintDocument(body);
  }).withFailureHandler(e=>showToast('Error',e.message,'danger')).getAllData('IZIN_KENDARAAN_MASUK');
}

// ════════════════════════════════════════════════════════
// MODUL 12: BARANG KELUAR (baru v3.2 — PRD Bab 7.2, hybrid digital+fisik)
// ════════════════════════════════════════════════════════
const KATEGORI_BARANG_KELUAR = ['Dimusnahkan', 'Dipergunakan', 'Diserahkan', 'Dikembalikan', 'Diperbaiki'];

let bkAllRows = [];
function loadBarangKeluar() {
  const c = document.getElementById('app-container');
  c.innerHTML = sectionHeader('Pengajuan Barang Keluar', 'Alur: SPS Bidang ajukan → SPS Keamanan approval digital → cetak surat → Danru periksa fisik & ttd/stempel basah → konfirmasi keluar → (kategori Diperbaiki) konfirmasi kembali → SPS Keamanan close', 'v3.2')
    + actionBar('Ajukan Barang Keluar', 'openBarangKeluarForm', 'BARANG_KELUAR', 'Pengajuan_Barang_Keluar', null,
        ['NoSurat', 'Tanggal', 'SPSBidangPemohon', 'JabatanPemohon', 'Tujuan', 'Kategori'])
    + `<div id="bkDashboardWrap" class="row g-3 mb-3"></div>`
    + `<div class="mb-3"><input type="text" class="form-control" id="bkSearchInput" placeholder="Cari No. Surat, SPS Bidang, Kategori, atau nama barang..." oninput="renderBarangKeluarTable()"></div>`
    + `<div id="tblBarangKeluar"></div>`;
  google.script.run.withSuccessHandler(res => {
    bkAllRows = res.data || [];
    renderBarangKeluarDashboard(bkAllRows);
    renderBarangKeluarTable();
  }).getAllData('BARANG_KELUAR');
}
function renderBarangKeluarTable() {
  const q = (val('bkSearchInput') || '').toLowerCase();
  const rows = bkAllRows.filter(r => {
    if (!q) return true;
    let itemNames = '';
    try { itemNames = JSON.parse(r.ItemsJSON||'[]').map(it=>it.namaBarang).join(' '); } catch(e) {}
    const hay = `${r.NoSurat||''} ${r.SPSBidangPemohon||''} ${r.Kategori||''} ${itemNames}`.toLowerCase();
    return hay.includes(q);
  });
  renderGenericTable('tblBarangKeluar',
    [ {label:'No. Surat', key:'NoSurat'}, {label:'Tanggal', render:r=>(r.Tanggal||'').slice(0,10)}, {label:'SPS Bidang', key:'SPSBidangPemohon'}, {label:'Kategori', key:'Kategori'},
      {label:'Barang', render:r=>{
        try { const items = JSON.parse(r.ItemsJSON||'[]'); return items.length ? `${items[0].namaBarang}${items.length>1?` (+${items.length-1} lainnya)`:''}` : '-'; }
        catch(e){ return '-'; }
      }},
      {label:'Status', render:r=>statusPill(r.Status)},
      {label:'Cetak', render:r => r.Status !== 'Diajukan' ? `<button class="btn btn-outline-ip btn-sm-ip" onclick="cetakSuratBarang('${r.NoSurat}')"><i class="bi bi-printer"></i></button>` : '-' } ],
    rows.sort((a,b)=> (b.NoSurat||'').localeCompare(a.NoSurat||'')),
    row => barangKeluarActions(row)
  );
}
function renderBarangKeluarDashboard(rows) {
  const now = new Date();
  const bulanIniRows = rows.filter(r => { const d = new Date(r.Tanggal); return !isNaN(d) && d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); });
  const cards = [
    { icon: 'bi-box-seam', bg: 'var(--tint-blue)', color: '#0C7A94', value: bulanIniRows.length, label: 'Total Bulan Ini' },
    { icon: 'bi-hourglass-split', bg: 'var(--tint-yellow)', color: '#FFC107', value: rows.filter(r=>r.Status==='Diajukan').length, label: 'Menunggu Approval' },
    { icon: 'bi-truck', bg: 'var(--tint-cyan)', color: '#00AEEF', value: rows.filter(r=>r.Status==='Disetujui').length, label: 'Menunggu Konfirmasi Keluar' },
    { icon: 'bi-check2-circle', bg: 'var(--tint-green)', color: '#00913E', value: bulanIniRows.filter(r=>r.Status==='Selesai').length, label: 'Selesai Bulan Ini' }
  ];
  document.getElementById('bkDashboardWrap').innerHTML = cards.map(c => `
    <div class="col-6 col-lg-3"><div class="stat-card" style="background:${c.bg};border-color:transparent;">
      <div class="stat-icon" style="background:${c.color};"><i class="bi ${c.icon}"></i></div>
      <div><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>
    </div></div>`).join('');
}
function barangKeluarActions(row) {
  let btns = '';
  if (row.Status === 'Diajukan' && ['SPS_KEAMANAN','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-primary-ip btn-sm-ip" onclick="callServer('approveSPSBarangKeluar',['${row.ID}','${AppState.user.Nama}'],'Disetujui SPS Keamanan',loadBarangKeluar)">Approve</button> `;
  if (row.Status === 'Disetujui' && ['DANRU','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-primary-ip btn-sm-ip" onclick="callServer('konfirmasiKeluarDanru',['${row.ID}','${AppState.user.Nama}'],'Barang keluar dikonfirmasi',loadBarangKeluar)">Konfirmasi Keluar</button> `;
  if (row.Status === 'Barang Keluar' && row.Kategori === 'Diperbaiki' && ['SATPAM','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-outline-ip btn-sm-ip" onclick="callServer('konfirmasiKembaliSatpam',['${row.ID}','${AppState.user.Nama}'],'Barang telah kembali',loadBarangKeluar)">Konfirmasi Kembali</button> `;
  if (['Barang Keluar','Kembali'].includes(row.Status) && ['SPS_KEAMANAN','ADMIN'].includes(AppState.user.Role) && !(row.Kategori==='Diperbaiki' && row.Status==='Barang Keluar'))
    btns += `<button class="btn btn-outline-ip btn-sm-ip" onclick="callServer('closeBarangKeluar',['${row.ID}','${AppState.user.Nama}'],'Pengajuan ditutup',loadBarangKeluar)">Close</button>`;
  return btns || '-';
}
function openBarangKeluarForm() {
  openFormModal('Ajukan Barang Keluar (Surat Pas)', `
    <form onsubmit="return submitBarangKeluarForm(event)">
      <div class="row g-2">
        <div class="col-12"><label class="form-label"><b>I. Yang Bertanda Tangan Dibawah Ini (SPS Bidang Pemohon)</b></label></div>
        <div class="col-6"><label class="form-label">Tanggal</label><input type="date" class="form-control" id="bkTanggal" value="${ipgToday()}" required></div>
        <div class="col-6"><label class="form-label">Nama SPS Bidang</label><input type="text" class="form-control" id="bkPemohon" list="personelNamaOptions" value="${AppState.user.Nama}" required></div>
        <div class="col-6"><label class="form-label">Jabatan</label><input type="text" class="form-control" id="bkJabatanPemohon"></div>
        <div class="col-6"><label class="form-label">Kategori</label>
          <select class="form-select" id="bkKategori" onchange="toggleDiserahkanKepada()">${selectOptions(KATEGORI_BARANG_KELUAR)}</select></div>
        <div class="col-12" id="bkDiserahkanWrap" style="display:none;"><label class="form-label">Diserahkan Kepada</label><input type="text" class="form-control" id="bkDiserahkanKepada"></div>

        <div class="col-12 mt-3"><hr><label class="form-label"><b>II. Dilakukan Oleh (Pelaksana)</b></label></div>
        <div class="col-6"><label class="form-label">Nama</label><input type="text" class="form-control" id="bkPelaksanaNama" list="personelNamaOptions" required></div>
        <div class="col-6"><label class="form-label">No. Induk/KTP/SIM</label><input type="text" class="form-control" id="bkPelaksanaNoInduk"></div>
        <div class="col-6"><label class="form-label">Jabatan Pekerjaan</label><input type="text" class="form-control" id="bkPelaksanaJabatan"></div>
        <div class="col-6"><label class="form-label">Nama Perusahaan</label><input type="text" class="form-control" id="bkPelaksanaPerusahaan"></div>
        <div class="col-6"><label class="form-label">No. Telepon Perusahaan</label><input type="text" class="form-control" id="bkPelaksanaTelepon"></div>
        <div class="col-6"><label class="form-label">Alamat Perusahaan</label><input type="text" class="form-control" id="bkPelaksanaAlamat"></div>

        <div class="col-12 mt-3"><hr><label class="form-label"><b>III. Data Pengemudi & Kendaraan</b></label></div>
        <div class="col-6"><label class="form-label">Nama Pengemudi</label><input type="text" class="form-control" id="bkPengemudiNama"></div>
        <div class="col-6"><label class="form-label">Alamat Rumah</label><input type="text" class="form-control" id="bkPengemudiAlamat"></div>
        <div class="col-4"><label class="form-label">Jenis Kendaraan</label><input type="text" class="form-control" id="bkJenisKendaraan"></div>
        <div class="col-4"><label class="form-label">Warna</label><input type="text" class="form-control" id="bkWarnaKendaraan"></div>
        <div class="col-4"><label class="form-label">Nomor Polisi</label><input type="text" class="form-control" id="bkNomorPolisi"></div>
        <div class="col-12"><label class="form-label">Tujuan</label><input type="text" class="form-control" id="bkTujuan"></div>
      </div>
      <hr>
      <div class="d-flex justify-content-between align-items-center mb-2">
        <label class="form-label mb-0"><b>IV. Daftar Barang Keluar</b></label>
        <button type="button" class="btn btn-outline-ip btn-sm-ip" onclick="addBarangItemRow()"><i class="bi bi-plus"></i> Tambah Barang</button>
      </div>
      <div id="bkItemsWrap"></div>
      <button type="submit" class="btn btn-primary-ip w-100 mt-3">Ajukan (Terbit Nomor Surat Otomatis)</button>
    </form>`);
  document.getElementById('bkItemsWrap').innerHTML = '';
  addBarangItemRow(); addBarangItemRow();
}
function toggleDiserahkanKepada() {
  document.getElementById('bkDiserahkanWrap').style.display = val('bkKategori') === 'Diserahkan' ? 'block' : 'none';
}
function addBarangItemRow() {
  const wrap = document.getElementById('bkItemsWrap');
  const div = document.createElement('div');
  div.className = 'row g-2 mb-2 align-items-end bk-item-row';
  div.innerHTML = `
    <div class="col-4"><label class="form-label small">Nama Barang</label><input type="text" class="form-control form-control-sm bk-nama" required></div>
    <div class="col-2"><label class="form-label small">Jumlah</label><input type="number" class="form-control form-control-sm bk-jumlah" min="0" value="1"></div>
    <div class="col-2"><label class="form-label small">Satuan</label>
      <input type="text" class="form-control form-control-sm bk-satuan" list="satuanOptions" placeholder="pcs">
      <datalist id="satuanOptions"><option value="Pcs"><option value="Set"><option value="Unit"><option value="Lot"></datalist>
    </div>
    <div class="col-3"><label class="form-label small">Keterangan</label><input type="text" class="form-control form-control-sm bk-ket"></div>
    <div class="col-1"><button type="button" class="btn btn-outline-ip btn-sm-ip" onclick="this.closest('.bk-item-row').remove()"><i class="bi bi-trash"></i></button></div>`;
  wrap.appendChild(div);
}
function submitBarangKeluarForm(evt) {
  evt.preventDefault();
  const items = [];
  document.querySelectorAll('#bkItemsWrap .bk-item-row').forEach(row => {
    const nama = row.querySelector('.bk-nama').value;
    if (!nama) return;
    items.push({ namaBarang: nama, jumlah: row.querySelector('.bk-jumlah').value, satuan: row.querySelector('.bk-satuan').value,
      keterangan: row.querySelector('.bk-ket').value, statusBarang: 'Menunggu' });
  });
  if (items.length === 0) { showToast('Peringatan', 'Tambahkan minimal 1 barang.', 'danger'); return false; }
  const payload = {
    tanggal: val('bkTanggal'), spsBidangPemohon: val('bkPemohon'), jabatanPemohon: val('bkJabatanPemohon'),
    kategori: val('bkKategori'), diserahkanKepada: val('bkDiserahkanKepada'),
    pelaksanaNama: val('bkPelaksanaNama'), pelaksanaNoInduk: val('bkPelaksanaNoInduk'), pelaksanaJabatan: val('bkPelaksanaJabatan'),
    pelaksanaPerusahaan: val('bkPelaksanaPerusahaan'), pelaksanaTelepon: val('bkPelaksanaTelepon'), pelaksanaAlamat: val('bkPelaksanaAlamat'),
    pengemudiNama: val('bkPengemudiNama'), pengemudiAlamatRumah: val('bkPengemudiAlamat'),
    jenisKendaraan: val('bkJenisKendaraan'), warnaKendaraan: val('bkWarnaKendaraan'), nomorPolisi: val('bkNomorPolisi'), tujuan: val('bkTujuan'),
    items, createdBy: AppState.user.Nama };
  closeFormModal();
  showSaving('Menerbitkan nomor surat...');
  google.script.run.withSuccessHandler(res => {
    hideSaving();
    if (res.success) { showToast('Berhasil', res.message, 'success'); loadBarangKeluar(); }
    else showToast('Gagal', res.message, 'danger');
  }).withFailureHandler(e=>{hideSaving();showToast('Error',e.message,'danger');}).ajukanBarangKeluar(payload);
  return false;
}
// ════════════════════════════════════════════════════════
// TEMPLATE CETAK RESMI — Letterhead PLN Indonesia Power (PRD 7.4)
// ════════════════════════════════════════════════════════
const JENIS_LAPORAN_LABELS = {
  mutasiJaga: 'BA Mutasi Jaga', checklistSarpras: 'Checklist Sarpras', rekapPatroli: 'Rekap Patroli',
  izinTamu: 'Izin Tamu', izinKendaraan: 'Izin Kendaraan', suratBarang: 'Surat Barang Keluar', baIncident: 'BA Incident'
};
let PLN_PRINT_LOGO = ''; // diisi belakangan oleh loadDefaultPrintLogo() — supaya tidak ikut memberatkan halaman login
/** jenisOrTitle: key jenis laporan (pakai config Admin) ATAU judul teks langsung (kompatibel dgn pemanggilan lama/generik) */
function buildLetterheadHTML(jenisOrTitle, arg2, arg3) {
  const isKnownType = JENIS_LAPORAN_LABELS.hasOwnProperty(jenisOrTitle);
  const namaUnit = (AppState.config && AppState.config.namaUnit) || 'PT PLN INDONESIA POWER UBP GRATI';
  const namaSistem = (AppState.config && AppState.config.namaSistem) || 'IP GUARD V3 — SISTEM MANAJEMEN PENGAMANAN';
  let judul, noDokumen, tanggalTerbit, revisi, metaLines;
  if (isKnownType) {
    const cfg = AppState.laporanHeaderConfig[jenisOrTitle] || {};
    judul = cfg.JudulFormulir || JENIS_LAPORAN_LABELS[jenisOrTitle];
    noDokumen = cfg.NoDokumen || '-';
    tanggalTerbit = cfg.TanggalTerbit || '-';
    revisi = cfg.Revisi || '-';
    metaLines = arg2;
  } else {
    judul = jenisOrTitle;
    noDokumen = arg2 || '-';
    tanggalTerbit = '-'; revisi = '-';
    metaLines = arg3;
  }
  const logoSrc = (AppState.config && AppState.config.logoUrl) ? AppState.config.logoUrl : PLN_PRINT_LOGO;
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
      <tr>
        <td style="border:1.5px solid #333;padding:8px;width:130px;text-align:center;vertical-align:middle;">
          <img src="${logoSrc}" style="max-width:100%;height:auto;display:block;margin:0 auto;">
        </td>
        <td style="border:1.5px solid #333;padding:8px 14px;text-align:center;vertical-align:middle;">
          <div style="font-size:15px;font-weight:700;color:#023B4A;letter-spacing:.02em;">${namaUnit}</div>
          <div style="font-size:11.5px;color:#444;">${namaSistem}</div>
          <div style="font-size:13px;font-weight:700;color:#0C7A94;text-transform:uppercase;margin-top:5px;letter-spacing:.02em;">${judul}</div>
        </td>
        <td style="border:1.5px solid #333;padding:8px 12px;text-align:left;vertical-align:middle;font-size:10.5px;color:#333;white-space:nowrap;line-height:1.7;">
          <div>No. Rekaman : <b>${noDokumen}</b></div>
          <div>Tgl. Terbit : <b>${tanggalTerbit}</b></div>
          <div>Revisi : <b>${revisi}</b></div>
          <div>Halaman : <b>1/1</b></div>
        </td>
      </tr>
    </table>
    ${metaLines ? `<div style="text-align:center;font-size:11px;color:#666;margin-bottom:14px;">${metaLines}</div>` : '<div style="margin-bottom:10px;"></div>'}
  `;
}

/** signers: [{label, name}] — kolom approval standar di bagian bawah form (PRD 7.4) */
/** signers: [{label, name}]. docRef: No. dokumen (BA/Surat/Izin) untuk isi QR verifikasi.
    QR cuma muncul di atas nama yang SUDAH approve (name terisi) — bukan di kolom kosong. */
function buildApprovalTable(signers, docRef) {
  const QR_BOX = 66; // ukuran tetap kotak QR (px) — konsisten berapapun kompleksitas datanya
  const w = Math.floor(100 / signers.length);
  const labelCells = signers.map(s =>
    `<td style="text-align:center; padding:10px 10px 4px; width:${w}%; vertical-align:bottom; font-size:11px; color:#666;">${s.label}</td>`
  ).join('');
  const signCells = signers.map(s => {
    const qrTag = (s.name && docRef) ? generateApprovalQrTag_(docRef, s.label, s.name) : '';
    // Tinggi ruang QR (kotak + jarak) DISAMAKAN persis dengan kolom kosong, supaya semua nama sejajar.
    const spacer = qrTag
      ? `<div style="width:${QR_BOX}px;height:${QR_BOX}px;margin:0 auto 6px;">${qrTag}</div>`
      : `<div style="height:${QR_BOX + 6}px;"></div>`;
    return `<td style="text-align:center; padding:0 10px 10px;">
      ${spacer}
      <div style="border-top:1px solid #333; padding-top:4px; font-size:11.5px; font-weight:600;">${s.name || '(_____________________)'}</div>
    </td>`;
  }).join('');
  return `
    <table style="width:100%; margin-top:32px; border-collapse:collapse;">
      <tr>${labelCells}</tr>
      <tr>${signCells}</tr>
    </table>
    <div style="margin-top:24px; font-size:9.5px; color:#999; text-align:center; border-top:1px dashed #ccc; padding-top:8px;">
      Dokumen ini dihasilkan otomatis oleh sistem IP GUARD V3 — PT PLN Indonesia Power UBP Grati. Tanda tangan digital tercatat pada Audit Trail sistem.
    </div>`;
}
/** QR verifikasi approval — berisi teks polos (bisa dibaca scanner biasa, tanpa perlu internet).
    Dibuat client-side pakai library qrcode-generator, tanpa panggilan ke server/API luar.
    Ukuran gambar dipaksa tetap kecil (lihat QR_BOX di buildApprovalTable) apapun kompleksitas datanya. */
function generateApprovalQrTag_(docRef, label, name) {
  try {
    if (typeof qrcode === 'undefined') return '';
    const text = `${docRef} | ${label}: ${name}`; // dipersingkat — makin sedikit data, makin sederhana QR-nya
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const rawTag = qr.createImgTag(1, 0);
    // Paksa ukuran tampil tetap kecil (bukan ikut ukuran alami hasil createImgTag)
    return rawTag.replace(/width="\d+"/, 'width="100%"').replace(/height="\d+"/, 'height="100%"');
  } catch (e) {
    return '';
  }
}

function openPrintDocument(bodyHtml, existingWin) {
  // existingWin: jendela yang sudah dibuka lebih dulu saat klik (hindari pop-up blocker pada proses yang menunggu server)
  const w = existingWin || window.open('', '_blank');
  if (!w) { showToast('Gagal', 'Pop-up diblokir browser. Izinkan pop-up untuk alamat ini, lalu coba lagi.', 'danger'); return; }
  w.document.open();
  w.document.write(`
    <html><head><title>Cetak Dokumen — IP GUARD V3</title>
    <style>
      @page { size: A4; margin: 18mm 16mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; color:#1A2333; font-size:12.5px; }
      table { font-size:11.5px; }
      .print-only-tip { background:#FFF6E0; border:1px solid #FFC107; border-radius:6px; padding:8px 12px; margin-bottom:14px; font-size:11.5px; color:#7A5B00; }
      @media print { .print-only-tip { display:none; } }
    </style></head>
    <body>
      <div class="print-only-tip">💡 Supaya hasil cetak bersih (tanpa tulisan "about:blank" & tanggal di pojok kertas), buka <b>"More settings"</b> di jendela cetak ini lalu matikan centang <b>"Headers and footers"</b>.</div>
      ${bodyHtml}
      <script>window.print();<\/script>
    </body></html>`);
  w.document.close();
}

function cetakSuratBarang(noSurat) {
  google.script.run.withSuccessHandler(res => {
    if (!res.success) { showToast('Gagal', res.message, 'danger'); return; }
    const r = res.data;
    let items = []; try { items = JSON.parse(r.ItemsJSON || '[]'); } catch(e) {}
    const itemRows = items.length
      ? items.map((it,i)=>`<tr>
          <td style="border:1px solid #ccc;padding:5px;text-align:center;">${i+1}</td>
          <td style="border:1px solid #ccc;padding:5px;">${it.namaBarang}</td>
          <td style="border:1px solid #ccc;padding:5px;text-align:center;">${it.jumlah||'-'}</td>
          <td style="border:1px solid #ccc;padding:5px;text-align:center;">${it.satuan||'-'}</td>
          <td style="border:1px solid #ccc;padding:5px;">${it.keterangan||'-'}</td>
          <td style="border:1px solid #ccc;padding:5px;">${it.statusBarang||'Menunggu'}</td>
        </tr>`).join('')
      : `<tr><td colspan="6" style="text-align:center;padding:6px;color:#999;">Tidak ada barang tercatat.</td></tr>`;
    const body = buildLetterheadHTML('suratBarang',
        `No. Surat: ${r.NoSurat} &nbsp;|&nbsp; Tanggal: <b>${fmtTanggalIndo(r.Tanggal)}</b> &nbsp;|&nbsp; Kategori: <b>${r.Kategori}</b>${r.Kategori==='Diserahkan' && r.DiserahkanKepada ? ' kepada '+r.DiserahkanKepada : ''} &nbsp;|&nbsp; Status: <b>${r.Status}</b>`) + `
      <p style="font-size:12px;font-weight:700;margin-bottom:2px;">I. Yang Bertanda Tangan Dibawah Ini</p>
      <table style="width:100%; font-size:12px; margin-bottom:8px;">
        <tr><td style="width:35%; padding:4px 0;">SPS Bidang Pemohon</td><td>: ${r.SPSBidangPemohon}</td></tr>
        <tr><td style="padding:4px 0;">Jabatan</td><td>: ${r.JabatanPemohon || '-'}</td></tr>
      </table>
      <p style="font-size:12px;font-weight:700;margin-bottom:2px;">II. Dilakukan Oleh</p>
      <table style="width:100%; font-size:12px; margin-bottom:8px;">
        <tr><td style="width:35%; padding:4px 0;">Nama</td><td>: ${r.PelaksanaNama || '-'}</td></tr>
        <tr><td style="padding:4px 0;">No. Induk/KTP/SIM</td><td>: ${r.PelaksanaNoInduk || '-'}</td></tr>
        <tr><td style="padding:4px 0;">Jabatan Pekerjaan</td><td>: ${r.PelaksanaJabatan || '-'}</td></tr>
        <tr><td style="padding:4px 0;">Nama Perusahaan</td><td>: ${r.PelaksanaPerusahaan || '-'}</td></tr>
        <tr><td style="padding:4px 0;">No. Telepon Perusahaan</td><td>: ${r.PelaksanaTelepon || '-'}</td></tr>
        <tr><td style="padding:4px 0;">Alamat Perusahaan</td><td>: ${r.PelaksanaAlamat || '-'}</td></tr>
      </table>
      <p style="font-size:12px;font-weight:700;margin-bottom:2px;">III. Data Pengemudi & Kendaraan</p>
      <table style="width:100%; font-size:12px; margin-bottom:10px;">
        <tr><td style="width:35%; padding:4px 0;">Nama Pengemudi</td><td>: ${r.PengemudiNama || '-'}</td></tr>
        <tr><td style="padding:4px 0;">Alamat Rumah</td><td>: ${r.PengemudiAlamatRumah || '-'}</td></tr>
        <tr><td style="padding:4px 0;">Jenis Kendaraan</td><td>: ${r.JenisKendaraan || '-'} &nbsp; Warna: ${r.WarnaKendaraan || '-'}</td></tr>
        <tr><td style="padding:4px 0;">Nomor Polisi</td><td>: ${r.NomorPolisi || '-'}</td></tr>
        <tr><td style="padding:4px 0;">Tujuan</td><td>: ${r.Tujuan || '-'}</td></tr>
      </table>
      <p style="font-size:12px;font-weight:700;margin-bottom:2px;">IV. Daftar Barang Keluar</p>
      <table style="width:100%;border-collapse:collapse;margin-top:4px;">
        <thead><tr>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;">No</th>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;">Nama Barang</th>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;">Jumlah</th>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;">Satuan</th>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;">Keterangan</th>
          <th style="border:1px solid #ccc;padding:5px;background:#eef2f8;">Status Barang</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>` + buildApprovalTable([
        { label: 'Pemohon (SPS Bidang)', name: r.SPSBidangPemohon },
        { label: 'Menyetujui (SPS Keamanan)', name: r.ApprovedBySPS },
        { label: 'Diperiksa Fisik (Danru — TTD & Stempel Basah)', name: r.KonfirmasiOlehDanru }
      ], `Surat Barang Keluar No. ${r.NoSurat}`);
    openPrintDocument(body);
  }).withFailureHandler(e=>showToast('Error',e.message,'danger')).findBarangKeluarByNoSurat(noSurat);
}

// ════════════════════════════════════════════════════════
// MODUL: INCIDENT — Baru → Ditindaklanjuti → Selesai (hasil diskusi lanjutan)
// ════════════════════════════════════════════════════════
const KATEGORI_INCIDENT = ['Keamanan', 'K3', 'Darurat', 'Operasional', 'Gangguan Masyarakat'];
const TINGKAT_RISIKO_LIST = ['Rendah', 'Sedang', 'Tinggi'];
const RISIKO_PILL = { 'Rendah': 'pill-success', 'Sedang': 'pill-warning', 'Tinggi': 'pill-danger' };

function loadIncidentDashboardDetail() {
  google.script.run.withSuccessHandler(res => {
    const wrap = document.getElementById('incidentDashboardWrap');
    if (!res.success) { wrap.innerHTML = `<div class="text-danger small">${res.message}</div>`; return; }
    const d = res.data;
    const naik = d.selisih > 0;
    const selisihColor = naik ? '#E53935' : '#00913E';
    const selisihIcon = naik ? 'bi-arrow-up-short' : 'bi-arrow-down-short';

    let html = `<div class="row g-3 mb-3">
      <div class="col-6 col-lg-3"><div class="stat-card" style="background:var(--tint-blue);border-color:transparent;">
        <div class="stat-icon" style="background:#0C7A94;"><i class="bi bi-clipboard-data"></i></div>
        <div><div class="stat-value">${d.totalBulanIni}</div><div class="stat-label">Total Insiden Bulan Ini</div>
          <div style="font-size:.7rem;color:${selisihColor};font-weight:700;"><i class="bi ${selisihIcon}"></i> ${Math.abs(d.selisih)} vs bulan lalu</div>
        </div>
      </div></div>
      <div class="col-6 col-lg-3"><div class="stat-card" style="background:var(--tint-red);border-color:transparent;">
        <div class="stat-icon" style="background:#E53935;"><i class="bi bi-exclamation-circle"></i></div>
        <div><div class="stat-value">${d.baruCount}</div><div class="stat-label">Baru (Belum Ditangani)</div>
          <div style="font-size:.7rem;visibility:hidden;">placeholder</div>
        </div>
      </div></div>
      <div class="col-6 col-lg-3"><div class="stat-card" style="background:var(--tint-yellow);border-color:transparent;">
        <div class="stat-icon" style="background:#FFC107;"><i class="bi bi-hourglass-split"></i></div>
        <div><div class="stat-value">${d.ditindaklanjutiCount}</div><div class="stat-label">Ditindaklanjuti</div>
          <div style="font-size:.7rem;visibility:hidden;">placeholder</div>
        </div>
      </div></div>
      <div class="col-6 col-lg-3"><div class="stat-card" style="background:var(--tint-green);border-color:transparent;">
        <div class="stat-icon" style="background:#00913E;"><i class="bi bi-check2-circle"></i></div>
        <div><div class="stat-value">${d.selesaiBulanIni}</div><div class="stat-label">Selesai Bulan Ini</div>
          <div style="font-size:.7rem;visibility:hidden;">placeholder</div>
        </div>
      </div></div>
    </div>`;

    if (d.risikoTinggiAktif > 0) {
      html += `<div class="card-ip mb-3" style="background:#FDE8E8;border:1px solid #E53935;">
        <div style="font-size:.85rem;color:#B71C1C;font-weight:700;"><i class="bi bi-exclamation-triangle-fill"></i> Ada ${d.risikoTinggiAktif} insiden Risiko Tinggi yang belum selesai — perlu perhatian segera.</div>
      </div>`;
    }

    const kategoriRows = Object.entries(d.kategoriCounts).map(([k,v]) => `
      <div class="d-flex align-items-center gap-2 mb-2">
        <div style="width:140px;font-size:.78rem;color:var(--text-dark);">${k}</div>
        <div style="flex:1;height:10px;background:#EEF2F8;border-radius:5px;overflow:hidden;">
          <div style="height:100%;width:${Math.round(v/d.maxKategori*100)}%;background:#0C7A94;"></div>
        </div>
        <div style="width:24px;text-align:right;font-size:.78rem;font-weight:700;">${v}</div>
      </div>`).join('');
    html += `<div class="card-ip mb-3">
      <h6 class="mb-2"><i class="bi bi-bar-chart-line"></i> Kategori Insiden Bulan Ini</h6>
      ${kategoriRows}
    </div>`;

    wrap.innerHTML = html;
  }).withFailureHandler(e => { document.getElementById('incidentDashboardWrap').innerHTML = `<div class="text-danger small">${e.message}</div>`; }).getIncidentDashboardDetail();
}
let incAllRows = [];
function loadIncident() {
  const c = document.getElementById('app-container');
  c.innerHTML = sectionHeader('Incident & Gangguan Keamanan', 'Sumber otomatis: Mutasi Jaga (Section D & B) & Kendaraan. Ditutup oleh TL Keamanan/SPS Keamanan.')
    + `<div class="mb-3 d-flex justify-content-end gap-2 flex-wrap">
         <button class="btn btn-outline-ip" onclick="openUnduhLaporanModal('incident')"><i class="bi bi-file-earmark-arrow-down"></i> Unduh Laporan</button>
         <button class="btn btn-primary-ip" onclick="openIncidentForm()"><i class="bi bi-plus-lg"></i> Lapor Incident Manual</button>
       </div>
       <div id="incidentDashboardWrap"><div class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm"></span> Memuat dashboard...</div></div>
       <div class="mb-3"><input type="text" class="form-control" id="incSearchInput" placeholder="Cari No. Insiden, lokasi, kategori, uraian, atau pelapor..." oninput="renderIncidentTable()"></div>
       <div id="tblIncident"></div>`;
  loadIncidentDashboardDetail();
  google.script.run.withSuccessHandler(res => {
    incAllRows = res.data || [];
    renderIncidentTable();
  }).getAllData('INCIDENT');
}
function renderIncidentTable() {
  const q = (val('incSearchInput') || '').toLowerCase();
  const rows = incAllRows.filter(r => {
    if (!q) return true;
    const hay = `${r.NoInsiden||''} ${r.Lokasi||''} ${r.Kategori||''} ${r.UraianKejadian||''} ${r.Pelapor||''}`.toLowerCase();
    return hay.includes(q);
  });
  renderGenericTable('tblIncident',
    [ {label:'ID Incident', key:'NoInsiden'}, {label:'Tanggal/Jam', render:r=>fmtDate(r.TanggalJam)}, {label:'Lokasi', key:'Lokasi'},
      {label:'Kategori', key:'Kategori'}, {label:'Uraian Kejadian', key:'UraianKejadian'}, {label:'Pelapor', key:'Pelapor'},
      {label:'Regu', key:'Regu'}, {label:'Shift', key:'Shift'},
      {label:'Risiko', render:r=>`<span class="pill ${RISIKO_PILL[r.TingkatRisiko]||'pill-neutral'}">${r.TingkatRisiko}</span>`},
      {label:'Foto Sebelum', render:r=> r.FotoUrl ? `<a href="${r.FotoUrl}" target="_blank" class="pill pill-info"><i class="bi bi-camera-fill"></i> Lihat</a>` : '-'},
      {label:'Foto Sesudah', render:r=> r.FotoSesudahUrl ? `<a href="${r.FotoSesudahUrl}" target="_blank" class="pill pill-info"><i class="bi bi-camera-fill"></i> Lihat</a>` : '-'},
      {label:'Tindak Lanjut', render:r=>r.TindakLanjut||'-'}, {label:'PIC Tindak Lanjut', render:r=>r.PICTindakLanjut||'-'},
      {label:'Status', render:r=>statusPill(r.Status)} ],
    rows.sort((a,b)=> new Date(b.TanggalJam)-new Date(a.TanggalJam)),
    row => incidentActions(row)
  );
}
function incidentActions(row) {
  let btns = `<button class="btn btn-outline-ip btn-sm-ip" title="Cetak BA" onclick="cetakBAIncident('${row.ID}')"><i class="bi bi-printer"></i></button> `;
  if (row.Status === 'Baru' && ['TL_KEAMANAN','SPS_KEAMANAN','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-primary-ip btn-sm-ip" title="Ditindak Lanjuti" onclick="openAmbilAlihIncidentModal('${row.ID}')"><i class="bi bi-hand-index-thumb"></i></button> `;
  if (row.Status === 'Ditindaklanjuti' && ['TL_KEAMANAN','SPS_KEAMANAN','ADMIN'].includes(AppState.user.Role))
    btns += `<button class="btn btn-outline-ip btn-sm-ip" title="Tutup Kasus" onclick="openTutupKasusModal('${row.ID}')"><i class="bi bi-check2-circle"></i></button>`;
  return btns || '-';
}
let incFotoSesudahUrl = '';
function openTutupKasusModal(id) {
  incFotoSesudahUrl = '';
  openFormModal('Tutup Kasus Incident', `
    <form onsubmit="return submitTutupKasus(event, '${id}')">
      <label class="form-label">Foto Sesudah (opsional)</label>
      <input type="file" accept="image/png, image/jpeg, image/webp" class="form-control mb-1" id="incFotoSesudahInput" onchange="handleFotoSesudahUpload(event)">
      <div class="small text-muted mb-3" id="incFotoSesudahStatus"></div>
      <button type="submit" class="btn btn-primary-ip w-100"><i class="bi bi-check2-circle"></i> Tutup Kasus</button>
    </form>`);
}
async function handleFotoSesudahUpload(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('incFotoSesudahStatus');
  statusEl.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Mengompres & mengunggah...';
  try {
    const compressed = await compressImageFile_(file);
    const res = await gsRun('uploadFotoIncident', compressed.base64, compressed.fileName, compressed.mimeType);
    if (!res.success) throw new Error(res.message);
    incFotoSesudahUrl = res.data.directUrl;
    statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> Foto siap';
  } catch (err) {
    statusEl.innerHTML = `<span class="text-danger">${err.message}</span>`;
  }
}
function submitTutupKasus(evt, id) {
  evt.preventDefault();
  closeFormModal();
  callServer('closeIncident', [id, AppState.user.Nama, incFotoSesudahUrl], 'Incident ditutup', loadIncident, 'Menyimpan...');
  return false;
}
function cetakBAIncident(id) {
  google.script.run.withSuccessHandler(res => {
    if (!res.success) { showToast('Gagal', res.message, 'danger'); return; }
    const r = (res.data || []).find(x => x.ID === id);
    if (!r) { showToast('Gagal', 'Data tidak ditemukan.', 'danger'); return; }
    const fotoRow = (r.FotoUrl || r.FotoSesudahUrl) ? `
      <div class="row" style="display:flex;gap:12px;margin-top:8px;">
        ${r.FotoUrl ? `<div style="flex:1;"><div style="font-size:11px;font-weight:700;margin-bottom:4px;">Foto Sebelum</div><img src="${r.FotoUrl}" style="width:100%;border-radius:6px;border:1px solid #ccc;"></div>` : ''}
        ${r.FotoSesudahUrl ? `<div style="flex:1;"><div style="font-size:11px;font-weight:700;margin-bottom:4px;">Foto Sesudah</div><img src="${r.FotoSesudahUrl}" style="width:100%;border-radius:6px;border:1px solid #ccc;"></div>` : ''}
      </div>` : '';
    const body = buildLetterheadHTML('baIncident',
        `No. Insiden: ${r.NoInsiden} &nbsp;|&nbsp; ${r.Lokasi} &nbsp;|&nbsp; Kategori: <b>${r.Kategori}</b> &nbsp;|&nbsp; Risiko: <b>${r.TingkatRisiko}</b> &nbsp;|&nbsp; Status: <b>${r.Status}</b>`) + `
      <table style="width:100%; font-size:12px; margin-bottom:8px;">
        <tr><td style="width:35%; padding:4px 0;">Tanggal/Jam</td><td>: ${fmtDate(r.TanggalJam)}</td></tr>
        <tr><td style="padding:4px 0;">Pelapor</td><td>: ${r.Pelapor}</td></tr>
        <tr><td style="padding:4px 0;">Regu/Shift</td><td>: ${r.Regu || '-'} / ${r.Shift || '-'}</td></tr>
        <tr><td style="padding:4px 0;">Asal Sumber</td><td>: ${r.AsalSumber || '-'}</td></tr>
      </table>
      <p style="font-size:12px;font-weight:700;margin-bottom:2px;">Uraian Kejadian</p>
      <p style="font-size:12px;margin-bottom:8px;">${r.UraianKejadian || '-'}</p>
      <p style="font-size:12px;font-weight:700;margin-bottom:2px;">Tindak Lanjut</p>
      <p style="font-size:12px;margin-bottom:8px;">${r.TindakLanjut || '-'} ${r.PICTindakLanjut ? '(PIC: '+r.PICTindakLanjut+')' : ''}</p>
      ${fotoRow}` + buildApprovalTable([
        { label: 'Pelapor', name: r.Pelapor },
        { label: 'PIC Tindak Lanjut', name: r.PICTindakLanjut },
        { label: 'Menutup Kasus', name: r.VerifikasiOleh }
      ], `Incident No. ${r.NoInsiden}`);
    openPrintDocument(body);
  }).withFailureHandler(e=>showToast('Error',e.message,'danger')).getAllData('INCIDENT');
}
function openAmbilAlihIncidentModal(id) {
  openFormModal('Ditindak Lanjuti — Tindak Lanjut Incident', `
    <form onsubmit="return submitAmbilAlihIncident(event, '${id}')">
      <label class="form-label">PIC Tindak Lanjut</label>
      <input type="text" class="form-control mb-2" id="incPICTindakLanjut" list="personelNamaOptions" placeholder="Nama penanggung jawab tindak lanjut (bisa dari bidang lain)" required>
      <label class="form-label">Tindak Lanjut</label>
      <textarea class="form-control" id="incTindakLanjut" rows="3" placeholder="Uraikan langkah tindak lanjut yang dilakukan" required></textarea>
      <button type="submit" class="btn btn-primary-ip w-100 mt-3">Ditindak Lanjuti</button>
    </form>`);
}
function submitAmbilAlihIncident(evt, id) {
  evt.preventDefault();
  const catatan = val('incTindakLanjut');
  const pic = val('incPICTindakLanjut');
  closeFormModal();
  callServer('ambilAlihIncident', [id, AppState.user.Nama, catatan, pic], 'Kasus diambil alih.', loadIncident, 'Menyimpan...');
  return false;
}
let incFotoUrl = '';
function handleFotoIncidentUpload(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('incFotoStatus');
  statusEl.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Mengompres & mengunggah...';
  compressImageFile_(file).then(function (compressed) {
    google.script.run.withSuccessHandler(res => {
      if (res.success) {
        incFotoUrl = res.data.url;
        statusEl.innerHTML = `<a href="${res.data.url}" target="_blank"><i class="bi bi-check-circle text-success"></i> Foto terlampir</a>`;
      } else {
        statusEl.innerHTML = `<span class="text-danger">${res.message}</span>`;
      }
    }).withFailureHandler(e => { statusEl.innerHTML = `<span class="text-danger">${e.message}</span>`; })
      .uploadFotoIncident(compressed.base64, compressed.fileName, compressed.mimeType);
  }).catch(function (err) {
    statusEl.innerHTML = `<span class="text-danger">${err.message}</span>`;
  });
}
function openIncidentForm() {
  incFotoUrl = ''; // reset - hindari foto submit sebelumnya kebawa ke laporan baru
  openFormModal('Lapor Incident Manual', `
    <form onsubmit="return submitIncidentForm(event)">
      <div class="row g-2">
        <div class="col-6"><label class="form-label">Lokasi</label><input type="text" class="form-control" id="incLokasi" placeholder="misal: Area Parkir Belakang" required></div>
        <div class="col-6"><label class="form-label">Kategori</label><select class="form-select" id="incKategori" required>${selectOptions(KATEGORI_INCIDENT)}</select></div>
        <div class="col-6"><label class="form-label">Regu</label><select class="form-select" id="incRegu">${selectOptions(OPT_REGU)}</select></div>
        <div class="col-6"><label class="form-label">Shift</label><select class="form-select" id="incShift">${selectOptions(OPT_SHIFT, ipgShiftNow())}</select></div>
        <div class="col-6"><label class="form-label">Tingkat Risiko</label><select class="form-select" id="incRisiko" required>${selectOptions(TINGKAT_RISIKO_LIST, 'Sedang')}</select></div>
        <div class="col-6"><label class="form-label">Pelapor</label><input type="text" class="form-control" id="incPelapor" list="personelNamaOptions" value="${AppState.user.Nama}" required></div>
        <div class="col-12"><label class="form-label">Uraian Kejadian</label><textarea class="form-control" id="incUraian" rows="3" required></textarea></div>
        <div class="col-12"><label class="form-label">Foto Sebelum (opsional)</label>
          <input type="file" accept="image/png, image/jpeg, image/gif, image/webp" class="form-control" id="incFotoInput" onchange="handleFotoIncidentUpload(event)">
          <div class="small text-muted" id="incFotoStatus"></div>
        </div>
      </div>
      <button type="submit" class="btn btn-primary-ip w-100 mt-3">Kirim Laporan</button>
    </form>`);
}
function submitIncidentForm(evt) {
  evt.preventDefault();
  const payload = { lokasi: val('incLokasi'), kategori: val('incKategori'), regu: val('incRegu'), shift: val('incShift'),
    tingkatRisiko: val('incRisiko'), pelapor: val('incPelapor'), uraianKejadian: val('incUraian'),
    fotoUrl: incFotoUrl, createdBy: AppState.user.Nama };
  closeFormModal();
  callServer('createIncidentManual', [payload], null, loadIncident, 'Menyimpan laporan...');
  return false;
}


// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// MODUL: DATA PERSONEL SECURITY / KTA MONITORING — digabung Master Data Personel (hasil diskusi lanjutan)
// ════════════════════════════════════════════════════════
const JENIS_KTA_LIST = ['Gada Utama', 'Gada Madya', 'Gada Pratama'];
const KTA_SISA_PILL = { aman: 'pill-success', segera: 'pill-warning', lewat: 'pill-danger' };
let ktaAllRows = [];
let ktaFormOpenFor = null; // null = tertutup, 'new' = tambah baru, id = edit
let ktaFotoUrl = '';

function loadKta() {
  const c = document.getElementById('app-container');
  c.innerHTML = sectionHeader('KTA Monitoring', 'Reminder otomatis harian 07:00 WIB dikirim ke Admin untuk KTA ≤90 hari.')
    + `<div class="mb-3 d-flex justify-content-end">
         <button class="btn btn-primary-ip" onclick="toggleKtaForm('new')"><i class="bi bi-plus-lg"></i> Input Data KTA</button>
       </div>
       <div id="ktaDashboardWrap" class="row g-3 mb-3"></div>
       <div id="ktaFormWrap" class="card-ip mb-3" style="display:none;"></div>
       <div class="mb-3"><input type="text" class="form-control" id="ktaSearchInput" placeholder="Cari nama, No. KTA, atau Regu..." oninput="renderKtaTable()"></div>
       <div id="tblKta"></div>`;
  google.script.run.withSuccessHandler(res => {
    ktaAllRows = res.data || [];
    renderKtaDashboard();
    renderKtaTable();
  }).getAllData('KTA');
}
function renderKtaDashboard() {
  const total = ktaAllRows.length;
  const aktif = ktaAllRows.filter(r => r.Status === 'Aktif').length;
  const expired = ktaAllRows.filter(r => r.Status === 'Expired').length;
  const akanKedaluwarsa = ktaAllRows.filter(r => {
    const s = sisaHariInfo(r.MasaBerlaku);
    return s.hari !== null && s.hari >= 0 && s.hari <= 90;
  }).length;
  const cards = [
    { icon: 'bi-person-vcard', bg: 'var(--tint-blue)', color: '#0C7A94', value: total, label: 'Total Personel' },
    { icon: 'bi-check2-circle', bg: 'var(--tint-green)', color: '#00913E', value: aktif, label: 'Status Aktif' },
    { icon: 'bi-x-circle', bg: 'var(--tint-red)', color: '#E53935', value: expired, label: 'Status Expired' },
    { icon: 'bi-hourglass-split', bg: 'var(--tint-yellow)', color: '#FFC107', value: akanKedaluwarsa, label: 'Akan Kedaluwarsa (\u226490 hari)' }
  ];
  document.getElementById('ktaDashboardWrap').innerHTML = cards.map(c => `
    <div class="col-6 col-lg-3"><div class="stat-card" style="background:${c.bg};border-color:transparent;">
      <div class="stat-icon" style="background:${c.color};"><i class="bi ${c.icon}"></i></div>
      <div><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>
    </div></div>`).join('');
}
function sisaHariInfo(masaBerlaku) {
  if (!masaBerlaku) return { hari: null, pill: 'pill-neutral', teks: '-' };
  const exp = new Date(masaBerlaku);
  if (isNaN(exp)) return { hari: null, pill: 'pill-neutral', teks: '-' };
  const today = new Date(); today.setHours(0,0,0,0);
  exp.setHours(0,0,0,0);
  const hari = Math.floor((exp - today) / 86400000);
  if (hari < 0) return { hari, pill: KTA_SISA_PILL.lewat, teks: `Lewat ${Math.abs(hari)} hari` };
  if (hari <= 90) return { hari, pill: KTA_SISA_PILL.segera, teks: `${hari} hari lagi` };
  return { hari, pill: KTA_SISA_PILL.aman, teks: `${hari} hari` };
}
function renderKtaTable() {
  const q = (document.getElementById('ktaSearchInput') ? val('ktaSearchInput') : '').toLowerCase();
  const rows = [...ktaAllRows].map(r => Object.assign({}, r, { _sisa: sisaHariInfo(r.MasaBerlaku) }))
    .filter(r => !q || `${r.Nama||''} ${r.NoKTA||''} ${r.Regu||''}`.toLowerCase().includes(q))
    .sort((a,b)=> (a._sisa.hari ?? 999999) - (b._sisa.hari ?? 999999));
  renderGenericTable('tblKta',
    [ {label:'Nama', key:'Nama'}, {label:'Regu', key:'Regu'}, {label:'No. KTA', render:r=>r.NoKTA||'-'}, {label:'Jenis KTA', render:r=>r.JenisKTA||'-'},
      {label:'Masa Berlaku', render:r=>(r.MasaBerlaku||'-').toString().slice(0,10)},
      {label:'Sisa Hari', render:r=>`<span class="pill ${r._sisa.pill}">${r._sisa.teks}</span>`},
      {label:'Foto', render:r=> r.FotoUrl ? `<a href="${r.FotoUrl}" target="_blank" class="pill pill-info"><i class="bi bi-camera-fill"></i> Lihat</a>` : '-'},
      {label:'Status', render:r=>`<span class="pill ${r.Status==='Aktif'?'pill-success':'pill-neutral'}">${r.Status||'-'}</span>`} ],
    rows,
    row => `<button class="btn btn-outline-ip btn-sm-ip" onclick="toggleKtaForm('${row.ID}')"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-outline-ip btn-sm-ip" onclick="openConfirmModal('Hapus data KTA ini?', ()=>callServer('deleteRecord',['KTA','${row.ID}'],'Data dihapus.',loadKta))"><i class="bi bi-trash"></i></button>`
  );
}
function handleFotoKtaUpload(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('ktaFotoStatus');
  statusEl.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Mengompres & mengunggah...';
  compressImageFile_(file).then(function (compressed) {
    google.script.run.withSuccessHandler(res => {
      if (res.success) {
        ktaFotoUrl = res.data.url;
        statusEl.innerHTML = `<a href="${res.data.url}" target="_blank"><i class="bi bi-check-circle text-success"></i> Foto terlampir</a>`;
      } else {
        statusEl.innerHTML = `<span class="text-danger">${res.message}</span>`;
      }
    }).withFailureHandler(e => { statusEl.innerHTML = `<span class="text-danger">${e.message}</span>`; })
      .uploadFotoKta(compressed.base64, compressed.fileName, compressed.mimeType);
  }).catch(function (err) {
    statusEl.innerHTML = `<span class="text-danger">${err.message}</span>`;
  });
}
function toggleKtaForm(target) {
  const wrap = document.getElementById('ktaFormWrap');
  if (ktaFormOpenFor === target) { ktaFormOpenFor = null; wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  ktaFormOpenFor = target;
  const editRow = target !== 'new' ? ktaAllRows.find(r => r.ID === target) : null;
  const v = k => editRow ? (editRow[k] ?? '') : '';
  ktaFotoUrl = editRow ? (editRow.FotoUrl || '') : ''; // reset/isi ulang sesuai baris yang diedit
  wrap.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="mb-0">${editRow ? 'Edit Data KTA' : 'Input Data KTA'}</h6>
      <button type="button" class="btn-close" onclick="toggleKtaForm('${target}')"></button>
    </div>
    <form onsubmit="return submitKtaForm(event, ${editRow ? `'${target}'` : 'null'})">
      <div class="row g-2">
        <div class="col-6"><label class="form-label">Nama</label><input type="text" class="form-control" id="ktaNama" list="personelNamaOptions" required value="${v('Nama')}"></div>
        <div class="col-6"><label class="form-label">Regu</label><select class="form-select" id="ktaRegu">${selectOptions(OPT_REGU, v('Regu'))}</select></div>
        <div class="col-6"><label class="form-label">NIK</label><input type="text" class="form-control" id="ktaNik" value="${v('NIK')}"></div>
        <div class="col-6"><label class="form-label">NIP</label><input type="text" class="form-control" id="ktaNip" value="${v('NIP')}"></div>
        <div class="col-6"><label class="form-label">Jenis Kelamin</label><select class="form-select" id="ktaJenisKelamin">
          <option ${v('JenisKelamin')==='Laki-laki'?'selected':''}>Laki-laki</option><option ${v('JenisKelamin')==='Perempuan'?'selected':''}>Perempuan</option></select></div>
        <div class="col-6"><label class="form-label">Alamat Perusahaan</label><input type="text" class="form-control" id="ktaAlamatPerusahaan" value="${v('AlamatPerusahaan')}"></div>
        <div class="col-6"><label class="form-label">No. HP</label><input type="text" class="form-control" id="ktaHp" value="${v('NoHP')}"></div>
        <div class="col-6"><label class="form-label">Email</label><input type="email" class="form-control" id="ktaEmail" value="${v('Email')}"></div>
        <div class="col-6"><label class="form-label">No. Registrasi KTA</label><input type="text" class="form-control" id="ktaNoRegistrasi" value="${v('NoRegistrasiKTA')}"></div>
        <div class="col-6"><label class="form-label">No. KTA</label><input type="text" class="form-control" id="ktaNoKta" required value="${v('NoKTA')}"></div>
        <div class="col-6"><label class="form-label">Jenis KTA</label><select class="form-select" id="ktaJenisKta">${selectOptions(JENIS_KTA_LIST, v('JenisKTA'))}</select></div>
        <div class="col-6"><label class="form-label">Status</label><select class="form-select" id="ktaStatus">${selectOptions(['Aktif','Expired'], v('Status') || 'Aktif')}</select></div>
        <div class="col-6"><label class="form-label">Tanggal Terbit</label><input type="date" class="form-control" id="ktaTglTerbit" value="${(v('TanggalTerbit')||'').toString().slice(0,10)}"></div>
        <div class="col-6"><label class="form-label">Masa Berlaku</label><input type="date" class="form-control" id="ktaMasaBerlaku" required value="${(v('MasaBerlaku')||'').toString().slice(0,10)}"></div>
        <div class="col-12"><label class="form-label">Foto KTA (opsional)</label>
          <input type="file" accept="image/png, image/jpeg, image/gif, image/webp" class="form-control" id="ktaFotoInput" onchange="handleFotoKtaUpload(event)">
          <div class="small text-muted" id="ktaFotoStatus">${editRow && editRow.FotoUrl ? `<a href="${editRow.FotoUrl}" target="_blank"><i class="bi bi-check-circle text-success"></i> Foto tersimpan</a>` : ''}</div>
        </div>
      </div>
      <div class="d-flex gap-2 mt-3">
        <button type="button" class="btn btn-outline-ip" onclick="toggleKtaForm('${target}')">Batal</button>
        <button type="submit" class="btn btn-primary-ip flex-grow-1">Simpan</button>
      </div>
    </form>`;
  wrap.style.display = 'block';
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function submitKtaForm(evt, editId) {
  evt.preventDefault();
  const payload = {
    Nama: val('ktaNama'), Regu: val('ktaRegu'), NIK: val('ktaNik'), NIP: val('ktaNip'), JenisKelamin: val('ktaJenisKelamin'),
    AlamatPerusahaan: val('ktaAlamatPerusahaan'), NoHP: val('ktaHp'), Email: val('ktaEmail'),
    NoRegistrasiKTA: val('ktaNoRegistrasi'), NoKTA: val('ktaNoKta'), JenisKTA: val('ktaJenisKta'), Status: val('ktaStatus'),
    TanggalTerbit: val('ktaTglTerbit'), MasaBerlaku: val('ktaMasaBerlaku'), FotoUrl: ktaFotoUrl
  };
  ktaFormOpenFor = null;
  document.getElementById('ktaFormWrap').style.display = 'none';
  if (editId) {
    payload.ID = editId;
    callServer('updateRecord', ['KTA', payload], 'Data KTA diperbarui.', loadKta, 'Menyimpan...');
  } else {
    callServer('addRecord', ['KTA', payload], 'Data KTA tersimpan.', loadKta, 'Menyimpan...');
  }
  return false;
}


// ════════════════════════════════════════════════════════
// MODUL: PETA KEAMANAN (statis — PRD v3.2, tidak terhubung Incident/Patroli)
// ════════════════════════════════════════════════════════
function loadPetaKeamanan() {
  document.getElementById('app-container').innerHTML = sectionHeader('Peta Keamanan', 'Denah/peta lokasi yang diunggah Admin, TL Keamanan, atau SPS Keamanan.')
    + `<div class="card-ip">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h6 class="mb-0"><i class="bi bi-map"></i> Peta Keamanan</h6>
          ${canManageContent() ? '<button class="btn btn-primary-ip btn-sm-ip" onclick="openPetaStatisForm()"><i class="bi bi-plus-lg"></i> Upload Peta</button>' : ''}
        </div>
        <div id="petaStatisListWrap" class="row g-3"><div class="text-muted small">Memuat...</div></div>
      </div>`;
  loadPetaStatisList();
}
let petaStatisAllRows = [];
function loadPetaStatisList() {
  google.script.run.withSuccessHandler(res => {
    petaStatisAllRows = res.data || [];
    renderPetaStatisList();
  }).getAllData('PETA_KEAMANAN_DOCS');
}
function renderPetaStatisList() {
  const wrap = document.getElementById('petaStatisListWrap');
  if (!petaStatisAllRows.length) { wrap.innerHTML = '<div class="text-muted small">Belum ada peta statis yang diunggah.</div>'; return; }
  wrap.innerHTML = petaStatisAllRows.map(r => `
    <div class="col-md-6 col-lg-4"><div class="card-ip">
      ${r.ThumbnailUrl
        ? `<img src="${r.ThumbnailUrl}" style="width:100%;height:160px;object-fit:cover;border-radius:var(--radius-md);margin-bottom:.5rem;">`
        : `<div style="width:100%;height:160px;background:var(--app-bg);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;margin-bottom:.5rem;"><i class="bi bi-file-earmark-pdf" style="font-size:2.5rem;color:#E53935;"></i></div>`}
      <div class="d-flex justify-content-between align-items-start mb-1">
        <div class="fw-bold small">${r.NamaPeta}</div>
        <span class="pill ${r.Status==='Non-Aktif'?'pill-neutral':'pill-success'}">${r.Status||'Aktif'}</span>
      </div>
      <div class="text-muted small mb-2">${r.FileType==='pdf'?'PDF':'Gambar'} &middot; oleh ${r.UploadedBy} &middot; ${fmtDate(r.Tanggal)}</div>
      <div class="d-flex gap-1 flex-wrap">
        <a href="${r.FileUrl}" target="_blank" class="btn btn-primary-ip btn-sm-ip flex-grow-1"><i class="bi bi-eye"></i> Lihat</a>
        <a href="${r.DownloadUrl||r.FileUrl}" target="_blank" class="btn btn-outline-ip btn-sm-ip"><i class="bi bi-download"></i></a>
        ${canManageContent() ? `<button class="btn btn-outline-ip btn-sm-ip" onclick="openPetaStatisForm('${r.ID}')"><i class="bi bi-pencil"></i></button>` : ''}
        ${canManageContent() ? `<button class="btn btn-outline-ip btn-sm-ip" onclick="togglePetaStatus('${r.ID}','${r.Status||'Aktif'}')"><i class="bi ${r.Status==='Non-Aktif'?'bi-eye':'bi-eye-slash'}"></i></button>` : ''}
      </div>
    </div></div>`).join('');
}
function togglePetaStatus(id, currentStatus) {
  const newStatus = currentStatus === 'Aktif' ? 'Non-Aktif' : 'Aktif';
  const row = petaStatisAllRows.find(r => r.ID === id);
  if (!row) return;
  const prevStatus = row.Status; // simpan buat rollback kalau server gagal
  row.Status = newStatus;
  renderPetaStatisList(); // update layar instan, tidak nunggu server
  google.script.run
    .withSuccessHandler(res => {
      if (!res.success) { row.Status = prevStatus; renderPetaStatisList(); showToast('Gagal', res.message, 'danger'); }
    })
    .withFailureHandler(err => { row.Status = prevStatus; renderPetaStatisList(); showToast('Error', err.message, 'danger'); })
    .updateFieldById('PETA_KEAMANAN_DOCS', id, { Status: newStatus });
}
let petaStatisFileUrl = '', petaStatisDownloadUrl = '', petaStatisThumbUrl = '', petaStatisFileType = '';
function openPetaStatisForm(editId) {
  const editRow = editId ? petaStatisAllRows.find(r => r.ID === editId) : null;
  petaStatisFileUrl = editRow ? editRow.FileUrl : '';
  petaStatisDownloadUrl = editRow ? editRow.DownloadUrl : '';
  petaStatisThumbUrl = editRow ? editRow.ThumbnailUrl : '';
  petaStatisFileType = editRow ? editRow.FileType : '';
  const v = k => editRow ? (editRow[k] ?? '') : '';
  openFormModal(editRow ? 'Edit Peta Statis' : 'Upload Peta Statis', `
    <form onsubmit="return submitPetaStatisForm(event, ${editRow ? `'${editId}'` : 'null'})">
      <div class="mb-2"><label class="form-label">Nama Peta</label><input type="text" class="form-control" id="psNama" placeholder="misal: Denah Lantai 1, Peta Area B" required value="${v('NamaPeta')}"></div>
      <div class="mb-2"><label class="form-label">Status</label><select class="form-select" id="psStatus">${selectOptions(['Aktif','Non-Aktif'], v('Status') || 'Aktif')}</select></div>
      <div class="mb-2"><label class="form-label">File Peta (gambar atau PDF) ${editRow ? '(opsional, kosongkan jika tidak diganti)' : ''}</label>
        <input type="file" accept="image/png, image/jpeg, image/webp, application/pdf" class="form-control" id="psFileInput" onchange="handlePetaStatisUpload(event)" ${editRow?'':'required'}>
        <div class="small text-muted mt-1" id="psFileStatus">${editRow && editRow.FileUrl ? `<a href="${editRow.FileUrl}" target="_blank"><i class="bi bi-check-circle text-success"></i> File saat ini tersimpan</a>` : ''}</div>
      </div>
      <button type="submit" class="btn btn-primary-ip w-100 mt-3" id="psSubmitBtn" ${editRow?'':'disabled'}>Simpan</button>
    </form>`);
}
async function handlePetaStatisUpload(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('psFileStatus');
  const submitBtn = document.getElementById('psSubmitBtn');
  submitBtn.disabled = true;
  statusEl.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Memproses...';
  try {
    if (file.type === 'application/pdf') {
      petaStatisFileType = 'pdf';
      let thumbBase64 = null;
      try {
        // pdf.js dimuat async, tunggu sebentar kalau belum siap (maks ~3 detik)
        let waited = 0;
        while (!ensurePdfJsReady_() && waited < 3000) { await new Promise(r => setTimeout(r, 100)); waited += 100; }
        if (!ensurePdfJsReady_()) throw new Error('Komponen PDF belum siap.');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        thumbBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
      } catch (thumbErr) {
        thumbBase64 = null; // thumbnail gagal dibuat — lanjut tanpa thumbnail, tampil ikon PDF generik
      }
      petaStatisThumbUrl = '';
      if (thumbBase64) {
        const thumbRes = await gsRun('uploadPetaKeamanan', thumbBase64, file.name.replace(/\.pdf$/i, '') + '_thumb.jpg', 'image/jpeg');
        if (thumbRes.success) petaStatisThumbUrl = thumbRes.data.directUrl;
      }
      const pdfBase64 = (await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      })).split(',')[1];
      const fileRes = await gsRun('uploadPetaKeamanan', pdfBase64, file.name, file.type);
      if (!fileRes.success) throw new Error(fileRes.message);
      petaStatisFileUrl = fileRes.data.url;
      petaStatisDownloadUrl = fileRes.data.downloadUrl;
      statusEl.innerHTML = petaStatisThumbUrl
        ? '<i class="bi bi-check-circle text-success"></i> File PDF & thumbnail siap'
        : '<i class="bi bi-check-circle text-success"></i> File PDF tersimpan (thumbnail tidak bisa dibuat, akan tampil ikon PDF)';
    } else {
      petaStatisFileType = 'image';
      const compressed = await compressImageFile_(file);
      const fileRes = await gsRun('uploadPetaKeamanan', compressed.base64, compressed.fileName, compressed.mimeType);
      if (!fileRes.success) throw new Error(fileRes.message);
      petaStatisFileUrl = fileRes.data.url;
      petaStatisDownloadUrl = fileRes.data.downloadUrl;
      petaStatisThumbUrl = fileRes.data.directUrl;
      statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> Gambar siap';
    }
    submitBtn.disabled = false;
  } catch (err) {
    statusEl.innerHTML = `<span class="text-danger">${err.message}</span>`;
  }
}
function submitPetaStatisForm(evt, editId) {
  evt.preventDefault();
  const payload = { NamaPeta: val('psNama'), Status: val('psStatus'), FileUrl: petaStatisFileUrl, DownloadUrl: petaStatisDownloadUrl, ThumbnailUrl: petaStatisThumbUrl, FileType: petaStatisFileType, UploadedBy: AppState.user.Nama, Tanggal: new Date().toISOString() };
  closeFormModal();
  if (editId) {
    payload.ID = editId;
    callServer('updateRecord', ['PETA_KEAMANAN_DOCS', payload], 'Peta diperbarui.', loadPetaStatisList, 'Menyimpan...');
  } else {
    callServer('addRecord', ['PETA_KEAMANAN_DOCS', payload], 'Peta tersimpan.', loadPetaStatisList, 'Menyimpan...');
  }
  return false;
}

// ════════════════════════════════════════════════════════
// MODUL: SOP CENTER & AWARENESS CENTER
// ════════════════════════════════════════════════════════
function canManageContent() { return ['ADMIN','TL_KEAMANAN','SPS_KEAMANAN'].includes(AppState.user.Role); }

const KLASIFIKASI_SOP = ['Prosedur', 'Instruksi Kerja (IK)', 'Rencana Pengamanan', 'Rencana Kontijensi', 'Kebijakan', 'Program Kerja'];
let sopAllRows = [];
let sopFilters = { search: '', klasifikasi: '', tahun: '', status: '', tab: 'Semua' };

function loadSopCenter() {
  const c = document.getElementById('app-container');
  sopFilters = { search: '', klasifikasi: '', tahun: '', status: '', tab: 'Semua' };
  c.innerHTML = sectionHeader('SOP & Dokumen Pengamanan', 'Cari, temukan, baca, dan download SOP dalam beberapa klik.')
    + (canManageContent() ? `<div class="mb-3 d-flex justify-content-end"><button class="btn btn-primary-ip" onclick="openSopForm()"><i class="bi bi-file-earmark-arrow-up"></i> Upload Dokumen</button></div>` : '')
    + `<div class="card-ip mb-3">
        <div class="row g-2 mb-3">
          <div class="col-md-4"><input type="text" class="form-control" id="sopSearchInput" placeholder="Cari SOP atau dokumen..." oninput="onSopFilterChange()"></div>
          <div class="col-md-2"><select class="form-select" id="sopFilterKlasifikasi" onchange="onSopFilterChange()"><option value="">Semua Klasifikasi</option>${selectOptions(KLASIFIKASI_SOP)}</select></div>
          <div class="col-md-2"><select class="form-select" id="sopFilterTahun" onchange="onSopFilterChange()"><option value="">Semua Tahun</option></select></div>
          <div class="col-md-2"><select class="form-select" id="sopFilterStatus" onchange="onSopFilterChange()"><option value="">Semua Status</option><option>Aktif</option><option>Non-Aktif</option></select></div>
        </div>
        <div id="sopTabsWrap" class="d-flex gap-2 flex-wrap"></div>
      </div>
      <div id="sopCardsWrap" class="row g-3"></div>`;
  google.script.run.withSuccessHandler(res => {
    sopAllRows = res.data || [];
    renderSopTabs();
    renderSopFilterTahunOptions();
    renderSopCards();
  }).getAllData('SOP_DOCS');
}
function renderSopFilterTahunOptions() {
  const tahunSet = Array.from(new Set(sopAllRows.map(r => r.Tahun).filter(Boolean))).sort((a, b) => b - a);
  document.getElementById('sopFilterTahun').innerHTML = '<option value="">Semua Tahun</option>' + tahunSet.map(t => `<option>${t}</option>`).join('');
}
function renderSopTabs() {
  const counts = {};
  KLASIFIKASI_SOP.forEach(k => counts[k] = sopAllRows.filter(r => r.Klasifikasi === k).length);
  const tabs = [{ key: 'Semua', label: 'Semua' }].concat(KLASIFIKASI_SOP.map(k => ({ key: k, label: `${k} (${counts[k]})` })));
  document.getElementById('sopTabsWrap').innerHTML = tabs.map(t => {
    const active = sopFilters.tab === t.key;
    return `<button type="button" onclick="setSopTab('${t.key}')" style="border:1.5px solid var(--primary);border-radius:999px;padding:.35rem .9rem;font-size:.8rem;font-weight:600;background:${active?'var(--primary)':'#fff'};color:${active?'#fff':'var(--primary)'};">${t.label}</button>`;
  }).join('');
}
function setSopTab(key) {
  sopFilters.tab = key;
  renderSopTabs();
  renderSopCards();
}
function onSopFilterChange() {
  sopFilters.search = val('sopSearchInput').toLowerCase();
  sopFilters.klasifikasi = val('sopFilterKlasifikasi');
  sopFilters.tahun = val('sopFilterTahun');
  sopFilters.status = val('sopFilterStatus');
  renderSopCards();
}
function renderSopCards() {
  const wrap = document.getElementById('sopCardsWrap');
  const rows = sopAllRows.filter(r => {
    if (sopFilters.tab !== 'Semua' && r.Klasifikasi !== sopFilters.tab) return false;
    if (sopFilters.klasifikasi && r.Klasifikasi !== sopFilters.klasifikasi) return false;
    if (sopFilters.tahun && String(r.Tahun) !== sopFilters.tahun) return false;
    if (sopFilters.status && r.Status !== sopFilters.status) return false;
    if (sopFilters.search && !String(r.Judul || '').toLowerCase().includes(sopFilters.search)) return false;
    return true;
  });
  if (!rows.length) { wrap.innerHTML = '<div class="col-12 text-muted text-center py-4">Tidak ada dokumen ditemukan.</div>'; return; }
  wrap.innerHTML = rows.map(r => `
    <div class="col-md-6 col-lg-3"><div class="card-ip">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div style="width:42px;height:42px;border-radius:10px;background:#FDE8E8;display:flex;align-items:center;justify-content:center;"><i class="bi bi-file-earmark-pdf-fill" style="color:#E53935;font-size:1.4rem;"></i></div>
        <span class="pill ${r.Status==='Aktif'?'pill-success':'pill-neutral'}">${r.Status||'-'}</span>
      </div>
      <div class="fw-bold mb-1" style="font-size:.9rem;line-height:1.3;">${r.Judul}</div>
      <div class="small text-muted">Klasifikasi: <b>${r.Klasifikasi||'-'}</b></div>
      <div class="small text-muted">Tahun: <b>${r.Tahun||'-'}</b></div>
      <div class="small text-muted mb-2">Terakhir Review: <b>${(r.TerakhirReview||'-').toString().slice(0,10)}</b></div>
      <div class="d-flex gap-1 flex-wrap">
        <a href="${r.FileUrl}" target="_blank" class="btn btn-primary-ip btn-sm-ip flex-grow-1"><i class="bi bi-book"></i> Baca</a>
        <a href="${r.DownloadUrl||r.FileUrl}" target="_blank" class="btn btn-outline-ip btn-sm-ip"><i class="bi bi-download"></i></a>
        ${canManageContent() ? `<button class="btn btn-outline-ip btn-sm-ip" onclick="openSopForm('${r.ID}')"><i class="bi bi-pencil"></i></button>` : ''}
        ${canManageContent() ? `<button class="btn btn-outline-ip btn-sm-ip" onclick="toggleSopStatus('${r.ID}','${r.Status}')"><i class="bi ${r.Status==='Aktif'?'bi-eye-slash':'bi-eye'}"></i></button>` : ''}
      </div>
    </div></div>`).join('');
}
function toggleSopStatus(id, currentStatus) {
  const newStatus = currentStatus === 'Aktif' ? 'Non-Aktif' : 'Aktif';
  const row = sopAllRows.find(r => r.ID === id);
  if (!row) return;
  const prevStatus = row.Status;
  row.Status = newStatus;
  renderSopCards();
  google.script.run
    .withSuccessHandler(res => {
      if (!res.success) { row.Status = prevStatus; renderSopCards(); showToast('Gagal', res.message, 'danger'); }
    })
    .withFailureHandler(err => { row.Status = prevStatus; renderSopCards(); showToast('Error', err.message, 'danger'); })
    .updateFieldById('SOP_DOCS', id, { Status: newStatus });
}
let sopFileUrl = '', sopDownloadUrl = '';
function openSopForm(editId) {
  const editRow = editId ? sopAllRows.find(r => r.ID === editId) : null;
  sopFileUrl = editRow ? editRow.FileUrl : '';
  sopDownloadUrl = editRow ? editRow.DownloadUrl : '';
  const v = k => editRow ? (editRow[k] ?? '') : '';
  openFormModal(editRow ? 'Edit SOP' : 'Upload Dokumen', `
    <form onsubmit="return submitSopForm(event, ${editRow ? `'${editId}'` : 'null'})">
      <div class="row g-2">
        <div class="col-12"><label class="form-label">Judul</label><input type="text" class="form-control" id="sopJudul" required value="${v('Judul')}"></div>
        <div class="col-6"><label class="form-label">Klasifikasi</label><select class="form-select" id="sopKlasifikasi" required>${selectOptions(KLASIFIKASI_SOP, v('Klasifikasi'))}</select></div>
        <div class="col-6"><label class="form-label">Tahun</label><input type="number" class="form-control" id="sopTahun" required value="${v('Tahun') || new Date().getFullYear()}"></div>
        <div class="col-6"><label class="form-label">Terakhir Review</label><input type="date" class="form-control" id="sopTerakhirReview" value="${(v('TerakhirReview')||'').toString().slice(0,10)}"></div>
        <div class="col-6"><label class="form-label">Status</label><select class="form-select" id="sopStatus">${selectOptions(['Aktif','Non-Aktif'], v('Status') || 'Aktif')}</select></div>
        <div class="col-12"><label class="form-label">File PDF ${editRow ? '(opsional, kosongkan jika tidak diganti)' : ''}</label>
          <input type="file" accept="application/pdf" class="form-control" id="sopFileInput" onchange="handleSopFileUpload(event)" ${editRow?'':'required'}>
          <div class="small text-muted mt-1" id="sopFileStatus">${editRow && editRow.FileUrl ? `<a href="${editRow.FileUrl}" target="_blank"><i class="bi bi-check-circle text-success"></i> File saat ini tersimpan</a>` : ''}</div>
        </div>
      </div>
      <button type="submit" class="btn btn-primary-ip w-100 mt-3">Simpan</button>
    </form>`);
}
async function handleSopFileUpload(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('sopFileStatus');
  statusEl.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Mengunggah...';
  try {
    const base64 = (await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })).split(',')[1];
    const res = await gsRun('uploadSopDoc', base64, file.name, file.type);
    if (!res.success) throw new Error(res.message);
    sopFileUrl = res.data.url;
    sopDownloadUrl = res.data.downloadUrl;
    statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> File siap';
  } catch (err) {
    statusEl.innerHTML = `<span class="text-danger">${err.message}</span>`;
  }
}
function submitSopForm(evt, editId) {
  evt.preventDefault();
  const payload = {
    Judul: val('sopJudul'), Klasifikasi: val('sopKlasifikasi'), Tahun: val('sopTahun'),
    TerakhirReview: val('sopTerakhirReview'), Status: val('sopStatus'),
    FileUrl: sopFileUrl, DownloadUrl: sopDownloadUrl, UploadedBy: AppState.user.Nama, Tanggal: new Date().toISOString()
  };
  closeFormModal();
  if (editId) {
    payload.ID = editId;
    callServer('updateRecord', ['SOP_DOCS', payload], 'SOP diperbarui.', loadSopCenter, 'Menyimpan...');
  } else {
    callServer('addRecord', ['SOP_DOCS', payload], 'SOP tersimpan.', loadSopCenter, 'Menyimpan...');
  }
  return false;
}

const TIPE_AWARENESS = ['Flyer', 'Berita', 'Kuis'];
const TIPE_BADGE_COLOR = { Flyer: '#0C7A94', Berita: '#00913E', Kuis: '#FFC107' };
const TIPE_BADGE_TEXT = { Flyer: '#fff', Berita: '#fff', Kuis: '#012530' };
const TIPE_BUTTON_LABEL = { Flyer: 'Lihat', Berita: 'Baca', Kuis: 'Mulai Kuis' };
const TIPE_BUTTON_ICON = { Flyer: 'bi-eye', Berita: 'bi-book', Kuis: 'bi-patch-question' };
let awarenessAllRows = [];
let awarenessFilters = { search: '', tab: 'Semua' };

// ── Telepon Penting: direktori kontak & Hubungi Darurat (hasil diskusi lanjutan) ──
let telpPentingRows = [];
function loadTeleponPenting() {
  const c = document.getElementById('app-container');
  const bisaKelola = canManageContent();
  c.innerHTML = sectionHeader('Telepon Penting', 'Direktori kontak internal & instansi darurat sekitar UBP Grati')
    + `<div class="card-ip mb-3" style="border:2px solid var(--danger);">
         <h6 class="mb-2" style="color:var(--danger-text);"><i class="bi bi-exclamation-triangle-fill"></i> Hubungi Darurat</h6>
         <p class="section-sub mb-3">Klik tombol instansi yang perlu dihubungi. Email terkirim otomatis; WhatsApp akan terbuka dengan pesan siap kirim (tinggal tekan kirim).</p>
         <div class="d-flex flex-wrap gap-2">
           <button class="btn btn-danger" onclick="handleHubungiDarurat('Polres')"><i class="bi bi-telephone-forward-fill"></i> PERMINTAAN DARURAT POLRES</button>
           <button class="btn btn-danger" onclick="handleHubungiDarurat('DAMKAR')"><i class="bi bi-telephone-forward-fill"></i> PERMINTAAN DARURAT DAMKAR</button>
           <button class="btn btn-danger" onclick="handleHubungiDarurat('BPBD')"><i class="bi bi-telephone-forward-fill"></i> PERMINTAAN DARURAT BPBD</button>
         </div>
       </div>
       <div class="card-ip">
         <h6 class="mb-2"><i class="bi bi-telephone-fill"></i> Direktori Telepon Penting</h6>
         <div id="tblTelpPenting"></div>
       </div>`;
  google.script.run.withSuccessHandler(res => {
    telpPentingRows = (res.data || []).sort((a,b) => Number(a.No) - Number(b.No));
    renderTelpPentingTable(bisaKelola);
  }).getAllData('MASTER_TELP_PENTING');
}
function renderTelpPentingTable(bisaKelola) {
  document.getElementById('tblTelpPenting').innerHTML = `<div class="table-responsive-ip"><table class="table-ip">
    <thead><tr><th>No</th><th>Nama / Instansi</th><th>No. Telp Penting</th><th>No HP/WA</th>${bisaKelola?'<th>Aksi</th>':''}</tr></thead>
    <tbody>${telpPentingRows.map(r => `
      <tr>
        <td>${r.No}</td><td>${r.NamaInstansi}</td><td>${r.NoTelpPenting||'-'}</td>
        <td>${r.NoHpWa ? ('<a href="https:&#47;&#47;wa.me/' + String(r.NoHpWa).replace(/\D/g,'') + '" target="_blank" style="display:inline-flex;align-items:center;gap:.35rem;background:var(--tint-green);color:#00913E;padding:.2rem .6rem;border-radius:var(--radius-pill);font-size:.78rem;font-weight:600;text-decoration:none;"><i class="bi bi-whatsapp"></i>' + r.NoHpWa + '</a>') : '-'}</td>
        ${bisaKelola ? `<td><button class="btn btn-outline-ip btn-sm-ip" onclick="openEditTelpPenting('${r.ID}')"><i class="bi bi-pencil"></i></button></td>` : ''}
      </tr>`).join('')}</tbody>
  </table></div>`;
}
function openEditTelpPenting(id) {
  const r = telpPentingRows.find(x => x.ID === id);
  if (!r) return;
  openFormModal('Edit Kontak — ' + r.NamaInstansi, `
    <form onsubmit="return saveEditTelpPenting(event,'${id}')">
      <div class="mb-2"><label class="form-label">Nama / Instansi</label><input type="text" class="form-control" id="etpNama" value="${r.NamaInstansi}" required></div>
      <div class="mb-2"><label class="form-label">No. Telp Penting</label><input type="text" class="form-control" id="etpTelp" value="${r.NoTelpPenting||''}"></div>
      <div class="mb-3"><label class="form-label">No HP/WA</label><input type="text" class="form-control" id="etpWa" value="${r.NoHpWa||''}" placeholder="misal: 628123456789"></div>
      <button type="submit" class="btn btn-primary-ip w-100"><i class="bi bi-check2"></i> Simpan</button>
    </form>`);
}
function saveEditTelpPenting(evt, id) {
  evt.preventDefault();
  const fields = { NamaInstansi: val('etpNama'), NoTelpPenting: val('etpTelp'), NoHpWa: val('etpWa') };
  closeFormModal();
  callServer('updateFieldById', ['MASTER_TELP_PENTING', id, fields], 'Kontak diperbarui.', loadTeleponPenting, 'Menyimpan...');
}
const EMERGENCY_CONTACT_MAP_ = {
  'Polres': { phone: 'emergencyPolresPhone', email: 'emergencyPolresEmail' },
  'BPBD': { phone: 'emergencyBpbdPhone', email: 'emergencyBpbdEmail' },
  'DAMKAR': { phone: 'emergencyDamkarPhone', email: 'emergencyDamkarEmail' }
};
function handleHubungiDarurat(instansi) {
  const keys = EMERGENCY_CONTACT_MAP_[instansi];
  if (!keys) return;
  const target = { nama: instansi, phone: AppState.config[keys.phone], email: AppState.config[keys.email] };
  const rincian = [
    target.email ? 'Email otomatis terkirim.' : 'Email belum diisi Admin — dilewati.',
    target.phone ? 'WhatsApp akan terbuka (pesan sudah terisi, tinggal tekan kirim).' : 'Nomor WA belum diisi Admin.'
  ].join(' ');
  openConfirmModal(`Kirim permintaan darurat ke: ${instansi}? ${rincian}`, () => {
    const namaUnit = AppState.config.namaUnit || 'PT PLN Indonesia Power UBP Grati';
    const waktu = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
    const message = `⚠ DARURAT — ${namaUnit}\nMohon bantuan segera.\nWaktu: ${waktu}\nDilaporkan oleh: ${AppState.user.Nama} (${ROLE_LABEL[AppState.user.Role]||AppState.user.Role})\nLokasi: ${namaUnit}`;
    // Email terkirim dari server (kalau alamatnya sudah diisi Admin)
    callServer('sendEmergencyAlert', [[{nama: target.nama, email: target.email}], message, AppState.user.Nama],
      'Permintaan darurat diproses.', null, 'Mengirim email darurat...');
    // WhatsApp dibuka di tab baru kalau nomornya ada — user tinggal tekan kirim
    if (target.phone) window.open('https:' + '//wa.me/' + String(target.phone).replace(/\D/g,'') + '?text=' + encodeURIComponent(message), '_blank');
  });
}

function loadAwareness() {
  const c = document.getElementById('app-container');
  awarenessFilters = { search: '', tab: 'Semua' };
  c.innerHTML = `
    <div class="card-ip mb-3" style="background:linear-gradient(135deg,#0052A3,#023B4A);color:#fff;text-align:center;padding:2.5rem 1.5rem;">
      <h2 style="font-weight:800;letter-spacing:.02em;color:#F7E82E;">SECURITY AWARENESS CENTER</h2>
      <p style="opacity:.9;">Tingkatkan Pengetahuan, Tingkatkan Kewaspadaan, Tingkatkan Keamanan.</p>
      <div style="max-width:520px;margin:0 auto;">
        <input type="text" class="form-control" id="awSearchInput" placeholder="Cari flyer, kuis, atau berita..." oninput="onAwarenessFilterChange()" style="border-radius:999px;padding:.65rem 1.25rem;">
      </div>
    </div>
    ${canManageContent() ? `<div class="mb-3 d-flex justify-content-end"><button class="btn btn-primary-ip" onclick="openAwarenessForm()"><i class="bi bi-plus-lg"></i> Publikasikan Materi</button></div>` : ''}
    <div id="awTabsWrap" class="d-flex gap-2 flex-wrap mb-3"></div>
    <div id="awCardsWrap" class="row g-3"></div>`;
  google.script.run.withSuccessHandler(res => {
    awarenessAllRows = res.data || [];
    renderAwarenessTabs();
    renderAwarenessCards();
  }).getAllData('AWARENESS_DOCS');
}
function renderAwarenessTabs() {
  const tabs = ['Semua', 'Flyer', 'Kuis', 'Berita'];
  document.getElementById('awTabsWrap').innerHTML = tabs.map(t => {
    const active = awarenessFilters.tab === t;
    return `<button type="button" onclick="setAwarenessTab('${t}')" style="border:1.5px solid var(--primary);border-radius:999px;padding:.4rem 1.1rem;font-size:.85rem;font-weight:600;background:${active?'var(--primary)':'#fff'};color:${active?'#fff':'var(--primary)'};">${t}</button>`;
  }).join('');
}
function setAwarenessTab(t) {
  awarenessFilters.tab = t;
  renderAwarenessTabs();
  renderAwarenessCards();
}
function onAwarenessFilterChange() {
  awarenessFilters.search = val('awSearchInput').toLowerCase();
  renderAwarenessCards();
}
function renderAwarenessCards() {
  const wrap = document.getElementById('awCardsWrap');
  const rows = awarenessAllRows.filter(r => {
    if (awarenessFilters.tab !== 'Semua' && r.Tipe !== awarenessFilters.tab) return false;
    if (awarenessFilters.search && !String(r.Judul || '').toLowerCase().includes(awarenessFilters.search)) return false;
    return true;
  });
  if (!rows.length) { wrap.innerHTML = '<div class="col-12 text-muted text-center py-4">Tidak ada materi ditemukan.</div>'; return; }
  wrap.innerHTML = rows.map(r => {
    const badgeBg = TIPE_BADGE_COLOR[r.Tipe] || '#6B7A90';
    const badgeColor = TIPE_BADGE_TEXT[r.Tipe] || '#fff';
    const thumb = r.ImageUrl
      ? `<img src="${r.ImageUrl}" style="width:100%;height:150px;object-fit:cover;border-radius:var(--radius-lg) var(--radius-lg) 0 0;">`
      : `<div style="width:100%;height:150px;background:var(--app-bg);border-radius:var(--radius-lg) var(--radius-lg) 0 0;display:flex;align-items:center;justify-content:center;"><i class="bi bi-patch-question-fill" style="font-size:2.2rem;color:#00AEEF;"></i></div>`;
    const btnLabel = TIPE_BUTTON_LABEL[r.Tipe] || 'Lihat';
    const btnIcon = TIPE_BUTTON_ICON[r.Tipe] || 'bi-eye';
    const actionAttrs = r.Tipe === 'Berita' ? `onclick="openAwarenessBaca('${r.ID}')"` : `href="${r.Tipe==='Kuis' ? r.LinkUrl : r.ImageUrl}" target="_blank"`;
    const tag = r.Tipe === 'Berita' ? 'button' : 'a';
    return `
    <div class="col-md-6 col-lg-3"><div class="card-ip" style="padding:0;overflow:hidden;">
      <div style="position:relative;">
        ${thumb}
        <span class="pill" style="position:absolute;top:8px;left:8px;background:${badgeBg};color:${badgeColor};font-weight:700;">${r.Tipe}</span>
      </div>
      <div style="padding:1rem;">
        <div class="fw-bold mb-1" style="font-size:.9rem;line-height:1.3;">${r.Judul}</div>
        ${r.Deskripsi ? `<div class="small text-muted mb-1" style="line-height:1.4;">${r.Deskripsi}</div>` : ''}
        <div class="small text-muted mb-2">${r.Kategori||'-'} &middot; ${(r.Tanggal||'').toString().slice(0,10)}</div>
        <div class="d-flex gap-1 flex-wrap">
          <${tag} class="btn btn-primary-ip btn-sm-ip flex-grow-1" ${actionAttrs}><i class="bi ${btnIcon}"></i> ${btnLabel}</${tag}>
          ${canManageContent() ? `<button class="btn btn-outline-ip btn-sm-ip" onclick="openAwarenessForm('${r.ID}')"><i class="bi bi-pencil"></i></button>` : ''}
          ${canManageContent() ? `<button class="btn btn-outline-ip btn-sm-ip" onclick="toggleAwarenessStatus('${r.ID}','${r.Status}')"><i class="bi ${r.Status==='Aktif'?'bi-eye-slash':'bi-eye'}"></i></button>` : ''}
        </div>
      </div>
    </div></div>`;
  }).join('');
}
function openAwarenessBaca(id) {
  const r = awarenessAllRows.find(x => x.ID === id);
  if (!r) return;
  openFormModal(r.Judul, `
    ${r.ImageUrl ? `<img src="${r.ImageUrl}" style="width:100%;border-radius:var(--radius-md);margin-bottom:1rem;">` : ''}
    <div class="small text-muted mb-2">${r.Kategori||'-'} &middot; ${(r.Tanggal||'').toString().slice(0,10)}</div>
    ${r.Deskripsi ? `<p class="fw-bold" style="font-size:.9rem;">${r.Deskripsi}</p>` : ''}
    <div style="white-space:pre-wrap;font-size:.9rem;line-height:1.6;">${r.Konten||''}</div>
  `);
}
function toggleAwarenessStatus(id, currentStatus) {
  const newStatus = currentStatus === 'Aktif' ? 'Non-Aktif' : 'Aktif';
  const row = awarenessAllRows.find(r => r.ID === id);
  if (!row) return;
  const prevStatus = row.Status;
  row.Status = newStatus;
  renderAwarenessCards();
  google.script.run
    .withSuccessHandler(res => {
      if (!res.success) { row.Status = prevStatus; renderAwarenessCards(); showToast('Gagal', res.message, 'danger'); }
    })
    .withFailureHandler(err => { row.Status = prevStatus; renderAwarenessCards(); showToast('Error', err.message, 'danger'); })
    .updateFieldById('AWARENESS_DOCS', id, { Status: newStatus });
}
let awarenessImageUrl = '';
function openAwarenessForm(editId) {
  const editRow = editId ? awarenessAllRows.find(r => r.ID === editId) : null;
  awarenessImageUrl = editRow ? editRow.ImageUrl : '';
  const v = k => editRow ? (editRow[k] ?? '') : '';
  openFormModal(editRow ? 'Edit Materi Awareness' : 'Publikasikan Materi', `
    <form onsubmit="return submitAwarenessForm(event, ${editRow ? `'${editId}'` : 'null'})">
      <div class="row g-2">
        <div class="col-6"><label class="form-label">Tipe</label><select class="form-select" id="awTipe">${selectOptions(TIPE_AWARENESS, v('Tipe'))}</select></div>
        <div class="col-6"><label class="form-label">Kategori</label><input type="text" class="form-control" id="awKategori" placeholder="misal: Keamanan, K3" value="${v('Kategori')}"></div>
        <div class="col-12"><label class="form-label">Judul</label><input type="text" class="form-control" id="awJudul" required value="${v('Judul')}"></div>
        <div class="col-12"><label class="form-label">Deskripsi Singkat (tampil sebagai preview di kartu)</label><textarea class="form-control" id="awDeskripsi" rows="2" placeholder="Ringkasan singkat...">${v('Deskripsi')}</textarea></div>
        <div class="col-6"><label class="form-label">Tanggal</label><input type="date" class="form-control" id="awTanggal" value="${(v('Tanggal')||'').toString().slice(0,10) || ipgToday()}"></div>
        <div class="col-6"><label class="form-label">Status</label><select class="form-select" id="awStatus">${selectOptions(['Aktif','Non-Aktif'], v('Status') || 'Aktif')}</select></div>
        <div class="col-12"><label class="form-label">Gambar (untuk Flyer/Berita, opsional)</label>
          <input type="file" accept="image/png, image/jpeg, image/webp" class="form-control" id="awImageInput" onchange="handleAwarenessImageUpload(event)">
          <div class="small text-muted mt-1" id="awImageStatus">${editRow && editRow.ImageUrl ? `<a href="${editRow.ImageUrl}" target="_blank"><i class="bi bi-check-circle text-success"></i> Gambar tersimpan</a>` : ''}</div>
        </div>
        <div class="col-12"><label class="form-label">Isi Berita (untuk Berita, opsional)</label><textarea class="form-control" id="awKonten" rows="4">${v('Konten')}</textarea></div>
        <div class="col-12"><label class="form-label">Link Kuis (untuk Kuis, opsional)</label><input type="url" class="form-control" id="awLinkUrl" placeholder="https:&#47;&#47;..." value="${v('LinkUrl')}"></div>
      </div>
      <button type="submit" class="btn btn-primary-ip w-100 mt-3">Simpan</button>
    </form>`);
}
async function handleAwarenessImageUpload(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('awImageStatus');
  statusEl.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Mengunggah...';
  try {
    const compressed = await compressImageFile_(file);
    const res = await gsRun('uploadAwarenessImage', compressed.base64, compressed.fileName, compressed.mimeType);
    if (!res.success) throw new Error(res.message);
    awarenessImageUrl = res.data.directUrl;
    statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> Gambar siap';
  } catch (err) {
    statusEl.innerHTML = `<span class="text-danger">${err.message}</span>`;
  }
}
function submitAwarenessForm(evt, editId) {
  evt.preventDefault();
  const payload = {
    Tipe: val('awTipe'), Judul: val('awJudul'), Kategori: val('awKategori'), Deskripsi: val('awDeskripsi'), Tanggal: val('awTanggal'),
    Status: val('awStatus'), ImageUrl: awarenessImageUrl, Konten: val('awKonten'), LinkUrl: val('awLinkUrl'),
    UploadedBy: AppState.user.Nama
  };
  closeFormModal();
  if (editId) {
    payload.ID = editId;
    callServer('updateRecord', ['AWARENESS_DOCS', payload], 'Materi diperbarui.', loadAwareness, 'Menyimpan...');
  } else {
    callServer('addRecord', ['AWARENESS_DOCS', payload], 'Materi dipublikasikan.', loadAwareness, 'Menyimpan...');
  }
  return false;
}

// ════════════════════════════════════════════════════════
// MASTER DATA (Admin/TL/SPS Keamanan — PRD Bab 6)
// ════════════════════════════════════════════════════════
function loadMasterData() {
  const c = document.getElementById('app-container');
  c.innerHTML = sectionHeader('Master Data', 'Single Source of Truth — Personel, Pos Jaga, Sarpras, Titik Patroli')
    + `<ul class="nav nav-pills mb-3" id="mdTabs">
        <li class="nav-item"><a class="nav-link active" href="javascript:void(0)" onclick="loadMasterTab('MASTER_PERSONEL',this)">Personel</a></li>
        <li class="nav-item"><a class="nav-link" href="javascript:void(0)" onclick="loadMasterTab('MASTER_POS',this)">Pos Jaga</a></li>
        <li class="nav-item"><a class="nav-link" href="javascript:void(0)" onclick="loadMasterTab('MASTER_SARPRAS',this)">Sarpras</a></li>
        <li class="nav-item"><a class="nav-link" href="javascript:void(0)" onclick="loadMasterTab('MASTER_TITIK_PATROLI',this)">Titik Patroli</a></li>
      </ul>` + actionBar('Tambah Entitas', 'openMasterForm') + `<div id="mdExtraBar"></div><div id="tblMaster"></div>`;
  loadMasterTab('MASTER_PERSONEL', document.querySelector('#mdTabs .nav-link'));
}
// Skema per-kolom Master Data (hasil diskusi lanjutan) — mempermudah isian sesuai struktur sheet
const MASTER_SCHEMAS = {
  MASTER_PERSONEL: [
    { key: 'Nama', label: 'Nama', type: 'text', required: true },
    { key: 'NRP', label: 'NRP', type: 'text', required: true },
    { key: 'Regu', label: 'Regu', type: 'select', options: OPT_REGU },
    { key: 'Jabatan', label: 'Jabatan', type: 'text', placeholder: 'misal: Satpam, Danru, TL Keamanan, SPS Keamanan' },
    { key: 'Kualifikasi', label: 'Kualifikasi', type: 'select', options: ['Gada Pratama','Gada Madya','Gada Utama','-'] },
    { key: 'Status', label: 'Status', type: 'select', options: ['Aktif','Non-Aktif'] }
  ],
  MASTER_POS: [
    { key: 'NamaPos', label: 'Nama Pos', type: 'select', options: OPT_POS },
    { key: 'Zonasi', label: 'Zonasi', type: 'select', options: ['Ring 1','Ring 2','Ring 3'] },
    { key: 'JumlahPetugas', label: 'Jumlah Petugas', type: 'number' },
    { key: 'Status', label: 'Status', type: 'select', options: ['Aktif','Non-Aktif'] }
  ],
  MASTER_SARPRAS: [
    { key: 'NamaSarana', label: 'Nama Sarana', type: 'text', required: true, placeholder: 'misal: APAR, Metal Detector, Radio HT' },
    { key: 'StandarQty', label: 'Standar Qty', type: 'number' },
    { key: 'PosJaga', label: 'Pos Jaga', type: 'select', options: OPT_POS },
    { key: 'Kategori', label: 'Kategori', type: 'text', placeholder: 'misal: K3, Komunikasi, Akses' }
  ],
  MASTER_TITIK_PATROLI: [
    { key: 'NamaTitik', label: 'Nama Titik', type: 'text', required: true },
    { key: 'KodeQR', label: 'Kode QR', type: 'text', readonly: true, placeholder: 'Otomatis — dibuat saat Cetak Stiker QR' },
    { key: 'Latitude', label: 'Latitude', type: 'number', step: 'any' },
    { key: 'Longitude', label: 'Longitude', type: 'number', step: 'any' },
    { key: 'PosJaga', label: 'Pos Jaga', type: 'select', options: OPT_POS }
  ]
};

let currentMasterSheet = 'MASTER_PERSONEL';
let currentMasterRows = [];
function loadMasterTab(sheetName, el) {
  currentMasterSheet = sheetName;
  document.querySelectorAll('#mdTabs .nav-link').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');
  const extra = document.getElementById('mdExtraBar');
  if (extra) extra.innerHTML = sheetName === 'MASTER_TITIK_PATROLI'
    ? `<div class="card-ip mb-3 d-flex flex-wrap align-items-center gap-2" style="padding:.85rem 1rem;">
         <div class="flex-grow-1 small"><b>Stiker QR titik patroli.</b> Kode QR dibuat otomatis untuk titik yang belum punya kode.
           Titik yang sudah punya kode tidak berubah, jadi stiker terpasang tetap berlaku.</div>
         <button class="btn btn-primary-ip btn-sm-ip" onclick="cetakStikerQrTitik()"><i class="bi bi-qr-code"></i> Cetak Stiker QR</button>
       </div>` : '';
  google.script.run.withSuccessHandler(res => {
    const rows = res.data || [];
    currentMasterRows = rows;
    const cols = rows.length ? Object.keys(rows[0]).filter(k=>k!=='ID').map(k=>({label:k, key:k})) : [];
    renderGenericTable('tblMaster', cols, rows, row =>
      `<button class="btn btn-outline-ip btn-sm-ip" onclick="openMasterForm('${row.ID}')"><i class="bi bi-pencil"></i></button>
       ${sheetName === 'MASTER_TITIK_PATROLI' ? `<button class="btn btn-outline-ip btn-sm-ip" title="Ganti kode QR (stiker hilang/rusak)" onclick="gantiKodeQrTitik('${row.ID}')"><i class="bi bi-arrow-repeat"></i></button>` : ''}
       <button class="btn btn-outline-ip btn-sm-ip" onclick="openConfirmModal('Hapus data ini?', ()=>callServer('deleteRecord',['${sheetName}','${row.ID}'],'Data dihapus.',()=>loadMasterTab('${sheetName}')))"><i class="bi bi-trash"></i></button>`
    );
  }).getAllData(sheetName);
}
function openMasterForm(editId) {
  const schema = MASTER_SCHEMAS[currentMasterSheet] || [];
  const editRow = editId ? currentMasterRows.find(r => r.ID === editId) : null;
  const fieldsHtml = schema.map(f => {
    const id = 'md_' + f.key;
    const currentVal = editRow ? editRow[f.key] : undefined;
    if (f.type === 'select') {
      return `<div class="col-6"><label class="form-label">${f.label}</label>
        <select class="form-select" id="${id}" ${f.required?'required':''}>${selectOptions(f.options, currentVal)}</select></div>`;
    }
    return `<div class="col-6"><label class="form-label">${f.label}</label>
      <input type="${f.type}" ${f.step?`step="${f.step}"`:''} ${f.readonly?'readonly':''} class="form-control" id="${id}" ${f.required?'required':''} placeholder="${f.placeholder||''}" value="${currentVal ?? ''}"></div>`;
  }).join('');
  openFormModal(editRow ? 'Edit Entitas Master Data' : 'Tambah Entitas Master Data', `
    <form onsubmit="return submitMasterForm(event, ${editRow ? `'${editId}'` : 'null'})">
      <p class="section-sub">${editRow ? 'Mengubah data di' : 'Menambahkan ke'} tabel: <b>${currentMasterSheet.replace('MASTER_','').replace('_',' ')}</b></p>
      <div class="row g-2">${fieldsHtml}</div>
      <button type="submit" class="btn btn-primary-ip w-100 mt-3">Simpan</button>
    </form>`);
}
function submitMasterForm(evt, editId) {
  evt.preventDefault();
  const schema = MASTER_SCHEMAS[currentMasterSheet] || [];
  const payload = {};
  schema.forEach(f => { payload[f.key] = val('md_' + f.key); });
  closeFormModal();
  if (editId) {
    payload.ID = editId;
    callServer('updateRecord', [currentMasterSheet, payload], 'Master data diperbarui.', ()=>loadMasterTab(currentMasterSheet), 'Menyimpan...');
  } else {
    callServer('addRecord', [currentMasterSheet, payload], 'Master data tersimpan.', ()=>loadMasterTab(currentMasterSheet), 'Menyimpan...');
  }
  return false;
}

// ── Stiker QR Titik Patroli (Master Data → tab Titik Patroli) ──
function _escHtml(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildStikerQrHtml(titikList, prefix) {
  const items = titikList.filter(t => String(t.KodeQR || '').trim());
  const cards = items.map(t => {
    let img = '';
    try {
      const qr = qrcode(0, 'Q');
      qr.addData(prefix + String(t.KodeQR).trim());
      qr.make();
      img = `<img src="${qr.createDataURL(8, 4)}" alt="" style="width:46mm;height:46mm;image-rendering:pixelated;display:block;margin:0 auto;">`;
    } catch (e) {
      img = '<div style="height:46mm;display:flex;align-items:center;justify-content:center;color:#E53935;">QR gagal dibuat</div>';
    }
    return `<div class="st">
      <div class="st-hd">IP GUARD V3 &middot; Titik Patroli</div>
      ${img}
      <div class="st-nm">${_escHtml(t.NamaTitik)}</div>
      <div class="st-pos">${_escHtml(t.PosJaga || '')}</div>
      <div class="st-kd">${_escHtml(t.KodeQR)}</div>
      <div class="st-ft">Scan lewat menu Patroli &rarr; Scan Titik Patroli &rarr; Scan QR</div>
    </div>`;
  }).join('');
  return `<style>
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .st-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
      .st { border: 1.5px dashed #8a9aa6; border-radius: 4mm; padding: 0 0 4mm; text-align: center; height: 80mm;
            box-sizing: border-box; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
      .st-hd { background: #023B4A; color: #F7E82E; font-weight: 700; font-size: 11px; letter-spacing: .02em;
               padding: 2.2mm 0; margin-bottom: 3mm; border-bottom: 1.2mm solid #F7E82E; }
      .st-nm { font-size: 16px; font-weight: 700; color: #012530; margin-top: 2.5mm; padding: 0 3mm; line-height: 1.15; }
      .st-pos { font-size: 11px; color: #555; margin-top: 1mm; }
      .st-kd { font-family: Consolas, monospace; font-size: 10px; color: #777; margin-top: 1mm; }
      .st-ft { font-size: 8.5px; color: #999; margin-top: 1.5mm; }
    </style>
    <div class="print-only-tip">Cetak di kertas stiker atau HVS tebal, gunting di garis putus-putus, lalu <b>laminasi</b>.
      Tempel setinggi dada di lokasi titik, terlindung dari hujan dan sinar matahari langsung.
      Jumlah stiker: <b>${items.length}</b>.</div>
    <div class="st-grid">${cards || '<p>Belum ada titik patroli.</p>'}</div>`;
}

function cetakStikerQrTitik() {
  if (typeof qrcode === 'undefined') { showToast('Gagal', 'Pembuat QR belum termuat. Tunggu sebentar lalu coba lagi.', 'danger'); return; }
  // Jendela dibuka SEKARANG (masih dalam klik pengguna) agar tidak diblokir pop-up blocker,
  // lalu diisi setelah data dari server datang.
  const w = window.open('', '_blank');
  if (!w) { showToast('Gagal', 'Pop-up diblokir browser. Izinkan pop-up untuk alamat ini, lalu coba lagi.', 'danger'); return; }
  w.document.write('<p style="font-family:sans-serif;padding:24px;">Menyiapkan stiker QR...</p>');
  showSaving('Menyiapkan kode QR titik patroli...');
  google.script.run
    .withSuccessHandler(res => {
      hideSaving();
      if (!res.success) { w.close(); showToast('Gagal', res.message, 'danger'); return; }
      openPrintDocument(buildStikerQrHtml(res.data.titik || [], res.data.prefix || 'IPGUARD:TP:'), w);
      if (res.data.dibuat) showToast('Berhasil', res.message, 'success');
      loadMasterTab('MASTER_TITIK_PATROLI', document.querySelectorAll('#mdTabs .nav-link')[3]);
    })
    .withFailureHandler(e => { hideSaving(); w.close(); showToast('Gagal', e.message, 'danger'); })
    .generateKodeQrTitikPatroli();
}

function gantiKodeQrTitik(id) {
  openConfirmModal('Ganti kode QR titik ini? Stiker lama di lokasi langsung tidak berlaku dan harus diganti dengan stiker baru.',
    () => callServer('regenerateKodeQrTitik', [id], null,
      () => loadMasterTab('MASTER_TITIK_PATROLI', document.querySelectorAll('#mdTabs .nav-link')[3]), 'Mengganti kode QR...'));
}

// ════════════════════════════════════════════════════════
// ADMINISTRASI AKUN (Admin only — PRD Bab 7.1)
// ════════════════════════════════════════════════════════
function loadAdministrasi() {
  const c = document.getElementById('app-container');
  c.innerHTML = sectionHeader('Administrasi Akun & Konfigurasi Sistem', '8 Role, approval registrasi, audit trail — khusus Admin')
    + `<div class="card-ip mb-3">
         <h6 class="mb-2"><i class="bi bi-envelope-gear"></i> Konfigurasi Notifikasi</h6>
         <div class="row g-2 align-items-end">
           <div class="col-md-8"><label class="form-label">Email Admin — Tujuan Notifikasi Izin Tamu Masuk</label>
             <input type="email" class="form-control" id="cfgEmailAdminTamu" placeholder="admin@example.com" value="${AppState.config.emailAdminTamu || ''}"></div>
           <div class="col-md-4"><button class="btn btn-primary-ip w-100" onclick="saveEmailAdminTamu()"><i class="bi bi-check2"></i> Simpan</button></div>
         </div>
         <p class="section-sub mt-2 mb-0">Email berisi ringkasan pengajuan (format WA) dikirim otomatis ke alamat ini setiap ada pengajuan Izin Tamu Masuk baru.</p>
       </div>
       <div class="card-ip mb-3">
         <h6 class="mb-2"><i class="bi bi-telephone-forward"></i> Kontak Instansi Darurat</h6>
         <p class="section-sub mb-2">Nomor & email instansi untuk fitur "Hubungi Darurat" di modul Telepon Penting. Nomor WA/HP kosong tetap bisa isi email saja (atau sebaliknya).</p>
         <div class="row g-2 mb-2">
           <div class="col-md-4"><label class="form-label">No. WA/HP Polres</label><input type="text" class="form-control" id="cfgPhonePolres" value="${AppState.config.emergencyPolresPhone || ''}" placeholder="misal: 62812xxxxxxx"></div>
           <div class="col-md-4"><label class="form-label">No. WA/HP BPBD</label><input type="text" class="form-control" id="cfgPhoneBpbd" value="${AppState.config.emergencyBpbdPhone || ''}" placeholder="misal: 62812xxxxxxx"></div>
           <div class="col-md-4"><label class="form-label">No. WA/HP DAMKAR</label><input type="text" class="form-control" id="cfgPhoneDamkar" value="${AppState.config.emergencyDamkarPhone || ''}" placeholder="misal: 62812xxxxxxx"></div>
         </div>
         <div class="row g-2 mb-2">
           <div class="col-md-4"><label class="form-label">Email Polres</label><input type="email" class="form-control" id="cfgEmailPolres" value="${AppState.config.emergencyPolresEmail || ''}"></div>
           <div class="col-md-4"><label class="form-label">Email BPBD</label><input type="email" class="form-control" id="cfgEmailBpbd" value="${AppState.config.emergencyBpbdEmail || ''}"></div>
           <div class="col-md-4"><label class="form-label">Email DAMKAR</label><input type="email" class="form-control" id="cfgEmailDamkar" value="${AppState.config.emergencyDamkarEmail || ''}"></div>
         </div>
         <button class="btn btn-outline-ip btn-sm-ip" onclick="saveEmergencyEmails()"><i class="bi bi-check2"></i> Simpan Kontak Instansi Darurat</button>
       </div>
       <div class="card-ip mb-3">
         <h6 class="mb-1"><i class="bi bi-file-earmark-text"></i> Header Laporan PDF</h6>
         <p class="section-sub mb-3">Konfigurasi header resmi yang tampil di bagian atas setiap dokumen cetak (BA, Formulir, Surat).</p>
         <div class="row g-2 mb-3 align-items-end">
           <div class="col-md-4">
             <label class="form-label">Logo Kop Surat (sisi kiri header)</label>
             <div class="d-flex align-items-center gap-2 mb-2">
               <div style="width:64px;height:64px;border:1px solid var(--border-subtle);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--surface-card);">
                 <img id="logoLaporanPreview" src="${AppState.config.logoUrl || PLN_PRINT_LOGO}" style="max-width:100%;max-height:100%;">
               </div>
               <div class="flex-grow-1">
                 <input type="file" accept="image/png, image/jpeg, image/webp" class="form-control form-control-sm" id="logoLaporanInput" onchange="handleLaporanLogoUpload(event)">
                 <div class="small text-muted mt-1" id="logoLaporanStatus"></div>
               </div>
             </div>
           </div>
           <div class="col-md-4"><label class="form-label">Nama Unit (baris 1 header)</label>
             <input type="text" class="form-control" id="cfgNamaUnit" value="${AppState.config.namaUnit || ''}"></div>
           <div class="col-md-4"><label class="form-label">Nama Sistem (baris 2 header)</label>
             <input type="text" class="form-control" id="cfgNamaSistem" value="${AppState.config.namaSistem || ''}"></div>
         </div>
         <button class="btn btn-outline-ip btn-sm-ip mb-3" onclick="saveNamaUnitSistem()"><i class="bi bi-check2"></i> Simpan Nama Unit/Sistem</button>
         <div id="tblLaporanHeader"></div>
       </div>
       <div class="card-ip mb-3">
         <h6 class="mb-1"><i class="bi bi-shield-lock"></i> Akses Menu per Role</h6>
         <p class="section-sub mb-3">Centang menu mana yang boleh diakses tiap role. Alur approval bertahap (Danru → TL Keamanan, dst.) tetap mengikuti aturan sistem, tidak diatur di sini.</p>
         <div id="tblRoleAccess"><div class="text-center text-muted py-3"><span class="spinner-border spinner-border-sm"></span></div></div>
       </div>
       <div id="tblUsers"></div>`;
  loadLaporanHeaderTable();
  loadRoleAccessTable();
  google.script.run.withSuccessHandler(res => {
    renderGenericTable('tblUsers',
      [ {label:'Nama', key:'Nama'}, {label:'Username', key:'Username'},
        {label:'Role', render:r=>`
          <div class="d-flex gap-1 align-items-center">
            <select class="form-select form-select-sm" style="width:auto;" id="roleSelect_${r.ID}">${selectOptions(Object.keys(ROLE_LABEL).map(k=>ROLE_LABEL[k]), ROLE_LABEL[r.Role])}</select>
            <button class="btn btn-outline-ip btn-sm-ip" title="Simpan Role" onclick="saveUserRole('${r.ID}')"><i class="bi bi-check2"></i></button>
          </div>` },
        {label:'Email', render:r=>r.Email||'-'}, {label:'Status', render:r=>statusPill(r.Status)} ],
      (res.data||[]),
      row => row.Status === 'Pending'
        ? `<button class="btn btn-primary-ip btn-sm-ip" onclick="callServer('approveAccount',['${row.ID}',true],'Akun disetujui',loadAdministrasi)">Setujui</button>
           <button class="btn btn-outline-ip btn-sm-ip" onclick="callServer('approveAccount',['${row.ID}',false],'Akun ditolak',loadAdministrasi)">Tolak</button>`
        : (row.Status === 'Aktif' ? `<button class="btn btn-outline-ip btn-sm-ip" onclick="callServer('updateFieldById',['USERS','${row.ID}',{Status:'Nonaktif'}],'Akun dinonaktifkan',loadAdministrasi)">Nonaktifkan</button>`
           : `<button class="btn btn-outline-ip btn-sm-ip" onclick="callServer('updateFieldById',['USERS','${row.ID}',{Status:'Aktif'}],'Akun diaktifkan',loadAdministrasi)">Aktifkan</button>`)
    );
  }).getAllData('USERS');
}
async function handleLaporanLogoUpload(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('logoLaporanStatus');
  statusEl.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Mengunggah...';
  try {
    const compressed = await compressImageFile_(file);
    const res = await gsRun('uploadLaporanLogo', compressed.base64, compressed.fileName, compressed.mimeType);
    if (!res.success) throw new Error(res.message);
    const logoUrl = res.data.directUrl;
    const setRes = await gsRun('setConfigValue', 'logoUrl', logoUrl);
    if (!setRes.success) throw new Error(setRes.message);
    AppState.config.logoUrl = logoUrl;
    document.getElementById('logoLaporanPreview').src = logoUrl;
    statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> Logo diperbarui, langsung dipakai di cetakan berikutnya.';
    showToast('Berhasil', 'Logo kop surat diperbarui.', 'success');
  } catch (err) {
    statusEl.innerHTML = `<span class="text-danger">${err.message}</span>`;
  }
}
function saveNamaUnitSistem() {
  const namaUnit = val('cfgNamaUnit'), namaSistem = val('cfgNamaSistem');
  showSaving('Menyimpan...');
  Promise.all([gsRun('setConfigValue', 'namaUnit', namaUnit), gsRun('setConfigValue', 'namaSistem', namaSistem)])
    .then(() => {
      hideSaving();
      AppState.config.namaUnit = namaUnit; AppState.config.namaSistem = namaSistem;
      showToast('Berhasil', 'Nama Unit/Sistem tersimpan.', 'success');
    })
    .catch(err => { hideSaving(); showToast('Error', err.message, 'danger'); });
}
let laporanHeaderRows = [];
function loadLaporanHeaderTable() {
  google.script.run.withSuccessHandler(res => {
    laporanHeaderRows = res.data || [];
    renderLaporanHeaderTable();
  }).getAllData('LAPORAN_HEADER_CONFIG');
}
function renderLaporanHeaderTable() {
  const wrap = document.getElementById('tblLaporanHeader');
  wrap.innerHTML = `<div class="table-responsive-ip"><table class="table-ip">
    <thead><tr><th>Jenis Laporan</th><th>Judul Formulir</th><th>No. Dokumen</th><th>Tanggal Terbit</th><th>Revisi</th><th>Aksi</th></tr></thead>
    <tbody>${laporanHeaderRows.map(r => `
      <tr>
        <td><b>${r.LabelLaporan}</b></td>
        <td><input type="text" class="form-control form-control-sm" id="lh_judul_${r.ID}" value="${r.JudulFormulir||''}"></td>
        <td><input type="text" class="form-control form-control-sm" id="lh_nodok_${r.ID}" value="${r.NoDokumen||''}" style="width:130px;"></td>
        <td><input type="text" class="form-control form-control-sm" id="lh_tgl_${r.ID}" value="${r.TanggalTerbit||''}" style="width:130px;"></td>
        <td><input type="text" class="form-control form-control-sm" id="lh_rev_${r.ID}" value="${r.Revisi||''}" style="width:70px;"></td>
        <td><button class="btn btn-outline-ip btn-sm-ip" title="Simpan" onclick="saveLaporanHeaderRow('${r.ID}')"><i class="bi bi-check2"></i></button></td>
      </tr>`).join('')}</tbody>
  </table></div>`;
}
function saveLaporanHeaderRow(id) {
  const fields = {
    JudulFormulir: val('lh_judul_' + id), NoDokumen: val('lh_nodok_' + id),
    TanggalTerbit: val('lh_tgl_' + id), Revisi: val('lh_rev_' + id)
  };
  callServer('updateFieldById', ['LAPORAN_HEADER_CONFIG', id, fields], 'Header laporan diperbarui.', () => {
    loadLaporanHeaderTable();
    loadLaporanHeaderConfig(); // segarkan cache AppState supaya cetakan berikutnya langsung pakai nilai baru
  }, 'Menyimpan...');
}

let roleAccessRows = [];
function loadRoleAccessTable() {
  google.script.run.withSuccessHandler(res => {
    roleAccessRows = res.data || [];
    renderRoleAccessTable();
  }).getAllData('ROLE_MENU_ACCESS');
}
function renderRoleAccessTable() {
  const roleKeys = Object.keys(ROLE_LABEL);
  const wrap = document.getElementById('tblRoleAccess');
  wrap.innerHTML = `<div class="table-responsive-ip"><table class="table-ip">
      <thead><tr><th>Menu</th>${roleKeys.map(rk=>`<th class="text-center">${ROLE_LABEL[rk]}</th>`).join('')}</tr></thead>
      <tbody>${roleAccessRows.map(r => `
        <tr>
          <td><b>${r.LabelMenu}</b></td>
          ${roleKeys.map(rk => `<td class="text-center"><input type="checkbox" id="racc_${r.ID}_${rk}" ${(r[rk]===true||r[rk]==='TRUE')?'checked':''}></td>`).join('')}
        </tr>`).join('')}</tbody>
    </table></div>
    <button class="btn btn-primary-ip btn-sm-ip mt-2" onclick="saveRoleAccessTable()"><i class="bi bi-check2"></i> Simpan Akses Menu</button>`;
}
function saveRoleAccessTable() {
  const roleKeys = Object.keys(ROLE_LABEL);
  const rows = roleAccessRows.map(r => {
    const roles = {};
    roleKeys.forEach(rk => { roles[rk] = document.getElementById(`racc_${r.ID}_${rk}`).checked; });
    return { id: r.ID, roles };
  });
  callServer('saveRoleMenuAccess', [rows], 'Akses menu tersimpan.', () => {
    // segarkan cache yang dipakai canAccess() tanpa perlu login ulang
    google.script.run.withSuccessHandler(res => {
      if (res.success) {
        const raMap = {};
        (res.data.roleMenuAccess || []).forEach(r => {
          const roles = {};
          roleKeys.forEach(rk => { roles[rk] = (r[rk] === true || r[rk] === 'TRUE'); });
          raMap[r.ID] = roles;
        });
        AppState.roleMenuAccess = raMap;
        renderSidebar();
      }
    }).getAppBootstrapData();
  }, 'Menyimpan...');
}
function saveUserRole(id) {
  const sel = document.getElementById('roleSelect_' + id);
  const labelToKey = Object.fromEntries(Object.entries(ROLE_LABEL).map(([k,v]) => [v,k]));
  const newRole = labelToKey[sel.value];
  callServer('updateFieldById', ['USERS', id, { Role: newRole }], 'Role diperbarui.', loadAdministrasi, 'Menyimpan...');
}
function saveEmailAdminTamu() {
  const email = val('cfgEmailAdminTamu');
  callServer('setConfigValue', ['emailAdminTamu', email], 'Email notifikasi tersimpan.', () => { AppState.config.emailAdminTamu = email; }, 'Menyimpan...');
}
function saveEmergencyEmails() {
  const polresPhone = val('cfgPhonePolres'), bpbdPhone = val('cfgPhoneBpbd'), damkarPhone = val('cfgPhoneDamkar');
  const polres = val('cfgEmailPolres'), bpbd = val('cfgEmailBpbd'), damkar = val('cfgEmailDamkar');
  showSaving('Menyimpan...');
  Promise.all([
    gsRun('setConfigValue', 'emergencyPolresPhone', polresPhone),
    gsRun('setConfigValue', 'emergencyBpbdPhone', bpbdPhone),
    gsRun('setConfigValue', 'emergencyDamkarPhone', damkarPhone),
    gsRun('setConfigValue', 'emergencyPolresEmail', polres),
    gsRun('setConfigValue', 'emergencyBpbdEmail', bpbd),
    gsRun('setConfigValue', 'emergencyDamkarEmail', damkar)
  ]).then(() => {
    hideSaving();
    AppState.config.emergencyPolresPhone = polresPhone;
    AppState.config.emergencyBpbdPhone = bpbdPhone;
    AppState.config.emergencyDamkarPhone = damkarPhone;
    AppState.config.emergencyPolresEmail = polres;
    AppState.config.emergencyBpbdEmail = bpbd;
    AppState.config.emergencyDamkarEmail = damkar;
    showToast('Berhasil', 'Kontak instansi darurat tersimpan.', 'success');
  }).catch(err => { hideSaving(); showToast('Error', err.message, 'danger'); });
}

// ════════════════════════════════════════════════════════
// HELPER: Action bar tombol tambah + Export Excel (PRD Bab 7.4)
// ════════════════════════════════════════════════════════
/** exportColumns: opsional — array nama kolom spesifik untuk Export Excel (bukan semua kolom sheet). */
function actionBar(label, fnName, exportSheet, exportFilename, printConfig, exportColumns) {
  return `<div class="mb-3 d-flex justify-content-end gap-2 flex-wrap">
    ${printConfig ? `<button class="btn btn-outline-ip" onclick='cetakLaporanTabel(${JSON.stringify(printConfig)})'><i class="bi bi-file-earmark-pdf"></i> Cetak Laporan</button>` : ''}
    ${exportSheet ? `<button class="btn btn-outline-ip" onclick='exportToExcel(${JSON.stringify(exportSheet)},${JSON.stringify(exportFilename || exportSheet)},${JSON.stringify(exportColumns || null)})'><i class="bi bi-file-earmark-excel"></i> Export Excel</button>` : ''}
    <button class="btn btn-primary-ip" onclick="${fnName}()"><i class="bi bi-plus-lg"></i> ${label}</button>
  </div>`;
}

/** Cetak rekap tabel modul sebagai laporan PDF-style dengan letterhead + 1 baris approval "Mengetahui" (PRD 7.4) */
function cetakLaporanTabel(cfg) {
  google.script.run.withSuccessHandler(res => {
    if (!res.success) { showToast('Gagal', res.message, 'danger'); return; }
    const rows = res.data || [];
    const cols = cfg.columns;
    const tableRows = rows.map(r => `<tr>${cols.map(c => `<td style="border:1px solid #ddd; padding:6px;">${r[c] ?? '-'}</td>`).join('')}</tr>`).join('');
    const body = buildLetterheadHTML(cfg.title, `LAP/${cfg.sheet}/${ipgToday()}`,
        `Periode cetak: ${new Date().toLocaleDateString('id-ID')} &nbsp;|&nbsp; Total data: ${rows.length}`) + `
      <table style="width:100%; border-collapse:collapse; margin-top:8px;">
        <thead><tr>${cols.map(c => `<th style="border:1px solid #ddd; padding:6px; background:#F4F7FB; text-align:left;">${c}</th>`).join('')}</tr></thead>
        <tbody>${tableRows || `<tr><td colspan="${cols.length}" style="text-align:center;padding:16px;color:#999;">Tidak ada data.</td></tr>`}</tbody>
      </table>` + buildApprovalTable([
        { label: 'Disiapkan oleh', name: AppState.user.Nama },
        { label: 'Mengetahui, TL Keamanan / SPS Keamanan', name: '' }
      ]);
    openPrintDocument(body);
  }).withFailureHandler(e=>showToast('Error',e.message,'danger')).getAllData(cfg.sheet);
}

// ── Export Excel (CSV) — client-side, tidak perlu round-trip tambahan ke server ──
/** columns: opsional — array nama kolom spesifik untuk dipakai (bukan semua kolom sheet). */
function exportToExcel(sheetName, filename, columns) {
  const title = 'Laporan ' + (filename || sheetName).replace(/_/g, ' ');
  showSaving('Menyiapkan file Excel (.xlsx)...');
  google.script.run.withSuccessHandler(res => {
    hideSaving();
    if (!res.success) { showToast('Info', res.message || 'Tidak ada data untuk diekspor.', 'danger'); return; }
    const byteChars = atob(res.data.base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}_${ipgToday()}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Berhasil', 'File Excel (.xlsx) berhasil diunduh.', 'success');
  }).withFailureHandler(e => { hideSaving(); showToast('Error', e.message, 'danger'); }).exportToXlsx(sheetName, title, columns);
}

// ── Cetak Berita Acara Mutasi Jaga (PRD Bab 7.4) ──
function cetakBAMutasiJaga(id) {
  google.script.run.withSuccessHandler(res => {
    if (!res.success) { showToast('Gagal', res.message, 'danger'); return; }
    const rows = res.data.filter(r => r.ID === id);
    if (rows.length === 0) { showToast('Gagal', 'Data tidak ditemukan.', 'danger'); return; }
    const r = rows[0];
    let sectionAEntries = [];
    try { sectionAEntries = JSON.parse(r.SectionA_Jurnal || '[]'); } catch(e) {}
    const sectionARows = sectionAEntries.length
      ? sectionAEntries.map(j => `<tr><td style="border:1px solid #ddd; padding:5px;">Rolling ${j.RollingKe}</td><td style="border:1px solid #ddd; padding:5px;">${j.JamRolling}</td><td style="border:1px solid #ddd; padding:5px;">${j.PetugasLama} → ${j.PetugasBaru}</td><td style="border:1px solid #ddd; padding:5px;">${j.Kondisi}</td><td style="border:1px solid #ddd; padding:5px;">${j.Catatan||'-'}</td></tr>`).join('')
      : `<tr><td colspan="5" style="text-align:center;padding:8px;color:#999;">Tidak ada entri jurnal tercatat.</td></tr>`;
    const body = buildLetterheadHTML('mutasiJaga',
        `No. BA: ${r.NoBA} &nbsp;|&nbsp; ${r.PosJaga} &nbsp;|&nbsp; Shift ${r.Shift} &nbsp;|&nbsp; Regu ${r.Regu} &nbsp;|&nbsp; ${ipgTanggalDinasPanjang(r)}`) + `
      <p style="font-size:12px;"><b>Status Approval:</b> ${r.StatusApproval}</p>
      <table style="width:100%; border-collapse:collapse; margin-top:4px;">
        <tr><td style="border:1px solid #ddd; padding:8px; width:24px; font-weight:700; background:#F4F7FB; vertical-align:top;">A</td>
            <td style="border:1px solid #ddd; padding:8px;"><b>Informasi Shift & Regu Petugas</b> (dari Jurnal Pos)
              <table style="width:100%; border-collapse:collapse; margin-top:6px; font-size:11px;">
                <thead><tr><th style="border:1px solid #ddd; padding:5px; background:#eef2f8;">Rolling</th><th style="border:1px solid #ddd; padding:5px; background:#eef2f8;">Jam</th><th style="border:1px solid #ddd; padding:5px; background:#eef2f8;">Petugas</th><th style="border:1px solid #ddd; padding:5px; background:#eef2f8;">Kondisi</th><th style="border:1px solid #ddd; padding:5px; background:#eef2f8;">Catatan</th></tr></thead>
                <tbody>${sectionARows}</tbody>
              </table>
            </td></tr>
        <tr><td style="border:1px solid #ddd; padding:8px; font-weight:700; background:#F4F7FB; vertical-align:top;">B</td>
            <td style="border:1px solid #ddd; padding:8px;"><b>Kondisi Pos</b>
              <table style="width:100%; border-collapse:collapse; margin-top:6px; font-size:11px;">
                <thead><tr><th style="border:1px solid #ddd; padding:5px; background:#eef2f8;">Item</th><th style="border:1px solid #ddd; padding:5px; background:#eef2f8;">Kondisi</th><th style="border:1px solid #ddd; padding:5px; background:#eef2f8;">Keterangan</th></tr></thead>
                <tbody>${(function(){
                  let items = []; try { items = JSON.parse(r.SectionBItems || r.SectionB || '[]'); } catch(e){}
                  if (!Array.isArray(items) || items.length===0) return '<tr><td colspan="3" style="text-align:center;padding:6px;color:#999;">-</td></tr>';
                  return items.map(it=>`<tr><td style="border:1px solid #ddd; padding:5px;">${it.item}</td><td style="border:1px solid #ddd; padding:5px;">${it.kondisi}</td><td style="border:1px solid #ddd; padding:5px;">${it.keterangan||'-'}</td></tr>`).join('');
                })()}</tbody>
              </table>
            </td></tr>
        <tr><td style="border:1px solid #ddd; padding:8px; font-weight:700; background:#F4F7FB;">C</td>
            <td style="border:1px solid #ddd; padding:8px;"><b>Inventaris Tersedia di Pos:</b> ${(JSON.parse(r.SectionC||'{}').catatan)||'-'}</td></tr>
        <tr><td style="border:1px solid #ddd; padding:8px; font-weight:700; background:#F4F7FB;">D</td>
            <td style="border:1px solid #ddd; padding:8px;"><b>Temuan & Anomali:</b> ${r.SectionD_Temuan || 'Nihil / Tidak ada gangguan'}</td></tr>
        <tr><td style="border:1px solid #ddd; padding:8px; font-weight:700; background:#F4F7FB;">E</td>
            <td style="border:1px solid #ddd; padding:8px;"><b>Catatan Operasional:</b> ${r.SectionE_Catatan || '-'}</td></tr>
      </table>` + buildApprovalTable([
        { label: 'Danru Lama (Regu Menyerahkan)', name: r.DanruLamaBy },
        { label: 'Danru Baru (Regu Menerima)', name: r.DanruBaruBy },
        { label: 'TL Keamanan', name: r.TLBy }
      ], `BA Mutasi Jaga No. ${r.NoBA}`);
    openPrintDocument(body);
  }).withFailureHandler(e=>showToast('Error',e.message,'danger')).getAllData('MUTASI_JAGA');
}
