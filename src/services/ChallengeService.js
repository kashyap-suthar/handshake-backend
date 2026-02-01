const { Challenge, User } = require('../models');
const { CHALLENGE_STATES, DEFAULTS } = require('../utils/constants');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const notificationService = require('./NotificationService');

class ChallengeService {
    async createChallenge(challengerId, challengedId, gameType, metadata = {}) {
        try {
            const [challenger, challenged] = await Promise.all([
                User.findByPk(challengerId),
                User.findByPk(challengedId),
            ]);

            if (!challenger) {
                throw new NotFoundError(`Challenger user ${challengerId} not found`);
            }

            if (!challenged) {
                throw new NotFoundError(`Challenged user ${challengedId} not found`);
            }

            if (challengerId === challengedId) {
                throw new ValidationError('Cannot challenge yourself');
            }

            const expiresAt = new Date(
                Date.now() + DEFAULTS.CHALLENGE_EXPIRATION_SECONDS * 1000,
            );

            const challenge = await Challenge.create({
                challengerId,
                challengedId,
                gameType,
                state: CHALLENGE_STATES.PENDING,
                expiresAt,
                metadata,
            });

            logger.info(`Challenge created: ${challenge.id} (${challenger.username} → ${challenged.username})`);

            try {
                const { io } = require('../server');
                if (io) {
                    const eventData = {
                        challengeId: challenge.id,
                        challenger: {
                            id: challenger.id,
                            username: challenger.username,
                        },
                        gameType: challenge.gameType,
                        createdAt: challenge.createdAt,
                    };

                    io.to(`user:${challengedId}`).emit('challenge:received', eventData);
                    logger.debug(`Emitted challenge:received event to user:${challengedId}`);
                }
            } catch (socketError) {
                logger.warn('Failed to emit challenge:received event:', socketError.message);
            }

            try {
                await notificationService.sendWakeUpNotification(challengedId, {
                    challengeId: challenge.id,
                    challenger: {
                        id: challenger.id,
                        username: challenger.username,
                    },
                    gameType: challenge.gameType,
                });
                logger.debug(`Push notification sent to user:${challengedId}`);
            } catch (notificationError) {
                logger.warn('Failed to send push notification:', notificationError.message);
            }

            return challenge;
        } catch (error) {
            logger.error('Failed to create challenge:', error);
            throw error;
        }
    }

    async getChallenge(challengeId, includeUsers = false) {
        try {
            const options = {
                where: { id: challengeId },
            };

            if (includeUsers) {
                options.include = [
                    { model: User, as: 'challenger', attributes: ['id', 'username', 'email'] },
                    { model: User, as: 'challenged', attributes: ['id', 'username', 'email'] },
                ];
            }

            const challenge = await Challenge.findOne(options);

            if (!challenge) {
                throw new NotFoundError(`Challenge ${challengeId} not found`);
            }

            return challenge;
        } catch (error) {
            logger.error(`Failed to get challenge ${challengeId}:`, error);
            throw error;
        }
    }

    async getPendingChallenges(userId, limit = 20) {
        try {
            const challenges = await Challenge.findAll({
                where: {
                    challengedId: userId,
                    state: CHALLENGE_STATES.PENDING,
                },
                include: [
                    { model: User, as: 'challenger', attributes: ['id', 'username'] },
                ],
                order: [['createdAt', 'DESC']],
                limit,
            });

            return challenges;
        } catch (error) {
            logger.error(`Failed to get pending challenges for user ${userId}:`, error);
            throw error;
        }
    }

    async updateChallengeState(challengeId, newState) {
        try {
            const challenge = await this.getChallenge(challengeId);

            if (!challenge.canTransitionTo(newState)) {
                throw new ValidationError(
                    `Cannot transition challenge from ${challenge.state} to ${newState}`,
                );
            }

            await challenge.transitionTo(newState);
            logger.info(`Challenge ${challengeId} transitioned to ${newState}`);

            return challenge;
        } catch (error) {
            logger.error(`Failed to update challenge ${challengeId} state:`, error);
            throw error;
        }
    }

    async incrementNotificationAttempt(challengeId) {
        try {
            const challenge = await this.getChallenge(challengeId);
            await challenge.incrementNotificationAttempt();

            logger.debug(`Challenge ${challengeId} notification attempt: ${challenge.notificationAttempts}`);
            return challenge;
        } catch (error) {
            logger.error(`Failed to increment notification attempt for ${challengeId}:`, error);
            throw error;
        }
    }

    async markExpiredChallenges() {
        try {
            const [affectedCount] = await Challenge.update(
                { state: CHALLENGE_STATES.EXPIRED },
                {
                    where: {
                        state: CHALLENGE_STATES.PENDING,
                        expiresAt: {
                            [require('sequelize').Op.lt]: new Date(),
                        },
                    },
                },
            );

            if (affectedCount > 0) {
                logger.info(`Marked ${affectedCount} challenges as expired`);
            }

            return affectedCount;
        } catch (error) {
            logger.error('Failed to mark expired challenges:', error);
            throw error;
        }
    }

    async deleteOldChallenges(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const deletedCount = await Challenge.destroy({
                where: {
                    createdAt: {
                        [require('sequelize').Op.lt]: cutoffDate,
                    },
                    state: {
                        [require('sequelize').Op.in]: [
                            CHALLENGE_STATES.EXPIRED,
                            CHALLENGE_STATES.DECLINED,
                            CHALLENGE_STATES.TIMEOUT,
                        ],
                    },
                },
            });

            if (deletedCount > 0) {
                logger.info(`Deleted ${deletedCount} old challenges`);
            }

            return deletedCount;
        } catch (error) {
            logger.error('Failed to delete old challenges:', error);
            throw error;
        }
    }
}

module.exports = new ChallengeService();
