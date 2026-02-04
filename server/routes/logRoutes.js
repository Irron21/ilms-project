const express = require('express');
const router = express.Router();
const logActivity = require('../utils/activityLogger'); 
const logController = require('../controllers/logController');
const  verifyToken  = require('../middleware/authMiddleware'); 

router.get('/actions', verifyToken, logController.getLogActions);
router.get('/history', verifyToken, logController.getActivityLogs);
router.post('/', verifyToken, (req, res) => {
    try {
        const { action, details } = req.body;

        const userID = req.user.userID || req.user.id;

        if (!req.user || !userID) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        logActivity(userID, action, details);

        res.status(200).json({ message: 'Log saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to log activity' });
    }
});

module.exports = router;
