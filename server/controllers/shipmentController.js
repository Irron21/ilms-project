const db = require('../config/db');
const XLSX = require('xlsx');
const logActivity = require('../utils/activityLogger');

// 1. Get Shipments (Updated for Archive Support)
exports.getActiveShipments = (req, res) => {
    const currentUserID = req.query.userID;
    const showArchived = req.query.archived === 'true';
    const isArchivedVal = showArchived ? 1 : 0; // 0 = Active, 1 = Archived

    let sql;
    let params = [];

    if (currentUserID) {
        // DRIVER/HELPER MODE: Always show active assigned jobs (ignore archive toggle for them)
        sql = `
            SELECT 
                s.shipmentID, c.clientName, s.destName, s.destLocation, 
                s.currentStatus, s.creationTimestamp, v.plateNo, v.type as truckType
            FROM Shipments s
            JOIN Clients c ON s.clientID = c.clientID
            JOIN Vehicles v ON s.vehicleID = v.vehicleID 
            JOIN ShipmentCrew sc ON s.shipmentID = sc.shipmentID
            WHERE sc.userID = ? AND s.isArchived = 0 
            ORDER BY s.creationTimestamp DESC
        `;
        params = [currentUserID];
    } else {
        // ADMIN MODE: Filter by isArchived status
        sql = `
            SELECT 
                s.shipmentID, c.clientName, s.destName, s.destLocation, 
                s.currentStatus, s.creationTimestamp, v.plateNo, v.type as truckType,
                GROUP_CONCAT(CONCAT(u.role, ':', u.firstName, ' ', u.lastName) SEPARATOR '|') AS crewDetails
            FROM Shipments s
            JOIN Clients c ON s.clientID = c.clientID
            JOIN Vehicles v ON s.vehicleID = v.vehicleID
            LEFT JOIN ShipmentCrew sc ON s.shipmentID = sc.shipmentID
            LEFT JOIN Users u ON sc.userID = u.userID
            WHERE s.isArchived = ? 
            GROUP BY s.shipmentID
            ORDER BY s.creationTimestamp DESC
        `;
        params = [isArchivedVal];
    }
    
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: "Failed to fetch shipments" });
        res.json(results);
    });
};

// 2. Update Status
exports.updateStatus = (req, res) => {
    const shipmentID = req.params.shipmentID;
    const { status, userID } = req.body;

    console.log(`Request to update Shipment #${shipmentID} to '${status}'`);

    if (!shipmentID || shipmentID === 'undefined') {
        return res.status(400).json({ error: "Shipment ID is missing" });
    }

    const updateShipmentSql = "UPDATE Shipments SET currentStatus = ? WHERE shipmentID = ?";
    const insertLogSql = "INSERT INTO ShipmentStatusLog (shipmentID, userID, phaseName, status) VALUES (?, ?, ?, ?)";

    db.query(updateShipmentSql, [status, shipmentID], (err, result) => {
        if (err) {
            console.error("Update Error:", err);
            return res.status(500).json({ error: err.message });
        }

        db.query(insertLogSql, [shipmentID, userID, status, status], (err, result) => {
            if (err) {
                console.error("Log Error:", err);
                return res.status(500).json({ error: err.message });
            }

            logActivity(db, userID, 'UPDATE_SHIPMENT', `Updated Shipment #${shipmentID} to ${status}`);
            res.json({ message: `Shipment ${shipmentID} updated to ${status}` });
        });
    });
};

