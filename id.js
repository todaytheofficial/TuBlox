// reorder-ids.js
// Запуск: node reorder-ids.js

require('dotenv').config();
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    odilId:   { type: Number, unique: true },
    username: { type: String },
    password: { type: String }
}, { strict: false });

const User = mongoose.model('User', userSchema);

async function reorderIds() {
    try {
        console.log('[DB] Connecting...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('[DB] Connected!\n');

        // Получаем всех по старому odilId
        const users = await User.find().sort({ odilId: 1 });

        console.log('[Before]');
        users.forEach(u => console.log(`  #${u.odilId} — ${u.username}`));

        // ═══════════════════════════════════════
        // Сначала ставим временные ID чтобы
        // не было конфликта unique
        // ═══════════════════════════════════════
        for (let i = 0; i < users.length; i++) {
            await User.updateOne(
                { _id: users[i]._id },
                { $set: { odilId: 99000 + i } }
            );
        }

        // ═══════════════════════════════════════
        // Теперь ставим финальные ID 1,2,3,4,5
        // ═══════════════════════════════════════
        for (let i = 0; i < users.length; i++) {
            await User.updateOne(
                { _id: users[i]._id },
                { $set: { odilId: i + 1 } }
            );
            console.log(`[Updated] "${users[i].username}" → #${i + 1}`);
        }

        // ═══════════════════════════════════════
        // Обновить Counter чтобы следующий
        // юзер получил правильный ID
        // ═══════════════════════════════════════
        const Counter = mongoose.model('Counter', new mongoose.Schema({
            _id: String,
            seq: Number
        }));

        await Counter.updateOne(
            { _id: 'userId' },
            { $set: { seq: users.length } },
            { upsert: true }
        );

        console.log(`[Counter] userId reset to ${users.length}`);

        // Показываем результат
        const updated = await User.find().sort({ odilId: 1 });
        console.log('\n[After]');
        updated.forEach(u => console.log(`  #${u.odilId} — ${u.username}`));

        console.log('\n✅ Done!');

    } catch (err) {
        console.error('[Error]', err.message);
    } finally {
        await mongoose.disconnect();
        console.log('[DB] Disconnected');
        process.exit(0);
    }
}

reorderIds();