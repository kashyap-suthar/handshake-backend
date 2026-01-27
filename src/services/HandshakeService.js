const { redisClient } = require('../config/redis');
const RedisHelper = require('../utils/redisHelper');
const ChallengeService = require('./ChallengeService');
const SessionService = require('./SessionService');
const PresenceService = require('./PresenceService');
const NotificationService = require('./NotificationService');
const { CHALLENGE_STATES, REDIS_KEYS, DEFAULTS, JOB_QUEUES } = require('../utils/constants');
const logger = require('../utils/logger');
const { User } = require('../models');

/**
 * Handshake Service - Orchestrate the player handshake flow
 * This is the core service that manages the wake-up mechanism
 */
class HandshakeService {
    constructor() {
        this.redis = new RedisHelper(redisClient);
        this.queueManager = null; // Will be set by job queue manager
    }

    /**
     * Set queue manager (dependency injection)
     * @param {object} queueManager - Queue manager instance
     */
    setQueueManager(queueManager) {
        this.queueManager = queueManager;
    }

    /**
     * Get lock key for a challenge
     * @param {string} challengeId - Challenge ID
     * @returns {string} - Lock key
     */
    _getLockKey(challengeId) {
        return `${REDIS_KEYS.LOCK}:challenge:${challengeId}`;
    }

    /**
     * Initiate handshake when challenge is accepted
     * This is the main entry point when Player B accepts a challenge
     * 
     * @param {string} challengeId - Challenge ID
     * @param {string} acceptedBy - User ID of Player B who accepted
     * @returns {Promise<object>} - Result object
     */
    async initiateHandshake(challengeId, acceptedBy) {
        const lockKey = this._getLockKey(challengeId);

        try {
            logger.info(`🚀 Initiating handshake for challenge ${challengeId}`);

            // Acquire distributed lock to prevent race conditions
            return await this.redis.withLock(lockKey, async () => {
                // 1. Get challenge and validate
                const challenge = await ChallengeService.getChallenge(challengeId, true);

                if (challenge.state !== CHALLENGE_STATES.PENDING) {
                    throw new Error(`Challenge ${challengeId} is not in PENDING state (current: ${challenge.state})`);
                }

                if (challenge.challengedId !== acceptedBy) {
                    throw new Error(`User ${acceptedBy} is not the challenged user`);
                }

                // 2. Update challenge state to NOTIFYING
                await ChallengeService.updateChallengeState(challengeId, CHALLENGE_STATES.NOTIFYING);

                // 3. Get Player A (the original challenger)
                const playerAId = challenge.challengerId;
                const playerA = challenge.challenger;

                // 4. Check if Player A is online
                const isOnline = await PresenceService.isUserOnline(playerAId);
                logger.info(`Player A (${playerA.username}) online status: ${isOnline}`);

                // 5. If online, emit WebSocket event to all Player A's devices
                if (isOnline && this.socketIO) {
                    const sockets = await PresenceService.getUserSockets(playerAId);
                    logger.info(`📡 Emitting wake-up to ${sockets.length} socket(s) for Player A`);

                    this.socketIO.to(`user:${playerAId}`).emit('challenge:wake-up', {
                        challengeId,
                        challenger: {
                            id: acceptedBy,
                            username: challenge.challenged.username,
                        },
                        gameType: challenge.gameType,
                        timestamp: Date.now(),
                    });
                }

                // 6. ALWAYS send FCM push notification (critical for background/killed apps)
                const playerBData = await User.findByPk(acceptedBy);
                const notificationSent = await NotificationService.sendWakeUpNotification(playerAId, {
                    challengeId,
                    challenger: {
                        id: acceptedBy,
                        username: playerBData.username,
                    },
                    gameType: challenge.gameType,
                });

                logger.info(`📲 FCM notification sent: ${notificationSent}`);

                // 7. Update state to WAITING_RESPONSE
                await ChallengeService.updateChallengeState(challengeId, CHALLENGE_STATES.WAITING_RESPONSE);
                await ChallengeService.incrementNotificationAttempt(challengeId);

                // 8. Schedule timeout job
                if (this.queueManager) {
                    await this.queueManager.scheduleTimeoutJob(challengeId, 1);
                    logger.info(`⏰ Scheduled timeout job for challenge ${challengeId} (attempt 1)`);
                }

                return {
                    success: true,
                    challengeId,
                    playerANotified: isOnline || notificationSent,
                    state: CHALLENGE_STATES.WAITING_RESPONSE,
                };
            });
        } catch (error) {
            logger.error(`Failed to initiate handshake for challenge ${challengeId}:`, error);
            throw error;
        }
    }

