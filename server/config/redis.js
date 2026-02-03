require('dotenv').config();
const redis = require('redis');

let redisClient;

// 1. Setup Configuration (Cloud vs Local)
if (process.env.REDIS_HOST) {
    console.log('⚡ Attempting to connect to Redis Cloud...');
    redisClient = redis.createClient({
        password: process.env.REDIS_PASSWORD,
        socket: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT
        }
    });
} else {
    console.log('⚡ Attempting to connect to Local Redis...');
    redisClient = redis.createClient({
        url: 'redis://localhost:6379'
    });
}

// 2. Prevent Crashes on Error
redisClient.on('error', (err) => {
    // This empty listener prevents the server from crashing when Redis fails
    console.warn('Redis Connection Failed (Caching Disabled):', err.message);
});

redisClient.on('connect', () => console.log('✅ Redis Client Connected'));

// 3. Connect Asynchronously (Don't await it!)
redisClient.connect().catch((err) => {
    console.warn('Could not connect to Redis. Continuing without caching.');
});

module.exports = redisClient;