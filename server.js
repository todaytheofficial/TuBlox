require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('MongoDB connected');
        try {
            await mongoose.connection.collection('users').dropIndex('email_1');
        } catch (e) {}
        
        // Создаём тестовую игру если нет игр
        const gameCount = await Game.countDocuments();
        if (gameCount === 0) {
            await Game.create({
                id: 'tublox-world',
                title: 'TuBlox World',
                description: 'The official TuBlox experience! Explore, build, and play with friends in an open world adventure.',
                creator: 'TuBlox',
                creatorId: 1,
                thumbnail: '/img/games/tublox-world.png',
                featured: true,
                visits: 0,
                likes: 95,
                maxPlayers: 50,
                serverHost: '127.0.0.1',
                serverPort: 7777
            });
            console.log('Default game created');
        }
    })
    .catch(err => console.error('MongoDB error:', err));

// Counter for auto-increment ID
const counterSchema = new mongoose.Schema({
    _id: String,
    seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

async function getNextUserId() {
    const counter = await Counter.findByIdAndUpdate(
        'userId',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq;
}

// User Schema
const userSchema = new mongoose.Schema({
    odilId: { type: Number, unique: true },
    username: { 
        type: String, 
        required: true, 
        unique: true, 
        minlength: 3, 
        maxlength: 20,
        lowercase: true,
        trim: true
    },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now },
    gameData: {
        level: { type: Number, default: 1 },
        coins: { type: Number, default: 0 },
        playTime: { type: Number, default: 0 }
    }
});

const User = mongoose.model('User', userSchema);

// Game Schema
const gameSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    creator: { type: String, required: true },
    creatorId: { type: Number },
    thumbnail: { type: String, default: '' },
    featured: { type: Boolean, default: false },
    visits: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    activePlayers: { type: Number, default: 0 },
    maxPlayers: { type: Number, default: 50 },
    serverHost: { type: String, default: '127.0.0.1' },
    serverPort: { type: Number, default: 7777 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Game = mongoose.model('Game', gameSchema);

// Launch Token Schema (для безопасного запуска игры)
const launchTokenSchema = new mongoose.Schema({
    token: { type: String, unique: true },
    odilId: { type: Number, required: true },
    username: { type: String, required: true },
    gameId: { type: String, required: true },
    serverHost: { type: String },
    serverPort: { type: Number },
    createdAt: { type: Date, default: Date.now, expires: 300 } // 5 минут
});

const LaunchToken = mongoose.model('LaunchToken', launchTokenSchema);

// Auth Middleware
const auth = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.redirect('/auth');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            res.clearCookie('token');
            return res.redirect('/auth');
        }
        
        req.user = user;
        next();
    } catch (err) {
        res.clearCookie('token');
        res.redirect('/auth');
    }
};

const authAPI = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            res.clearCookie('token');
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }
        
        req.user = user;
        next();
    } catch (err) {
        res.clearCookie('token');
        res.status(401).json({ success: false, message: 'Not authorized' });
    }
};

// ============================================
// Countdown Middleware — ДО всех роутов
// ============================================
const LAUNCH_DATE = new Date('2026-03-05T15:00:00+03:00'); // 5 марта 2026, 15:00 MSK
const COUNTDOWN_ENABLED = true; // переключатель

function countdownRedirect(req, res, next) {
    if (!COUNTDOWN_ENABLED) return next();
    if (Date.now() >= LAUNCH_DATE.getTime()) return next();
    
    // Пропускаем: landing (/), auth (/auth), countdown, API, статику
    const allowed = ['/', '/auth', '/countdown'];
    const isAllowed = allowed.includes(req.path) 
        || req.path.startsWith('/api/') 
        || req.path.startsWith('/css/') 
        || req.path.startsWith('/js/') 
        || req.path.startsWith('/img/')
        || req.path.startsWith('/fonts/');
    
    if (isAllowed) return next();
    
    // Всё остальное → countdown
    return res.redirect('/countdown');
}

app.use(countdownRedirect);

