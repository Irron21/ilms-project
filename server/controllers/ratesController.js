const db = require('../config/db');

// READ: Get all rates
exports.getAllRates = (req, res) => {
    const sql = "SELECT * FROM PayrollRates ORDER BY routeCluster ASC, vehicleType ASC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// CREATE: Add a new rate
exports.createRate = (req, res) => {
    const { routeCluster, vehicleType, driverBaseFee, helperBaseFee, foodAllowance } = req.body;
    
    // Check duplicates
    const checkSql = "SELECT rateID FROM PayrollRates WHERE routeCluster = ? AND vehicleType = ?";
    db.query(checkSql, [routeCluster, vehicleType], (err, existing) => {
        if (existing.length > 0) return res.status(400).json({ error: "Rate already exists for this Route + Vehicle combination." });

        const sql = `
            INSERT INTO PayrollRates (routeCluster, vehicleType, driverBaseFee, helperBaseFee, foodAllowance)
            VALUES (?, ?, ?, ?, ?)
        `;
        db.query(sql, [routeCluster, vehicleType, driverBaseFee, helperBaseFee, foodAllowance], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Rate added successfully", rateID: result.insertId });
        });
    });
};

// UPDATE: Edit existing rate
exports.updateRate = (req, res) => {
    const { id } = req.params;
    const { driverBaseFee, helperBaseFee, foodAllowance } = req.body;

    const sql = `
        UPDATE PayrollRates 
        SET driverBaseFee = ?, helperBaseFee = ?, foodAllowance = ? 
        WHERE rateID = ?
    `;
    db.query(sql, [driverBaseFee, helperBaseFee, foodAllowance, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Rate updated successfully" });
    });
};

// DELETE: Remove a rate
exports.deleteRate = (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM PayrollRates WHERE rateID = ?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Rate deleted successfully" });
    });
};