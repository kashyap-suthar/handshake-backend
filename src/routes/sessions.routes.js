const express = require('express');
const {
    getSession,
    getActiveSessions,
    endSession,
} = require('../controllers/sessionController');
const { authenticateJWT } = require('../middleware/auth');
const { validateUUID } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

// Get active sessions for current user
router.get('/me/active', getActiveSessions);

// Get session details
router.get('/:id', validateUUID, getSession);

// End session
router.post('/:id/end', validateUUID, endSession);

module.exports = router;