// 3. Get Logs (THIS WAS MISSING)
exports.getShipmentLogs = (req, res) => {
    const id = req.params.id; 

    const sql = `
        SELECT phaseName, timestamp 
        FROM ShipmentStatusLog 
        WHERE shipmentID = ? 
        ORDER BY timestamp DESC
    `;

    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error("Error fetching logs:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
};

exports.getFormResources = (req, res) => {
    const sqlDrivers = "SELECT userID, firstName, lastName FROM Users WHERE role = 'Driver' AND isArchived = 0";
    const sqlHelpers = "SELECT userID, firstName, lastName FROM Users WHERE role = 'Helper' AND isArchived = 0";
    const sqlVehicles = "SELECT vehicleID, plateNo, type FROM Vehicles WHERE isArchived = 0";

    // Run queries in parallel
    db.query(sqlDrivers, (err, drivers) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.query(sqlHelpers, (err, helpers) => {
            if (err) return res.status(500).json({ error: err.message });

            db.query(sqlVehicles, (err, vehicles) => {
                if (err) return res.status(500).json({ error: err.message });
                
                res.json({ drivers, helpers, vehicles });
            });
        });
    });
};


exports.createShipment = (req, res) => {
    // 1. Extract and Parse Data (Ensure IDs are Numbers)
    const shipmentID = req.body.shipmentID;
    const clientID = 1; 
    const vehicleID = req.body.vehicleID;
    const destName = req.body.destName;
    const destLocation = req.body.destLocation;
    const driverID = parseInt(req.body.driverID); 
    const helperID = parseInt(req.body.helperID); 
    const operationsUserID = req.body.operationsUserID;

    // 2. Basic Validation
    if (!shipmentID) return res.status(400).json({ error: "Shipment ID is required." });
    if (!driverID || !helperID) return res.status(400).json({ error: "Driver and Helper are required." });
    if (driverID === helperID) return res.status(400).json({ error: "Driver and Helper cannot be the same person." });


    db.getConnection((err, connection) => {
        if (err) {
            console.error("❌ Connection Error:", err);
            return res.status(500).json({ error: "Database connection failed." });
        }

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                return res.status(500).json({ error: "Transaction failed." });
            }

            const sqlShipment = `
                INSERT INTO Shipments (shipmentID, clientID, vehicleID, destName, destLocation, operationsUserID, currentStatus) 
                VALUES (?, ?, ?, ?, ?, ?, 'Pending') 
            `;

            // Step 3: Insert Shipment
            connection.query(sqlShipment, [shipmentID, clientID, vehicleID, destName, destLocation, operationsUserID], (err, result) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "Shipment ID already exists." });
                        res.status(500).json({ error: "Failed to create shipment record: " + err.message });
                    });
                }

                const sqlCrew = "INSERT INTO ShipmentCrew (shipmentID, userID) VALUES ?";
                const crewValues = [[shipmentID, driverID], [shipmentID, helperID]];

                // Step 4: Insert Crew
                connection.query(sqlCrew, [crewValues], (err, crewResult) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).json({ error: "Crew Assignment Failed: " + err.message });
                        });
                    }

                    const sqlLog = "INSERT INTO ShipmentStatusLog (shipmentID, userID, phaseName, status) VALUES (?, ?, 'Creation', 'Created')";
                    
                    // Step 5: Insert Log
                    connection.query(sqlLog, [shipmentID, operationsUserID], (err) => {
                        if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Log fail" }); });

                        logActivity(connection, operationsUserID, 'CREATE_SHIPMENT', `Created Shipment #${shipmentID}`, () => {
                            connection.commit((err) => {
                                connection.release();
                                res.json({ message: "Success", shipmentID });
                            });
                        });
                    });
                });
            });
        });
    });
};

