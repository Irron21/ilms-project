const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');

router.get('/periods', payrollController.getPeriods);
router.post('/generate', payrollController.generatePayroll);
router.get('/summary/:periodID', payrollController.getPayrollSummary);

module.exports = router;