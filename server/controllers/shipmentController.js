const db = require('../config/db');

exports.getActiveShipments = (req, res) => {
    const currentUserID = req.query.userID;

    console.log("📡 Fetching shipments for Driver ID:", currentUserID);

    const sql = `
        SELECT 
            s.shipmentID, 
            c.clientName, 
            s.destLocation, 
            s.currentStatus, 
            s.creationTimestamp 
        FROM Shipments s
        JOIN Clients c ON s.clientID = c.clientID
        JOIN ShipmentCrew sc ON s.shipmentID = sc.shipmentID
        WHERE sc.userID = ?  -- Only show shipments assigned to THIS user
        ORDER BY s.creationTimestamp DESC
    `;
    
    db.query(sql, [currentUserID], (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ error: "Failed to fetch shipments" });
        }
        res.json(results);
    });
};

exports.updateStatus = (req, res) => {
    const { shipmentID } = req.params;
    const { status, userID } = req.body;
    console.log(`Request to update Shipment #${shipmentID} to '${status}'`);
    
    const updateShipmentSql = "UPDATE Shipments SET currentStatus = ? WHERE shipmentID = ?";
    const insertLogSql = "INSERT INTO ShipmentStatusLog (shipmentID, userID, phaseName, status) VALUES (?, ?, ?, ?)";

    db.query(updateShipmentSql, [status, shipmentID], (err, result) => {
        if (err) {
            console.error("Update Error:", err);
            return res.status(500).json({ error: err.message });
        }

        db.query(insertLogSql, [shipmentID, userID, status, status], (err, result) => {
            if (err) {
                console.error("Log Error:", err);
                return res.status(500).json({ error: err.message });
            }

            console.log("Update Successful.");
            res.json({ message: `Shipment ${shipmentID} updated to ${status}` });
        });
    });
};