const db = require('../config/db');

const run = async () => {
  const query = (sql, params) => new Promise((resolve, reject) => {
    db.query(sql, params, (err, res) => err ? reject(err) : resolve(res));
  });
  try {
    const cols = await query("SHOW COLUMNS FROM ShipmentPayroll LIKE 'payoutDate'");
    if (cols.length > 0) {
      await query("ALTER TABLE ShipmentPayroll DROP COLUMN payoutDate");
      console.log("Dropped column payoutDate from ShipmentPayroll");
    } else {
      console.log("Column payoutDate does not exist on ShipmentPayroll");
    }
  } catch (e) {
    console.error("Migration error:", e.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

run();
