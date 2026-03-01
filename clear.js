require('dotenv').config();
const mongoose = require('mongoose');

async function clearDatabase() {
    try {
        console.log('Подключение к MongoDB...');
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Подключено к MongoDB');

        const db = mongoose.connection.db;
        
        // Получаем все коллекции
        const collections = await db.listCollections().toArray();
        
        console.log(`\nНайдено коллекций: ${collections.length}`);
        
        // Удаляем каждую коллекцию
        for (const collection of collections) {
            await db.dropCollection(collection.name);
            console.log(`✓ Удалена коллекция: ${collection.name}`);
        }

        console.log('\n✅ База данных полностью очищена!');
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('Отключено от MongoDB');
        process.exit(0);
    }
}

clearDatabase();