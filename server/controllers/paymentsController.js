const db = require('../config/db');
const logActivity = require('../utils/activityLogger');

// GET total paid & history for a user in a period
exports.getUserPayments = (req, res) => {
    const { periodID, userID } = req.params;
    const sql = `
        SELECT * FROM PayrollPayments 
        WHERE periodID = ? AND userID = ? 
        ORDER BY paymentDate DESC
    `;
    db.query(sql, [periodID, userID], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// ADD a payment
exports.addPayment = (req, res) => {
    const { periodID, userID, amount, notes, referenceNumber } = req.body;
    
    // Simple validation
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

    const sql = `
        INSERT INTO PayrollPayments (periodID, userID, amount, notes, referenceNumber)
        VALUES (?, ?, ?, ?, ?)
    `;
    db.query(sql, [periodID, userID, amount, notes, referenceNumber], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Payment recorded", id: result.insertId });
    });
};

exports.voidPayment = (req, res) => {
    const { id } = req.params;
    
    const sql = `UPDATE PayrollPayments SET status = 'VOID' WHERE paymentID = ?`;
    const adminID = (req.user && req.user.userID) ? req.user.userID : 1;
    
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        logActivity(
            adminID, 
            'VOID_PAYMENT', 
            `Voided payment reference #${id}`
        );

        res.json({ message: "Payment voided successfully" });
    });
};