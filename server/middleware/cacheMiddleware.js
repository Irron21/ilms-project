const redisClient = require('../config/redis');

const cache = (duration = 3600) => async (req, res, next) => {
    // If Redis is not open/connected, skip caching
    if (!redisClient.isOpen) {
        return next();
    }

    // Only cache GET requests
    if (req.method !== 'GET') {
        return next();
    }

    // Create a unique key based on the request URL
    const key = `cache:${req.originalUrl}`;

    try {
        const cachedData = await redisClient.get(key);
        if (cachedData) {
            // Return cached data
            return res.json(JSON.parse(cachedData));
        }

        // Override res.json to store the response in Redis before sending
        const originalJson = res.json;
        res.json = function (body) {
            // Only cache successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                redisClient.setEx(key, duration, JSON.stringify(body));
            }
            return originalJson.call(this, body);
        };
        next();
    } catch (err) {
        console.error('Redis Cache Error:', err);
        next();
    }
};

module.exports = cache;
