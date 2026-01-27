const express = require('express');
const { register, login, getProfile } = require('../controllers/authController');
const { authenticateJWT } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Public routes
router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, validateLogin, login);

// Protected routes
router.get('/profile', authenticateJWT, getProfile);

module.exports = router;
