const db = require('../config/db');
const bcrypt = require('bcryptjs');

// GET USERS (Supports ?archived=true)
exports.getAllUsers = (req, res) => {
    const showArchived = req.query.archived === 'true';
    const archiveValue = showArchived ? 1 : 0;

    const sql = `
        SELECT u.userID, ul.employeeID, u.firstName, u.lastName, 
               u.email, u.phone, u.role, u.dob, u.dateCreated 
        FROM Users u
        LEFT JOIN UserLogins ul ON u.userID = ul.userID
        WHERE u.isArchived = ? 
        ORDER BY u.dateCreated DESC
    `;
    
    db.query(sql, [archiveValue], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// RESTORE USER (Unarchive)
exports.restoreUser = (req, res) => {
    const { id } = req.params;

    db.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: "DB Connection failed" });

        connection.beginTransaction(err => {
            if (err) { connection.release(); return res.status(500).json({ error: "Transaction failed" }); }

            // 1. Set isArchived = 0
            const restoreUserSql = "UPDATE Users SET isArchived = 0 WHERE userID = ?";
            connection.query(restoreUserSql, [id], (err) => {
                if (err) {
                    return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Failed to restore user" }); });
                }

                // 2. Re-enable Login (isActive = 1)
                const enableLoginSql = "UPDATE UserLogins SET isActive = 1 WHERE userID = ?";
                connection.query(enableLoginSql, [id], (err) => {
                    if (err) {
                        return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Failed to enable login" }); });
                    }

                    connection.commit(err => {
                        if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Commit failed" }); });
                        connection.release();
                        res.json({ message: "User restored successfully" });
                    });
                });
            });
        });
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

// ARCHIVE (SOFT DELETE) USER
exports.deleteUser = (req, res) => {
    const { id } = req.params;

    // 1. CHECK FOR ACTIVE SHIPMENTS (Strict Block)
    // We strictly block archiving if they are currently working on a job.
    const checkSql = `
        SELECT s.shipmentID 
        FROM Shipments s
        JOIN ShipmentCrew sc ON s.shipmentID = sc.shipmentID
        WHERE sc.userID = ? 
        AND s.currentStatus NOT IN ('Completed', 'Cancelled')
    `;

    db.query(checkSql, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        // If they are on an active job, BLOCK THEM.
        if (results.length > 0) {
            return res.status(409).json({ 
                error: "Dependency Conflict", 
                activeShipments: results.map(r => r.shipmentID) 
            });
        }

        // 2. SOFT DELETE (ARCHIVE)
        // If they are free (no active jobs), we hide them.
        db.getConnection((err, connection) => {
            if (err) return res.status(500).json({ error: "DB Connection failed" });

            connection.beginTransaction(err => {
                if (err) { connection.release(); return res.status(500).json({ error: "Transaction failed" }); }

                // A. Mark User as Archived
                const archiveUserSql = "UPDATE Users SET isArchived = 1 WHERE userID = ?";
                connection.query(archiveUserSql, [id], (err) => {
                    if (err) {
                        return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Failed to archive user" }); });
                    }

                    // B. Disable Login Access (So they can't log in anymore)
                    const disableLoginSql = "UPDATE UserLogins SET isActive = 0 WHERE userID = ?";
                    connection.query(disableLoginSql, [id], (err) => {
                        if (err) {
                            return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Failed to disable login" }); });
                        }

                        connection.commit(err => {
                            if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Commit failed" }); });
                            connection.release();
                            res.json({ message: "User archived successfully" });
                        });
                    });
                });
            });
        });
    });
};