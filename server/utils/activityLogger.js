// server/utils/activityLogger.js

// ✅ 1. Import your DB connection here
const db = require('../config/db'); 

// ✅ 2. REMOVE 'connection' from the arguments
const logActivity = (userID, actionType, details, callback) => {
    
    // Default to ID 1 if missing
    const finalUserID = userID || 1; 
    
    const sql = "INSERT INTO UserActivityLog (userID, actionType, details) VALUES (?, ?, ?)";
    
    // ✅ 3. Use 'db' directly
    db.query(sql, [finalUserID, actionType, details], (err) => {
        if (err) console.error("⚠️ Activity Log Error:", err.message);
        if (callback) callback(err);
    });
};

module.exports = logActivity;