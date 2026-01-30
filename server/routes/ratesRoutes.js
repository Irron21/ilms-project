const express = require('express');
const router = express.Router();
const ratesController = require('../controllers/ratesController');

router.get('/', ratesController.getAllRates);
router.post('/', ratesController.createRate);
router.put('/:id', ratesController.updateRate);
router.delete('/:id', ratesController.deleteRate);

module.exports = router;