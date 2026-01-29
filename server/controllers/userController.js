const db = require('../config/db');
const bcrypt = require('bcryptjs');

// --- HELPER: Log Activity ---
const logActivity = (connection, userID, action, details, callback) => {
    const finalUserID = userID || 1; 
    const sql = "INSERT INTO UserActivityLog (userID, actionType, details) VALUES (?, ?, ?)";
    connection.query(sql, [finalUserID, action, details], callback);
};

// GET USERS
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

// RESTORE USER
exports.restoreUser = (req, res) => {
    const { id } = req.params;
    const adminID = req.user ? req.user.userID : 1;

    db.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: "DB Connection failed" });

        connection.beginTransaction(err => {
            if (err) { connection.release(); return res.status(500).json({ error: "Transaction failed" }); }

            const restoreUserSql = "UPDATE Users SET isArchived = 0 WHERE userID = ?";
            connection.query(restoreUserSql, [id], (err) => {
                if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Failed to restore user" }); });

                const enableLoginSql = "UPDATE UserLogins SET isActive = 1 WHERE userID = ?";
                connection.query(enableLoginSql, [id], (err) => {
                    if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Failed to enable login" }); });

                    logActivity(connection, adminID, 'RESTORE_USER', `Restored User - [ID: ${id}]`, () => {
                        connection.commit(err => {
                            if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Commit failed" }); });
                            connection.release();
                            res.json({ message: "User restored successfully" });
                        });
                    });
                });
            });
        });
    });
};

// CREATE USER
exports.createUser = async (req, res) => {
    const { firstName, lastName, email, phone, role, dob, password, employeeID } = req.body;
    const adminID = req.user ? req.user.userID : 1; 

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
                if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err.message }); });
                
                const newUserID = result.insertId;
                const finalEmployeeID = employeeID || `EMP${Date.now().toString().slice(-6)}`;
                
                const loginSql = "INSERT INTO UserLogins (userID, employeeID, hashedPassword) VALUES (?, ?, ?)";
                connection.query(loginSql, [newUserID, finalEmployeeID, hashedPassword], (err) => {
                    if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err.message }); });

                    const logDetails = `Created User - ${firstName} ${lastName} (${role}) [ID: ${newUserID}]`;
                    logActivity(connection, adminID, 'CREATE_USER', logDetails, () => {
                        connection.commit(err => {
                            if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Commit failed" }); });
                            connection.release();
                            res.json({ message: "User created successfully" });
                        });
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
    const adminID = req.user ? req.user.userID : 1;

    const sql = "UPDATE Users SET firstName=?, lastName=?, email=?, phone=?, role=?, dob=? WHERE userID=?";
    db.query(sql, [firstName, lastName, email, phone, role, dob, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        const logDetails = `Updated User - ${firstName} ${lastName} [ID: ${id}]`;
        logActivity(db, adminID, 'UPDATE_USER', logDetails, () => {
             res.json({ message: "User updated successfully" });
        });
    });
};

// ARCHIVE USER
exports.deleteUser = (req, res) => {
    const { id } = req.params;
    const adminID = req.user ? req.user.userID : 1;

    // 1. CHECK FOR ACTIVE SHIPMENTS
    const checkSql = `
        SELECT s.shipmentID 
        FROM Shipments s
        JOIN ShipmentCrew sc ON s.shipmentID = sc.shipmentID
        WHERE sc.userID = ? 
        AND s.currentStatus NOT IN ('Completed', 'Cancelled')
    `;

    db.query(checkSql, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
            const activeIDs = results.map(r => r.shipmentID).join(', ');

            const logDetails = `Archive DENIED - User has active Shipment(s) ${activeIDs} [ID: ${id}]`;

            return logActivity(db, adminID, 'ARCHIVE_USER_DENIED', logDetails, () => {
                res.status(409).json({ 
                    error: "Dependency Conflict", 
                    activeShipments: results.map(r => r.shipmentID) 
                });
            });
        }

        // 2. ARCHIVE
        db.getConnection((err, connection) => {
            if (err) return res.status(500).json({ error: "DB Connection failed" });

            connection.beginTransaction(err => {
                if (err) { connection.release(); return res.status(500).json({ error: "Transaction failed" }); }

                const archiveUserSql = "UPDATE Users SET isArchived = 1 WHERE userID = ?";
                connection.query(archiveUserSql, [id], (err) => {
                    if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Failed to archive" }); });

                    const disableLoginSql = "UPDATE UserLogins SET isActive = 0 WHERE userID = ?";
                    connection.query(disableLoginSql, [id], (err) => {
                        if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Failed to disable login" }); });

                        logActivity(connection, adminID, 'ARCHIVE_USER', `Archived User - [ID: ${id}]`, () => {
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
    });
};