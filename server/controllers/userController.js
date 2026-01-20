const db = require('../config/db');
const bcrypt = require('bcryptjs');

// GET ALL USERS
exports.getAllUsers = (req, res) => {
    const sql = `
        SELECT 
            u.userID, 
            ul.employeeID, 
            u.firstName, 
            u.lastName, 
            u.email, 
            u.phone, 
            u.role, 
            u.dob,
            u.dateCreated 
        FROM Users u
        LEFT JOIN UserLogins ul ON u.userID = ul.userID
        ORDER BY u.dateCreated DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// CREATE USER
exports.createUser = async (req, res) => {
    const { firstName, lastName, email, phone, role, dob, password, employeeID } = req.body;

    // 1. Hash Password
    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(password, 10);
    } catch (err) {
        return res.status(500).json({ error: "Encryption error" });
    }

    // 2. Handle Empty Date
    const finalDob = (dob === '' || dob === undefined) ? null : dob;

    // 3. GET A CONNECTION FROM THE POOL (Required for Transactions)
    db.getConnection((err, connection) => {
        if (err) {
            console.error("Connection Error:", err);
            return res.status(500).json({ error: "Database connection failed" });
        }

        // 4. Start Transaction on that specific connection
        connection.beginTransaction(err => {
            if (err) {
                connection.release(); 
                return res.status(500).json({ error: "Transaction start failed" });
            }

            const userSql = "INSERT INTO Users (firstName, lastName, email, phone, role, dob) VALUES (?, ?, ?, ?, ?, ?)";
            const userValues = [firstName, lastName, email, phone, role, finalDob];

            // 5. Query 1: Insert User
            connection.query(userSql, userValues, (err, result) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error("SQL Error (Users):", err.message);
                        res.status(500).json({ error: "Failed to create user: " + err.message });
                    });
                }

                const newUserID = result.insertId;
                const finalEmployeeID = employeeID || `EMP${Date.now().toString().slice(-6)}`;
                const loginSql = "INSERT INTO UserLogins (userID, employeeID, hashedPassword) VALUES (?, ?, ?)";

                // 6. Query 2: Insert Login
                connection.query(loginSql, [newUserID, finalEmployeeID, hashedPassword], (err, result) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release(); 
                            console.error("SQL Error (UserLogins):", err.message);
                            res.status(500).json({ error: "Failed to create login credentials" });
                        });
                    }

                    // 7. Commit the Transaction
                    connection.commit(err => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                res.status(500).json({ error: "Commit failed" });
                            });
                        }
                        
                        console.log("User Created Successfully:", firstName);
                        connection.release();
                        res.json({ message: "User created successfully" });
                    });
                });
            });
        });
    });
};

// UPDATE USER
exports.updateUser = (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, email, phone, role, dob } = req.body;

    const sql = "UPDATE Users SET firstName=?, lastName=?, email=?, phone=?, role=?, dob=? WHERE userID=?";
    
    db.query(sql, [firstName, lastName, email, phone, role, dob, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "User updated successfully" });
    });
};

// DELETE USER
exports.deleteUser = (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM Users WHERE userID = ?";
    
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "User deleted successfully" });
    });
};