const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,     
    user: process.env.DB_USER,       
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the connection when the app starts
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed: ', err.code); 
        console.error(err.message);
    } else {
        console.log('Connected to MySQL database via Pool.');
        connection.release(); 
    }
});

module.exports = pool;