    /**
     * Handle Player A's response to wake-up (Accept or Decline)
     * 
     * @param {string} challengeId - Challenge ID
     * @param {string} userId - User ID of Player A
     * @param {string} response - 'ACCEPT' or 'DECLINE'
     * @returns {Promise<object>} - Result object
     */
    async handleWakeUpResponse(challengeId, userId, response) {
        try {
            logger.info(`📩 Player A response for challenge ${challengeId}: ${response}`);

            // Get challenge
            const challenge = await ChallengeService.getChallenge(challengeId, true);

            // Validate user is the challenger (Player A)
            if (challenge.challengerId !== userId) {
                throw new Error('Only the original challenger can respond');
            }

            // Validate state
            if (challenge.state !== CHALLENGE_STATES.WAITING_RESPONSE) {
                throw new Error(`Challenge is not waiting for response (current state: ${challenge.state})`);
            }

            if (response === 'ACCEPT') {
                // Player A accepted - create session
                const session = await SessionService.createSession(
                    challengeId,
                    [challenge.challengerId, challenge.challengedId],
                    {
                        gameType: challenge.gameType,
                    },
                );

                // Update challenge state to ACTIVE
                await ChallengeService.updateChallengeState(challengeId, CHALLENGE_STATES.ACTIVE);

                // Emit session:ready to both players
                if (this.socketIO) {
                    this.socketIO.to(`user:${challenge.challengerId}`).emit('session:ready', {
                        sessionId: session.id,
                        challengeId,
                        opponent: {
                            id: challenge.challengedId,
                            username: challenge.challenged.username,
                        },
                        gameType: challenge.gameType,
                    });

                    this.socketIO.to(`user:${challenge.challengedId}`).emit('session:ready', {
                        sessionId: session.id,
                        challengeId,
                        opponent: {
                            id: challenge.challengerId,
                            username: challenge.challenger.username,
                        },
                        gameType: challenge.gameType,
                    });
                }

                logger.info(`✅ Session ${session.id} created for challenge ${challengeId}`);

                return {
                    success: true,
                    action: 'SESSION_CREATED',
                    sessionId: session.id,
                    challengeId,
                };
            } else if (response === 'DECLINE') {
                // Player A declined
                await ChallengeService.updateChallengeState(challengeId, CHALLENGE_STATES.DECLINED);

                // Notify Player B
                if (this.socketIO) {
                    this.socketIO.to(`user:${challenge.challengedId}`).emit('challenge:declined', {
                        challengeId,
                        timestamp: Date.now(),
                    });
                }

                logger.info(`❌ Challenge ${challengeId} declined by Player A`);

                return {
                    success: true,
                    action: 'DECLINED',
                    challengeId,
                };
            } else {
                throw new Error(`Invalid response: ${response}`);
            }
        } catch (error) {
            logger.error(`Failed to handle wake-up response for challenge ${challengeId}:`, error);
            throw error;
        }
    }

    /**
     * Handle timeout (called by job queue)
     * 
     * @param {string} challengeId - Challenge ID
     * @param {number} attemptNumber - Current attempt number
     * @returns {Promise<boolean>} - True if should retry
     */
    async handleTimeout(challengeId, attemptNumber) {
        try {
            logger.info(`⏰ Handling timeout for challenge ${challengeId} (attempt ${attemptNumber})`);

            const challenge = await ChallengeService.getChallenge(challengeId, true);

            // Check if challenge is still waiting for response
            if (challenge.state !== CHALLENGE_STATES.WAITING_RESPONSE) {
                logger.info(`Challenge ${challengeId} no longer waiting (state: ${challenge.state}), cancelling timeout`);
                return false; // Don't retry
            }

            // Check max attempts
            if (attemptNumber >= DEFAULTS.MAX_RETRY_ATTEMPTS) {
                // Max retries reached, mark as TIMEOUT
                await ChallengeService.updateChallengeState(challengeId, CHALLENGE_STATES.TIMEOUT);

                // Notify Player B
                if (this.socketIO) {
                    this.socketIO.to(`user:${challenge.challengedId}`).emit('challenge:timeout', {
                        challengeId,
                        timestamp: Date.now(),
                    });
                }

                logger.info(`⏱ Challenge ${challengeId} timed out after ${attemptNumber} attempts`);
                return false; // Don't retry
            }

            // Retry notification
            logger.info(`🔄 Retrying notification for challenge ${challengeId} (attempt ${attemptNumber + 1})`);

            const playerAId = challenge.challengerId;
            const playerBId = challenge.challengedId;
            const playerB = await User.findByPk(playerBId);

            // Send notification again
            await NotificationService.sendWakeUpNotification(playerAId, {
                challengeId,
                challenger: {
                    id: playerBId,
                    username: playerB.username,
                },
                gameType: challenge.gameType,
            });

            await ChallengeService.incrementNotificationAttempt(challengeId);

            // Schedule next timeout
            if (this.queueManager) {
                await this.queueManager.scheduleTimeoutJob(challengeId, attemptNumber + 1);
            }

            return true; // Continue retrying
        } catch (error) {
            logger.error(`Failed to handle timeout for challenge ${challengeId}:`, error);
            return false;
        }
    }

    /**
     * Set Socket.IO instance (dependency injection)
     * @param {object} io - Socket.IO instance
     */
    setSocketIO(io) {
        this.socketIO = io;
    }
}

module.exports = new HandshakeService();
