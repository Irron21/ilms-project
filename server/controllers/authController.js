const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const redisClient = require('../config/redis'); // Import Redis

const SECRET_KEY = process.env.JWT_SECRET; 

exports.login = (req, res) => {
    const { employeeID, password } = req.body;

    // 1. SELECT USER & STATUS (Added ul.isActive)
    const sql = `
        SELECT 
            ul.userID, 
            ul.hashedPassword, 
            ul.isActive, 
            u.role, 
            u.firstName, 
            u.lastName,
            u.dateCreated
        FROM UserLogins ul
        JOIN Users u ON ul.userID = u.userID
        WHERE ul.employeeID = ?
    `;

    db.query(sql, [employeeID], async (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        
        // 2. USER NOT FOUND
        if (results.length === 0) {
            return res.status(401).json({ error: "Invalid Employee ID or Password" });
        }

        const user = results[0];

        // 3. CHECK STATUS 
        if (user.isActive === 0) {
            return res.status(403).json({ 
                error: "Unauthorized: This account has been deactivated." 
            });
        }

        // 4. CHECK PASSWORD
        const isMatch = await bcrypt.compare(password, user.hashedPassword);

        if (!isMatch) {
            return res.status(401).json({ error: "Invalid Employee ID or Password" });
        }

        // 5. GENERATE TOKEN
        const token = jwt.sign({ id: user.userID, role: user.role }, SECRET_KEY, { expiresIn: '12h' });

        // 6. SAVE SESSION & LOG
        // Cache active token in Redis for 12 hours
        if (redisClient.isOpen) {
            await redisClient.setEx(`session:${user.userID}`, 43200, token);
        }

        const updateTokenSql = "UPDATE UserLogins SET activeToken = ? WHERE userID = ?";
        db.query(updateTokenSql, [token, user.userID], (updateErr) => {
            if (updateErr) console.error("Token Save Error:", updateErr);

            const logSql = "INSERT INTO UserActivityLog (userID, actionType, details) VALUES (?, ?, ?)";
            db.query(logSql, [user.userID, 'LOGIN', `User ${employeeID} logged in`]);

            res.json({
                message: "Login success",
                token,
                user: {
                    userID: user.userID,
                    username: employeeID,
                    role: user.role,
                    fullName: `${user.firstName} ${user.lastName}`,
                    dateCreated: new Date(user.dateCreated).toLocaleDateString()
                }
            });
        });
    });
};

exports.logout = async (req, res) => {
    const userID = req.user.id; // From verifyToken

    // Clear from Redis
    if (redisClient.isOpen) {
        await redisClient.del(`session:${userID}`);
    }

    // Set activeToken to NULL
    const sql = "UPDATE UserLogins SET activeToken = NULL WHERE userID = ?";
    db.query(sql, [userID], (err) => {
        if (err) {
            console.error("Logout Error:", err);
            return res.status(500).json({ error: "Logout failed" });
        }
        res.json({ message: "Logged out successfully" });
    });
};