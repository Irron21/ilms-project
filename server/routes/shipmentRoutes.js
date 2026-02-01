const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const verifyToken = require('../middleware/authMiddleware'); // ✅ Import

// READ Routes (Usually safe without token if public, but better with it)
router.get('/', verifyToken, shipmentController.getActiveShipments);
router.get('/:id/logs', verifyToken, shipmentController.getShipmentLogs);
router.get('/resources', verifyToken, shipmentController.getShipmentResources);
router.get('/payroll-routes', verifyToken, shipmentController.getPayrollRoutes);

// WRITE Routes (CRITICAL: These need verifyToken for Logging & Security)
router.post('/create', verifyToken, shipmentController.createShipment);
router.post('/create-batch', verifyToken, shipmentController.createBatchShipments); // ✅ You just added this
router.put('/:shipmentID/status', verifyToken, shipmentController.updateStatus);
router.put('/:id/archive', verifyToken, shipmentController.archiveShipment);
router.put('/:id/restore', verifyToken, shipmentController.restoreShipment);

// EXPORT (Controller uses req.user for logs)
router.get('/export', verifyToken, shipmentController.exportShipments); 

module.exports = router;