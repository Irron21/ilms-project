const jwt = require('jsonwebtoken');
const db = require('../config/db');

const SECRET_KEY = process.env.JWT_SECRET;

const verifyToken = (req, res, next) => {
    // 1. Get token from header (Format: "Bearer <token>")
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Get just the token part

    if (!token) return res.status(403).json({ error: "No token provided" });

    // 2. Basic JWT Verification (Is it expired? Is it fake?)
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Unauthorized: Invalid Token" });

        // 3. "Single Device" Check (Does it match the DB?)
        const sql = "SELECT activeToken FROM UserLogins WHERE userID = ?";
        db.query(sql, [decoded.id], (dbErr, results) => {
            if (dbErr || results.length === 0) {
                return res.status(500).json({ error: "Auth verification failed" });
            }

            const dbToken = results[0].activeToken;

            // If the token sent by user !== token in DB, they were kicked off!
            if (token !== dbToken) {
                return res.status(401).json({ error: "Session expired. Logged in on another device." });
            }

            // Success! Attach user info to request and proceed
            req.user = decoded; 
            next();
        });
    });
};

module.exports = verifyToken;