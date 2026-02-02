const db = require('../config/db');

const debugMatch = async () => {
    console.log("--- DEBUG PERIOD MATCH ---");

    const query = (sql, params) => {
        return new Promise((resolve, reject) => {
            db.query(sql, params, (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    };

    try {
        // 1. Get Latest Shipment
        const shipments = await query("SELECT shipmentID, deliveryDate FROM Shipments ORDER BY shipmentID DESC LIMIT 1");
        if (shipments.length === 0) {
            console.log("No shipments found.");
            process.exit();
        }
        const s = shipments[0];
        console.log("Latest Shipment:", s);
        console.log("Delivery Date Object:", s.deliveryDate);
        console.log("Delivery Date ISO:", s.deliveryDate.toISOString());

        // 2. Run the Exact Query
        const sql = `
            SELECT periodID, startDate, endDate 
            FROM PayrollPeriods 
            WHERE startDate <= ? 
            AND DATE_ADD(endDate, INTERVAL 1 DAY) > ?
            ORDER BY startDate DESC 
            LIMIT 1
        `;
        
        const periodMatch = await query(sql, [s.deliveryDate, s.deliveryDate]);
        console.log("Query Result:", periodMatch);

        // 3. Debug Dates of all periods to see why it might fail
        const periods = await query("SELECT periodID, startDate, endDate FROM PayrollPeriods ORDER BY startDate DESC LIMIT 5");
        console.log("\nTop 5 Periods:");
        periods.forEach(p => {
            console.log(`ID: ${p.periodID}`);
            console.log(`  Start: ${p.startDate.toISOString()} (<= ${s.deliveryDate.toISOString()}?) -> ${p.startDate <= s.deliveryDate}`);
            
            // Replicate DATE_ADD logic in JS roughly
            const endPlusOne = new Date(p.endDate);
            endPlusOne.setDate(endPlusOne.getDate() + 1);
            console.log(`  End+1: ${endPlusOne.toISOString()} (> ${s.deliveryDate.toISOString()}?) -> ${endPlusOne > s.deliveryDate}`);
        });

    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        process.exit();
    }
};

debugMatch();
