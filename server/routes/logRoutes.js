const express = require('express');
const router = express.Router();
const logActivity = require('../utils/activityLogger'); 

const  verifyToken  = require('../middleware/authMiddleware'); 

router.post('/', verifyToken, (req, res) => {
    try {
        const { action, details } = req.body;
        
        console.log("Log Request User:", req.user);

        const userID = req.user.userID || req.user.id;

        if (!req.user || !userID) {
            console.log("401 Blocked: User or ID missing");
            return res.status(401).json({ error: 'User not authenticated' });
        }

        logActivity(userID, action, details);

        res.status(200).json({ message: 'Log saved successfully' });
    } catch (error) {
        console.error('Logging error:', error);
        res.status(500).json({ error: 'Failed to log activity' });
    }
});

module.exports = router;