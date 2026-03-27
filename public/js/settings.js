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
    } catch (e) {
        sToast('Failed to load account', 'error');
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
        sToast('Theme updated');
    }
}

// ═══════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════

function initSettingsEvents() {
    byId('change-username-btn').addEventListener('click', changeUsername);
    byId('new-username').addEventListener('keypress', e => { if (e.key === 'Enter') changeUsername(); });

    byId('change-password-btn').addEventListener('click', changePassword);
    byId('confirm-password').addEventListener('keypress', e => { if (e.key === 'Enter') changePassword(); });

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

    if (!val) return sToast('Enter a username', 'error');
    if (val.length < 3 || val.length > 20) return sToast('Must be 3–20 characters', 'error');
    if (!/^[a-z0-9_]+$/.test(val)) return sToast('Only letters, numbers, underscore', 'error');
    if (val === settingsUser.username) return sToast('Already your username', 'error');

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
            sToast('Username changed');
        } else {
            sToast(data.message || 'Failed', 'error');
        }
    } catch (e) {
        sToast('Connection error', 'error');
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

    if (!cur || !nw || !conf) return sToast('Fill all fields', 'error');
    if (nw.length < 6) return sToast('Min 6 characters', 'error');
    if (nw !== conf) return sToast('Passwords don\'t match', 'error');
    if (cur === nw) return sToast('New password must be different', 'error');

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
            sToast('Password changed');
        } else {
            sToast(data.message || 'Failed', 'error');
        }
    } catch (e) {
        sToast('Connection error', 'error');
    }
    setBtnLoading(btn, false, 'Change Password');
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

function sToast(msg, type) {
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