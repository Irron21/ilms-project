const db = require('../config/db');
const logActivity = require('../utils/activityLogger');

// GET all adjustments for a specific user in a specific period
exports.getUserAdjustments = (req, res) => {
    const { periodID, userID } = req.params;
    const sql = `
        SELECT * FROM PayrollAdjustments 
        WHERE periodID = ? AND userID = ? 
        ORDER BY created_at DESC
    `;
    db.query(sql, [periodID, userID], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

exports.addAdjustment = (req, res) => {
    const { userID, periodID, type, amount, reason } = req.body;
    const adminID = req.body.adminID || (req.user ? req.user.userID : 1);

    const sql = `
        INSERT INTO PayrollAdjustments (userID, periodID, type, amount, reason)
        VALUES (?, ?, ?, ?, ?)
    `;
    db.query(sql, [userID, periodID, type, amount, reason], (err, result) => {
        if (err) {
            return logActivity(adminID, 'ADJUSTMENT_ERROR', `Failed to add ${type} for User #${userID}: ${err.message}`, () => {
                res.status(500).json({ error: err.message });
            });
        }

        logActivity(
            adminID, 
            'ADD_ADJUSTMENT', 
            `Added ${type} of ${amount} for User #${userID}. Reason: ${reason}`,
            () => {
                res.json({ message: "Adjustment added", id: result.insertId });
            }
        );
    });
};

exports.deleteAdjustment = (req, res) => {
    const { id } = req.params;
    const adminID = (req.user && req.user.userID) ? req.user.userID : 1;

    const sql = "UPDATE PayrollAdjustments SET status = 'VOID' WHERE adjustmentID = ?";
    db.query(sql, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        logActivity(
            adminID, 
            'VOID_ADJUSTMENT', 
            `Voided adjustment #${id}`,
            () => {
                res.json({ message: "Deleted successfully" });
            }
        );
    });
};