exports.exportShipments = (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
      SELECT 
        s.shipmentID AS "Shipment ID",
        c.clientName AS "Client",
        c.defaultLocation AS "Origin",
        s.destName AS "Destination Name",
        s.destLocation AS "Destination Address",
        v.plateNo AS "Truck Plate",
        v.type AS "Truck Type",
        s.currentStatus AS "Current Status",
        
        -- Crew Details
        GROUP_CONCAT(DISTINCT CONCAT(u.role, ': ', u.firstName, ' ', u.lastName) SEPARATOR ' | ') as "Assigned Crew",

        -- PIVOTING LOGS
        DATE_FORMAT(s.creationTimestamp, '%Y-%m-%d %H:%i:%s') AS "Date Created",
        
        -- UPDATED ALIAS: 'sLog' instead of 'ssl'
        DATE_FORMAT(MAX(CASE WHEN sLog.phaseName = 'Arrival' THEN sLog.timestamp END), '%Y-%m-%d %H:%i:%s') AS "Arrival Time",
        DATE_FORMAT(MAX(CASE WHEN sLog.phaseName = 'Handover Invoice' THEN sLog.timestamp END), '%Y-%m-%d %H:%i:%s') AS "Handover Invoice Time",
        DATE_FORMAT(MAX(CASE WHEN sLog.phaseName = 'Start Unload' THEN sLog.timestamp END), '%Y-%m-%d %H:%i:%s') AS "Start Unload Time",
        DATE_FORMAT(MAX(CASE WHEN sLog.phaseName = 'Finish Unload' THEN sLog.timestamp END), '%Y-%m-%d %H:%i:%s') AS "Finish Unload Time",
        DATE_FORMAT(MAX(CASE WHEN sLog.phaseName = 'Invoice Receive' THEN sLog.timestamp END), '%Y-%m-%d %H:%i:%s') AS "Invoice Receive Time",
        DATE_FORMAT(MAX(CASE WHEN sLog.phaseName = 'Departure' THEN sLog.timestamp END), '%Y-%m-%d %H:%i:%s') AS "Departure Time",
        DATE_FORMAT(MAX(CASE WHEN sLog.phaseName = 'Completed' THEN sLog.timestamp END), '%Y-%m-%d %H:%i:%s') AS "Completion Time"

      FROM Shipments s
      JOIN Clients c ON s.clientID = c.clientID
      JOIN Vehicles v ON s.vehicleID = v.vehicleID
      LEFT JOIN ShipmentCrew sc ON s.shipmentID = sc.shipmentID
      LEFT JOIN Users u ON sc.userID = u.userID
      
      -- CHANGED 'ssl' TO 'sLog' HERE 👇
      LEFT JOIN ShipmentStatusLog sLog ON s.shipmentID = sLog.shipmentID
      
      WHERE s.creationTimestamp BETWEEN ? AND ?
      GROUP BY s.shipmentID
      ORDER BY s.creationTimestamp DESC
    `;

    const start = `${startDate} 00:00:00`;
    const end = `${endDate} 23:59:59`;

    db.query(query, [start, end], (err, rows) => {
        if (err) {
            console.error("Export Query Error:", err);
            return res.status(500).json({ message: "Database error during export" });
        }

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No records found for this timeframe' });
        }

        try {
            const workSheet = XLSX.utils.json_to_sheet(rows);
            const wscols = Object.keys(rows[0]).map(key => ({ wch: 20 }));
            workSheet['!cols'] = wscols;

            const workBook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workBook, workSheet, "Shipment Report");

            const excelBuffer = XLSX.write(workBook, { bookType: 'xlsx', type: 'buffer' });

            res.setHeader('Content-Disposition', `attachment; filename=Shipments_${startDate}_to_${endDate}.xlsx`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(excelBuffer);

        } catch (error) {
            console.error("Excel Generation Error:", error);
            res.status(500).json({ message: "Error generating Excel file" });
        }
    });
};

exports.archiveShipment = (req, res) => {
    const { id } = req.params;
    const adminID = req.body.userID || 1; 

    const sql = "UPDATE Shipments SET isArchived = 1 WHERE shipmentID = ?";
    
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        logActivity(db, adminID, 'ARCHIVE_SHIPMENT', `Archived Shipment #${id}`, () => {
            res.json({ message: "Shipment archived successfully" });
        });
    });
};

exports.restoreShipment = (req, res) => {
    const { id } = req.params;
    const adminID = req.body.userID || 1;

    const sql = "UPDATE Shipments SET isArchived = 0 WHERE shipmentID = ?";
    
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        logActivity(db, adminID, 'RESTORE_SHIPMENT', `Restored Shipment #${id}`, () => {
            res.json({ message: "Shipment restored successfully" });
        });
    });
};