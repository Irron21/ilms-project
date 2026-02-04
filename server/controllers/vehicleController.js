const db = require('../config/db');
const logActivity = require('../utils/activityLogger');
const { clearCache } = require('../utils/cacheHelper');

// GET VEHICLES
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
    const adminID = req.user ? req.user.userID : 1;

    const sql = "UPDATE Vehicles SET isArchived = 0 WHERE vehicleID = ?";
    db.query(sql, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        logActivity(adminID, 'RESTORE_VEHICLE', `Restored Vehicle - [ID: ${id}]`, async () => {
             await clearCache('cache:/api/vehicles*');
             res.json({ message: "Vehicle restored successfully" });
        });
    });
};

// CREATE VEHICLE
exports.createVehicle = (req, res) => {
    const { plateNo, type, status } = req.body; 
    const adminID = req.user ? req.user.userID : 1;

    const sql = "INSERT INTO Vehicles (plateNo, type, status) VALUES (?, ?, ?)";
    db.query(sql, [plateNo, type, status || 'Working'], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const logDetails = `Created Vehicle - ${plateNo} (${type}) [ID: ${result.insertId}]`;
        logActivity(adminID, 'CREATE_VEHICLE', logDetails, async () => {
            await clearCache('cache:/api/vehicles*');
            res.json({ message: "Vehicle added successfully", id: result.insertId });
        });
    });
};

// UPDATE VEHICLE
exports.updateVehicle = (req, res) => {
    const { id } = req.params;
    const { plateNo, type, status } = req.body;
    const adminID = req.user ? req.user.userID : 1;

    const sql = "UPDATE Vehicles SET plateNo=?, type=?, status=? WHERE vehicleID=?";
    db.query(sql, [plateNo, type, status, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        logActivity(adminID, 'UPDATE_VEHICLE', `Updated Vehicle - ${plateNo} [ID: ${id}]`, async () => {
             await clearCache('cache:/api/vehicles*');
             res.json({ message: "Vehicle updated successfully" });
        });
    });
};

// UPDATE VEHICLE STATUS (With Failure Log)
exports.updateVehicleStatus = (req, res) => {
    const { id } = req.params;
    const { status } = req.body; 
    const adminID = req.user ? req.user.userID : 1;

    if (status === 'Maintenance') {
        const checkSql = `SELECT shipmentID FROM Shipments WHERE vehicleID = ? AND currentStatus NOT IN ('Completed', 'Cancelled')`;
        db.query(checkSql, [id], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });

            if (results.length > 0) {
                const activeIDs = results.map(r => r.shipmentID).join(', ');

                const logDetails = `Status Change DENIED - Vehicle busy with Shipment(s) ${activeIDs} [ID: ${id}]`;
                
                return logActivity(adminID, 'UPDATE_STATUS_DENIED', logDetails, () => {
                    res.status(409).json({ 
                        error: "Vehicle is currently in an active shipment", 
                        activeShipments: results.map(r => r.shipmentID) 
                    });
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

            logActivity(adminID, 'UPDATE_VEHICLE_STATUS', `Updated Status - [ID: ${id}] to ${status}`, async () => {
                await clearCache('cache:/api/vehicles*');
                res.json({ message: "Status updated successfully" });
            });
        });
    }
};

// ARCHIVE VEHICLE (With Failure Log)
exports.deleteVehicle = (req, res) => {
    const { id } = req.params;
    const adminID = req.user ? req.user.userID : 1;

    // 1. Check for Active Shipments
    const checkSql = `SELECT shipmentID FROM Shipments WHERE vehicleID = ? AND currentStatus NOT IN ('Completed', 'Cancelled')`;

    db.query(checkSql, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
            const activeIDs = results.map(r => r.shipmentID).join(', ');

            const logDetails = `Archive DENIED - Vehicle busy with Shipment(s) ${activeIDs} [ID: ${id}]`;

            return logActivity(adminID, 'ARCHIVE_VEHICLE_DENIED', logDetails, () => {
                res.status(409).json({ 
                    error: "Dependency Conflict", 
                    activeShipments: results.map(r => r.shipmentID) 
                });
            });
        }

        // 2. SOFT DELETE
        const archiveSql = "UPDATE Vehicles SET isArchived = 1 WHERE vehicleID = ?";
        db.query(archiveSql, [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            logActivity(adminID, 'ARCHIVE_VEHICLE', `Archived Vehicle - [ID: ${id}]`, async () => {
                await clearCache('cache:/api/vehicles*');
                res.json({ message: "Vehicle archived successfully" });
            });
        });
    });
};