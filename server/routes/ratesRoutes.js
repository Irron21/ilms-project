const express = require('express');
const router = express.Router();
const ratesController = require('../controllers/ratesController');
const verifyToken = require('../middleware/authMiddleware');

router.get('/', verifyToken, ratesController.getAllRates);
router.post('/', verifyToken, ratesController.createRate);
router.put('/:id', verifyToken, ratesController.updateRate);
router.delete('/:id', verifyToken, ratesController.deleteRate);

module.exports = router;
