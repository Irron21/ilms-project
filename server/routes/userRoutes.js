const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const verifyToken = require('../middleware/authMiddleware'); 
const cache = require('../middleware/cacheMiddleware');

router.get('/', verifyToken, cache(300), userController.getAllUsers);
router.post('/create', verifyToken, userController.createUser);
router.put('/:id', verifyToken, userController.updateUser);
router.delete('/:id', verifyToken, userController.deleteUser);
router.put('/:id/restore', verifyToken, userController.restoreUser);
router.put('/:id/reset-password', verifyToken, userController.resetPassword);

module.exports = router;