const db = require('../config/db');
const XLSX = require('xlsx');
const logActivity = require('../utils/activityLogger');

/** Fetches shipments filtered by user role (Driver/Helper see assigned only) or archived state */
exports.getActiveShipments = (req, res) => {
    // 1. Get Role
    const requesterRole = req.user ? req.user.role : 'Driver'; 
    const currentUserID = req.query.userID;
    
    // 2. Define who gets "Desktop Mode" (Admin OR Operations)
    // We treat 'Admin', 'ADMIN', and 'Operations' as Desktop users.
    const isDesktopUser = ['Admin', 'Operations'].includes(requesterRole);

    // 3. Logic: Only force "Driver Mode" if they are NOT a Desktop User
    const isDriverMode = !isDesktopUser && currentUserID;

    console.log(`Role: ${requesterRole} | Mode: ${isDriverMode ? "MOBILE" : "DESKTOP"}`);

    const showArchived = req.query.archived === 'true';
    const isArchivedVal = showArchived ? 1 : 0; 

    // Define columns 
    const columns = `
        s.shipmentID, s.destName, s.destLocation, 
        s.loadingDate, s.deliveryDate, s.delayReason,
        s.currentStatus, s.creationTimestamp, v.plateNo, v.type as truckType
    `;
    const sortLogic = `ORDER BY s.loadingDate IS NULL ASC, s.loadingDate ASC, s.creationTimestamp DESC`;

    // Pagination Logic
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    let limitClause = "";
    
    if (page && limit) {
        const offset = (page - 1) * limit;
        limitClause = ` LIMIT ${limit} OFFSET ${offset}`;
    } else if (limit) {
        limitClause = ` LIMIT ${limit}`;
    }

    let sql;
    let params = [];

    if (isDriverMode) {
        // --- MOBILE / DRIVER MODE ---
        // Updated to include crewDetails so mobile users can see their partner
        sql = `
            SELECT ${columns},
                GROUP_CONCAT(CONCAT(sc_all.role, ':', u.firstName, ' ', u.lastName) SEPARATOR '|') AS crewDetails
            FROM Shipments s
            JOIN Vehicles v ON s.vehicleID = v.vehicleID 
            JOIN ShipmentCrew sc_me ON s.shipmentID = sc_me.shipmentID
            LEFT JOIN ShipmentCrew sc_all ON s.shipmentID = sc_all.shipmentID
            LEFT JOIN Users u ON sc_all.userID = u.userID
            WHERE sc_me.userID = ? 
              AND s.isArchived = 0 
              AND (
                  s.currentStatus != 'Completed' 
                  OR (s.currentStatus = 'Completed' AND s.deliveryDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY))
              )
            GROUP BY s.shipmentID
            ${sortLogic}
            ${limitClause}
        `;
        params = [currentUserID];
    } else {
        // --- DESKTOP / ADMIN / OPERATIONS MODE ---
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
            ${limitClause}
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

    const calculatePayroll = (shipmentID, explicitDate = null) => {
    // Use console.log for maximum reliability in remote environments
    const log = (msg) => console.error(`[PAYROLL-DEBUG] [Shipment ${shipmentID}] ${msg}`);

    log(`STARTING CALCULATION. Explicit Date: ${explicitDate}`);

    const getCrewSQL = `
        SELECT 
            sc.userID as crewID, 
            sc.role as assignedRole, 
            s.destLocation, 
            v.type as vehicleType
        FROM ShipmentCrew sc
        JOIN Users u ON sc.userID = u.userID        
        JOIN Shipments s ON s.shipmentID = sc.shipmentID
        LEFT JOIN Vehicles v ON s.vehicleID = v.vehicleID 
        WHERE s.shipmentID = ?
    `;

    db.query(getCrewSQL, [shipmentID], (err, crewMembers) => {
        if (err) {
            log(`ERROR getting crew: ${err.message}`);
            return console.error("Payroll Error (Get Crew):", err);
        }
        if (crewMembers.length === 0) {
            log("ERROR: No crew found");
            return console.error("Payroll Error: No crew found for this shipment.");
        }

        const { destLocation, vehicleType } = crewMembers[0]; 
        
        // Helper to find period and insert payroll
        const performPayrollInsert = (deliveryDateToUse, source) => {
            log(`Searching Period for Date: ${deliveryDateToUse} (Source: ${source})`);

            const getPeriodSQL = `
                SELECT periodID, startDate, endDate FROM PayrollPeriods 
                WHERE startDate <= ? 
                AND DATE_ADD(endDate, INTERVAL 1 DAY) > ?
                ORDER BY startDate DESC 
                LIMIT 1
            `;

            db.query(getPeriodSQL, [deliveryDateToUse, deliveryDateToUse], (err, periodResult) => {
                if (err) {
                    log(`DB ERROR getting period: ${err.message}`);
                    return;
                }
                
                const periodID = (periodResult && periodResult.length > 0) ? periodResult[0].periodID : null;
                log(`Found Period ID: ${periodID}`);
                
                if (!periodID) {
                    log(`WARNING: No period found for date ${deliveryDateToUse}. Aborting payroll insert.`);
                    // If we used explicit date and failed, try fetching from DB as a last resort fallback
                    if (source === 'memory') {
                        log("Attempting Fallback: Fetching date from DB...");
                        setTimeout(() => fetchDateFromDBAndRetry(), 1000);
                    }
                    return;
                }

                const getRateSQL = `
                    SELECT * FROM PayrollRates 
                    WHERE ? LIKE CONCAT('%', routeCluster, '%') 
                    AND vehicleType = ? 
                    LIMIT 1
                `;

                db.query(getRateSQL, [destLocation, vehicleType || 'AUV'], (err, rates) => {
                    if (err) {
                        log(`DB ERROR getting rates: ${err.message}`);
                        return;
                    }

                    const rateData = rates.length > 0 ? rates[0] : null;
                    const standardDriverPay = rateData ? rateData.driverBaseFee : 600.00;
                    const standardHelperPay = rateData ? rateData.helperBaseFee : 400.00;
                    const totalAllowance = rateData ? rateData.foodAllowance : 350.00;
                    const crewCount = crewMembers.length;
                    const allowancePerPerson = crewCount > 0 ? (totalAllowance / crewCount) : 0;

                    log(`Rates Found: Driver=${standardDriverPay}, Helper=${standardHelperPay}, Allowance=${allowancePerPerson}`);

                    const insertPromises = crewMembers.map(member => {
                        return new Promise(resolve => {
                            let payAmount = member.assignedRole === 'Driver' ? standardDriverPay : standardHelperPay;
                            const insertPayrollSQL = `
                                INSERT INTO ShipmentPayroll 
                                (shipmentID, crewID, baseFee, allowance, periodID) 
                                VALUES (?, ?, ?, ?, ?)
                                ON DUPLICATE KEY UPDATE 
                                    periodID = VALUES(periodID)
                            `;
                            db.query(insertPayrollSQL, [shipmentID, member.crewID, payAmount, allowancePerPerson, periodID], (err) => {
                                if (err) {
                                    log(`INSERT FAILED for Crew ${member.crewID}: ${err.message}`);
                                } else {
                                    log(`SUCCESS: Inserted/Updated payroll for Crew ${member.crewID}`);
                                }
                                resolve();
                            });
                        });
                    });

                    Promise.all(insertPromises).then(() => {
                        const fixSql = `
                            UPDATE ShipmentPayroll sp
                            JOIN Shipments s ON s.shipmentID = sp.shipmentID
                            JOIN PayrollPeriods p 
                              ON s.deliveryDate >= p.startDate 
                             AND s.deliveryDate < DATE_ADD(p.endDate, INTERVAL 1 DAY)
                            SET sp.periodID = p.periodID
                            WHERE sp.shipmentID = ? AND sp.periodID IS NULL
                        `;
                        db.query(fixSql, [shipmentID], (err, result) => {
                            if (err) {
                                log(`PERIOD FIX UPDATE ERROR: ${err.message}`);
                            } else {
                                log(`PERIOD FIX UPDATE AFFECTED ROWS: ${result && result.affectedRows}`);
                            }
                        });
                    });
                });
            });
        };

        const fetchDateFromDBAndRetry = () => {
            const getShipmentDateSQL = "SELECT deliveryDate FROM Shipments WHERE shipmentID = ?";
            db.query(getShipmentDateSQL, [shipmentID], (err, shipResult) => {
                if (err) {
                    log(`FALLBACK ERROR: Could not fetch date from DB: ${err.message}`);
                    return;
                }
                if (shipResult.length === 0 || !shipResult[0].deliveryDate) {
                    log(`FALLBACK ERROR: Shipment not found or has no deliveryDate`);
                    return;
                }
                const dbDate = shipResult[0].deliveryDate;
                log(`Fetched DB Date: ${dbDate}`);
                performPayrollInsert(dbDate, 'database');
            });
        };

        // Main Flow
        if (explicitDate) {
            performPayrollInsert(explicitDate, 'memory');
        } else {
            fetchDateFromDBAndRetry();
        }
    });
};

// 2. Update Status
exports.updateStatus = (req, res) => {
    const shipmentID = req.params.id;
    const { status, userID, deliveryDate, clientTimestamp, remarks } = req.body;

    if (!shipmentID || shipmentID === 'undefined') {
        return res.status(400).json({ error: "Shipment ID is missing" });
    }

    // --- Date Validation Guard ---
    // Prevent updates to statuses based on loading/delivery dates
    const warehouseStatuses = ['Arrival at Warehouse', 'Start Loading', 'End Loading', 'Document Released', 'Start Route'];
    const deliveryStatuses = ['Arrival', 'Handover Invoice', 'Start Unload', 'Finish Unload', 'Invoice Receive', 'Departure', 'Completed'];
    
    if (status === 'Loaded' || warehouseStatuses.includes(status) || deliveryStatuses.includes(status)) {
        const checkSql = "SELECT loadingDate, deliveryDate FROM Shipments WHERE shipmentID = ?";
        db.query(checkSql, [shipmentID], (err, rows) => {
            if (err) return res.status(500).json({ error: "DB Check failed: " + err.message });
            
            if (rows.length === 0) {
                return res.status(404).json({ error: "Shipment not found" });
            }

            if (rows.length > 0) {
                const { loadingDate, deliveryDate } = rows[0];
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // 1. Loading Date Check (Loaded and Warehouse steps)
                if ((status === 'Loaded' || warehouseStatuses.includes(status)) && loadingDate) {
                    const loadDateObj = new Date(loadingDate);
                    loadDateObj.setHours(0, 0, 0, 0);
                    if (today < loadDateObj) {
                        return res.status(403).json({ 
                            error: "Business Rule Violation", 
                            message: `Warehouse steps and loading confirmation are restricted until the loading date (${loadingDate}).` 
                        });
                    }
                }

                // 2. Delivery Date Check
                if (deliveryStatuses.includes(status) && deliveryDate) {
                    const delDateObj = new Date(deliveryDate);
                    delDateObj.setHours(0, 0, 0, 0);
                    if (today < delDateObj) {
                        return res.status(403).json({ 
                            error: "Business Rule Violation", 
                            message: `Delivery steps are restricted until the delivery date (${deliveryDate}).` 
                        });
                    }
                }
            }
            proceedWithUpdate();
        });
    } else {
        proceedWithUpdate();
    }

    function proceedWithUpdate() {
        let updateShipmentSql = "UPDATE Shipments SET currentStatus = ? WHERE shipmentID = ?";
        let params = [status, shipmentID];
        
        // Handle timezone shift for Philippine Time (UTC+8)
        // The client sends a UTC timestamp (Date.now()). 
        // We explicitly format it as a UTC string 'YYYY-MM-DD HH:mm:ss' for the DB.
        // This avoids any ambiguity with server local time or driver timezone settings.
        let eventDateObj = clientTimestamp ? new Date(clientTimestamp) : (deliveryDate ? new Date(deliveryDate) : new Date());
        
        if (isNaN(eventDateObj.getTime())) {
            eventDateObj = new Date();
        }

        // Force UTC String Generation
        const validTimestamp = eventDateObj.toISOString().slice(0, 19).replace('T', ' ');

        // Update Delivery Date if Completed
        let computedDate = null;
        if (status === 'Completed') {
            updateShipmentSql = "UPDATE Shipments SET currentStatus = ?, deliveryDate = ? WHERE shipmentID = ?";
            computedDate = validTimestamp;
            params = [status, computedDate, shipmentID];
        }

        const insertLogSql = "INSERT INTO ShipmentStatusLog (shipmentID, userID, phaseName, status, timestamp, remarks) VALUES (?, ?, ?, ?, ?, ?)";

        db.query(updateShipmentSql, params, (err, result) => {
            if (err) {
                console.error("Update Error:", err);
                return res.status(500).json({ error: err.message });
            }

            db.query(insertLogSql, [shipmentID, userID, status, status, validTimestamp, remarks || null], (err, result) => {
                if (err) {
                    // Check for Foreign Key Constraint Failure (Shipment doesn't exist)
                    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
                        console.warn(`Log Insert Failed: Shipment ${shipmentID} does not exist.`);
                        return res.status(404).json({ error: "Shipment not found (during log update)" });
                    }
                    console.error("Log Error:", err);
                    return res.status(500).json({ error: err.message });
                }

                logActivity(userID, 'UPDATE_SHIPMENT', `Updated Shipment #${shipmentID} to ${status}`);
                res.json({ message: `Shipment ${shipmentID} updated to ${status}` });
            });

            if (status === 'Completed') { 
                setTimeout(() => {
                    calculatePayroll(shipmentID, computedDate || new Date());
                }, 500); 
            }
        });
    }
};

// 3. Get Logs 
exports.getShipmentLogs = (req, res) => {
    const id = req.params.id; 

    const sql = `
        SELECT 
            l.phaseName, 
            l.timestamp,
            l.remarks,
            CONCAT(u.firstName, ' ', u.lastName) AS actorName,
            u.role AS actorRole
        FROM ShipmentStatusLog l
        LEFT JOIN Users u ON l.userID = u.userID
        WHERE l.shipmentID = ? 
        ORDER BY l.timestamp DESC
    `;

    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error("Error fetching logs:", err);
            return res.status(500).json({ error: "Database error" });
        }
        
        // Append 'Z' to timestamps to explicitly indicate UTC
        // The DB stores UTC, but mysql2 returns strings like "YYYY-MM-DD HH:MM:SS" (no Z).
        // By adding Z, we ensure the client parses it as UTC and converts to local time correctly.
        const normalizedResults = results.map(row => ({
            ...row,
            timestamp: row.timestamp ? (row.timestamp.replace(' ', 'T') + 'Z') : null
        }));

        res.json(normalizedResults);
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
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Arrival at Warehouse' LIMIT 1) as arrivalWarehouse,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Start Loading' LIMIT 1) as startLoading,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'End Loading' LIMIT 1) as endLoading,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Document Released' LIMIT 1) as documentReleased,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Start Route' LIMIT 1) as startRoute,
        
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Arrival' LIMIT 1) as arrival,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Handover Invoice' LIMIT 1) as handover,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Start Unload' LIMIT 1) as startUnload,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Finish Unload' LIMIT 1) as finishUnload,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Invoice Receive' LIMIT 1) as invoiceReceive,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Departure' LIMIT 1) as departure,
        (SELECT timestamp FROM ShipmentStatusLog WHERE shipmentID = s.shipmentID AND phaseName = 'Completed' LIMIT 1) as completed,

        -- Remarks for Store Steps (Grouped)
        (SELECT GROUP_CONCAT(CONCAT(phaseName, ': ', remarks) SEPARATOR ' | ') 
         FROM ShipmentStatusLog 
         WHERE shipmentID = s.shipmentID 
           AND remarks IS NOT NULL 
           AND remarks != '' 
           AND phaseName IN ('Arrival', 'Handover Invoice', 'Start Unload', 'Finish Unload', 'Invoice Receive', 'Departure')) as storeRemarks

      FROM Shipments s
      JOIN Vehicles v ON s.vehicleID = v.vehicleID
      
      -- JOIN 1: Find the person assigned as 'Driver'
      LEFT JOIN ShipmentCrew scDriver ON s.shipmentID = scDriver.shipmentID AND scDriver.role = 'Driver'
      LEFT JOIN Users uDriver ON scDriver.userID = uDriver.userID
      
      -- JOIN 2: Find the person assigned as 'Helper' (Even if they are actually a Driver)
      LEFT JOIN ShipmentCrew scHelper ON s.shipmentID = scHelper.shipmentID AND scHelper.role = 'Helper'
      LEFT JOIN Users uHelper ON scHelper.userID = uHelper.userID

      -- Join Payroll
      LEFT JOIN ShipmentPayroll spDriver ON s.shipmentID = spDriver.shipmentID AND spDriver.crewID = uDriver.userID
      LEFT JOIN ShipmentPayroll spHelper ON s.shipmentID = spHelper.shipmentID AND spHelper.crewID = uHelper.userID

      -- Join Rates
      LEFT JOIN PayrollRates pr ON (s.destLocation LIKE CONCAT('%', pr.routeCluster, '%') AND v.type = pr.vehicleType)
      
      -- Filter by Overlap (Duration) if both dates exist, otherwise single date fallback
      WHERE 
        -- Case 1: Overlap (Shipment Duration overlaps with Selected Period)
        (s.loadingDate IS NOT NULL AND s.deliveryDate IS NOT NULL AND s.loadingDate <= ? AND s.deliveryDate >= ?)
        OR 
        -- Case 2: Only Loading Date exists (Check if in range)
        (s.loadingDate IS NOT NULL AND s.deliveryDate IS NULL AND s.loadingDate BETWEEN ? AND ?)
        OR 
        -- Case 3: No Loading Date (Check Creation Timestamp)
        (s.loadingDate IS NULL AND s.creationTimestamp BETWEEN ? AND ?)
      
      GROUP BY s.shipmentID
      ORDER BY s.loadingDate DESC, s.creationTimestamp DESC
    `;

    // Ensure full day coverage
    const start = `${startDate}`;  // YYYY-MM-DD
    const end = `${endDate}`;      // YYYY-MM-DD
    
    const startDateTime = `${start} 00:00:00`;
    const endDateTime = `${end} 23:59:59`;

    // Param Order:
    // 1. Overlap: loadingDate <= end AND deliveryDate >= start
    // 2. Loading Only: loadingDate BETWEEN start AND end
    // 3. Creation Only: creationTimestamp BETWEEN start AND end
    const queryParams = [
        end, start,         // Overlap
        start, end,         // Loading Only
        startDateTime, endDateTime // Creation Only
    ];

    db.query(query, queryParams, (err, rows) => {
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
            // 3. Map Data (Transposed: Headers in First Column)
            const fmtDate = (d) => d ? new Date(d).toLocaleString() : '-';
            const fmtMoney = (m) => m ? Number(m).toFixed(2) : '0.00';

            const colMap = {
                'shipmentID': { label: 'Shipment ID', val: r => r.shipmentID },
                'destName': { label: 'Destination Name', val: r => r.destName },
                'destLocation': { label: 'Destination Address', val: r => r.destLocation },
                'loadingDate': { label: 'Loading Date', val: r => r.loadingDate },
                'deliveryDate': { label: 'Delivery Date', val: r => r.deliveryDate },
                'plateNo': { label: 'Truck Plate', val: r => r.plateNo },
                'truckType': { label: 'Truck Type', val: r => r.truckType },
                'currentStatus': { label: 'Status', val: r => r.currentStatus },
                'driverName': { label: 'Driver', val: r => `${r.driverNameFirst || ''} ${r.driverNameLast || ''}`.trim() },
                'helperName': { label: 'Helper', val: r => `${r.helperNameFirst || ''} ${r.helperNameLast || ''}`.trim() },
                'driverFee': { label: 'Driver Fee', val: r => fmtMoney(r.driverFee) },
                'helperFee': { label: 'Helper Fee', val: r => fmtMoney(r.helperFee) },
                'allowance': { label: 'Allowance', val: r => fmtMoney(r.allowance) },
                'dateCreated': { label: 'Date Created', val: r => fmtDate(r.creationTimestamp) },
                
                // Warehouse Phases
                'arrivalWarehouse': { label: 'Time: Arrival at Warehouse', val: r => fmtDate(r.arrivalWarehouse) },
                'startLoading': { label: 'Time: Start Loading', val: r => fmtDate(r.startLoading) },
                'endLoading': { label: 'Time: End Loading', val: r => fmtDate(r.endLoading) },
                'documentReleased': { label: 'Time: Document Released', val: r => fmtDate(r.documentReleased) },
                'startRoute': { label: 'Time: Start Route', val: r => fmtDate(r.startRoute) },
                
                // Store Phases
                'arrival': { label: 'Arrival Time', val: r => fmtDate(r.arrival) },
                'handover': { label: 'Handover Invoice', val: r => fmtDate(r.handover) },
                'startUnload': { label: 'Start Unload', val: r => fmtDate(r.startUnload) },
                'finishUnload': { label: 'Finish Unload', val: r => fmtDate(r.finishUnload) },
                'invoiceReceive': { label: 'Invoice Receive', val: r => fmtDate(r.invoiceReceive) },
                'departure': { label: 'Departure', val: r => fmtDate(r.departure) },
                'completed': { label: 'Completion Time', val: r => fmtDate(r.completed) },
                'remarks': { label: 'Remarks', val: r => r.storeRemarks || '-' }
            };

            const transposedData = [];
            
            // Build Rows (Where each row starts with the Header Name)
            selectedColumns.forEach(colKey => {
                const config = colMap[colKey];
                if (config) {
                    const rowData = [config.label]; // Header is the first cell
                    rows.forEach(r => rowData.push(config.val(r))); // Shipment values follow horizontally
                    transposedData.push(rowData);
                }
            });

            // 4. Generate & Send
            const workSheet = XLSX.utils.aoa_to_sheet(transposedData);
            
            // Optional: Set column widths (First col wider for headers)
            const colWidths = [{ wch: 25 }]; 
            for(let i=0; i<rows.length; i++) colWidths.push({ wch: 20 });
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

exports.updateDelayReason = (req, res) => {
    const { id } = req.params;
    const { reason, userID } = req.body;

    if (!reason) return res.status(400).json({ error: "Reason is required" });

    const sql = "UPDATE Shipments SET delayReason = ? WHERE shipmentID = ?";
    db.query(sql, [reason, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        logActivity(userID || 1, 'UPDATE_DELAY_REASON', `Added delay reason for #${id}: ${reason}`, () => {
            res.json({ message: "Delay reason updated" });
        });
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
