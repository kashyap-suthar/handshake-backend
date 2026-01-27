const NotificationService = require('../services/NotificationService');
const PresenceService = require('../services/PresenceService');
const logger = require('../utils/logger');

/**
 * Register device token for push notifications
 */
const registerDevice = async (req, res, next) => {
    try {
        const { token, platform } = req.body;
        const userId = req.user.id;

        await NotificationService.registerDeviceToken(userId, token);

        logger.info(`Device token registered for user ${req.user.username} (platform: ${platform || 'unknown'})`);

        res.json({
            success: true,
            message: 'Device token registered successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Unregister device token
 */
const unregisterDevice = async (req, res, next) => {
    try {
        const { token } = req.body;
        const userId = req.user.id;

        await NotificationService.unregisterDeviceToken(userId, token);

        res.json({
            success: true,
            message: 'Device token unregistered successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Send heartbeat to keep presence alive
 * Alternative to WebSocket heartbeat for HTTP-only clients
 */
const heartbeat = async (req, res, next) => {
    try {
        const userId = req.user.id;

        await PresenceService.heartbeat(userId);

        res.json({
            success: true,
            timestamp: Date.now(),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get presence status for a user
 */
const getPresence = async (req, res, next) => {
    try {
        const { userId } = req.params;

        const presence = await PresenceService.getPresence(userId);

        res.json({
            success: true,
            data: { presence },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    registerDevice,
    unregisterDevice,
    heartbeat,
    getPresence,
};
