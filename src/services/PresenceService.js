const { redisClient } = require('../config/redis');
const RedisHelper = require('../utils/redisHelper');
const { REDIS_KEYS, DEFAULTS } = require('../utils/constants');
const logger = require('../utils/logger');

class PresenceService {
    constructor() {
        this.redis = new RedisHelper(redisClient);
    }

    _getPresenceKey(userId) {
        return `${REDIS_KEYS.PRESENCE}:${userId}`;
    }

    _getUserSocketKey(userId) {
        return `${REDIS_KEYS.USER_SOCKET}:${userId}`;
    }

    _getSocketKey(socketId) {
        return `${REDIS_KEYS.SOCKET}:${socketId}`;
    }

    async setUserOnline(userId, socketId) {
        try {
            await this.redis.addToSet(this._getUserSocketKey(userId), socketId);

            await redisClient.set(
                this._getSocketKey(socketId),
                userId,
                'EX',
                DEFAULTS.PRESENCE_TTL_SECONDS,
            );

            const connectionCount = await this.redis.getSetCount(
                this._getUserSocketKey(userId),
            );

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

    async setUserOffline(userId, socketId) {
        try {
            await this.redis.removeFromSet(this._getUserSocketKey(userId), socketId);

            await this.redis.delete(this._getSocketKey(socketId));

            const connectionCount = await this.redis.getSetCount(
                this._getUserSocketKey(userId),
            );

            if (connectionCount === 0) {
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

    async isUserOnline(userId) {
        try {
            const presence = await this.redis.getHash(this._getPresenceKey(userId));
            return presence.isOnline === 'true';
        } catch (error) {
            logger.error(`Failed to check if user ${userId} is online:`, error);
            return false;
        }
    }

    async getUserSockets(userId) {
        try {
            return await this.redis.getSetMembers(this._getUserSocketKey(userId));
        } catch (error) {
            logger.error(`Failed to get sockets for user ${userId}:`, error);
            return [];
        }
    }

    async getUserBySocket(socketId) {
        try {
            return await redisClient.get(this._getSocketKey(socketId));
        } catch (error) {
            logger.error(`Failed to get user for socket ${socketId}:`, error);
            return null;
        }
    }

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
