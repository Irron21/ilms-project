const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');
const verifyToken = require('../middleware/authMiddleware'); 

router.get('/:periodID/:userID', verifyToken, paymentsController.getUserPayments);
router.post('/', verifyToken, paymentsController.addPayment);
router.delete('/:id', verifyToken, paymentsController.voidPayment);

module.exports = router;
