const { redisClient } = require('../config/redis');
const RedisHelper = require('../utils/redisHelper');
const ChallengeService = require('./ChallengeService');
const SessionService = require('./SessionService');
const PresenceService = require('./PresenceService');
const NotificationService = require('./NotificationService');
const { CHALLENGE_STATES, REDIS_KEYS, DEFAULTS, JOB_QUEUES } = require('../utils/constants');
const logger = require('../utils/logger');
const { User } = require('../models');

class HandshakeService {
    constructor() {
        this.redis = new RedisHelper(redisClient);
        this.queueManager = null;
    }

    setQueueManager(queueManager) {
        this.queueManager = queueManager;
    }

    _getLockKey(challengeId) {
        return `${REDIS_KEYS.LOCK}:challenge:${challengeId}`;
    }

    async initiateHandshake(challengeId, acceptedBy) {
        const lockKey = this._getLockKey(challengeId);

        try {
            logger.info(`🚀 Initiating handshake for challenge ${challengeId}`);

            return await this.redis.withLock(lockKey, async () => {
                const challenge = await ChallengeService.getChallenge(challengeId, true);

                if (challenge.state !== CHALLENGE_STATES.PENDING) {
                    throw new Error(`Challenge ${challengeId} is not in PENDING state (current: ${challenge.state})`);
                }

                if (challenge.challengedId !== acceptedBy) {
                    throw new Error(`User ${acceptedBy} is not the challenged user`);
                }

                await ChallengeService.updateChallengeState(challengeId, CHALLENGE_STATES.NOTIFYING);

                const playerAId = challenge.challengerId;
                const playerA = challenge.challenger;

                const isOnline = await PresenceService.isUserOnline(playerAId);
                logger.info(`Player A (${playerA.username}) online status: ${isOnline}`);

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

                await ChallengeService.updateChallengeState(challengeId, CHALLENGE_STATES.WAITING_RESPONSE);
                await ChallengeService.incrementNotificationAttempt(challengeId);

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

    async handleWakeUpResponse(challengeId, userId, response) {
        try {
            logger.info(`📩 Player A response for challenge ${challengeId}: ${response}`);

            const challenge = await ChallengeService.getChallenge(challengeId, true);

            if (challenge.challengerId !== userId) {
                throw new Error('Only the original challenger can respond');
            }

            if (challenge.state !== CHALLENGE_STATES.WAITING_RESPONSE) {
                throw new Error(`Challenge is not waiting for response (current state: ${challenge.state})`);
            }

            if (response === 'ACCEPT') {
                const session = await SessionService.createSession(
                    challengeId,
                    [challenge.challengerId, challenge.challengedId],
                    {
                        gameType: challenge.gameType,
                    },
                );

                await ChallengeService.updateChallengeState(challengeId, CHALLENGE_STATES.ACTIVE);

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
                await ChallengeService.updateChallengeState(challengeId, CHALLENGE_STATES.DECLINED);

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

    async handleTimeout(challengeId, attemptNumber) {
        try {
            logger.info(`⏰ Handling timeout for challenge ${challengeId} (attempt ${attemptNumber})`);

            const challenge = await ChallengeService.getChallenge(challengeId, true);

            if (challenge.state !== CHALLENGE_STATES.WAITING_RESPONSE) {
                logger.info(`Challenge ${challengeId} no longer waiting (state: ${challenge.state}), cancelling timeout`);
                return false;
            }

            if (attemptNumber >= DEFAULTS.MAX_RETRY_ATTEMPTS) {
                await ChallengeService.updateChallengeState(challengeId, CHALLENGE_STATES.TIMEOUT);

                if (this.socketIO) {
                    this.socketIO.to(`user:${challenge.challengedId}`).emit('challenge:timeout', {
                        challengeId,
                        timestamp: Date.now(),
                    });
                }

                logger.info(`⏱ Challenge ${challengeId} timed out after ${attemptNumber} attempts`);
                return false;
            }

            logger.info(`🔄 Retrying notification for challenge ${challengeId} (attempt ${attemptNumber + 1})`);

            const playerAId = challenge.challengerId;
            const playerBId = challenge.challengedId;
            const playerB = await User.findByPk(playerBId);

            await NotificationService.sendWakeUpNotification(playerAId, {
                challengeId,
                challenger: {
                    id: playerBId,
                    username: playerB.username,
                },
                gameType: challenge.gameType,
            });

            await ChallengeService.incrementNotificationAttempt(challengeId);

            if (this.queueManager) {
                await this.queueManager.scheduleTimeoutJob(challengeId, attemptNumber + 1);
            }

            return true;
        } catch (error) {
            logger.error(`Failed to handle timeout for challenge ${challengeId}:`, error);
            return false;
        }
    }

    setSocketIO(io) {
        this.socketIO = io;
    }
}

module.exports = new HandshakeService();
