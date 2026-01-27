const { redisClient } = require('../config/redis');
const RedisHelper = require('../utils/redisHelper');
const { REDIS_KEYS, DEFAULTS } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Presence Service - Track user online/offline status and multi-device support
 */
class PresenceService {
    constructor() {
        this.redis = new RedisHelper(redisClient);
    }

    /**
     * Get presence key for a user
     * @param {string} userId - User ID
     * @returns {string} - Redis key
     */
    _getPresenceKey(userId) {
        return `${REDIS_KEYS.PRESENCE}:${userId}`;
    }

    /**
     * Get user socket set key
     * @param {string} userId - User ID
     * @returns {string} - Redis key
     */
    _getUserSocketKey(userId) {
        return `${REDIS_KEYS.USER_SOCKET}:${userId}`;
    }

    /**
     * Get socket to user mapping key
     * @param {string} socketId - Socket ID
     * @returns {string} - Redis key
     */
    _getSocketKey(socketId) {
        return `${REDIS_KEYS.SOCKET}:${socketId}`;
    }

    /**
     * Set user online
     * @param {string} userId - User ID
     * @param {string} socketId - Socket ID
     */
    async setUserOnline(userId, socketId) {
        try {
            // Add socket to user's socket set
            await this.redis.addToSet(this._getUserSocketKey(userId), socketId);

            // Store socket to user mapping
            await redisClient.set(
                this._getSocketKey(socketId),
                userId,
                'EX',
                DEFAULTS.PRESENCE_TTL_SECONDS,
            );

            // Get connection count
            const connectionCount = await this.redis.getSetCount(
                this._getUserSocketKey(userId),
            );

            // Update presence hash
            await this.redis.setHash(
                this._getPresenceKey(userId),
                {
                    isOnline: 'true',
                    lastSeen: Date.now().toString(),
                    connectionCount: connectionCount.toString(),
                },
                DEFAULTS.PRESENCE_TTL_SECONDS,
            );

            logger.debug(`User ${userId} is now online (connections: ${connectionCount})`);
        } catch (error) {
            logger.error(`Failed to set user ${userId} online:`, error);
            throw error;
        }
    }

    /**
     * Set user offline (called when socket disconnects)
     * @param {string} userId - User ID
     * @param {string} socketId - Socket ID
     */
    async setUserOffline(userId, socketId) {
        try {
            // Remove socket from user's socket set
            await this.redis.removeFromSet(this._getUserSocketKey(userId), socketId);

            // Remove socket to user mapping
            await this.redis.delete(this._getSocketKey(socketId));

            // Get remaining connection count
            const connectionCount = await this.redis.getSetCount(
                this._getUserSocketKey(userId),
            );

            if (connectionCount === 0) {
                // No more connections, set user offline
                await this.redis.setHash(
                    this._getPresenceKey(userId),
                    {
                        isOnline: 'false',
                        lastSeen: Date.now().toString(),
                        connectionCount: '0',
                    },
                    DEFAULTS.PRESENCE_TTL_SECONDS,
                );
                logger.debug(`User ${userId} is now offline`);
            } else {
                // Still has other connections
                await this.redis.setHash(
                    this._getPresenceKey(userId),
                    {
                        connectionCount: connectionCount.toString(),
                    },
                    DEFAULTS.PRESENCE_TTL_SECONDS,
                );
                logger.debug(`User ${userId} still online (connections: ${connectionCount})`);
            }
        } catch (error) {
            logger.error(`Failed to set user ${userId} offline:`, error);
            throw error;
        }
    }

    /**
     * Check if user is online
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} - True if online
     */
    async isUserOnline(userId) {
        try {
            const presence = await this.redis.getHash(this._getPresenceKey(userId));
            return presence.isOnline === 'true';
        } catch (error) {
            logger.error(`Failed to check if user ${userId} is online:`, error);
            return false;
        }
    }

    /**
     * Get all socket IDs for a user (multi-device support)
     * @param {string} userId - User ID
     * @returns {Promise<string[]>} - Array of socket IDs
     */
    async getUserSockets(userId) {
        try {
            return await this.redis.getSetMembers(this._getUserSocketKey(userId));
        } catch (error) {
            logger.error(`Failed to get sockets for user ${userId}:`, error);
            return [];
        }
    }

    /**
     * Get user ID from socket ID
     * @param {string} socketId - Socket ID
     * @returns {Promise<string|null>} - User ID or null
     */
    async getUserBySocket(socketId) {
        try {
            return await redisClient.get(this._getSocketKey(socketId));
        } catch (error) {
            logger.error(`Failed to get user for socket ${socketId}:`, error);
            return null;
        }
    }

    /**
     * Refresh user presence (heartbeat)
     * @param {string} userId - User ID
     */
    async heartbeat(userId) {
        try {
            const presenceKey = this._getPresenceKey(userId);
            const exists = await redisClient.exists(presenceKey);

            if (exists) {
                await redisClient.expire(presenceKey, DEFAULTS.PRESENCE_TTL_SECONDS);
                await this.redis.setHash(presenceKey, {
                    lastSeen: Date.now().toString(),
                });
                logger.debug(`Heartbeat received from user ${userId}`);
            }
        } catch (error) {
            logger.error(`Failed to process heartbeat for user ${userId}:`, error);
        }
    }

    /**
     * Get presence info for a user
     * @param {string} userId - User ID
     * @returns {Promise<object>} - Presence data
     */
    async getPresence(userId) {
        try {
            const presence = await this.redis.getHash(this._getPresenceKey(userId));
            return {
                isOnline: presence.isOnline === 'true',
                lastSeen: presence.lastSeen ? parseInt(presence.lastSeen, 10) : null,
                connectionCount: parseInt(presence.connectionCount || '0', 10),
            };
        } catch (error) {
            logger.error(`Failed to get presence for user ${userId}:`, error);
            return { isOnline: false, lastSeen: null, connectionCount: 0 };
        }
    }
}

module.exports = new PresenceService();
