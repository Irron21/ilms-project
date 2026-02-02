const db = require('../config/db');

const runDebug = async () => {
    console.log("--- DEBUG START ---");

    const query = (sql, params) => {
        return new Promise((resolve, reject) => {
            db.query(sql, params, (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    };

    try {
        // 1. Get Recent Shipments with precise dates
        console.log("\n1. LAST 5 SHIPMENTS:");
        const shipments = await query(`
            SELECT shipmentID, currentStatus, loadingDate, deliveryDate, isArchived
            FROM Shipments 
            ORDER BY shipmentID DESC 
        `);
        console.table(shipments);

        if (shipments.length > 0) {
            const ids = shipments.map(s => s.shipmentID);
            
            // 2. Get Related ShipmentPayroll Entries
            console.log(`\n2. PAYROLL ENTRIES FOR IDs [${ids.join(', ')}]:`);
            const payrolls = await query(`
                SELECT payrollID, shipmentID, crewID, baseFee, allowance, periodID
                FROM ShipmentPayroll 
                WHERE shipmentID IN (?)
                ORDER BY shipmentID, crewID
            `, [ids]);
            console.table(payrolls);
        }

        // 3. Get ALL Payroll Periods
        console.log("\n3. ALL PAYROLL PERIODS:");
        const periods = await query(`
            SELECT periodID, startDate, endDate, status 
            FROM PayrollPeriods 
            ORDER BY startDate DESC
        `);
        console.table(periods);

    } catch (err) {
        console.error("DEBUG ERROR:", err);
    } finally {
        console.log("\n--- DEBUG END ---");
        process.exit();
    }
};

runDebug();
