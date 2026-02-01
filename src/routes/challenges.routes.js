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

router.use(authenticateJWT);

router.post('/', challengeLimiter, validateCreateChallenge, createChallenge);
router.get('/me/pending', getPendingChallenges);
router.get('/:id', validateUUID, getChallenge);
router.post('/:id/accept', validateUUID, acceptChallenge);
router.post('/:id/decline', validateUUID, declineChallenge);
router.post('/:id/respond', validateUUID, validateChallengeResponse, respondToChallenge);

module.exports = router;
