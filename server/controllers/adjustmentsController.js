const db = require('../config/db');

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

// ADD a new adjustment (e.g., another 500 peso advance)
exports.addAdjustment = (req, res) => {
    const { userID, periodID, type, amount, reason } = req.body;
    const sql = `
        INSERT INTO PayrollAdjustments (userID, periodID, type, amount, reason)
        VALUES (?, ?, ?, ?, ?)
    `;
    db.query(sql, [userID, periodID, type, amount, reason], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Adjustment added", id: result.insertId });
    });
};

// DELETE an entry (in case of mistake)
exports.deleteAdjustment = (req, res) => {
    const { id } = req.params;
    const sql = "UPDATE PayrollAdjustments SET status = 'VOID' WHERE adjustmentID = ?";
    db.query(sql, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Deleted successfully" });
    });
};