const db = require('../config/db');
const logActivity = require('../utils/activityLogger');
const XLSX = require('xlsx');
const util = require('util');

// Get List of Pay Periods
exports.getPeriods = (req, res) => {
    const sql = "SELECT * FROM PayrollPeriods ORDER BY startDate DESC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

const processCarryOverDebts = (currentPeriodID, dbConnection) => {
    return new Promise((resolve, reject) => {
        
        // 1. Find Previous Period
        const findPrevSql = `
            SELECT periodID FROM PayrollPeriods 
            WHERE endDate < (SELECT startDate FROM PayrollPeriods WHERE periodID = ?) 
            ORDER BY endDate DESC LIMIT 1
        `;

        dbConnection.query(findPrevSql, [currentPeriodID], (err, prevResults) => {
            if (err) return reject(err);
            if (prevResults.length === 0) {
                console.log("No previous period found to carry over from.");
                return resolve(); // Done, nothing to do
            }

            const previousPeriodID = prevResults[0].periodID;
            console.log(`Processing Carry-Over: Period ${previousPeriodID} -> Period ${currentPeriodID}`);

            // 2. Clean up OLD entries for this period (Prevent Duplicates)
            const cleanUpSql = `DELETE FROM PayrollAdjustments WHERE periodID = ? AND reason LIKE 'Balance from Period %'`;
            
            dbConnection.query(cleanUpSql, [currentPeriodID], (err) => {
                if (err) return reject(err);

                // 3. Calculate Debts
                const sql = `
                    SELECT 
                        u.userID,
                        (
                            COALESCE(SUM(sp.baseFee), 0) + 
                            COALESCE((SELECT SUM(amount) FROM PayrollAdjustments WHERE userID = u.userID AND periodID = ? AND type = 'BONUS' AND status != 'VOID'), 0) -
                            COALESCE((SELECT SUM(amount) FROM PayrollAdjustments WHERE userID = u.userID AND periodID = ? AND type = 'DEDUCTION' AND status != 'VOID'), 0)
                        ) as netSalary,
                        COALESCE((SELECT SUM(amount) FROM PayrollPayments WHERE userID = u.userID AND periodID = ? AND status = 'COMPLETED'), 0) as totalPaid
                    FROM Users u
                    LEFT JOIN ShipmentPayroll sp ON u.userID = sp.crewID AND sp.periodID = ?
                    GROUP BY u.userID
                    HAVING totalPaid > netSalary
                `;

                dbConnection.query(sql, [previousPeriodID, previousPeriodID, previousPeriodID, previousPeriodID], (err, results) => {
                    if (err) return reject(err);

                    // 4. Insert New Debts
                    const pendingInserts = results.map(row => {
                        const debt = row.totalPaid - row.netSalary;
                        if (debt > 0) {
                            return new Promise((innerResolve) => {
                                const insertSql = `
                                    INSERT INTO PayrollAdjustments (userID, periodID, type, amount, reason)
                                    VALUES (?, ?, 'DEDUCTION', ?, ?)
                                `;
                                dbConnection.query(insertSql, [row.userID, currentPeriodID, debt, `Balance from Period #${previousPeriodID}`], (err) => {
                                    if (err) console.error("Failed to insert debt:", err);
                                    innerResolve();
                                });
                            });
                        }
                        return Promise.resolve();
                    });

                    // Wait for all inserts to finish
                    Promise.all(pendingInserts).then(() => resolve());
                });
            });
        });
    });
};

const formatDateLocal = (dateInput) => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// GENERATE PAYROLL (Awaits Carry-Over)
exports.generatePayroll = (req, res) => {
    const { periodID } = req.body;
    const adminID = (req.user && req.user.userID) ? req.user.userID : 1; 

    // 1. SECURITY CHECK: Ensure Period is NOT Closed
    db.query("SELECT status FROM PayrollPeriods WHERE periodID = ?", [periodID], (err, result) => {
        if (err) return res.status(500).json({ error: "Database error checking period status" });
        
        if (result.length > 0 && result[0].status === 'CLOSED') {
            return res.status(403).json({ error: "This period is LOCKED. You cannot regenerate payroll." });
        }

        // 2. PROCEED: Fetch Period Dates
            db.query("SELECT * FROM PayrollPeriods WHERE periodID = ?", [periodID], (err, periods) => {
                if (err || periods.length === 0) return res.status(500).json({ error: "Invalid Period" });

                // Date Handling: Ensure we cover the full range in Local/PH Time
                const periodStart = new Date(periods[0].startDate);
                const periodEnd = new Date(periods[0].endDate);

                // Add 1 day to end date to ensure we capture the full last day (since DB stores 00:00)
                periodEnd.setDate(periodEnd.getDate() + 1);

                const start = periodStart.toISOString().slice(0, 19).replace('T', ' ');
                const end = periodEnd.toISOString().slice(0, 19).replace('T', ' ');

                console.log(`Generating Payroll for Range: ${start} to ${end}`);

                // 3. Fetch Rates
                db.query("SELECT * FROM PayrollRates", (err, rates) => {
                if (err) return res.status(500).json({ error: "Failed to fetch rates" });

                // 4. Find Completed Shipments (That haven't been assigned a period yet)
                const shipmentSql = `
                    SELECT 
                        s.shipmentID, s.destLocation, s.deliveryDate,
                        v.type as vehicleType,
                        sc.userID as crewID, sc.role,
                        (SELECT COUNT(*) FROM ShipmentCrew WHERE shipmentID = s.shipmentID) as crewCount
                    FROM Shipments s
                    JOIN ShipmentCrew sc ON s.shipmentID = sc.shipmentID
                    JOIN Users u ON sc.userID = u.userID
                    JOIN Vehicles v ON s.vehicleID = v.vehicleID
                    LEFT JOIN ShipmentPayroll sp ON s.shipmentID = sp.shipmentID AND sc.userID = sp.crewID
                    WHERE s.currentStatus = 'Completed'
                      AND s.deliveryDate BETWEEN ? AND ?
                      AND (sp.payrollID IS NULL OR sp.periodID IS NULL)
                `;

                db.query(shipmentSql, [start, end], (err, shipments) => {
                    if (err) return res.status(500).json({ error: "Failed to fetch shipments: " + err.message });

                    // Helper to finish: Process Debts -> Log -> Respond
                    const finishGeneration = (rowsCreated = 0) => {
                        processCarryOverDebts(periodID, db)
                            .then(() => {
                                logActivity(
                                    adminID, 
                                    'GENERATE_PAYROLL', 
                                    `Harvested/Generated payroll calculation for Period #${periodID}`,
                                    () => {
                                        res.json({ 
                                            message: "Payroll Generated & Balances Updated", 
                                            rowsCreated: rowsCreated 
                                        });
                                    }
                                );
                            })
                            .catch(err => {
                                console.error("Carry-Over Error:", err);
                                res.status(500).json({ error: "Payroll generated but failed to carry over debts." });
                            });
                    };

                    // If no new shipments, still run debt carry-over
                    if (shipments.length === 0) {
                        return finishGeneration(0); 
                    }

                    // 5. Calculate Fees & Allowance
                    const valuesToInsert = shipments.map(ship => {
                        // Find matching rate
                        const matchedRate = rates.find(r => 
                            ship.destLocation.toLowerCase().includes(r.routeCluster.toLowerCase()) && 
                            ship.vehicleType === r.vehicleType
                        );

                        // Defaults
                        let baseFee = ship.role === 'Driver' ? 600 : 400;
                        let totalAllowance = 350;

                        // Apply Rate if found
                        if (matchedRate) {
                            baseFee = ship.role === 'Driver' ? matchedRate.driverBaseFee : matchedRate.helperBaseFee;
                            totalAllowance = matchedRate.foodAllowance;
                        }

                        // Split allowance
                        const allowancePerPerson = totalAllowance / (ship.crewCount || 1);

                        return [ship.shipmentID, ship.crewID, periodID, baseFee, allowancePerPerson];
                    });

                    // 6. Bulk Insert with Duplicate Update
                    const insertSql = `
                        INSERT INTO ShipmentPayroll (shipmentID, crewID, periodID, baseFee, allowance) 
                        VALUES ?
                        ON DUPLICATE KEY UPDATE
                        periodID = VALUES(periodID),
                        baseFee = VALUES(baseFee),
                        allowance = VALUES(allowance)
                    `;

                    db.query(insertSql, [valuesToInsert], (err, result) => {
                        if (err) return res.status(500).json({ error: "Insert Failed: " + err.message });
                        finishGeneration(result.affectedRows);
                    });
                });
            });
        });
    });
};

// VIEW SUMMARY
exports.getPayrollSummary = (req, res) => {
    const { periodID } = req.params;

    const sql = `
        SELECT 
            u.userID, u.firstName, u.lastName, u.role,
            COUNT(DISTINCT sp.payrollID) as tripCount,
            COALESCE(SUM(DISTINCT sp.baseFee), 0) as totalBasePay,
            COALESCE(SUM(DISTINCT sp.allowance), 0) as totalAllowance,
            
            -- Shipment-specific adjustments (Sum of all adjustments for this crew in this period's shipments)
            COALESCE((
                SELECT SUM(CASE WHEN sa.type = 'BONUS' THEN sa.amount ELSE -sa.amount END)
                FROM ShipmentAdjustments sa
                JOIN ShipmentPayroll sp2 ON sa.shipmentID = sp2.shipmentID AND sa.crewID = sp2.crewID
                WHERE sp2.crewID = u.userID AND sp2.periodID = ?
            ), 0) as totalShipmentAdjustments,
            
            COALESCE((SELECT SUM(amount) FROM PayrollAdjustments pa 
                WHERE pa.userID = u.userID AND pa.periodID = ? AND pa.type = 'BONUS' AND pa.status != 'VOID'), 0) as totalBonus,  

            COALESCE((SELECT SUM(amount) FROM PayrollAdjustments pa 
                WHERE pa.userID = u.userID AND pa.periodID = ? AND pa.type = 'DEDUCTION' AND pa.status != 'VOID'), 0) as totalDeductions, 

            COALESCE((SELECT SUM(amount) FROM PayrollPayments pp 
                WHERE pp.userID = u.userID AND pp.periodID = ? AND pp.status = 'COMPLETED'), 0) as totalPaid

        FROM Users u
        LEFT JOIN ShipmentPayroll sp ON u.userID = sp.crewID AND sp.periodID = ?
        
        WHERE sp.payrollID IS NOT NULL 
           OR EXISTS (SELECT 1 FROM PayrollAdjustments pa WHERE pa.userID = u.userID AND pa.periodID = ?)
           
        GROUP BY u.userID
        ORDER BY u.lastName ASC
    `;

    db.query(sql, [periodID, periodID, periodID, periodID, periodID, periodID], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        const finalResults = results.map(row => ({
            ...row,
            netSalary: (Number(row.totalBasePay) + Number(row.totalShipmentAdjustments) + Number(row.totalBonus)) - Number(row.totalDeductions)
        }));
        res.json(finalResults);
    });
};

