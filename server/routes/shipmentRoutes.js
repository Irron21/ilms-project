const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');

router.get('/', shipmentController.getActiveShipments);
router.get('/:id/logs', shipmentController.getShipmentLogs);
router.get('/resources', shipmentController.getShipmentResources);
router.get('/payroll-routes', shipmentController.getPayrollRoutes);

router.post('/create', shipmentController.createShipment);
router.post('/create-batch', shipmentController.createBatchShipments);
router.put('/:id/status', shipmentController.updateStatus);
router.put('/:id/delay-reason', shipmentController.updateDelayReason);
router.put('/:id/archive', shipmentController.archiveShipment);
router.put('/:id/restore', shipmentController.restoreShipment);

router.get('/export', shipmentController.exportShipments); 

module.exports = router;