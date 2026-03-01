// ============================================
// Console
// ============================================
console.clear();
console.log('%cTUBLOX', 'font-size:52px;font-weight:800;color:#fff;');
console.log('%c⛔ STOP!', 'font-size:24px;font-weight:bold;color:#f00;');
console.log('%cDo not paste code here.', 'font-size:14px;color:#ff4444;');

// ============================================
// Countdown Config
// ============================================
// 3 марта 2026, 15:00 по МСК (UTC+3) = 12:00 UTC
const LAUNCH_DATE = new Date('2026-03-03T12:00:00Z');

function isBeforeLaunch() {
    return new Date() < LAUNCH_DATE;
}

function isCountdownPage() {
    return !!document.querySelector('.countdown-page');
}

function isAuthPage() {
    return !!document.querySelector('.auth-tabs');
}

// ============================================
// Redirect Logic
// ============================================
function checkCountdownRedirect() {
    if (isBeforeLaunch()) {
        // До запуска — все страницы кроме countdown и auth → редирект на countdown
        if (!isCountdownPage() && !isAuthPage()) {
            location.href = '/countdown';
            return true;
        }
    } else {
        // После запуска — если на countdown → редирект на главную
        if (isCountdownPage()) {
            location.href = '/';
            return true;
        }
    }
    return false;
}

// ============================================
// Countdown Timer
// ============================================
function startCountdown() {
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function update() {
        const now = new Date();
        const diff = LAUNCH_DATE - now;

        if (diff <= 0) {
            // Таймер закончился — редирект на главную
            daysEl.textContent = '00';
            hoursEl.textContent = '00';
            minutesEl.textContent = '00';
            secondsEl.textContent = '00';
            
            // Перенаправляем на главную через 1 секунду
            setTimeout(() => {
                location.href = '/';
            }, 1000);
            return;
        }

        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        daysEl.textContent = pad(days);
        hoursEl.textContent = pad(hours);
        minutesEl.textContent = pad(minutes);
        secondsEl.textContent = pad(seconds);

        requestAnimationFrame(() => {
            setTimeout(update, 1000 - (Date.now() % 1000));
        });
    }

    update();
}

// ============================================
// Toast
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
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, 3000);
}

// ============================================
// Current User
// ============================================
let currentUser = null;

// ============================================
// Auth
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
            toast(`Account created! ID: #${data.odilId}`);
            // Если до запуска — возвращаем на countdown, иначе на home
            setTimeout(() => {
                location.href = isBeforeLaunch() ? '/countdown' : '/home';
            }, 1000);
        } else {
            toast(data.message, 'error');
        }
    } catch { toast('Connection error', 'error'); }
    btn.innerHTML = html;
    btn.disabled = false;
}

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
            // Если до запуска — возвращаем на countdown, иначе на home
            setTimeout(() => {
                location.href = isBeforeLaunch() ? '/countdown' : '/home';
            }, 600);
        } else {
            toast(data.message, 'error');
        }
    } catch { toast('Connection error', 'error'); }
    btn.innerHTML = html;
    btn.disabled = false;
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    location.href = isBeforeLaunch() ? '/countdown' : '/';
}

// ============================================
// User Data
// ============================================
async function loadUser() {
    try {
        const res = await fetch('/api/user');
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            
            document.querySelectorAll('.username').forEach(el => el.textContent = data.user.username);
            document.querySelectorAll('.odil-id').forEach(el => el.textContent = `#${data.user.odilId}`);

            const level = document.getElementById('user-level');
            const coins = document.getElementById('user-coins');
            const time = document.getElementById('user-playtime');
            if (level) level.textContent = data.user.gameData.level;
            if (coins) coins.textContent = data.user.gameData.coins;
            if (time) time.textContent = Math.floor(data.user.gameData.playTime / 60) + 'h';
        }
    } catch (e) { console.error(e); }
}

// ============================================
// Games
// ============================================
function gameCardHTML(game, large = false) {
    const placeholder = `
        <div class="placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="6" width="20" height="12" rx="2"/>
                <path d="M6 12h4M8 10v4M14 10l4 4M14 14l4-4"/>
            </svg>
        </div>
    `;
    
    return `
        <div class="game-card ${large ? 'large' : ''}" onclick="location.href='/game/${game.id}'">
            <div class="game-card-image">
                ${game.thumbnail ? `<img src="${game.thumbnail}" alt="${game.title}">` : placeholder}
                <div class="game-card-players">
                    <span class="dot"></span>
                    <span>${game.activePlayers || 0} playing</span>
                </div>
            </div>
            <div class="game-card-info">
                <div class="game-card-title">${game.title}</div>
                <div class="game-card-creator">by ${game.creator}</div>
            </div>
        </div>
    `;
}

