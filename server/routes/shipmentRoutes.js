const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');

router.get('/', shipmentController.getActiveShipments);
router.get('/:id/logs', shipmentController.getShipmentLogs);
router.post('/:shipmentID/update', shipmentController.updateStatus);
router.get('/resources', shipmentController.getFormResources);
router.post('/create', shipmentController.createShipment);

module.exports = router;