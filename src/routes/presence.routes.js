const express = require('express');
const {
    registerDevice,
    unregisterDevice,
    heartbeat,
    getPresence,
} = require('../controllers/presenceController');
const { authenticateJWT } = require('../middleware/auth');
const { validateDeviceToken } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

// Register device token for FCM
router.post('/register-device', validateDeviceToken, registerDevice);

// Unregister device token
router.post('/unregister-device', validateDeviceToken, unregisterDevice);

// Heartbeat (keep-alive)
router.post('/heartbeat', heartbeat);

// Get presence status
router.get('/:userId', getPresence);

module.exports = router;
