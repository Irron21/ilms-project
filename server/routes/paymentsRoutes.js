const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');

router.get('/:periodID/:userID', paymentsController.getUserPayments);
router.post('/', paymentsController.addPayment);
router.delete('/:id', paymentsController.voidPayment);

module.exports = router;