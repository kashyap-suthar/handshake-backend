const Redis = require('ioredis');
const logger = require('./logger');
const { DEFAULTS } = require('./constants');

class RedisHelper {
    constructor(redisClient) {
        this.client = redisClient;
    }

    async acquireLock(key, ttl = DEFAULTS.LOCK_TTL_SECONDS) {
        try {
            const result = await this.client.set(key, '1', 'EX', ttl, 'NX');
            return result === 'OK';
        } catch (error) {
            logger.error(`Failed to acquire lock for ${key}:`, error);
            return false;
        }
    }

    async releaseLock(key) {
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error(`Failed to release lock for ${key}:`, error);
            return false;
        }
    }

    async withLock(lockKey, fn, ttl = DEFAULTS.LOCK_TTL_SECONDS) {
        const acquired = await this.acquireLock(lockKey, ttl);

        if (!acquired) {
            throw new Error(`Failed to acquire lock: ${lockKey}`);
        }

        try {
            return await fn();
        } finally {
            await this.releaseLock(lockKey);
        }
    }

    async setHash(key, data, ttl = null) {
        await this.client.hset(key, data);
        if (ttl) {
            await this.client.expire(key, ttl);
        }
    }

    async getHash(key) {
        return this.client.hgetall(key);
    }

    async delete(key) {
        return this.client.del(key);
    }

    async addToSet(key, members) {
        return this.client.sadd(key, members);
    }

    async removeFromSet(key, members) {
        return this.client.srem(key, members);
    }

    async getSetMembers(key) {
        return this.client.smembers(key);
    }

    async getSetCount(key) {
        return this.client.scard(key);
    }
}

module.exports = RedisHelper;
