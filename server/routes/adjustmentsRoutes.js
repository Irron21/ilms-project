const express = require('express');
const router = express.Router();
const adjustmentsController = require('../controllers/adjustmentsController');

router.get('/:periodID/:userID', adjustmentsController.getUserAdjustments);
router.post('/', adjustmentsController.addAdjustment);
router.delete('/:id', adjustmentsController.deleteAdjustment);

module.exports = router;