// GET TRIPS
exports.getEmployeeTrips = (req, res) => {
    const { periodID, userID } = req.params;

    const sql = `
        SELECT 
            s.shipmentID,
            s.deliveryDate as shipmentDate, 
            s.destLocation as routeCluster,          
            v.type as vehicleType,               
            sp.baseFee,
            sp.allowance,
            -- Subquery to get sum of adjustments for this specific shipment/crew
            COALESCE((
                SELECT SUM(CASE WHEN type = 'BONUS' THEN amount ELSE -amount END)
                FROM ShipmentAdjustments
                WHERE shipmentID = s.shipmentID AND crewID = ?
            ), 0) as adjustmentAmount
        FROM ShipmentPayroll sp
        JOIN Shipments s ON sp.shipmentID = s.shipmentID
        LEFT JOIN Vehicles v ON s.vehicleID = v.vehicleID 
        WHERE sp.periodID = ? 
          AND sp.crewID = ?
          AND s.currentStatus = 'Completed'
          AND s.loadingDate IS NOT NULL
        ORDER BY s.deliveryDate DESC
    `;

    db.query(sql, [userID, periodID, userID], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// GET MULTIPLE ADJUSTMENTS FOR A SHIPMENT
exports.getShipmentAdjustments = (req, res) => {
    const { shipmentID, crewID } = req.params;
    const sql = "SELECT * FROM ShipmentAdjustments WHERE shipmentID = ? AND crewID = ? ORDER BY created_at DESC";
    db.query(sql, [shipmentID, crewID], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// ADD SHIPMENT ADJUSTMENT
exports.addShipmentAdjustment = (req, res) => {
    const { shipmentID, crewID, amount, type, reason } = req.body;
    const adminID = req.user ? req.user.userID : 1;

    if (!shipmentID || !crewID || !amount || !type || !reason) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const sql = "INSERT INTO ShipmentAdjustments (shipmentID, crewID, amount, type, reason) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [shipmentID, crewID, amount, type, reason], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        logActivity(adminID, 'ADD_SHIPMENT_ADJUSTMENT', `Added ${type} of ₱${amount} to Shipment #${shipmentID} (Crew #${crewID}): ${reason}`, () => {
            res.json({ message: "Adjustment added successfully", adjustmentID: result.insertId });
        });
    });
};

