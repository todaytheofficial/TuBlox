// ═══════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════

let settingsUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettingsUser();
    initSettingsTheme();
    initSettingsEvents();
});

// ═══════════════════════════════════════════════════════════════
// LOAD USER
// ═══════════════════════════════════════════════════════════════

async function loadSettingsUser() {
    try {
        const res = await fetch('/api/user');
        const data = await res.json();
        if (!data.success) { window.location.href = '/auth'; return; }
        settingsUser = data.user;

        setText('display-username', settingsUser.username);
        setText('display-id', '#' + settingsUser.odilId);
        setText('display-joined', fmtDate(settingsUser.createdAt));
        setText('display-last-active', fmtDate(settingsUser.lastSeen || settingsUser.createdAt));
    } catch (e) {
        showSettingsToast('Failed to load account', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════

function initSettingsTheme() {
    const saved = localStorage.getItem('tublox-theme') || 'dark';
    applyThemeSelection(saved, false);

    document.querySelectorAll('.settings-theme-option').forEach(opt => {
        opt.addEventListener('click', () => {
            applyThemeSelection(opt.dataset.theme, true);
        });
    });
}

function applyThemeSelection(theme, save) {
    document.body.classList.remove('theme-dark', 'theme-midnight');
    document.body.classList.add('theme-' + theme);

    document.querySelectorAll('.settings-theme-option').forEach(opt => {
        const radio = opt.querySelector('input[type="radio"]');
        if (opt.dataset.theme === theme) {
            opt.classList.add('active');
            radio.checked = true;
        } else {
            opt.classList.remove('active');
            radio.checked = false;
        }
    });

    if (save) {
        localStorage.setItem('tublox-theme', theme);
        showSettingsToast('Theme updated');
    }
}

// ═══════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════

function initSettingsEvents() {
    // Username
    byId('change-username-btn').addEventListener('click', changeUsername);
    byId('new-username').addEventListener('keypress', e => { if (e.key === 'Enter') changeUsername(); });

    // Password change
    byId('change-password-btn').addEventListener('click', changePassword);

    // Toggle password view
    byId('toggle-password-btn').addEventListener('click', openVerifyModal);

    // Verify modal
    byId('verify-password-btn').addEventListener('click', verifyAndReveal);
    byId('verify-password-input').addEventListener('keypress', e => { if (e.key === 'Enter') verifyAndReveal(); });
    document.querySelector('#verify-modal .modal-backdrop').addEventListener('click', closeVerifyModal);

    // Logout
    byId('logout-btn').addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/';
    });
}

// ═══════════════════════════════════════════════════════════════
// CHANGE USERNAME
// ═══════════════════════════════════════════════════════════════

async function changeUsername() {
    const input = byId('new-username');
    const val = input.value.trim().toLowerCase();
    if (!val) return showSettingsToast('Enter a username', 'error');
    if (val.length < 3 || val.length > 20) return showSettingsToast('Must be 3–20 characters', 'error');
    if (!/^[a-z0-9_]+$/.test(val)) return showSettingsToast('Only letters, numbers, underscore', 'error');
    if (val === settingsUser.username) return showSettingsToast('Already your username', 'error');

    const btn = byId('change-username-btn');
    setBtnLoading(btn, true);

    try {
        const res = await fetch('/api/user/username', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: val })
        });
        const data = await res.json();
        if (data.success) {
            settingsUser.username = val;
            setText('display-username', val);
            input.value = '';
            showSettingsToast('Username changed');
        } else {
            showSettingsToast(data.message || 'Failed', 'error');
        }
    } catch (e) {
        showSettingsToast('Connection error', 'error');
    }
    setBtnLoading(btn, false, 'Save');
}

// ═══════════════════════════════════════════════════════════════
// CHANGE PASSWORD
// ═══════════════════════════════════════════════════════════════

async function changePassword() {
    const cur = byId('current-password').value;
    const nw = byId('new-password').value;
    const conf = byId('confirm-password').value;

    if (!cur || !nw || !conf) return showSettingsToast('Fill all fields', 'error');
    if (nw.length < 6) return showSettingsToast('Min 6 characters', 'error');
    if (nw !== conf) return showSettingsToast('Passwords don\'t match', 'error');

    const btn = byId('change-password-btn');
    setBtnLoading(btn, true);

    try {
        const res = await fetch('/api/user/password', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: cur, newPassword: nw })
        });
        const data = await res.json();
        if (data.success) {
            byId('current-password').value = '';
            byId('new-password').value = '';
            byId('confirm-password').value = '';
            showSettingsToast('Password changed');
        } else {
            showSettingsToast(data.message || 'Failed', 'error');
        }
    } catch (e) {
        showSettingsToast('Connection error', 'error');
    }
    setBtnLoading(btn, false, 'Change Password');
}

// ═══════════════════════════════════════════════════════════════
// VERIFY & REVEAL PASSWORD
// ═══════════════════════════════════════════════════════════════

function openVerifyModal() {
    byId('verify-modal').classList.add('active');
    const inp = byId('verify-password-input');
    inp.value = '';
    setTimeout(() => inp.focus(), 100);
}

function closeVerifyModal() {
    byId('verify-modal').classList.remove('active');
}

async function verifyAndReveal() {
    const pw = byId('verify-password-input').value;
    if (!pw) return showSettingsToast('Enter password', 'error');

    const btn = byId('verify-password-btn');
    setBtnLoading(btn, true);

    try {
        const res = await fetch('/api/user/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });
        const data = await res.json();
        if (data.success) {
            closeVerifyModal();
            const display = byId('password-display');
            const eyeOpen = document.querySelector('.eye-open');
            const eyeClosed = document.querySelector('.eye-closed');

            display.type = 'text';
            display.value = pw;
            eyeOpen.style.display = 'none';
            eyeClosed.style.display = 'block';

            showSettingsToast('Visible for 5 seconds');

            setTimeout(() => {
                display.type = 'password';
                display.value = '••••••••';
                eyeOpen.style.display = 'block';
                eyeClosed.style.display = 'none';
            }, 5000);
        } else {
            showSettingsToast(data.message || 'Wrong password', 'error');
        }
    } catch (e) {
        showSettingsToast('Connection error', 'error');
    }
    setBtnLoading(btn, false, 'Verify');
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function byId(id) { return document.getElementById(id); }
function setText(id, text) { const el = byId(id); if (el) el.textContent = text; }

function fmtDate(d) {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function setBtnLoading(btn, loading, label) {
    if (loading) {
        btn.disabled = true;
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = '<span class="loader"></span>';
    } else {
        btn.disabled = false;
        btn.innerHTML = label || btn.dataset.originalHtml || 'Save';
    }
}

function showSettingsToast(msg, type) {
    if (window.toast) { window.toast(msg, type || 'success'); return; }
    const c = byId('toast-container');
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'success');
    const icon = type === 'error'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    el.innerHTML = icon + '<span>' + msg + '</span>';
    c.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, 3000);
}