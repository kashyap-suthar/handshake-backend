const { Challenge, User } = require('../models');
const { CHALLENGE_STATES, DEFAULTS } = require('../utils/constants');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const notificationService = require('./NotificationService');

/**
 * Challenge Service - CRUD operations for challenges
 */
class ChallengeService {
    /**
     * Create a new challenge
     * @param {string} challengerId - User creating the challenge
     * @param {string} challengedId - User being challenged
     * @param {string} gameType - Type of game
     * @param {object} metadata - Additional metadata
     * @returns {Promise<Challenge>} - Created challenge
     */
    async createChallenge(challengerId, challengedId, gameType, metadata = {}) {
        try {
            // Validate users exist
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

            // Calculate expiration time
            const expiresAt = new Date(
                Date.now() + DEFAULTS.CHALLENGE_EXPIRATION_SECONDS * 1000,
            );

            // Create challenge
            const challenge = await Challenge.create({
                challengerId,
                challengedId,
                gameType,
                state: CHALLENGE_STATES.PENDING,
                expiresAt,
                metadata,
            });

            logger.info(`Challenge created: ${challenge.id} (${challenger.username} → ${challenged.username})`);

            // Emit WebSocket event to notify challenged user
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

                    // Emit to challenged user's room
                    io.to(`user:${challengedId}`).emit('challenge:received', eventData);
                    logger.debug(`Emitted challenge:received event to user:${challengedId}`);
                }
            } catch (socketError) {
                // Don't fail challenge creation if socket emission fails
                logger.warn('Failed to emit challenge:received event:', socketError.message);
            }

            // Send push notification to challenged user (works even if app is killed)
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
                // Don't fail challenge creation if notification fails
                logger.warn('Failed to send push notification:', notificationError.message);
            }

            return challenge;
        } catch (error) {
            logger.error('Failed to create challenge:', error);
            throw error;
        }
    }

    /**
     * Get challenge by ID
     * @param {string} challengeId - Challenge ID
     * @param {boolean} includeUsers - Include challenger and challenged user data
     * @returns {Promise<Challenge>} - Challenge
     */
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

    /**
     * Get pending challenges for a user
     * @param {string} userId - User ID
     * @param {number} limit - Max results
     * @returns {Promise<Challenge[]>} - Array of challenges
     */
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

    /**
     * Update challenge state
     * @param {string} challengeId - Challenge ID
     * @param {string} newState - New state
     * @returns {Promise<Challenge>} - Updated challenge
     */
    async updateChallengeState(challengeId, newState) {
        try {
            const challenge = await this.getChallenge(challengeId);

            // Validate state transition
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

    /**
     * Increment notification attempt count
     * @param {string} challengeId - Challenge ID
     * @returns {Promise<Challenge>} - Updated challenge
     */
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

    /**
     * Mark expired challenges
     * @returns {Promise<number>} - Number of challenges marked as expired
     */
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

    /**
     * Delete old challenges (cleanup)
     * @param {number} daysOld - Delete challenges older than this many days
     * @returns {Promise<number>} - Number of challenges deleted
     */
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
