const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const verifyToken = require('../middleware/authMiddleware'); 

router.get('/shipment-adjustments/:shipmentID/:crewID', verifyToken, payrollController.getShipmentAdjustments);
router.post('/shipment-adjustment', verifyToken, payrollController.addShipmentAdjustment);
router.delete('/shipment-adjustment/:adjustmentID', verifyToken, payrollController.deleteShipmentAdjustment);
router.get('/export', payrollController.exportPayroll);
router.get('/summary/:periodID', payrollController.getPayrollSummary);
router.get('/trips/:periodID/:userID', payrollController.getEmployeeTrips);

router.get('/periods', verifyToken, payrollController.getPeriods);
router.post('/generate', verifyToken, payrollController.generatePayroll); // Critical
router.post('/periods/generate', verifyToken, payrollController.generateFuturePeriods);
router.post('/close', verifyToken, payrollController.closePeriod);

module.exports = router;