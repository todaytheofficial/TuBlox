// ============================================
// Console Branding & Security Warning
// ============================================
console.clear();

console.log(
    '%cTUBLOX',
    `
    font-size: 52px;
    font-weight: 800;
    color: #fff;
    background: #000;
    padding: 10px 20px;
    text-shadow: 0 0 10px rgba(255,255,255,0.3);
    `
);

console.log(
    '%c⛔ STOP!',
    'font-size: 24px; font-weight: bold; color: #ff0000;'
);

console.log(
    '%cIf someone told you to paste something here, it is a scam and will give them access to your account.',
    'font-size: 14px; color: #ff4444;'
);

console.log(
    '%cNever share your cookies, tokens, or paste code from strangers.',
    'font-size: 13px; color: #ff6666;'
);

// ============================================
// Countdown Timer
// ============================================
function initCountdown() {
    const countdown = document.getElementById('countdown');
    if (!countdown) return;

    // 2 марта 2026, 15:00 МСК (UTC+3)
    const releaseDate = new Date('2026-03-02T15:00:00+03:00').getTime();

    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    function update() {
        const now = Date.now();
        const diff = releaseDate - now;

        if (diff <= 0) {
            countdown.innerHTML = '<span class="countdown-ended">🎮 Game is Live!</span>';
            // Redirect to home after release
            setTimeout(() => {
                window.location.href = '/home';
            }, 2000);
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
        if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
        if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
        if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
    }

    update();
    setInterval(update, 1000);
}

// ============================================
// Toast Notifications
// ============================================
function toast(msg, type = 'success') {
    let c = document.querySelector('.toast-container');
    if (!c) {
        c = document.createElement('div');
        c.className = 'toast-container';
        document.body.appendChild(c);
    }

    const icon = type === 'success'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${icon}<span>${msg}</span>`;
    c.appendChild(el);

    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 200);
    }, 3000);
}

// ============================================
// Auth Tabs
// ============================================
function initTabs() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.onclick = () => {
            const t = tab.dataset.tab;
            document.querySelectorAll('.auth-tab').forEach(x => x.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(x => x.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${t}-form`).classList.add('active');
        };
    });
}

// ============================================
// Register
// ============================================
async function register(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const html = btn.innerHTML;
    btn.innerHTML = '<div class="loader"></div>';
    btn.disabled = true;

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('reg-username').value,
                password: document.getElementById('reg-password').value
            })
        });
        const data = await res.json();

        if (data.success) {
            toast('Account created');
            setTimeout(() => location.href = '/home', 600);
        } else {
            toast(data.message, 'error');
        }
    } catch {
        toast('Connection error', 'error');
    }

    btn.innerHTML = html;
    btn.disabled = false;
}

// ============================================
// Login
// ============================================
async function login(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const html = btn.innerHTML;
    btn.innerHTML = '<div class="loader"></div>';
    btn.disabled = true;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('login-username').value,
                password: document.getElementById('login-password').value
            })
        });
        const data = await res.json();

        if (data.success) {
            toast('Welcome back');
            setTimeout(() => location.href = '/home', 600);
        } else {
            toast(data.message, 'error');
        }
    } catch {
        toast('Connection error', 'error');
    }

    btn.innerHTML = html;
    btn.disabled = false;
}

// ============================================
// Logout
// ============================================
async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    location.href = '/';
}

// ============================================
// Load User Data
// ============================================
async function loadUser() {
    try {
        const res = await fetch('/api/user');
        const data = await res.json();

        if (data.success) {
            const u = data.user;
            document.querySelectorAll('.username').forEach(el => el.textContent = u.username);

            const level = document.getElementById('user-level');
            const coins = document.getElementById('user-coins');
            const time = document.getElementById('user-playtime');

            if (level) level.textContent = u.gameData.level;
            if (coins) coins.textContent = u.gameData.coins;
            if (time) time.textContent = Math.floor(u.gameData.playTime / 60) + 'h';
        }
    } catch (e) {
        console.error(e);
    }
}

// ============================================
// Init
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Countdown
    initCountdown();

    // Auth
    if (document.querySelector('.auth-tabs')) {
        initTabs();
        document.getElementById('register-form')?.addEventListener('submit', register);
        document.getElementById('login-form')?.addEventListener('submit', login);
    }

    // Home
    if (document.querySelector('.home-page')) {
        loadUser();
        document.getElementById('logout-btn')?.addEventListener('click', logout);
    }
});