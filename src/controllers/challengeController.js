const ChallengeService = require('../services/ChallengeService');
const HandshakeService = require('../services/HandshakeService');
const logger = require('../utils/logger');

/**
 * Create a new challenge
 */
const createChallenge = async (req, res, next) => {
    try {
        const { challengedId, gameType, metadata } = req.body;
        const challengerId = req.user.id;

        const challenge = await ChallengeService.createChallenge(
            challengerId,
            challengedId,
            gameType,
            metadata,
        );

        res.status(201).json({
            success: true,
            data: { challenge },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Accept a challenge (triggers handshake)
 */
const acceptChallenge = async (req, res, next) => {
    try {
        const { id: challengeId } = req.params;
        const acceptedBy = req.user.id;

        logger.info(`User ${req.user.username} accepting challenge ${challengeId}`);

        // Initiate handshake flow
        const result = await HandshakeService.initiateHandshake(challengeId, acceptedBy);

        res.json({
            success: true,
            data: result,
            message: 'Challenge accepted, notifying opponent...',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Respond to wake-up notification (Accept/Decline)
 * This is an alternative to the WebSocket event for HTTP-only clients
 */
const respondToChallenge = async (req, res, next) => {
    try {
        const { id: challengeId } = req.params;
        const { response } = req.body;
        const userId = req.user.id;

        const result = await HandshakeService.handleWakeUpResponse(
            challengeId,
            userId,
            response,
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get challenge details
 */
const getChallenge = async (req, res, next) => {
    try {
        const { id: challengeId } = req.params;

        const challenge = await ChallengeService.getChallenge(challengeId, true);

        res.json({
            success: true,
            data: { challenge },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get pending challenges for current user
 */
const getPendingChallenges = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit, 10) || 20;

        const challenges = await ChallengeService.getPendingChallenges(userId, limit);

        res.json({
            success: true,
            data: {
                challenges,
                count: challenges.length,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createChallenge,
    acceptChallenge,
    respondToChallenge,
    getChallenge,
    getPendingChallenges,
};
