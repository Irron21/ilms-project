const db = require('../config/db');

const fixPeriods = async () => {
    console.log("--- STARTING PERIOD FIX ---");

    const query = (sql, params) => {
        return new Promise((resolve, reject) => {
            db.query(sql, params, (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    };

    try {
        // 1. Get Payroll Entries with NULL Period
        const pending = await query(`
            SELECT sp.payrollID, s.shipmentID, s.deliveryDate 
            FROM ShipmentPayroll sp
            JOIN Shipments s ON sp.shipmentID = s.shipmentID
            WHERE sp.periodID IS NULL
        `);

        console.log(`Found ${pending.length} entries with missing Period ID.`);

        if (pending.length === 0) {
            console.log("Nothing to fix.");
            process.exit();
        }

        // 2. Get All Periods
        const periods = await query("SELECT * FROM PayrollPeriods");

        // 3. Match and Update
        for (const entry of pending) {
            const shipDate = new Date(entry.deliveryDate);
            
            // Find Period
            const match = periods.find(p => {
                const start = new Date(p.startDate);
                const end = new Date(p.endDate);
                // Adjust end date to include the full day (same logic as controller fix)
                end.setDate(end.getDate() + 1);
                
                return shipDate >= start && shipDate < end;
            });

            if (match) {
                console.log(`Shipment ${entry.shipmentID} (${shipDate.toISOString()}) -> Period ${match.periodID} (${match.startDate.toISOString()} - ${match.endDate.toISOString()})`);
                
                await query("UPDATE ShipmentPayroll SET periodID = ? WHERE payrollID = ?", [match.periodID, entry.payrollID]);
            } else {
                console.log(`WARNING: No period found for Shipment ${entry.shipmentID} (${shipDate.toISOString()})`);
            }
        }

        console.log("--- FIX COMPLETE ---");

    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        process.exit();
    }
};

fixPeriods();
