const express = require('express');
const {
    createChallenge,
    acceptChallenge,
    respondToChallenge,
    getChallenge,
    getPendingChallenges,
    declineChallenge,
} = require('../controllers/challengeController');
const { authenticateJWT } = require('../middleware/auth');
const {
    validateCreateChallenge,
    validateChallengeResponse,
    validateUUID,
} = require('../middleware/validation');
const { challengeLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

// Create challenge
router.post('/', challengeLimiter, validateCreateChallenge, createChallenge);

// Get pending challenges for current user
router.get('/me/pending', getPendingChallenges);

// Get challenge details
router.get('/:id', validateUUID, getChallenge);

// Accept challenge (triggers handshake)
router.post('/:id/accept', validateUUID, acceptChallenge);

// Decline challenge (by challenged user)
router.post('/:id/decline', validateUUID, declineChallenge);

// Respond to wake-up (Accept/Decline)
router.post('/:id/respond', validateUUID, validateChallengeResponse, respondToChallenge);

module.exports = router;
