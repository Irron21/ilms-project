const db = require('../config/db');

const run = async () => {
  const query = (sql, params) => new Promise((resolve, reject) => {
    db.query(sql, params, (err, res) => err ? reject(err) : resolve(res));
  });
  try {
    const cols = await query("SHOW COLUMNS FROM ShipmentPayroll LIKE 'status'");
    if (cols.length > 0) {
      await query("ALTER TABLE ShipmentPayroll DROP COLUMN status");
      console.log("Dropped column status from ShipmentPayroll");
    } else {
      console.log("Column status does not exist on ShipmentPayroll");
    }
  } catch (e) {
    console.error("Migration error:", e.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

run();
