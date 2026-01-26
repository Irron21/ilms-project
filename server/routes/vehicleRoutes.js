const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');

router.get('/', vehicleController.getAllVehicles);
router.post('/create', vehicleController.createVehicle);
router.put('/:id', vehicleController.updateVehicle); 
router.put('/:id/status', vehicleController.updateVehicleStatus); 
router.delete('/:id', vehicleController.deleteVehicle);

module.exports = router;