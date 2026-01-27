const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * JWT Authentication Middleware for REST API
 */
const authenticateJWT = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError('No token provided');
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user info to request
        req.user = {
            id: decoded.userId,
            username: decoded.username,
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(new UnauthorizedError('Invalid token'));
        }
        if (error.name === 'TokenExpiredError') {
            return next(new UnauthorizedError('Token expired'));
        }
        next(error);
    }
};

/**
 * Socket.IO Authentication Middleware
 */
const authenticateSocket = async (socket, next) => {
    try {
        // Get token from handshake query or auth object
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
            logger.warn(`Socket ${socket.id} connection rejected: No token provided`);
            return next(new Error('Authentication error: No token provided'));
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user info to socket
        socket.userId = decoded.userId;
        socket.username = decoded.username;

        logger.debug(`Socket ${socket.id} authenticated as user ${decoded.userId}`);
        next();
    } catch (error) {
        logger.warn(`Socket ${socket.id} authentication failed:`, error.message);

        if (error.name === 'JsonWebTokenError') {
            return next(new Error('Authentication error: Invalid token'));
        }
        if (error.name === 'TokenExpiredError') {
            return next(new Error('Authentication error: Token expired'));
        }

        next(new Error('Authentication error'));
    }
};

/**
 * Generate JWT token
 * @param {object} user - User object
 * @returns {string} - JWT token
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            username: user.username,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRATION || '7d',
        },
    );
};

module.exports = {
    authenticateJWT,
    authenticateSocket,
    generateToken,
};
