const express = require('express');
const router = express.Router();
const kpiController = require('../controllers/kpiController');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const verifyToken = require('../middleware/authMiddleware');
const cache = require('../middleware/cacheMiddleware');

router.post('/upload', verifyToken, upload.single('kpiReport'), kpiController.uploadKPIReport);
router.get('/months', verifyToken, cache(300), kpiController.getAvailableMonths);
router.get('/dashboard', verifyToken, cache(300), kpiController.getDashboardData); 
router.post('/delete', verifyToken, kpiController.deleteReport);

module.exports = router;