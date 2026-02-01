const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');

router.get('/', shipmentController.getActiveShipments);
router.get('/:id/logs', shipmentController.getShipmentLogs);
router.put('/:shipmentID/status', shipmentController.updateStatus);
router.post('/create', shipmentController.createShipment);
router.get('/export', shipmentController.exportShipments);
router.put('/:id/archive', shipmentController.archiveShipment);
router.put('/:id/restore', shipmentController.restoreShipment);
router.get('/payroll-routes', shipmentController.getPayrollRoutes);
router.get('/resources', shipmentController.getShipmentResources);

module.exports = router;