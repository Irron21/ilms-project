const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const verifyToken = require('../middleware/authMiddleware');
const cache = require('../middleware/cacheMiddleware');

router.get('/', verifyToken, cache(300), vehicleController.getAllVehicles);
router.post('/create', verifyToken, vehicleController.createVehicle);
router.put('/:id', verifyToken, vehicleController.updateVehicle); 
router.put('/:id/status', verifyToken, vehicleController.updateVehicleStatus); 
router.delete('/:id', verifyToken, vehicleController.deleteVehicle);
router.put('/:id/restore', verifyToken, vehicleController.restoreVehicle);

module.exports = router;
