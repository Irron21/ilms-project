const express = require('express');
const router = express.Router();
const adjustmentsController = require('../controllers/adjustmentsController');
const  verifyToken  = require('../middleware/authMiddleware'); 

router.get('/:periodID/:userID', verifyToken, adjustmentsController.getUserAdjustments);
router.post('/', verifyToken, adjustmentsController.addAdjustment);
router.delete('/:id', verifyToken, adjustmentsController.deleteAdjustment);

module.exports = router;