// DELETE SHIPMENT ADJUSTMENT
exports.deleteShipmentAdjustment = (req, res) => {
    const { adjustmentID } = req.params;
    const adminID = req.user ? req.user.userID : 1;

    const sql = "DELETE FROM ShipmentAdjustments WHERE adjustmentID = ?";
    db.query(sql, [adjustmentID], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        logActivity(adminID, 'DELETE_SHIPMENT_ADJUSTMENT', `Removed shipment adjustment ID #${adjustmentID}`, () => {
            res.json({ message: "Adjustment removed successfully" });
        });
    });
};

exports.closePeriod = (req, res) => {
    const { periodID } = req.body;
    
    console.log(`[Close Period] Attempting to close period #${periodID}`);

    if (!periodID) {
        return res.status(400).json({ error: "Period ID is required" });
    }

    const adminID = (req.user && req.user.userID) ? req.user.userID : 1;

    const sql = "UPDATE PayrollPeriods SET status = 'CLOSED' WHERE periodID = ?";
    
    db.query(sql, [periodID], (err, result) => {
        if (err) {
            console.error("[Close Period DB Error]:", err); 
            return res.status(500).json({ error: "Database update failed: " + err.message });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Period not found" });
        }

        logActivity(adminID, 'CLOSE_PERIOD', `Finalized/Locked Payroll Period #${periodID}`, () => {
            res.json({ message: "Period Closed Successfully" });
        });
    });
};

