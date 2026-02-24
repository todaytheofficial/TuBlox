require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Release date: March 2, 2026 15:00 MSK (UTC+3)
const RELEASE_DATE = new Date('2026-03-02T15:00:00+03:00');

function isReleased() {
    return Date.now() >= RELEASE_DATE.getTime();
}

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('MongoDB connected');
        try {
            await mongoose.connection.collection('users').dropIndex('email_1');
        } catch (e) {}
    })
    .catch(err => console.error('MongoDB error:', err));

// User Schema
const userSchema = new mongoose.Schema({
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

// Pages
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

app.get('/countdown', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'countdown.html'));
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
    // Redirect to countdown if not released yet
    if (!isReleased()) {
        return res.redirect('/countdown');
    }
    res.sendFile(path.join(__dirname, 'pages', 'home.html'));
});

// API
app.get('/api/user', auth, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user._id,
            username: req.user.username,
            createdAt: req.user.createdAt,
            gameData: req.user.gameData
        }
    });
});

app.get('/api/release', (req, res) => {
    res.json({
        released: isReleased(),
        releaseDate: RELEASE_DATE.toISOString()
    });
});

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

        const hash = await bcrypt.hash(password, 12);
        const user = new User({ username: cleanUsername, password: hash });
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

app.post('/api/gamedata', auth, async (req, res) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));