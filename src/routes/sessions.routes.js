const express = require('express');
const {
    getSession,
    getActiveSessions,
    endSession,
} = require('../controllers/sessionController');
const { authenticateJWT } = require('../middleware/auth');
const { validateUUID } = require('../middleware/validation');

const router = express.Router();

router.use(authenticateJWT);

router.get('/me/active', getActiveSessions);
router.get('/:id', validateUUID, getSession);
router.post('/:id/end', validateUUID, endSession);

module.exports = router;
