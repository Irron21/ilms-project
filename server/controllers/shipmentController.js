const db = require('../config/db');
const XLSX = require('xlsx');
const logActivity = require('../utils/activityLogger');

/** Fetches shipments filtered by user role (Driver/Helper see assigned only) or archived state */
exports.getActiveShipments = (req, res) => {
    const currentUserID = req.query.userID;
    const showArchived = req.query.archived === 'true';
    const isArchivedVal = showArchived ? 1 : 0; 

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
        /* Admin mode: use assigned role from ShipmentCrew */
        sql = `
            SELECT ${columns},
                GROUP_CONCAT(CONCAT(sc.role, ':', u.firstName, ' ', u.lastName) SEPARATOR '|') AS crewDetails
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

exports.getShipmentResources = (req, res) => {
    // 1. Fetch Working Vehicles
    const sqlVehicles = "SELECT vehicleID, plateNo, type FROM Vehicles WHERE status = 'Working' AND isArchived = 0";
    
    // 2. Fetch Active Users (Drivers & Helpers)
    const sqlUsers = "SELECT userID, firstName, lastName, role FROM Users WHERE role IN ('Driver', 'Helper') AND isArchived = 0 ORDER BY lastName ASC";

    db.query(sqlVehicles, (err, vehicles) => {
        if (err) return res.status(500).json({ error: err.message });

        db.query(sqlUsers, (err, users) => {
            if (err) return res.status(500).json({ error: err.message });

            // LOGIC:
            // Drivers List: Only users with role 'Driver'
            const drivers = users.filter(u => u.role === 'Driver');
            
            // Helpers List: Users with role 'Helper' OR 'Driver' (Drivers can act as helpers)
            const helpers = users.filter(u => u.role === 'Helper' || u.role === 'Driver');

            res.json({
                vehicles,
                drivers,
                helpers
            });
        });
    });
};

    const calculatePayroll = (shipmentID) => {
    const getCrewSQL = `
        SELECT 
            sc.userID as crewID, 
            sc.role as assignedRole, /* Job on this shipment, not user's default role */          
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
            const totalAllowance = rateData ? rateData.foodAllowance : 350.00;
            const crewCount = crewMembers.length;
            const allowancePerPerson = crewCount > 0 ? (totalAllowance / crewCount) : 0;

            // 4. Loop through EACH crew member
            crewMembers.forEach(member => {
                let payAmount = 0;

                /* Pay based on assigned role on this shipment */
                if (member.assignedRole === 'Driver') {
                    payAmount = standardDriverPay;
                } else {
                    payAmount = standardHelperPay; 
                }

                // 5. Insert Record
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
                        console.log(`Logged User ${member.crewID} as ${member.assignedRole}: Salary ${payAmount}`);
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

exports.createBatchShipments = async (req, res) => {
    const shipments = req.body; 
    // Ensure we have a valid User ID, defaulting to 1 (System/Admin) if auth fails
    const userID = (req.user && req.user.userID) ? req.user.userID : 1;

    if (!Array.isArray(shipments) || shipments.length === 0) {
        return res.status(400).json({ error: "No shipment data provided." });
    }

    db.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: "Database connection failed." });

        connection.beginTransaction(async (err) => {
            if (err) { connection.release(); return res.status(500).json({ error: "Transaction start failed." }); }

            try {
                for (let i = 0; i < shipments.length; i++) {
                    const s = shipments[i];
                    const itemNum = i + 1;

                    /* Validation */
                    if (!s.shipmentID) throw new Error(`Item ${itemNum}: Missing 'Shipment ID'`);
                    if (!s.driverID)   throw new Error(`Item ${itemNum}: Missing 'Driver'`);
                    if (!s.helperID)   throw new Error(`Item ${itemNum}: Missing 'Helper'`);
                    if (!s.vehicleID)  throw new Error(`Item ${itemNum}: Missing 'Vehicle'`);
                    if (!s.loadingDate) throw new Error(`Item ${itemNum}: Missing 'Loading Date'`);
                    if (!s.deliveryDate) throw new Error(`Item ${itemNum}: Missing 'Delivery Date'`);

                    // Parse Integers
                    const shipmentID = parseInt(s.shipmentID);
                    const vehicleID = parseInt(s.vehicleID);
                    const driverID = parseInt(s.driverID);
                    const helperID = parseInt(s.helperID);

                    // Date Logic
                    const loadDateObj = new Date(s.loadingDate);
                    const delDateObj = new Date(s.deliveryDate);
                    
                    if (isNaN(loadDateObj.getTime())) throw new Error(`Item ${itemNum}: Invalid Loading Date format.`);
                    if (isNaN(delDateObj.getTime())) throw new Error(`Item ${itemNum}: Invalid Delivery Date format.`);
                    
                    if (delDateObj < loadDateObj) {
                        throw new Error(`Item ${itemNum} (ID ${shipmentID}): Delivery date cannot be before Loading date.`);
                    }

                    // Route Check
                    const routeCheck = await new Promise((resolve, reject) => {
                        connection.query(
                            "SELECT routeCluster FROM PayrollRates WHERE ? LIKE CONCAT('%', routeCluster, '%') LIMIT 1",
                            [s.destLocation],
                            (err, res) => err ? reject(err) : resolve(res)
                        );
                    });

                    if (routeCheck.length === 0) {
                        throw new Error(`Item ${itemNum} (ID ${shipmentID}): Location '${s.destLocation}' is not a recognized Route.`);
                    }

                    // Insert Shipment
                    await new Promise((resolve, reject) => {
                        const sqlShip = `INSERT INTO Shipments (shipmentID, vehicleID, destName, destLocation, loadingDate, deliveryDate, userID, currentStatus) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`;
                        connection.query(sqlShip, [shipmentID, vehicleID, s.destName, s.destLocation, s.loadingDate, s.deliveryDate, userID], (err) => {
                            if (err) {
                                if (err.code === 'ER_DUP_ENTRY') reject(new Error(`Item ${itemNum}: Shipment ID ${shipmentID} already exists.`));
                                else reject(err);
                            } else resolve();
                        });
                    });

                    // Insert Crew
                    const crewValues = [
                        [shipmentID, driverID, 'Driver'],
                        [shipmentID, helperID, 'Helper']
                    ];
                    await new Promise((resolve, reject) => {
                        connection.query("INSERT INTO ShipmentCrew (shipmentID, userID, role) VALUES ?", [crewValues], (err) => err ? reject(err) : resolve());
                    });

                    // Insert Log
                    await new Promise((resolve, reject) => {
                        connection.query("INSERT INTO ShipmentStatusLog (shipmentID, userID, phaseName, status) VALUES (?, ?, 'Creation', 'Created')", [shipmentID, userID], (err) => err ? reject(err) : resolve());
                    });
                }

                connection.commit((err) => {
                    if (err) {
                        connection.rollback(() => connection.release());
                        return res.status(500).json({ error: "Commit failed." });
                    }
                    connection.release();
                    logActivity(userID, 'BATCH_CREATE', `Created ${shipments.length} shipments in batch.`);
                    res.json({ message: "Batch created successfully", count: shipments.length });
                });

            } catch (error) {
                connection.rollback(() => connection.release());
                return res.status(400).json({ error: error.message });
            }
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

                    const sqlCrew = "INSERT INTO ShipmentCrew (shipmentID, userID, role) VALUES ?";
                    const crewValues = [
                        [shipmentID, driverID, 'Driver'], 
                        [shipmentID, helperID, 'Helper']
                    ];

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
    
    // 1. Parse Columns
    let selectedColumns = [];
    try {
        selectedColumns = req.query.columns ? JSON.parse(req.query.columns) : [];
    } catch (e) {
        selectedColumns = [];
    }

    const adminID = (req.user && req.user.userID) ? req.user.userID : 1;

    // 2. SQL QUERY (With Rate Fallback)
    const query = `
      SELECT 
        s.shipmentID, s.destName, s.destLocation, s.loadingDate, s.deliveryDate,  
        v.plateNo, v.type AS truckType, s.currentStatus, s.creationTimestamp,
        
        -- Crew Names (Fetched by Shipment Role)
        MAX(uDriver.firstName) AS driverNameFirst, MAX(uDriver.lastName) AS driverNameLast,
        MAX(uHelper.firstName) AS helperNameFirst, MAX(uHelper.lastName) AS helperNameLast,

        -- FINANCIALS
        COALESCE(MAX(spDriver.baseFee), MAX(pr.driverBaseFee)) AS driverFee,
        COALESCE(MAX(spHelper.baseFee), MAX(pr.helperBaseFee)) AS helperFee,
        COALESCE(MAX(spDriver.allowance), MAX(pr.foodAllowance)) AS allowance,

        -- Timestamps
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Arrival' LIMIT 1) as arrival,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Handover Invoice' LIMIT 1) as handover,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Start Unload' LIMIT 1) as startUnload,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Finish Unload' LIMIT 1) as finishUnload,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Invoice Receive' LIMIT 1) as invoiceReceive,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Departure' LIMIT 1) as departure,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Completed' LIMIT 1) as completed

      FROM Shipments s
      JOIN Vehicles v ON s.vehicleID = v.vehicleID
      
      -- ✅ JOIN 1: Find the person assigned as 'Driver'
      LEFT JOIN ShipmentCrew scDriver ON s.shipmentID = scDriver.shipmentID AND scDriver.role = 'Driver'
      LEFT JOIN Users uDriver ON scDriver.userID = uDriver.userID
      
      -- ✅ JOIN 2: Find the person assigned as 'Helper' (Even if they are actually a Driver)
      LEFT JOIN ShipmentCrew scHelper ON s.shipmentID = scHelper.shipmentID AND scHelper.role = 'Helper'
      LEFT JOIN Users uHelper ON scHelper.userID = uHelper.userID

      -- Join Payroll
      LEFT JOIN ShipmentPayroll spDriver ON s.shipmentID = spDriver.shipmentID AND spDriver.crewID = uDriver.userID
      LEFT JOIN ShipmentPayroll spHelper ON s.shipmentID = spHelper.shipmentID AND spHelper.crewID = uHelper.userID

      -- Join Rates
      LEFT JOIN PayrollRates pr ON (s.destLocation LIKE CONCAT('%', pr.routeCluster, '%') AND v.type = pr.vehicleType)
      
      WHERE s.creationTimestamp BETWEEN ? AND ?
      
      GROUP BY s.shipmentID
      ORDER BY s.creationTimestamp DESC
    `;

    const start = `${startDate} 00:00:00`;
    const end = `${endDate} 23:59:59`;

    db.query(query, [start, end], (err, rows) => {
        if (err) {
            console.error("Export Query Error:", err);
            if (!res.headersSent) return res.status(500).json({ message: "Database error" });
            return;
        }
        if (rows.length === 0) {
            if (!res.headersSent) return res.status(404).json({ message: 'No records found' });
            return;
        }

        try {
            // 3. Map Data Respecting User Order
            const excelData = rows.map(row => {
                const finalRow = {}; // This object preserves insertion order in modern JS
                const fmtDate = (d) => d ? new Date(d).toLocaleString() : '-';
                const fmtMoney = (m) => m ? Number(m).toFixed(2) : '0.00';

                // Iterate through the ORDERED array from frontend
                selectedColumns.forEach(colKey => {
                    switch (colKey) {
                        case 'shipmentID': finalRow['Shipment ID'] = row.shipmentID; break;
                        case 'destName': finalRow['Destination Name'] = row.destName; break;
                        case 'destLocation': finalRow['Destination Address'] = row.destLocation; break;
                        case 'loadingDate': finalRow['Loading Date'] = row.loadingDate; break;
                        case 'deliveryDate': finalRow['Delivery Date'] = row.deliveryDate; break;
                        case 'plateNo': finalRow['Truck Plate'] = row.plateNo; break;
                        case 'truckType': finalRow['Truck Type'] = row.truckType; break;
                        case 'currentStatus': finalRow['Status'] = row.currentStatus; break;
                        case 'driverName': finalRow['Driver'] = `${row.driverNameFirst || ''} ${row.driverNameLast || ''}`.trim(); break;
                        case 'helperName': finalRow['Helper'] = `${row.helperNameFirst || ''} ${row.helperNameLast || ''}`.trim(); break;
                        case 'driverFee': finalRow['Driver Fee'] = fmtMoney(row.driverFee); break;
                        case 'helperFee': finalRow['Helper Fee'] = fmtMoney(row.helperFee); break;
                        case 'allowance': finalRow['Allowance'] = fmtMoney(row.allowance); break;
                        case 'dateCreated': finalRow['Date Created'] = fmtDate(row.creationTimestamp); break;
                        case 'arrival': finalRow['Arrival Time'] = fmtDate(row.arrival); break;
                        case 'handover': finalRow['Handover Invoice'] = fmtDate(row.handover); break;
                        case 'startUnload': finalRow['Start Unload'] = fmtDate(row.startUnload); break;
                        case 'finishUnload': finalRow['Finish Unload'] = fmtDate(row.finishUnload); break;
                        case 'invoiceReceive': finalRow['Invoice Receive'] = fmtDate(row.invoiceReceive); break;
                        case 'departure': finalRow['Departure'] = fmtDate(row.departure); break;
                        case 'completed': finalRow['Completion Time'] = fmtDate(row.completed); break;
                    }
                });

                return finalRow;
            });

            // 4. Generate & Send
            const workSheet = XLSX.utils.json_to_sheet(excelData);
            const colWidths = Object.keys(excelData[0] || {}).map(() => ({ wch: 20 }));
            workSheet['!cols'] = colWidths;

            const workBook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workBook, workSheet, "Shipment Report");
            const excelBuffer = XLSX.write(workBook, { bookType: 'xlsx', type: 'buffer' });

            res.setHeader('Content-Disposition', `attachment; filename=Shipments_${startDate}_to_${endDate}.xlsx`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

            logActivity(adminID, 'EXPORT_DATA', `Exported Report (${startDate} to ${endDate})`, () => {
                res.send(excelBuffer);
            });

        } catch (error) {
            console.error("Excel Gen Error:", error);
            if (!res.headersSent) res.status(500).json({ message: "Error generating Excel file" });
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