const db = require('../config/db');

// 1. Get List of Pay Periods (for the Dropdown)
exports.getPeriods = (req, res) => {
    const sql = "SELECT * FROM PayrollPeriods ORDER BY startDate DESC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
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
            COUNT(sp.payrollID) as tripCount,
            SUM(sp.baseFee) as totalBasePay,
            SUM(sp.allowance) as totalAllowance,
            SUM(sp.deductions) as totalDeductions,
            SUM(sp.additionalPay) as totalBonus,
            -- Calculate Net Pay (Base + Bonus - Deductions) *Allowance is usually separate cash*
            SUM(sp.baseFee + sp.additionalPay - sp.deductions) as netSalary
        FROM ShipmentPayroll sp
        JOIN Users u ON sp.crewID = u.userID
        WHERE sp.periodID = ?
        GROUP BY u.userID
        ORDER BY u.lastName ASC
    `;

    db.query(sql, [periodID], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};