function featuredGameHTML(game) {
    const placeholder = `
        <div class="placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="6" width="20" height="12" rx="2"/>
                <path d="M6 12h4M8 10v4M14 10l4 4M14 14l4-4"/>
            </svg>
        </div>
    `;
    
    return `
        <div class="featured-game" onclick="location.href='/game/${game.id}'">
            <div class="featured-game-image">
                ${game.thumbnail ? `<img src="${game.thumbnail}" alt="${game.title}">` : placeholder}
            </div>
            <div class="featured-game-info">
                <div class="featured-game-badge">Featured</div>
                <h3 class="featured-game-title">${game.title}</h3>
                <p class="featured-game-desc">${game.description || 'No description'}</p>
                <div class="featured-game-stats">
                    <span><strong>${game.activePlayers || 0}</strong> playing</span>
                    <span><strong>${formatNumber(game.visits || 0)}</strong> visits</span>
                    <span><strong>${game.likes || 0}%</strong> likes</span>
                </div>
                <button class="btn btn-primary" onclick="event.stopPropagation(); playGame('${game.id}')">
                    <svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Play Now
                </button>
            </div>
        </div>
    `;
}

async function loadFeaturedGame() {
    const container = document.getElementById('featured-game');
    if (!container) return;
    
    try {
        const res = await fetch('/api/games?featured=true&limit=1');
        const data = await res.json();
        
        if (data.success && data.games.length > 0) {
            container.innerHTML = featuredGameHTML(data.games[0]);
        } else {
            container.innerHTML = '<p class="no-content">No games available</p>';
        }
    } catch (e) {
        container.innerHTML = '<p class="no-content">Error loading games</p>';
    }
}

async function loadAllGames() {
    const container = document.getElementById('all-games');
    if (!container) return;
    
    try {
        const res = await fetch('/api/games');
        const data = await res.json();
        
        if (data.success && data.games.length > 0) {
            container.innerHTML = data.games.map(g => gameCardHTML(g, true)).join('');
        } else {
            container.innerHTML = '<p class="no-content">No games available</p>';
        }
    } catch (e) {
        container.innerHTML = '<p class="no-content">Error loading games</p>';
    }
}

async function loadGamePage() {
    const container = document.getElementById('game-content');
    if (!container) return;
    
    const gameId = location.pathname.split('/').pop();
    
    try {
        const res = await fetch(`/api/game/${gameId}`);
        const data = await res.json();
        
        if (data.success) {
            const g = data.game;
            const placeholder = `
                <div class="placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="2" y="6" width="20" height="12" rx="2"/>
                        <path d="M6 12h4M8 10v4M14 10l4 4M14 14l4-4"/>
                    </svg>
                </div>
            `;
            
            container.innerHTML = `
                <div class="game-hero">
                    <div class="game-media">
                        ${g.thumbnail ? `<img src="${g.thumbnail}" alt="${g.title}">` : placeholder}
                    </div>
                    <div class="game-sidebar">
                        <div class="game-main-card">
                            <h1 class="game-title">${g.title}</h1>
                            <p class="game-creator">by <a href="/user/${g.creatorId}">${g.creator}</a></p>
                            
                            <div class="game-stats">
                                <div class="game-stat">
                                    <div class="game-stat-value">${g.activePlayers || 0}</div>
                                    <div class="game-stat-label">Playing</div>
                                </div>
                                <div class="game-stat">
                                    <div class="game-stat-value">${formatNumber(g.visits || 0)}</div>
                                    <div class="game-stat-label">Visits</div>
                                </div>
                                <div class="game-stat">
                                    <div class="game-stat-value">${g.likes || 0}%</div>
                                    <div class="game-stat-label">Likes</div>
                                </div>
                            </div>
                            
                            <button class="btn btn-primary play-button" onclick="playGame('${g.id}')">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5 3 19 12 5 21 5 3"/>
                                </svg>
                                Play
                            </button>
                            
                            <div class="game-actions">
                                <button class="btn btn-secondary" onclick="likeGame('${g.id}')">
                                    👍 Like
                                </button>
                                <button class="btn btn-secondary" onclick="shareGame('${g.id}')">
                                    🔗 Share
                                </button>
                            </div>
                        </div>
                        
                        <div class="game-description">
                            <h3>About</h3>
                            <p>${g.description || 'No description provided.'}</p>
                        </div>
                    </div>
                </div>
            `;
            
            document.title = `TuBlox — ${g.title}`;
        } else {
            container.innerHTML = `
                <div class="not-found">
                    <h2>Game not found</h2>
                    <a href="/games" class="btn btn-secondary">Browse Games</a>
                </div>
            `;
        }
    } catch (e) {
        container.innerHTML = '<p class="error">Error loading game</p>';
    }
}

// ============================================
// Play Game
// ============================================
async function launchGame(gameId) {
    try {
        const res = await fetch('/api/game/launch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId })
        });
        const data = await res.json();
        
        if (data.success) {
            const launchData = {
                username: currentUser.username,
                odilId: currentUser.odilId,
                host: data.serverHost || '127.0.0.1',
                port: data.serverPort || 7777,
                token: data.token
            };
            
            const jsonStr = JSON.stringify(launchData);
            console.log('Launch JSON:', jsonStr);
            
            const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
            console.log('Base64:', base64);
            
            const launchUrl = 'tublox://play/' + base64;
            console.log('Launch URL:', launchUrl);
            
            window.location.href = launchUrl;
            
            setTimeout(() => {
                closePlayModal();
                toast('Game launching...');
            }, 1500);
        } else {
            toast(data.message || 'Failed to launch', 'error');
            closePlayModal();
        }
    } catch (e) {
        console.error('Launch error:', e);
        toast('Connection error', 'error');
        closePlayModal();
    }
}

