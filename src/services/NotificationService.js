const { getMessaging } = require('../config/firebase');
const { User } = require('../models');
const logger = require('../utils/logger');

class NotificationService {
    async sendWakeUpNotification(userId, challengeData) {
        try {
            const messaging = getMessaging();
            if (!messaging) {
                logger.warn('Firebase messaging not configured, skipping notification');
                return false;
            }

            // Get user's device tokens
            const user = await User.findByPk(userId);
            if (!user || !user.deviceTokens || user.deviceTokens.length === 0) {
                logger.warn(`User ${userId} has no device tokens registered`);
                return false;
            }

            const { challenger, gameType, challengeId } = challengeData;

            const message = {
                notification: {
                    title: 'Game Challenge!',
                    body: `${challenger.username} wants to play ${gameType} with you!`,
                },
                data: {
                    type: 'WAKE_UP',
                    challengeId,
                    challengerId: challenger.id,
                    challenger: challenger.username,
                    gameType,
                    timestamp: Date.now().toString(),
                },
                android: {
                    priority: 'high',
                    notification: {
                        priority: 'high',
                        channelId: 'handshake-wake-up',
                        sound: 'default',
                        defaultSound: true,
                        defaultVibrateTimings: true,
                        visibility: 'public',
                        tag: `challenge_${challengeId}`,
                    },
                    ttl: 30000,
                },
                apns: {
                    headers: {
                        'apns-priority': '10',
                        'apns-push-type': 'alert',
                    },
                    payload: {
                        aps: {
                            alert: {
                                title: 'Game Challenge!',
                                body: `${challenger.username} wants to play ${gameType} with you!`,
                            },
                            sound: 'default',
                            badge: 1,
                            'interruption-level': 'critical',
                            'content-available': 1,
                        },
                    },
                },
            };

            const invalidTokens = [];
            let successCount = 0;

            for (const token of user.deviceTokens) {
                try {
                    await messaging.send({ ...message, token });
                    successCount++;
                    logger.info(`✓ Notification sent to user ${userId} (token: ${token.substring(0, 20)}...)`);
                } catch (error) {
                    logger.error(`Failed to send notification to token ${token.substring(0, 20)}...:`, error.message);

                    if (
                        error.code === 'messaging/invalid-registration-token' ||
                        error.code === 'messaging/registration-token-not-registered'
                    ) {
                        invalidTokens.push(token);
                    }
                }
            }

            if (invalidTokens.length > 0) {
                logger.info(`Removing ${invalidTokens.length} invalid tokens for user ${userId}`);
                for (const token of invalidTokens) {
                    await user.removeDeviceToken(token);
                }
            }

            return successCount > 0;
        } catch (error) {
            logger.error(`Failed to send wake-up notification to user ${userId}:`, error);
            return false;
        }
    }

    async registerDeviceToken(userId, token) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error(`User ${userId} not found`);
            }

            await user.addDeviceToken(token);
            logger.info(`✓ Device token registered for user ${userId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to register device token for user ${userId}:`, error);
            throw error;
        }
    }

    async unregisterDeviceToken(userId, token) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error(`User ${userId} not found`);
            }

            await user.removeDeviceToken(token);
            logger.info(`✓ Device token unregistered for user ${userId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to unregister device token for user ${userId}:`, error);
            throw error;
        }
    }

    async sendNotification(userId, title, body, data = {}) {
        try {
            const messaging = getMessaging();
            if (!messaging) {
                logger.warn('Firebase messaging not configured');
                return false;
            }

            const user = await User.findByPk(userId);
            if (!user || !user.deviceTokens || user.deviceTokens.length === 0) {
                return false;
            }

            const message = {
                notification: { title, body },
                data: {
                    ...data,
                    timestamp: Date.now().toString(),
                },
                android: { priority: 'normal' },
                apns: {
                    payload: {
                        aps: {
                            alert: { title, body },
                            sound: 'default',
                        },
                    },
                },
            };

            let sent = false;
            for (const token of user.deviceTokens) {
                try {
                    await messaging.send({ ...message, token });
                    sent = true;
                } catch (error) {
                    logger.error(`Failed to send notification:`, error.message);
                }
            }

            return sent;
        } catch (error) {
            logger.error('Failed to send notification:', error);
            return false;
        }
    }
}

module.exports = new NotificationService();