const query = util.promisify(db.query).bind(db);
exports.exportPayroll = async (req, res) => {
    console.log(`[Export Start] Batch Export Request`);

    const adminID = (req.user && req.user.userID) ? req.user.userID : 1;

    // 1. Parse Inputs
    let periodIDs = [];
    let selectedColumns = [];

    try {
        // Parse Period IDs
        if (req.query.periodIDs) {
            periodIDs = Array.isArray(req.query.periodIDs) 
                ? req.query.periodIDs 
                : JSON.parse(req.query.periodIDs);
        }
        
        // Parse Columns
        if (req.query.columns) {
            selectedColumns = Array.isArray(req.query.columns) 
                ? req.query.columns 
                : JSON.parse(req.query.columns);
        } else {
            selectedColumns = ['date', 'shipmentID', 'rate']; 
        }
    } catch (e) {
        console.error("Parsing Error:", e);
        return res.status(400).json({ error: "Invalid parameters" });
    }

    if (periodIDs.length === 0) return res.status(400).json({ error: "No periods selected" });

    // 2. Create Workbook
    const workBook = XLSX.utils.book_new();

    try {
        // 3. LOOP through each Period ID
        for (const pID of periodIDs) {
            
            // A. Fetch Period Name
            const pRes = await query("SELECT * FROM PayrollPeriods WHERE periodID = ?", [pID]);
            if (pRes.length === 0) continue; // Skip invalid periods
            const periodName = pRes[0].periodName;
            
            // Clean sheet name (Excel limits: max 31 chars, no special symbols)
            const sheetName = periodName.replace(/[:\\/?*[\]]/g, "").substring(0, 30);

            // B. Fetch Employees active in this period
            const empSql = `
                SELECT DISTINCT u.userID, u.firstName, u.lastName, u.role
                FROM Users u
                WHERE EXISTS (SELECT 1 FROM ShipmentPayroll sp WHERE sp.crewID = u.userID AND sp.periodID = ?)
                   OR EXISTS (SELECT 1 FROM PayrollAdjustments pa WHERE pa.userID = u.userID AND pa.periodID = ?)
                ORDER BY u.lastName ASC
            `;
            const employees = await query(empSql, [pID, pID]);

            // C. Fetch Data
            const sqlShipments = `
                SELECT sp.crewID, s.shipmentID, s.deliveryDate, s.destName, s.destLocation, 
                       v.type as vehicleType, sp.baseFee, sp.allowance, sp.adjustmentAmount, sp.adjustmentReason
                FROM ShipmentPayroll sp
                JOIN Shipments s ON sp.shipmentID = s.shipmentID
                LEFT JOIN Vehicles v ON s.vehicleID = v.vehicleID
                WHERE sp.periodID = ?
                ORDER BY s.deliveryDate ASC
            `;
            const sqlAdjustments = "SELECT * FROM PayrollAdjustments WHERE periodID = ? AND status != 'VOID'";
            const sqlPayments = "SELECT * FROM PayrollPayments WHERE periodID = ? AND status != 'VOID'";

            // Parallel Fetch for this period
            const [allShipments, allAdjustments, allPayments] = await Promise.all([
                query(sqlShipments, [pID]),
                query(sqlAdjustments, [pID]),
                query(sqlPayments, [pID])
            ]);

            // D. Build Rows
            const masterRows = [];

            employees.forEach(emp => {
                const empShipments = allShipments.filter(s => s.crewID === emp.userID);
                const empAdjustments = allAdjustments.filter(a => a.userID === emp.userID);
                
                // HEADER
                masterRows.push(['============================================================']);
                masterRows.push([`EMPLOYEE: ${emp.lastName.toUpperCase()}, ${emp.firstName.toUpperCase()}`]);
                masterRows.push([`ID: ${emp.userID}`, `ROLE: ${emp.role}`, `PERIOD: ${periodName}`]);
                masterRows.push(['------------------------------------------------------------']);
                
                // COLUMN HEADERS
                const headerRow = selectedColumns.map(k => {
                    if(k === 'date') return 'DATE';
                    if(k === 'shipmentID') return 'SHIPMENT ID';
                    if(k === 'customer') return 'CUSTOMER';
                    if(k === 'route') return 'ROUTE';
                    if(k === 'vehicleType') return 'TYPE';
                    if(k === 'rate') return 'BASE FEE';
                    if(k === 'allowance') return 'ALLOWANCE';
                    if(k === 'adjustment') return 'ADJUSTMENT';
                    if(k === 'reason') return 'REASON';
                    return k.toUpperCase();
                });
                masterRows.push(headerRow);

                // DATA
                let totalRate = 0;
                let totalAllowance = 0;
                let totalShipmentAdj = 0;

                empShipments.forEach(s => {
                    const row = [];
                    const safeDate = s.deliveryDate ? new Date(s.deliveryDate).toLocaleDateString() : '-';
                    selectedColumns.forEach(k => {
                        if(k === 'date') row.push(safeDate);
                        if(k === 'shipmentID') row.push(s.shipmentID);
                        if(k === 'customer') row.push(s.destName || '-');
                        if(k === 'route') row.push(s.destLocation || '-');
                        if(k === 'vehicleType') row.push(s.vehicleType || '-');
                        if(k === 'rate') row.push(Number(s.baseFee) || 0);
                        if(k === 'allowance') row.push(Number(s.allowance) || 0);
                        if(k === 'adjustment') row.push(Number(s.adjustmentAmount) || 0);
                        if(k === 'reason') row.push(s.adjustmentReason || '-');
                    });
                    masterRows.push(row);
                    totalRate += (Number(s.baseFee) || 0);
                    totalAllowance += (Number(s.allowance) || 0);
                    totalShipmentAdj += (Number(s.adjustmentAmount) || 0);
                });

                // FOOTER for shipments
                const footerRow = [];
                selectedColumns.forEach(k => {
                    if(k === 'rate') footerRow.push(totalRate);
                    else if(k === 'allowance') footerRow.push(totalAllowance);
                    else if(k === 'adjustment') footerRow.push(totalShipmentAdj);
                    else footerRow.push('');
                });
                masterRows.push(footerRow);

                // SUMMARY
                const bonusTotal = empAdjustments.filter(a => a.type === 'BONUS').reduce((sum, a) => sum + Number(a.amount), 0);
                const deductTotal = empAdjustments.filter(a => a.type === 'DEDUCTION').reduce((sum, a) => sum + Number(a.amount), 0);
                const netPay = (totalRate + totalShipmentAdj + bonusTotal) - deductTotal;

                masterRows.push([]); 
                masterRows.push(['', '--- PAYROLL SUMMARY ---']);
                masterRows.push(['', 'Total Base Fees:', totalRate]);
                if (totalShipmentAdj !== 0) {
                    masterRows.push(['', 'Shipment Adjustments:', totalShipmentAdj]);
                }
                masterRows.push(['', 'Total Bonuses:', bonusTotal]);
                masterRows.push(['', 'Less: Deductions/Advances:', `(${deductTotal})`]);
                masterRows.push(['', '-----------------------', '----------']);
                masterRows.push(['', 'NET PAYABLE:', netPay]);
                masterRows.push(['', '=======================', '==========']);
                
                if (totalAllowance > 0) {
                    masterRows.push(['', 'Total Allowance (Food/Gas):', totalAllowance]);
                }

                // ADJUSTMENTS DETAIL
                if (empAdjustments.length > 0) {
                    masterRows.push([]); 
                    masterRows.push(['DETAILS: ADJUSTMENTS / DEDUCTIONS']);
                    masterRows.push(['Type', 'Reason', 'Amount']);
                    empAdjustments.forEach(a => {
                        masterRows.push([a.type, a.reason, Number(a.amount)]);
                    });
                }
                
                masterRows.push([]); 
                masterRows.push([]); 
            });

            // E. Add Sheet to Workbook
            const workSheet = XLSX.utils.aoa_to_sheet(masterRows);
            workSheet['!cols'] = [{wch:15}, {wch:25}, {wch:25}, {wch:20}, {wch:15}, {wch:15}, {wch:15}];
            
            // Append sheet with specific period name
            XLSX.utils.book_append_sheet(workBook, workSheet, sheetName);
        }

        // 4. Send File
        const excelBuffer = XLSX.write(workBook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Disposition', `attachment; filename=Payroll_Batch_Report.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        logActivity(adminID, 'EXPORT_BATCH', `Exported Batch Payroll for ${periodIDs.length} periods`, () => {
            res.send(excelBuffer);
        });

    } catch (error) {
        console.error("Batch Export Error:", error);
        if (!res.headersSent) res.status(500).json({ error: "Batch Export Failed" });
    }
};

