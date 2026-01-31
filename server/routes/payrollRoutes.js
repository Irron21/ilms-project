const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');

router.get('/export', payrollController.exportPayroll);
router.get('/periods', payrollController.getPeriods);
router.post('/generate', payrollController.generatePayroll);
router.get('/summary/:periodID', payrollController.getPayrollSummary);
router.get('/trips/:periodID/:userID', payrollController.getEmployeeTrips);
router.post('/close', payrollController.closePeriod);
router.post('/periods/generate', payrollController.generateFuturePeriods);

module.exports = router;