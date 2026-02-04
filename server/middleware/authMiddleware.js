const jwt = require('jsonwebtoken');
const db = require('../config/db');
const redisClient = require('../config/redis');

const SECRET_KEY = process.env.JWT_SECRET;

const verifyToken = (req, res, next) => {
    // 1. Get token from header (Format: "Bearer <token>")
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Get just the token part

    if (!token) return res.status(403).json({ error: "No token provided" });

    // 2. Basic JWT Verification (Is it expired? Is it fake?)
    jwt.verify(token, SECRET_KEY, async (err, decoded) => {
        if (err) return res.status(401).json({ error: "Unauthorized: Invalid Token" });

        // 3. "Single Device" Check (Redis First -> DB Fallback)
        try {
            let activeToken = null;

            // Check Redis First
            if (redisClient.isOpen) {
                activeToken = await redisClient.get(`session:${decoded.id}`);
            }

            // If found in Redis, compare immediately (Fast Path)
            if (activeToken) {
                if (token !== activeToken) {
                     return res.status(401).json({ error: "Session expired. Logged in on another device." });
                }
                req.user = decoded;
                return next();
            }

            // Fallback to DB if not in Redis (e.g., Redis restart or expiry)
            const sql = "SELECT activeToken FROM UserLogins WHERE userID = ?";
            db.query(sql, [decoded.id], async (dbErr, results) => {
                if (dbErr) {
                    console.error("Auth Middleware DB Error:", dbErr);
                    return res.status(500).json({ error: "Auth verification failed" });
                }

                if (!results || results.length === 0) {
                    return res.status(401).json({ error: "User not found or invalid session." });
                }

                const dbToken = results[0].activeToken;
                
                // Cache it back to Redis if valid
                if (dbToken && redisClient.isOpen) {
                    await redisClient.setEx(`session:${decoded.id}`, 3600, dbToken);
                }

                if (token !== dbToken) {
                    return res.status(401).json({ error: "Session expired. Logged in on another device." });
                }

                req.user = decoded; 
                next();
            });

        } catch (sysErr) {
            console.error("Auth System Error:", sysErr);
            return res.status(500).json({ error: "Internal Auth Error" });
        }
    });
};

module.exports = verifyToken;