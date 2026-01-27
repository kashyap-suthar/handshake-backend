const Redis = require('ioredis');
const logger = require('./logger');
const { DEFAULTS } = require('./constants');

/**
 * Redis helper utilities for distributed locking and common operations
 */

class RedisHelper {
    constructor(redisClient) {
        this.client = redisClient;
    }

    /**
     * Acquire a distributed lock
     * @param {string} key - Lock key
     * @param {number} ttl - Time to live in seconds (default: 10s)
     * @returns {Promise<boolean>} - True if lock acquired, false otherwise
     */
    async acquireLock(key, ttl = DEFAULTS.LOCK_TTL_SECONDS) {
        try {
            const result = await this.client.set(key, '1', 'EX', ttl, 'NX');
            return result === 'OK';
        } catch (error) {
            logger.error(`Failed to acquire lock for ${key}:`, error);
            return false;
        }
    }

    /**
     * Release a distributed lock
     * @param {string} key - Lock key
     * @returns {Promise<boolean>} - True if lock released
     */
    async releaseLock(key) {
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error(`Failed to release lock for ${key}:`, error);
            return false;
        }
    }

    /**
     * Execute a function with a distributed lock
     * @param {string} lockKey - Lock key
     * @param {Function} fn - Function to execute
     * @param {number} ttl - Lock TTL in seconds
     * @returns {Promise<any>} - Result of the function
     */
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

    /**
     * Set a hash value in Redis
     * @param {string} key - Redis key
     * @param {object} data - Data to store
     * @param {number} ttl - TTL in seconds (optional)
     */
    async setHash(key, data, ttl = null) {
        await this.client.hset(key, data);
        if (ttl) {
            await this.client.expire(key, ttl);
        }
    }

    /**
     * Get all hash values
     * @param {string} key - Redis key
     * @returns {Promise<object>} - Hash data
     */
    async getHash(key) {
        return this.client.hgetall(key);
    }

    /**
     * Delete a key
     * @param {string} key - Redis key
     */
    async delete(key) {
        return this.client.del(key);
    }

    /**
     * Add to a set
     * @param {string} key - Redis key
     * @param {string|string[]} members - Members to add
     */
    async addToSet(key, members) {
        return this.client.sadd(key, members);
    }

    /**
     * Remove from a set
     * @param {string} key - Redis key
     * @param {string|string[]} members - Members to remove
     */
    async removeFromSet(key, members) {
        return this.client.srem(key, members);
    }

    /**
     * Get all set members
     * @param {string} key - Redis key
     * @returns {Promise<string[]>} - Set members
     */
    async getSetMembers(key) {
        return this.client.smembers(key);
    }

    /**
     * Get set count
     * @param {string} key - Redis key
     * @returns {Promise<number>} - Number of members
     */
    async getSetCount(key) {
        return this.client.scard(key);
    }
}

module.exports = RedisHelper;
