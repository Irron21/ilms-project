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

            const start = formatDateLocal(periods[0].startDate);
            const end = formatDateLocal(periods[0].endDate);

            // 3. Fetch Rates
            db.query("SELECT * FROM PayrollRates", (err, rates) => {
                if (err) return res.status(500).json({ error: "Failed to fetch rates" });

                // 4. Find Completed Shipments (That haven't been paid yet)
                const shipmentSql = `
                    SELECT 
                        s.shipmentID, s.destLocation, s.deliveryDate,
                        v.type as vehicleType,
                        sc.userID as crewID, u.role,
                        (SELECT COUNT(*) FROM ShipmentCrew WHERE shipmentID = s.shipmentID) as crewCount
                    FROM Shipments s
                    JOIN ShipmentCrew sc ON s.shipmentID = sc.shipmentID
                    JOIN Users u ON sc.userID = u.userID
                    JOIN Vehicles v ON s.vehicleID = v.vehicleID
                    LEFT JOIN ShipmentPayroll sp ON s.shipmentID = sp.shipmentID AND sc.userID = sp.crewID
                    WHERE s.currentStatus = 'Completed'
                      AND s.deliveryDate BETWEEN ? AND ?
                      AND sp.payrollID IS NULL
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

                        return [ship.shipmentID, ship.crewID, periodID, baseFee, allowancePerPerson, 'PENDING'];
                    });

                    // 6. Bulk Insert
                    const insertSql = `
                        INSERT INTO ShipmentPayroll (shipmentID, crewID, periodID, baseFee, allowance, status) 
                        VALUES ?
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
            COUNT(sp.payrollID) as tripCount,
            COALESCE(SUM(sp.baseFee), 0) as totalBasePay,
            COALESCE(SUM(sp.allowance), 0) as totalAllowance,
            
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

    db.query(sql, [periodID, periodID, periodID, periodID, periodID], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        const finalResults = results.map(row => ({
            ...row,
            netSalary: (Number(row.totalBasePay) + Number(row.totalBonus)) - Number(row.totalDeductions)
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
            sp.allowance
        FROM ShipmentPayroll sp
        JOIN Shipments s ON sp.shipmentID = s.shipmentID
        LEFT JOIN Vehicles v ON s.vehicleID = v.vehicleID 
        WHERE sp.periodID = ? 
          AND sp.crewID = ?
          AND s.currentStatus = 'Completed'
          AND s.loadingDate IS NOT NULL
        ORDER BY s.deliveryDate DESC
    `;

    db.query(sql, [periodID, userID], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
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
                       v.type as vehicleType, sp.baseFee, sp.allowance
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
                    return k.toUpperCase();
                });
                masterRows.push(headerRow);

                // DATA
                let totalRate = 0;
                let totalAllowance = 0;

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
                    });
                    masterRows.push(row);
                    totalRate += (Number(s.baseFee) || 0);
                    totalAllowance += (Number(s.allowance) || 0);
                });

                // SUMMARY
                const bonusTotal = empAdjustments.filter(a => a.type === 'BONUS').reduce((sum, a) => sum + Number(a.amount), 0);
                const deductTotal = empAdjustments.filter(a => a.type === 'DEDUCTION').reduce((sum, a) => sum + Number(a.amount), 0);
                const netPay = (totalRate + bonusTotal) - deductTotal;

                masterRows.push([]); 
                masterRows.push(['', '--- PAYROLL SUMMARY ---']);
                masterRows.push(['', 'Total Base Fees:', totalRate]);
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