function playGame(gameId) {
    if (!currentUser) {
        toast('Please log in to play', 'error');
        return;
    }
    
    const modal = document.getElementById('play-modal');
    if (modal) {
        modal.classList.add('active');
        const status = document.getElementById('launch-status');
        const download = document.getElementById('launch-download');
        if (status) status.style.display = 'flex';
        if (download) download.style.display = 'none';
    }
    
    launchGame(gameId);
}

function closePlayModal() {
    const modal = document.getElementById('play-modal');
    if (modal) modal.classList.remove('active');
}

async function likeGame(gameId) {
    const res = await fetch(`/api/game/${gameId}/like`, { method: 'POST' });
    const data = await res.json();
    if (data.success) toast('Game liked!');
}

function shareGame(gameId) {
    navigator.clipboard.writeText(`${location.origin}/game/${gameId}`);
    toast('Link copied!');
}

// ============================================
// Users
// ============================================
async function loadUsers() {
    const grid = document.getElementById('users-grid');
    if (!grid) return;
    
    try {
        const res = await fetch('/api/users');
        const data = await res.json();
        
        if (data.success && data.users.length > 0) {
            grid.innerHTML = data.users.map(u => `
                <div class="user-card" onclick="location.href='/user/${u.odilId}'">
                    <div class="user-avatar"></div>
                    <div class="user-info">
                        <div class="user-name">${u.username}</div>
                        <div class="user-id">#${u.odilId}</div>
                    </div>
                    <div class="user-level">Lv.${u.gameData.level}</div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<p class="no-content">No players yet</p>';
        }
    } catch (e) {
        grid.innerHTML = '<p class="no-content">Error loading</p>';
    }
}

// ============================================
// Profile
// ============================================
async function loadProfile() {
    const content = document.getElementById('profile-content');
    if (!content) return;
    
    const id = location.pathname.split('/').pop();
    
    try {
        const res = await fetch(`/api/user/${id}`);
        const data = await res.json();
        
        if (data.success) {
            const u = data.user;
            content.innerHTML = `
                <div class="profile-header">
                    <div class="profile-avatar"></div>
                    <h1 class="profile-name">${u.username}</h1>
                    <div class="profile-id">#${u.odilId}</div>
                </div>
                <div class="profile-stats">
                    <div class="card profile-stat">
                        <div class="profile-stat-value">${u.gameData.level}</div>
                        <div class="profile-stat-label">Level</div>
                    </div>
                    <div class="card profile-stat">
                        <div class="profile-stat-value">${u.gameData.coins}</div>
                        <div class="profile-stat-label">Coins</div>
                    </div>
                    <div class="card profile-stat">
                        <div class="profile-stat-value">${Math.floor(u.gameData.playTime / 60)}h</div>
                        <div class="profile-stat-label">Play Time</div>
                    </div>
                </div>
            `;
        } else {
            content.innerHTML = '<div class="not-found"><h2>User not found</h2></div>';
        }
    } catch (e) {
        content.innerHTML = '<p class="error">Error</p>';
    }
}

// ============================================
// Helpers
// ============================================
function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
}

// ============================================
// Init
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // ======== COUNTDOWN REDIRECT CHECK ========
    // Проверяем первым делом — если нужно редиректить, не грузим остальное
    if (checkCountdownRedirect()) return;

    // ======== Countdown Page ========
    if (isCountdownPage()) {
        startCountdown();
        // Не грузим остальное — это страница ожидания
        return;
    }

    // Auth
    if (document.querySelector('.auth-tabs')) {
        initTabs();
        document.getElementById('register-form')?.addEventListener('submit', register);
        document.getElementById('login-form')?.addEventListener('submit', login);
    }
    
    // Home
    if (document.querySelector('.home-page')) {
        loadUser();
        loadFeaturedGame();
        document.getElementById('logout-btn')?.addEventListener('click', logout);
    }
    
    // Games
    if (document.querySelector('.games-page')) {
        loadUser();
        loadAllGames();
        document.getElementById('logout-btn')?.addEventListener('click', logout);
    }
    
    // Game
    if (document.querySelector('.game-page')) {
        loadUser();
        loadGamePage();
        document.getElementById('logout-btn')?.addEventListener('click', logout);
    }
    
    // Users
    if (document.querySelector('.users-page')) {
        loadUser();
        loadUsers();
        document.getElementById('logout-btn')?.addEventListener('click', logout);
    }
    
    // Profile
    if (document.querySelector('.profile-page')) {
        loadUser();
        loadProfile();
        document.getElementById('logout-btn')?.addEventListener('click', logout);
    }
    
    // Modal backdrop close
    document.querySelectorAll('.modal-backdrop').forEach(el => {
        el.onclick = () => el.closest('.modal').classList.remove('active');
    });
});