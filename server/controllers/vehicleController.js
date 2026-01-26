const db = require('../config/db');

// 1. Get All Vehicles
exports.getAllVehicles = (req, res) => {
    const sql = "SELECT * FROM Vehicles ORDER BY dateCreated DESC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// 2. Create Vehicle
exports.createVehicle = (req, res) => {
    const { plateNo, type, status } = req.body; 

    const sql = "INSERT INTO Vehicles (plateNo, type, status) VALUES (?, ?, ?)";
    
    db.query(sql, [plateNo, type, status || 'Working'], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Vehicle added successfully", id: result.insertId });
    });
};

// 3. Update Vehicle (General Info)
exports.updateVehicle = (req, res) => {
    const { id } = req.params;
    const { plateNo, type, status } = req.body;
    const sql = "UPDATE Vehicles SET plateNo=?, type=?, status=? WHERE vehicleID=?";
    db.query(sql, [plateNo, type, status, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Vehicle updated successfully" });
    });
};

// 4. Update Vehicle Status (Toggle)
exports.updateVehicleStatus = (req, res) => {
    const { id } = req.params;
    const { status } = req.body; 
    const sql = "UPDATE Vehicles SET status=? WHERE vehicleID=?";
    db.query(sql, [status, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Status updated successfully" });
    });
};

// 5. Delete Vehicle - WAS MISSING
exports.deleteVehicle = (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM Vehicles WHERE vehicleID=?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Vehicle deleted successfully" });
    });
};