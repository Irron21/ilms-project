const db = require('../config/db');
const XLSX = require('xlsx');
const logActivity = require('../utils/activityLogger');

// 1. Get Shipments (Updated for Archive Support)
exports.getActiveShipments = (req, res) => {
    const currentUserID = req.query.userID;
    const showArchived = req.query.archived === 'true';
    const isArchivedVal = showArchived ? 1 : 0; 

    // Define columns clearly
    const columns = `
        s.shipmentID, s.destName, s.destLocation, 
        s.loadingDate, s.deliveryDate,
        s.currentStatus, s.creationTimestamp, v.plateNo, v.type as truckType
    `;

    const sortLogic = `ORDER BY s.loadingDate IS NULL ASC, s.loadingDate ASC, s.creationTimestamp DESC`;

    let sql;
    let params = [];

    if (currentUserID) {
        // DRIVER/HELPER MODE
        sql = `
            SELECT ${columns}
            FROM Shipments s
            JOIN Vehicles v ON s.vehicleID = v.vehicleID 
            JOIN ShipmentCrew sc ON s.shipmentID = sc.shipmentID
            WHERE sc.userID = ? AND s.isArchived = 0 
            ${sortLogic}
        `;
        params = [currentUserID];
    } else {
        // ADMIN MODE
        sql = `
            SELECT ${columns},
                GROUP_CONCAT(CONCAT(u.role, ':', u.firstName, ' ', u.lastName) SEPARATOR '|') AS crewDetails
            FROM Shipments s
            JOIN Vehicles v ON s.vehicleID = v.vehicleID
            LEFT JOIN ShipmentCrew sc ON s.shipmentID = sc.shipmentID
            LEFT JOIN Users u ON sc.userID = u.userID
            WHERE s.isArchived = ? 
            GROUP BY s.shipmentID
            ${sortLogic}
        `;
        params = [isArchivedVal];
    }
    
    db.query(sql, params, (err, results) => {
        if (err) {
            console.error("Database Error:", err.message);
            return res.status(500).json({ error: "Failed to fetch shipments" });
        }
        res.json(results);
    });
};

const calculatePayroll = (shipmentID) => {
    const getCrewSQL = `
        SELECT 
            sc.userID as crewID, 
            u.role,          
            s.destLocation, 
            v.type as vehicleType
        FROM ShipmentCrew sc
        JOIN Users u ON sc.userID = u.userID        
        JOIN Shipments s ON s.shipmentID = sc.shipmentID
        LEFT JOIN Vehicles v ON s.vehicleID = v.vehicleID 
        WHERE s.shipmentID = ?
    `;

    db.query(getCrewSQL, [shipmentID], (err, crewMembers) => {
        if (err) return console.error("Payroll Error (Get Crew):", err);
        if (crewMembers.length === 0) return console.error("Payroll Error: No crew found for this shipment.");

        // 2. Get the Rates for this Location/Vehicle
        const { destLocation, vehicleType } = crewMembers[0]; 

        const getRateSQL = `
            SELECT * FROM PayrollRates 
            WHERE ? LIKE CONCAT('%', routeCluster, '%') 
            AND vehicleType = ? 
            LIMIT 1
        `;

        db.query(getRateSQL, [destLocation, vehicleType || 'AUV'], (err, rates) => {
            if (err) return console.error("Payroll Error (Get Rate):", err);

            // Default rates if not found in DB
            const rateData = rates.length > 0 ? rates[0] : null;
            const standardDriverPay = rateData ? rateData.driverBaseFee : 600.00;
            const standardHelperPay = rateData ? rateData.helperBaseFee : 400.00;
            
            // 3. CALCULATE SPLIT ALLOWANCE
            // Example: 350 Total / 2 Crew = 175 Each
            const totalAllowance = rateData ? rateData.foodAllowance : 350.00;
            const crewCount = crewMembers.length;
            const allowancePerPerson = crewCount > 0 ? (totalAllowance / crewCount) : 0;

            // 4. Loop through EACH crew member
            crewMembers.forEach(member => {
                let payAmount = 0;

                // Determine Salary based on Role
                if (member.role === 'Driver') {
                    payAmount = standardDriverPay;
                } else {
                    payAmount = standardHelperPay; 
                }

                // 5. Insert Record
                // NOTE: We save 'allowancePerPerson' so Admin can see it, 
                // but the Database SQL we just ran ensures it is NOT added to the Total Payout.
                const insertPayrollSQL = `
                    INSERT INTO ShipmentPayroll 
                    (shipmentID, crewID, baseFee, allowance, status, payoutDate) 
                    VALUES (?, ?, ?, ?, 'PENDING', NOW())
                    ON DUPLICATE KEY UPDATE payoutDate = NOW()
                `;

                db.query(insertPayrollSQL, [shipmentID, member.crewID, payAmount, allowancePerPerson], (err) => {
                    if (err) {
                        console.error(`Payroll Failed for User ${member.crewID}:`, err.message);
                    } else {
                        console.log(`Logged User ${member.crewID}: Salary ${payAmount}, Allowance Received ${allowancePerPerson}`);
                    }
                });
            });
        });
    });
};

