const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB || 0,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
});

redisClient.on('connect', () => {
    logger.info('✓ Redis client connecting...');
});

redisClient.on('ready', () => {
    logger.info('✓ Redis client ready');
});

redisClient.on('error', (err) => {
    logger.error('✗ Redis client error:', err);
});

redisClient.on('close', () => {
    logger.info('✓ Redis connection closed');
});

redisClient.on('reconnecting', () => {
    logger.warn('⚠ Redis client reconnecting...');
});

const testRedisConnection = async () => {
    try {
        await redisClient.ping();
        logger.info('✓ Redis connection established successfully');
        return true;
    } catch (error) {
        logger.error('✗ Unable to connect to Redis:', error);
        return false;
    }
};

const closeRedisConnection = async () => {
    try {
        await redisClient.quit();
        logger.info('✓ Redis connection closed gracefully');
    } catch (error) {
        logger.error('✗ Error closing Redis connection:', error);
    }
};

module.exports = {
    redisClient,
    testRedisConnection,
    closeRedisConnection,
};
