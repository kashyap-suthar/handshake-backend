const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Create rate limiter with Redis store for distributed rate limiting
 */
const createRateLimiter = (options = {}) => {
    const defaultOptions = {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100, // 100 requests per window
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
            // Skip rate limiting in test environment
            return process.env.NODE_ENV === 'test';
        },
    };

    // Use Redis store if available
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

// Default rate limiter for general API endpoints
const apiLimiter = createRateLimiter();

// Stricter rate limiter for authentication endpoints
const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many authentication attempts, please try again later',
});

// Rate limiter for challenge creation
const challengeLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 challenges per minute
    message: 'Too many challenges created, please slow down',
});

module.exports = {
    createRateLimiter,
    apiLimiter,
    authLimiter,
    challengeLimiter,
};
