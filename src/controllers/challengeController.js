const ChallengeService = require('../services/ChallengeService');
const HandshakeService = require('../services/HandshakeService');
const logger = require('../utils/logger');
const { CHALLENGE_STATES } = require('../utils/constants');

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

/**
 * Decline a challenge (by challenged user)
 */
const declineChallenge = async (req, res, next) => {
    try {
        const { id: challengeId } = req.params;
        const userId = req.user.id;

        logger.info(`User ${req.user.username} declining challenge ${challengeId}`);

        // Get challenge to validate
        const challenge = await ChallengeService.getChallenge(challengeId, true);

        // Validate user is the challenged user
        if (challenge.challengedId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only the challenged user can decline',
            });
        }

        // Validate state allows decline
        if (challenge.state !== CHALLENGE_STATES.PENDING) {
            return res.status(400).json({
                success: false,
                error: `Cannot decline challenge in ${challenge.state} state`,
            });
        }

        // Update state to declined
        await ChallengeService.updateChallengeState(challengeId, CHALLENGE_STATES.DECLINED);

        // Notify challenger via WebSocket
        try {
            const { io } = require('../server');
            if (io) {
                io.to(`user:${challenge.challengerId}`).emit('challenge:declined', {
                    challengeId,
                    declinedBy: {
                        id: userId,
                        username: req.user.username,
                    },
                });
            }
        } catch (socketError) {
            logger.warn('Failed to emit challenge:declined event:', socketError.message);
        }

        res.json({
            success: true,
            message: 'Challenge declined',
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
    declineChallenge,
};
