const db = require('../config/db');

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

    db.query("SELECT * FROM PayrollPeriods WHERE periodID = ?", [periodID], (err, periods) => {
        if (err || periods.length === 0) return res.status(500).json({ error: "Invalid Period" });

        const start = formatDateLocal(periods[0].startDate);
        const end = formatDateLocal(periods[0].endDate);

        db.query("SELECT * FROM PayrollRates", (err, rates) => {
            if (err) return res.status(500).json({ error: "Failed to fetch rates" });

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

                // Function to finish up (Process Debts -> Send Response)
                const finishGeneration = (rowsCreated = 0) => {
                    processCarryOverDebts(periodID, db)
                        .then(() => {
                            res.json({ 
                                message: "Payroll Generated & Balances Updated", 
                                rowsCreated: rowsCreated 
                            });
                        })
                        .catch(err => {
                            console.error("Carry-Over Error:", err);
                            res.status(500).json({ error: "Payroll generated but failed to carry over debts." });
                        });
                };

                if (shipments.length === 0) {
                    return finishGeneration(0); // Run debt check even if no shipments
                }

                const valuesToInsert = shipments.map(ship => {
                    const matchedRate = rates.find(r => 
                        ship.destLocation.toLowerCase().includes(r.routeCluster.toLowerCase()) && 
                        ship.vehicleType === r.vehicleType
                    );

                    let baseFee = ship.role === 'Driver' ? 600 : 400;
                    let totalAllowance = 350;

                    if (matchedRate) {
                        baseFee = ship.role === 'Driver' ? matchedRate.driverBaseFee : matchedRate.helperBaseFee;
                        totalAllowance = matchedRate.foodAllowance;
                    }

                    const allowancePerPerson = totalAllowance / (ship.crewCount || 1);

                    return [ship.shipmentID, ship.crewID, periodID, baseFee, allowancePerPerson, 'PENDING'];
                });

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