exports.generateFuturePeriods = (req, res) => {
    const adminID = (req.user && req.user.userID) ? req.user.userID : 1;

    // 1. Find the latest period currently in the DB
    db.query("SELECT MAX(endDate) as lastDate FROM PayrollPeriods", (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        let startDate = new Date();
        
        // If DB has periods, start the day after the last one. 
        // If DB is empty, start from Jan 1st of current year.
        if (result[0].lastDate) {
            startDate = new Date(result[0].lastDate);
            startDate.setDate(startDate.getDate() + 1); // Start next day
        } else {
            startDate = new Date(new Date().getFullYear(), 0, 1); // Jan 1 this year
        }

        const newPeriods = [];
        const monthNames = ["January", "February", "March", "April", "May", "June", 
                            "July", "August", "September", "October", "November", "December"];

        // 2. Generate 12 months worth of periods (24 periods)
        // We loop through the next 12 months starting from our calculated startDate
        let currentYear = startDate.getFullYear();
        let currentMonth = startDate.getMonth();

        for (let i = 0; i < 12; i++) {
            // --- Period 1: 1st to 15th ---
            // Only add if our start date is before or on the 1st
            const firstPeriodStart = new Date(currentYear, currentMonth, 1);
            const firstPeriodEnd = new Date(currentYear, currentMonth, 15);
            
            if (firstPeriodStart >= startDate) {
                newPeriods.push([
                    `${monthNames[currentMonth]} 1-15, ${currentYear}`, // Name
                    formatDateLocal(firstPeriodStart),                  // Start
                    formatDateLocal(firstPeriodEnd),                    // End
                    'OPEN'                                              // Status
                ]);
            }

            // --- Period 2: 16th to End of Month ---
            // "0" as day gets the last day of previous month, so we use currentMonth + 1, 0
            const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const secondPeriodStart = new Date(currentYear, currentMonth, 16);
            const secondPeriodEnd = new Date(currentYear, currentMonth, lastDayOfMonth);

            if (secondPeriodStart >= startDate) {
                newPeriods.push([
                    `${monthNames[currentMonth]} 16-${lastDayOfMonth}, ${currentYear}`,
                    formatDateLocal(secondPeriodStart),
                    formatDateLocal(secondPeriodEnd),
                    'OPEN'
                ]);
            }

            // Move to next month
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
        }

        if (newPeriods.length === 0) {
            return res.json({ message: "Periods are already up to date." });
        }

        // 3. Bulk Insert
        const sql = "INSERT INTO PayrollPeriods (periodName, startDate, endDate, status) VALUES ?";
        db.query(sql, [newPeriods], (err, insertRes) => {
            if (err) return res.status(500).json({ error: err.message });

            logActivity(adminID, 'GENERATE_PERIODS', `Generated ${insertRes.affectedRows} new payroll periods`, () => {
                res.json({ message: `Successfully generated ${insertRes.affectedRows} new periods.` });
            });
        });
    });
};
