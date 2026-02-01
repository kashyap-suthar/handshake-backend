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

router.use(authenticateJWT);

router.post('/register-device', validateDeviceToken, registerDevice);
router.post('/unregister-device', validateDeviceToken, unregisterDevice);
router.post('/heartbeat', heartbeat);
router.get('/:userId', getPresence);

module.exports = router;
