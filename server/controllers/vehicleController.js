const db = require('../config/db');

// GET VEHICLES (Supports ?archived=true)
exports.getAllVehicles = (req, res) => {
    const showArchived = req.query.archived === 'true';
    const archiveValue = showArchived ? 1 : 0;

    const sql = "SELECT * FROM Vehicles WHERE isArchived = ? ORDER BY dateCreated DESC";
    db.query(sql, [archiveValue], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// RESTORE VEHICLE
exports.restoreVehicle = (req, res) => {
    const { id } = req.params;
    const sql = "UPDATE Vehicles SET isArchived = 0 WHERE vehicleID = ?";
    db.query(sql, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Vehicle restored successfully" });
    });
};

// Create Vehicle
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

// Update Vehicle
exports.updateVehicle = (req, res) => {
    const { id } = req.params;
    const { plateNo, type, status } = req.body;
    const sql = "UPDATE Vehicles SET plateNo=?, type=?, status=? WHERE vehicleID=?";
    db.query(sql, [plateNo, type, status, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Vehicle updated successfully" });
    });
};

// Update Vehicle Status
exports.updateVehicleStatus = (req, res) => {
    const { id } = req.params;
    const { status } = req.body; 

    if (status === 'Maintenance') {
        const checkSql = `
            SELECT shipmentID FROM Shipments 
            WHERE vehicleID = ? 
            AND currentStatus NOT IN ('Completed', 'Cancelled')
        `;

        db.query(checkSql, [id], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            // CONFLICT FOUND: Truck is busy
            if (results.length > 0) {
                return res.status(409).json({ 
                    error: "Vehicle is currently in an active shipment", 
                    activeShipments: results.map(r => r.shipmentID) 
                });
            }

            performUpdate();
        });
    } else {
        performUpdate();
    }

    function performUpdate() {
        const sql = "UPDATE Vehicles SET status=? WHERE vehicleID=?";
        db.query(sql, [status, id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Status updated successfully" });
        });
    }
};

/// ARCHIVE (SOFT DELETE) VEHICLE
exports.deleteVehicle = (req, res) => {
    const { id } = req.params;

    // 1. Check for Active Shipments
    const checkSql = `
        SELECT shipmentID FROM Shipments 
        WHERE vehicleID = ? 
        AND currentStatus NOT IN ('Completed', 'Cancelled')
    `;

    db.query(checkSql, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
            return res.status(409).json({ 
                error: "Dependency Conflict", 
                activeShipments: results.map(r => r.shipmentID) 
            });
        }

        // 2. SOFT DELETE
        const archiveSql = "UPDATE Vehicles SET isArchived = 1 WHERE vehicleID = ?";
        db.query(archiveSql, [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Vehicle archived successfully" });
        });
    });
};