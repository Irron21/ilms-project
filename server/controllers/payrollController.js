const db = require('../config/db');

// 1. Get List of Pay Periods (for the Dropdown)
exports.getPeriods = (req, res) => {
    const sql = "SELECT * FROM PayrollPeriods ORDER BY startDate DESC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// Function to carry over debts from the previous period
// Function to carry over debts from the previous period
const processCarryOverDebts = async (currentPeriodID, dbConnection) => {
    // 1. Get previous period ID
    const previousPeriodID = currentPeriodID - 1; 
    if (previousPeriodID <= 0) return; 

    // ✅ FIX START: Delete existing carry-overs for this period first!
    // This prevents "Stacking" deductions if you click Generate multiple times.
    const cleanUpSql = `
        DELETE FROM PayrollAdjustments 
        WHERE periodID = ? 
        AND reason = 'Cash Advance / Overage from Previous Period'
    `;
    
    // We wrap the rest in a callback to ensure cleanup happens first
    dbConnection.query(cleanUpSql, [currentPeriodID], (err) => {
        if (err) return console.error("Error cleaning up old debts:", err);

        // 2. NOW calculate the debts from the previous period
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
            if (err) return console.error("Error checking debts:", err);

            results.forEach(row => {
                const debt = row.totalPaid - row.netSalary;
                
                if (debt > 0) {
                    console.log(`Carrying over debt of ${debt} for User ${row.userID}`);
                    
                    // 3. Insert fresh Deduction
                    const insertSql = `
                        INSERT INTO PayrollAdjustments (userID, periodID, type, amount, reason)
                        VALUES (?, ?, 'DEDUCTION', ?, 'Cash Advance / Overage from Previous Period')
                    `;
                    dbConnection.query(insertSql, [row.userID, currentPeriodID, debt]);
                }
            });
        });
    });
};

// 2. GENERATE: Assign Floating Shipments to a Period
exports.generatePayroll = (req, res) => {
    const { periodID } = req.body;

    // A. First, get the dates for this period
    const dateSql = "SELECT * FROM PayrollPeriods WHERE periodID = ?";
    db.query(dateSql, [periodID], (err, periods) => {
        if (err || periods.length === 0) return res.status(500).json({ error: "Invalid Period" });

        const period = periods[0];

        // B. "Harvest" the records
        // Find all ShipmentPayroll rows that exist within these dates but represent UNPAID/UNASSIGNED work
        // We join Shipments to check the 'creationTimestamp'
        const updateSql = `
            UPDATE ShipmentPayroll sp
            JOIN Shipments s ON sp.shipmentID = s.shipmentID
            SET sp.periodID = ?
            WHERE s.creationTimestamp BETWEEN ? AND ?
            AND sp.periodID IS NULL
        `;
        
        // Use full day range (00:00:00 to 23:59:59)
        const start = `${new Date(period.startDate).toISOString().split('T')[0]} 00:00:00`;
        const end   = `${new Date(period.endDate).toISOString().split('T')[0]} 23:59:59`;

        db.query(updateSql, [periodID, start, end], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            processCarryOverDebts(periodID, db); 

            res.json({ 
                message: "Payroll Generated Successfully", 
                rowsProcessed: result.changedRows 
            });
        });
    });
};

// 3. VIEW: Get the "Suggestion" (Summary by Employee)
exports.getPayrollSummary = (req, res) => {
    const { periodID } = req.params;

    const sql = `
        SELECT 
            u.userID, 
            u.firstName, 
            u.lastName, 
            u.role,
            
            -- 1. TRIP DATA
            COUNT(sp.payrollID) as tripCount,
            COALESCE(SUM(sp.baseFee), 0) as totalBasePay,
            COALESCE(SUM(sp.allowance), 0) as totalAllowance,
            
            COALESCE((SELECT SUM(amount) FROM PayrollAdjustments pa 
                WHERE pa.userID = u.userID 
                AND pa.periodID = ? 
                AND pa.type = 'BONUS'
                AND pa.status != 'VOID'), 0) as totalBonus,  

            COALESCE((SELECT SUM(amount) FROM PayrollAdjustments pa 
                WHERE pa.userID = u.userID 
                AND pa.periodID = ? 
                AND pa.type = 'DEDUCTION'
                AND pa.status != 'VOID'), 0) as totalDeductions, 

            -- 4. PAYMENTS (New!)
            COALESCE((SELECT SUM(amount) FROM PayrollPayments pp 
                WHERE pp.userID = u.userID AND pp.periodID = ? AND pp.status = 'COMPLETED'), 0) as totalPaid

        FROM Users u
        LEFT JOIN ShipmentPayroll sp ON u.userID = sp.crewID AND sp.periodID = ?
        
        -- Filter: Show users with EITHER trips OR adjustments
        WHERE sp.payrollID IS NOT NULL 
           OR EXISTS (SELECT 1 FROM PayrollAdjustments pa WHERE pa.userID = u.userID AND pa.periodID = ?)
           
        GROUP BY u.userID
        ORDER BY u.lastName ASC
    `;

    // ✅ FIX: Ensure periodID is passed 5 times to match the 5 '?' above
    db.query(sql, [periodID, periodID, periodID, periodID, periodID], (err, results) => {
        if (err) {
            console.error("SQL Error:", err); // Log error to terminal
            return res.status(500).json({ error: err.message });
        }
        
        const finalResults = results.map(row => ({
            ...row,
            netSalary: (Number(row.totalBasePay) + Number(row.totalBonus)) - Number(row.totalDeductions)
        }));
        
        res.json(finalResults);
    });
};

// GET: Fetch all trips (shipments) for a specific employee in a period
exports.getEmployeeTrips = (req, res) => {
    const { periodID, userID } = req.params;

    const sql = `
        SELECT 
            s.shipmentID,
            s.creationTimestamp as shipmentDate,  -- ✅ Fix: Map real column to expected name
            s.destLocation as routeCluster,           -- ✅ Fix: Use destName since routeCluster column is missing
            v.type as vehicleType,                -- ✅ Fix: Get type from joined Vehicles table
            sp.baseFee,
            sp.allowance
        FROM ShipmentPayroll sp
        JOIN Shipments s ON sp.shipmentID = s.shipmentID
        LEFT JOIN Vehicles v ON s.vehicleID = v.vehicleID  -- ✅ Fix: Join Vehicles table
        WHERE sp.periodID = ? AND sp.crewID = ?
        ORDER BY s.creationTimestamp DESC
    `;

    db.query(sql, [periodID, userID], (err, results) => {
        if (err) {
            console.error("SQL Error in getEmployeeTrips:", err.message); 
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
};