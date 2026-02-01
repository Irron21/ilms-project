const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const verifyToken = require('../middleware/authMiddleware');

router.get('/', verifyToken, shipmentController.getActiveShipments);
router.get('/:id/logs', verifyToken, shipmentController.getShipmentLogs);
router.get('/resources', verifyToken, shipmentController.getShipmentResources);
router.get('/payroll-routes', verifyToken, shipmentController.getPayrollRoutes);

router.post('/create', verifyToken, shipmentController.createShipment);
router.post('/create-batch', verifyToken, shipmentController.createBatchShipments);
router.put('/:shipmentID/status', verifyToken, shipmentController.updateStatus);
router.put('/:id/archive', verifyToken, shipmentController.archiveShipment);
router.put('/:id/restore', verifyToken, shipmentController.restoreShipment);

router.get('/export', verifyToken, shipmentController.exportShipments); 

module.exports = router;