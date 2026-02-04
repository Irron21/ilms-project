const db = require('../config/db'); 

const logActivity = (userID, actionType, details, callback) => {

    const finalUserID = userID || 1; 
    
    const sql = "INSERT INTO UserActivityLog (userID, actionType, details) VALUES (?, ?, ?)";

    db.query(sql, [finalUserID, actionType, details], (err) => {
        if (err) console.error("Activity Log Error:", err.message);
        
        if (callback) {
            try {
                // Safely execute callback and handle Promises if async
                const result = callback(err);
                if (result instanceof Promise) {
                    result.catch(pErr => console.error("Activity Callback Async Error:", pErr));
                }
            } catch (cbErr) {
                console.error("Activity Callback Sync Error:", cbErr);
            }
        }
    });
};

module.exports = logActivity;