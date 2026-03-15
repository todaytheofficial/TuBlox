// cleanup.js - Очистка пользователей
// Запуск: node cleanup.js

require('dotenv').config();
const mongoose = require('mongoose');

// Схемы
const counterSchema = new mongoose.Schema({
    _id: String,
    seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

const userSchema = new mongoose.Schema({
    odilId: { type: Number, unique: true },
    username: { type: String, required: true, unique: true, minlength: 3, maxlength: 20, lowercase: true, trim: true },
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

async function cleanup() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected!\n');

        // Показываем всех пользователей до очистки
        const allUsers = await User.find().select('odilId username');
        console.log('Users before cleanup:');
        allUsers.forEach(u => console.log(`  #${u.odilId} - ${u.username}`));
        console.log('');

        // Удаляем всех кроме today_idk и martovec
        const deleteResult = await User.deleteMany({
            username: { $nin: ['today_idk', 'martovec'] }
        });
        console.log(`Deleted ${deleteResult.deletedCount} users`);

        // Меняем martovec odilId на 2
        const martovec = await User.findOne({ username: 'martovec' });
        if (martovec) {
            martovec.odilId = 2;
            await martovec.save();
            console.log('Updated martovec: odilId = 2');
        } else {
            console.log('martovec not found');
        }

        // Проверяем today_idk
        const todayIdk = await User.findOne({ username: 'today_idk' });
        if (todayIdk) {
            console.log(`today_idk: odilId = ${todayIdk.odilId}`);
        }

        // Обновляем счётчик (следующий ID будет 3)
        await Counter.findByIdAndUpdate(
            'userId',
            { seq: 2 },
            { upsert: true }
        );
        console.log('Counter reset: next odilId = 3');

        // Показываем результат
        console.log('\nUsers after cleanup:');
        const remaining = await User.find().select('odilId username').sort({ odilId: 1 });
        remaining.forEach(u => console.log(`  #${u.odilId} - ${u.username}`));

        console.log('\nDone!');
        process.exit(0);

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

cleanup();