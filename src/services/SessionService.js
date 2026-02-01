const { Session } = require('../models');
const { SESSION_STATES } = require('../utils/constants');
const { NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

class SessionService {
    async createSession(challengeId, players, metadata = {}) {
        try {
            if (players.length !== 2) {
                throw new Error('Session must have exactly 2 players');
            }

            const session = await Session.create({
                challengeId,
                players,
                state: SESSION_STATES.ACTIVE,
                metadata,
            });

            logger.info(`Session created: ${session.id} for challenge ${challengeId}`);
            return session;
        } catch (error) {
            logger.error('Failed to create session:', error);
            throw error;
        }
    }

    async getSession(sessionId) {
        try {
            const session = await Session.findByPk(sessionId);

            if (!session) {
                throw new NotFoundError(`Session ${sessionId} not found`);
            }

            return session;
        } catch (error) {
            logger.error(`Failed to get session ${sessionId}:`, error);
            throw error;
        }
    }

    async getSessionByChallenge(challengeId) {
        try {
            const session = await Session.findOne({
                where: { challengeId },
            });

            return session;
        } catch (error) {
            logger.error(`Failed to get session for challenge ${challengeId}:`, error);
            return null;
        }
    }

    async endSession(sessionId, state = SESSION_STATES.COMPLETED, metadata = {}) {
        try {
            const session = await this.getSession(sessionId);
            await session.endSession(state, metadata);

            logger.info(`Session ${sessionId} ended with state ${state}`);
            return session;
        } catch (error) {
            logger.error(`Failed to end session ${sessionId}:`, error);
            throw error;
        }
    }

    async getActiveSessions(userId) {
        try {
            const { Op } = require('sequelize');

            const sessions = await Session.findAll({
                where: {
                    players: {
                        [Op.contains]: [userId],
                    },
                    state: SESSION_STATES.ACTIVE,
                },
                order: [['startedAt', 'DESC']],
            });

            return sessions;
        } catch (error) {
            logger.error(`Failed to get active sessions for user ${userId}:`, error);
            return [];
        }
    }
}

module.exports = new SessionService();
