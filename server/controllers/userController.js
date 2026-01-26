const db = require('../config/db');
const bcrypt = require('bcryptjs');

// GET ALL USERS
exports.getAllUsers = (req, res) => {
    const sql = `
        SELECT u.userID, ul.employeeID, u.firstName, u.lastName, 
               u.email, u.phone, u.role, u.dob, u.dateCreated 
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
    let hashedPassword;
    try { hashedPassword = await bcrypt.hash(password, 10); } 
    catch (err) { return res.status(500).json({ error: "Encryption error" }); }

    const finalDob = (dob === '' || dob === undefined) ? null : dob;

    db.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: "DB Connection failed" });

        connection.beginTransaction(err => {
            if (err) { connection.release(); return res.status(500).json({ error: "Transaction failed" }); }

            const userSql = "INSERT INTO Users (firstName, lastName, email, phone, role, dob) VALUES (?, ?, ?, ?, ?, ?)";
            connection.query(userSql, [firstName, lastName, email, phone, role, finalDob], (err, result) => {
                if (err) {
                    return connection.rollback(() => { connection.release(); res.status(500).json({ error: err.message }); });
                }
                const newUserID = result.insertId;
                const finalEmployeeID = employeeID || `EMP${Date.now().toString().slice(-6)}`;
                
                const loginSql = "INSERT INTO UserLogins (userID, employeeID, hashedPassword) VALUES (?, ?, ?)";
                connection.query(loginSql, [newUserID, finalEmployeeID, hashedPassword], (err) => {
                    if (err) {
                        return connection.rollback(() => { connection.release(); res.status(500).json({ error: err.message }); });
                    }
                    connection.commit(err => {
                        if (err) { return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Commit failed" }); }); }
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
    db.query(sql, [firstName, lastName, email, phone, role, dob, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "User updated successfully" });
    });
};

// DELETE USER (FIXED FOR YOUR SCHEMA)
exports.deleteUser = (req, res) => {
    const { id } = req.params;

    // 1. CHECK FOR ACTIVE SHIPMENTS
    // We must join Shipments and ShipmentCrew because 'driverID' doesn't exist in Shipments
    const checkSql = `
        SELECT s.shipmentID 
        FROM Shipments s
        JOIN ShipmentCrew sc ON s.shipmentID = sc.shipmentID
        WHERE sc.userID = ? 
        AND s.currentStatus NOT IN ('Completed', 'Cancelled')
    `;

    db.query(checkSql, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        // If active shipments exist, BLOCK delete and return 409
        if (results.length > 0) {
            return res.status(409).json({ 
                error: "Dependency Conflict", 
                activeShipments: results.map(r => r.shipmentID) 
            });
        }

        // 2. CLEAN UP & DELETE
        // We use a Transaction to ensure all or nothing deletes
        db.getConnection((err, connection) => {
            if (err) return res.status(500).json({ error: "DB Connection failed" });

            connection.beginTransaction(err => {
                if (err) { connection.release(); return res.status(500).json({ error: "Transaction failed" }); }

                // A. Remove from History (ShipmentCrew) so we don't get Foreign Key errors
                // (Only deleting completed/cancelled history, since active was checked above)
                connection.query("DELETE FROM ShipmentCrew WHERE userID = ?", [id], (err) => {
                    if (err) {
                        return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Failed to clear crew history" }); });
                    }

                    // B. Remove Login Credentials
                    connection.query("DELETE FROM UserLogins WHERE userID = ?", [id], (err) => {
                        if (err) {
                            return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Failed to delete login" }); });
                        }

                        // C. Finally, Delete the User
                        connection.query("DELETE FROM Users WHERE userID = ?", [id], (err) => {
                            if (err) {
                                // If this fails, it might be referenced in other tables like 'Shipments' (as operationsUserID) or logs
                                return connection.rollback(() => { 
                                    connection.release(); 
                                    // Check for FK error
                                    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                                        res.status(409).json({ error: "Cannot delete: User has created shipments or logs." });
                                    } else {
                                        res.status(500).json({ error: err.message }); 
                                    }
                                });
                            }

                            connection.commit(err => {
                                if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Commit failed" }); });
                                connection.release();
                                res.json({ message: "User deleted successfully" });
                            });
                        });
                    });
                });
            });
        });
    });
};