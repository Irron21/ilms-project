const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');

router.get('/', shipmentController.getActiveShipments);

router.post('/:shipmentID/update', shipmentController.updateStatus);

module.exports = router;