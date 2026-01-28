const express = require('express');
const router = express.Router();
const kpiController = require('../controllers/kpiController');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('kpiReport'), kpiController.uploadKPIReport);
router.get('/months', kpiController.getAvailableMonths);
router.get('/dashboard', kpiController.getDashboardData); 
router.post('/delete', kpiController.deleteReport);

module.exports = router;