// ═══════════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
    try {
        const token = req.cookies.token;
        if (token && jwt.verify(token, process.env.JWT_SECRET)) {
            return res.redirect('/home');
        }
    } catch (e) {
        res.clearCookie('token');
    }
    res.sendFile(path.join(__dirname, 'pages', 'landing.html'));
});

app.get('/auth', (req, res) => {
    try {
        const token = req.cookies.token;
        if (token && jwt.verify(token, process.env.JWT_SECRET)) {
            return res.redirect('/home');
        }
    } catch (e) {
        res.clearCookie('token');
    }
    res.sendFile(path.join(__dirname, 'pages', 'auth.html'));
});

app.get('/home', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'home.html'));
});

app.get('/games', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'games.html'));
});

app.get('/game/:id', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'game.html'));
});

app.get('/users', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'users.html'));
});

app.get('/user/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'profile.html'));
});

app.get('/countdown', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'countdown.html'));
});

// ═══════════════════════════════════════════════════════════════
// API - USER
// ═══════════════════════════════════════════════════════════════

app.get('/api/user', authAPI, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user._id,
            odilId: req.user.odilId,
            username: req.user.username,
            createdAt: req.user.createdAt,
            gameData: req.user.gameData
        }
    });
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find()
            .select('odilId username gameData createdAt')
            .sort({ createdAt: -1 })
            .limit(100);
        
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findOne({ odilId: parseInt(id) })
            .select('odilId username gameData createdAt');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════
// API - AUTH
// ═══════════════════════════════════════════════════════════════

app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'All fields required' });
        }

        const cleanUsername = username.toLowerCase().trim();

        if (cleanUsername.length < 3 || cleanUsername.length > 20) {
            return res.status(400).json({ success: false, message: 'Username must be 3-20 characters' });
        }

        if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
            return res.status(400).json({ success: false, message: 'Username can only contain letters, numbers and underscore' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const exists = await User.findOne({ username: cleanUsername });
        if (exists) {
            return res.status(400).json({ success: false, message: 'Username already taken' });
        }

        const odilId = await getNextUserId();
        const hash = await bcrypt.hash(password, 12);
        
        const user = new User({ 
            username: cleanUsername, 
            password: hash,
            odilId: odilId
        });
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, { 
            httpOnly: true, 
            maxAge: 7 * 24 * 60 * 60 * 1000, 
            sameSite: 'strict' 
        });
        
        res.json({ success: true, odilId });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'All fields required' });
        }

        const cleanUsername = username.toLowerCase().trim();
        const user = await User.findOne({ username: cleanUsername });
        
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid username or password' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(400).json({ success: false, message: 'Invalid username or password' });
        }

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, { 
            httpOnly: true, 
            maxAge: 7 * 24 * 60 * 60 * 1000, 
            sameSite: 'strict' 
        });
        
        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// API - GAMES
// ═══════════════════════════════════════════════════════════════

