const ChallengeService = require('../services/ChallengeService');
const HandshakeService = require('../services/HandshakeService');
const logger = require('../utils/logger');
const { CHALLENGE_STATES } = require('../utils/constants');

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

const acceptChallenge = async (req, res, next) => {
    try {
        const { id: challengeId } = req.params;
        const acceptedBy = req.user.id;

        logger.info(`User ${req.user.username} accepting challenge ${challengeId}`);

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

const declineChallenge = async (req, res, next) => {
    try {
        const { id: challengeId } = req.params;
        const userId = req.user.id;

        logger.info(`User ${req.user.username} declining challenge ${challengeId}`);

        const challenge = await ChallengeService.getChallenge(challengeId, true);

        if (challenge.challengedId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only the challenged user can decline',
            });
        }

        if (challenge.state !== CHALLENGE_STATES.PENDING) {
            return res.status(400).json({
                success: false,
                error: `Cannot decline challenge in ${challenge.state} state`,
            });
        }

        await ChallengeService.updateChallengeState(challengeId, CHALLENGE_STATES.DECLINED);

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
