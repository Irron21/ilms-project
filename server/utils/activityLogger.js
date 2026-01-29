// server/utils/activityLogger.js

/**
 * Logs user activity to the database.
 * @param {Object} connection - The DB connection or pool.
 * @param {number} userID - The ID of the user performing the action.
 * @param {string} actionType - Short code for the action (e.g., 'CREATE_SHIPMENT').
 * @param {string} details - Readable description of the event.
 * @param {Function} [callback] - Optional callback to run after logging.
 */
const logActivity = (connection, userID, actionType, details, callback) => {
    // Default to ID 1 (System/Admin) if userID is missing/null
    const finalUserID = userID || 1; 
    
    const sql = "INSERT INTO UserActivityLog (userID, actionType, details) VALUES (?, ?, ?)";
    
    // Check if a callback was provided
    if (callback) {
        connection.query(sql, [finalUserID, actionType, details], (err) => {
            if (err) console.error("⚠️ Activity Log Error:", err.message);
            callback(err);
        });
    } else {
        // "Fire and Forget" mode (if no callback is needed)
        connection.query(sql, [finalUserID, actionType, details], (err) => {
            if (err) console.error("⚠️ Activity Log Error:", err.message);
        });
    }
};

module.exports = logActivity;