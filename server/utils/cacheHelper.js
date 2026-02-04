const redisClient = require('../config/redis');

/**
 * Clears Redis cache keys matching a specific pattern (prefix).
 * @param {string} pattern - The pattern to match (e.g., "cache:/api/users*")
 */
const clearCache = async (pattern) => {
    if (!redisClient.isOpen) return;

    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
            console.log(`Cache Cleared [${pattern}]:`, keys.length, 'keys removed');
        }
    } catch (err) {
        console.error(`Cache Clear Error [${pattern}]:`, err);
    }
};

module.exports = { clearCache };