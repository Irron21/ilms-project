const db = require('../config/db'); 

const logActivity = (userID, actionType, details, callback) => {

    const finalUserID = userID || 1; 
    
    const sql = "INSERT INTO UserActivityLog (userID, actionType, details) VALUES (?, ?, ?)";

    db.query(sql, [finalUserID, actionType, details], (err) => {
        if (err) console.error("Activity Log Error:", err.message);
        if (callback) callback(err);
    });
};

module.exports = logActivity;