// 2. Update Status
exports.updateStatus = (req, res) => {
    const shipmentID = req.params.shipmentID;
    const { status, userID } = req.body;

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

            logActivity(userID, 'UPDATE_SHIPMENT', `Updated Shipment #${shipmentID} to ${status}`);
            res.json({ message: `Shipment ${shipmentID} updated to ${status}` });
        });

        if (status === 'Completed') { 
            calculatePayroll(shipmentID); 
        }
    });
};

// 3. Get Logs 
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
    // 1. Extract Data
    const { 
        shipmentID, vehicleID, destName, destLocation, 
        loadingDate, deliveryDate, 
        userID 
    } = req.body;
    
    const driverID = parseInt(req.body.driverID); 
    const helperID = parseInt(req.body.helperID); 
    const loadDateObj = new Date(loadingDate);
    const delDateObj = new Date(deliveryDate);
    const today = new Date();
    today.setHours(0,0,0,0);

    // CHECK 1: Loading Date Future
    if (loadDateObj > new Date()) { 
        const msg = `Attempted to create Shipment #${shipmentID} with a future Loading Date (${loadingDate}) which is invalid.`;
        return logActivity(userID, 'SHIPMENT_VALIDATION_ERROR', msg, () => {
            res.status(400).json({ error: "Loading Date cannot be in the future." });
        });
    }
    
    // CHECK 2: Delivery before Loading
    if (delDateObj < loadDateObj) {
        const msg = `Attempted to create Shipment #${shipmentID} where Delivery Date (${deliveryDate}) is before Loading Date (${loadingDate}).`;
        return logActivity(userID, 'SHIPMENT_VALIDATION_ERROR', msg, () => {
            res.status(400).json({ error: "Delivery Date cannot be before Loading Date." });
        });
    }

    // CHECK 3: Route Cluster Validation (RESTORED THIS LOGIC)
    const checkRouteSql = "SELECT routeCluster FROM PayrollRates WHERE ? LIKE CONCAT('%', routeCluster, '%') LIMIT 1";
    db.query(checkRouteSql, [destLocation], (err, results) => {
        if (err) return res.status(500).json({ error: "Validation check failed." });

        if (results.length === 0) {
            const msg = `User attempted to input route '${destLocation}' which does not match any known Route Cluster.`;
            return logActivity(userID, 'SHIPMENT_VALIDATION_ERROR', msg, () => {
                res.status(400).json({ error: `The location "${destLocation}" is not a recognized Route Cluster.` });
            });
        }

        // 2. Validation
        if (!shipmentID) return res.status(400).json({ error: "Shipment ID is required." });
        if (!driverID || !helperID) return res.status(400).json({ error: "Driver and Helper are required." });
        if (!loadingDate || !deliveryDate) return res.status(400).json({ error: "Loading and Delivery dates are required." });

        db.getConnection((err, connection) => {
            if (err) return res.status(500).json({ error: "Database connection failed." });

            connection.beginTransaction((err) => {
                if (err) {
                    connection.release();
                    return res.status(500).json({ error: "Transaction failed." });
                }

                const sqlShipment = `
                    INSERT INTO Shipments (shipmentID, vehicleID, destName, destLocation, loadingDate, deliveryDate, userID, currentStatus) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending') 
                `;

                connection.query(sqlShipment, [shipmentID, vehicleID, destName, destLocation, loadingDate, deliveryDate, userID], (err, result) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "Shipment ID already exists." });
                            res.status(500).json({ error: "Failed to create shipment record: " + err.message });
                        });
                    }

                    const sqlCrew = "INSERT INTO ShipmentCrew (shipmentID, userID) VALUES ?";
                    const crewValues = [[shipmentID, driverID], [shipmentID, helperID]];

                    connection.query(sqlCrew, [crewValues], (err) => {
                        if (err) {
                            return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Crew Fail" }); });
                        }

                        const sqlLog = "INSERT INTO ShipmentStatusLog (shipmentID, userID, phaseName, status) VALUES (?, ?, 'Creation', 'Created')";
                        connection.query(sqlLog, [shipmentID, userID], (err) => {
                            if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Log fail" }); });

                            logActivity(userID, 'CREATE_SHIPMENT', `Created Shipment #${shipmentID}`, () => {
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
    }); // End Route Check
};

exports.exportShipments = (req, res) => {
    const { startDate, endDate } = req.query;
    // FIX 1: Define adminID (checking req.user from middleware, or default to 1)
    const adminID = (req.user && req.user.userID) ? req.user.userID : 1;

    const query = `
      SELECT 
        s.shipmentID AS "Shipment ID",
        s.destName AS "Destination Name",
        s.destLocation AS "Destination Address",
        s.loadingDate AS "Loading Date",    
        s.deliveryDate AS "Delivery Date",  
        v.plateNo AS "Truck Plate",
        v.type AS "Truck Type",
        s.currentStatus AS "Current Status",
        
        GROUP_CONCAT(DISTINCT CONCAT(u.role, ': ', u.firstName, ' ', u.lastName) SEPARATOR ' | ') as "Assigned Crew",

        DATE_FORMAT(s.creationTimestamp, '%Y-%m-%d %H:%i:%s') AS "Date Created",
        DATE_FORMAT(MAX(CASE WHEN sLog.phaseName = 'Arrival' THEN sLog.timestamp END), '%Y-%m-%d %H:%i:%s') AS "Arrival Time",
        DATE_FORMAT(MAX(CASE WHEN sLog.phaseName = 'Departure' THEN sLog.timestamp END), '%Y-%m-%d %H:%i:%s') AS "Departure Time",
        DATE_FORMAT(MAX(CASE WHEN sLog.phaseName = 'Completed' THEN sLog.timestamp END), '%Y-%m-%d %H:%i:%s') AS "Completion Time"

      FROM Shipments s
      JOIN Vehicles v ON s.vehicleID = v.vehicleID
      LEFT JOIN ShipmentCrew sc ON s.shipmentID = sc.shipmentID
      LEFT JOIN Users u ON sc.userID = u.userID
      LEFT JOIN ShipmentStatusLog sLog ON s.shipmentID = sLog.shipmentID
      
      WHERE s.creationTimestamp BETWEEN ? AND ?
      GROUP BY s.shipmentID
      ORDER BY s.creationTimestamp DESC
    `;

    const start = `${startDate} 00:00:00`;
    const end = `${endDate} 23:59:59`;

    db.query(query, [start, end], (err, rows) => {
        if (err) return res.status(500).json({ message: "Database error during export" });
        if (rows.length === 0) return res.status(404).json({ message: 'No records found' });

        try {
            const workSheet = XLSX.utils.json_to_sheet(rows);
            const wscols = Object.keys(rows[0]).map(key => ({ wch: 20 }));
            workSheet['!cols'] = wscols;

            const workBook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workBook, workSheet, "Shipment Report");
            const excelBuffer = XLSX.write(workBook, { bookType: 'xlsx', type: 'buffer' });

            // Set Headers for File Download
            res.setHeader('Content-Disposition', `attachment; filename=Shipments_${startDate}_to_${endDate}.xlsx`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

            // FIX 2: Correct Log Activity Call
            logActivity(
                adminID, 
                'EXPORT_DATA', 
                `Exported Shipment Report (${startDate} to ${endDate})`, 
                () => {
                    // FIX 3: Send the file buffer INSIDE the callback
                    // Do NOT use res.json() here, the browser expects the file stream.
                    res.send(excelBuffer);
                }
            );

        } catch (error) {
            console.error("Export Error:", error);
            // Only send error json if headers haven't been sent yet
            if (!res.headersSent) {
                res.status(500).json({ message: "Error generating Excel file" });
            }
        }
    });
};

exports.archiveShipment = (req, res) => {
    const { id } = req.params;
    const adminID = req.body.userID || 1; 

    const sql = "UPDATE Shipments SET isArchived = 1 WHERE shipmentID = ?";
    
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        logActivity(adminID, 'ARCHIVE_SHIPMENT', `Archived Shipment #${id}`, () => {
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

        logActivity(adminID, 'RESTORE_SHIPMENT', `Restored Shipment #${id}`, () => {
            res.json({ message: "Shipment restored successfully" });
        });
    });
};

exports.getPayrollRoutes = (req, res) => {
    // We select Route AND VehicleType to build a map
    const sql = "SELECT routeCluster, vehicleType FROM PayrollRates ORDER BY routeCluster ASC";
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching routes:", err);
            return res.status(500).json({ error: "Failed to fetch routes" });
        }

        // Transform data into a clean structure:
        // { "CANDELARIA": ["AUV"], "TAGUIG": ["AUV", "6WH"] }
        const routeMap = {};
        
        results.forEach(row => {
            const route = row.routeCluster; 
            if (!routeMap[route]) {
                routeMap[route] = [];
            }
            // Avoid duplicates
            if (!routeMap[route].includes(row.vehicleType)) {
                routeMap[route].push(row.vehicleType);
            }
        });

        res.json(routeMap);
    });
};