// Получить список игр
app.get('/api/games', async (req, res) => {
    try {
        const { featured, limit } = req.query;
        
        let query = {};
        if (featured === 'true') {
            query.featured = true;
        }
        
        const games = await Game.find(query)
            .sort({ featured: -1, visits: -1 })
            .limit(parseInt(limit) || 50);
        
        res.json({ success: true, games });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Получить игру по ID
app.get('/api/game/:id', async (req, res) => {
    try {
        const game = await Game.findOne({ id: req.params.id });
        
        if (!game) {
            return res.status(404).json({ success: false, message: 'Game not found' });
        }
        
        res.json({ success: true, game });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Запуск игры - создаёт токен для клиента
app.post('/api/game/launch', authAPI, async (req, res) => {
    try {
        const { gameId } = req.body;
        
        const game = await Game.findOne({ id: gameId });
        if (!game) {
            return res.status(404).json({ success: false, message: 'Game not found' });
        }
        
        // Увеличиваем счётчик посещений
        game.visits += 1;
        await game.save();
        
        // Создаём уникальный токен для запуска
        const token = crypto.randomBytes(32).toString('hex');
        
        await LaunchToken.create({
            token,
            odilId: req.user.odilId,
            username: req.user.username,
            gameId: game.id,
            serverHost: game.serverHost,
            serverPort: game.serverPort
        });
        
        res.json({ 
            success: true, 
            token,
            serverHost: game.serverHost,
            serverPort: game.serverPort
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Валидация токена (вызывается клиентом при запуске)
app.get('/api/game/validate/:token', async (req, res) => {
    try {
        const launchData = await LaunchToken.findOne({ token: req.params.token });
        
        if (!launchData) {
            return res.status(404).json({ success: false, message: 'Invalid or expired token' });
        }
        
        // Удаляем токен после использования
        await LaunchToken.deleteOne({ token: req.params.token });
        
        res.json({
            success: true,
            odilId: launchData.odilId,
            username: launchData.username,
            gameId: launchData.gameId,
            serverHost: launchData.serverHost,
            serverPort: launchData.serverPort
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Лайк игры
app.post('/api/game/:id/like', authAPI, async (req, res) => {
    try {
        const game = await Game.findOne({ id: req.params.id });
        if (!game) {
            return res.status(404).json({ success: false, message: 'Game not found' });
        }
        
        // TODO: проверить что пользователь ещё не лайкал
        game.likes = Math.min(100, game.likes + 1);
        await game.save();
        
        res.json({ success: true, likes: game.likes });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════
// API - GAME DATA
// ═══════════════════════════════════════════════════════════════

app.post('/api/gamedata', authAPI, async (req, res) => {
    try {
        const { level, coins, playTime } = req.body;
        const update = {};
        
        if (typeof level === 'number') update['gameData.level'] = level;
        if (typeof coins === 'number') update['gameData.coins'] = coins;
        if (typeof playTime === 'number') update['gameData.playTime'] = playTime;
        
        await User.findByIdAndUpdate(req.user._id, update);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Save error' });
    }
});

// ═══════════════════════════════════════════════════════════════
// API - GAME SERVERS
// ═══════════════════════════════════════════════════════════════

const gameServers = new Map();

app.post('/api/servers/register', (req, res) => {
    const { name, port, maxPlayers, gameId } = req.body;
    const host = '127.0.0.1';
    const serverId = `${host}:${port || 7777}`;
    
    gameServers.set(serverId, {
        id: serverId,
        name: name || 'Game Server',
        host: host,
        port: port || 7777,
        maxPlayers: maxPlayers || 64,
        players: 0,
        gameId: gameId || 'tublox-world',
        lastSeen: Date.now()
    });
    
    console.log(`[Servers] Registered: ${serverId}`);
    res.json({ success: true, serverId });
});

app.post('/api/servers/heartbeat', async (req, res) => {
    const { serverId, players } = req.body;
    
    if (gameServers.has(serverId)) {
        const server = gameServers.get(serverId);
        server.players = players || 0;
        server.lastSeen = Date.now();
        
        // Обновляем activePlayers в игре
        if (server.gameId) {
            await Game.findOneAndUpdate(
                { id: server.gameId },
                { activePlayers: players || 0 }
            );
        }
        
        res.json({ success: true });
    } else {
        gameServers.set(serverId, {
            id: serverId,
            name: 'Game Server',
            host: serverId.split(':')[0],
            port: parseInt(serverId.split(':')[1]) || 7777,
            maxPlayers: 64,
            players: players || 0,
            lastSeen: Date.now()
        });
        res.json({ success: true, registered: true });
    }
});

app.get('/download/TuClient.zip', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'download', 'TuClient.zip');
    
    if (!require('fs').existsSync(filePath)) {
        return res.status(404).send('File not found');
    }
    
    res.download(filePath, 'TuClient.zip');
});

app.get('/api/servers', (req, res) => {
    const now = Date.now();
    const servers = [];
    
    for (const [id, server] of gameServers) {
        if (now - server.lastSeen > 15000) {
            gameServers.delete(id);
            console.log(`[Servers] Removed offline: ${id}`);
        } else {
            servers.push(server);
        }
    }
    
    res.json({ success: true, servers });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));