const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

const createRateLimiter = (options = {}) => {
    const defaultOptions = {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: 'Too many requests, please try again later',
        handler: (req, res) => {
            logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
            res.status(429).json({
                success: false,
                error: 'Too many requests, please try again later',
            });
        },
        skip: (req) => {
            return process.env.NODE_ENV === 'test';
        },
    };

    try {
        return rateLimit({
            ...defaultOptions,
            ...options,
            store: new RedisStore({
                client: redisClient,
                prefix: 'rate_limit:',
            }),
        });
    } catch (error) {
        logger.warn('Failed to create Redis rate limiter, falling back to memory store');
        return rateLimit({
            ...defaultOptions,
            ...options,
        });
    }
};

const apiLimiter = createRateLimiter();

const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts, please try again later',
});

const challengeLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many challenges created, please slow down',
});

module.exports = {
    createRateLimiter,
    apiLimiter,
    authLimiter,
    challengeLimiter,
};
