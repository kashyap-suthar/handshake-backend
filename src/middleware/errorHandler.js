const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    // Log error
    if (err.isOperational) {
        logger.warn(`Operational error: ${err.message}`);
    } else {
        logger.error('Unexpected error:', err);
    }

    // Default error values
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';
    let error = err;

    // Handle Sequelize errors
    if (err.name === 'SequelizeValidationError') {
        statusCode = 400;
        message = err.errors.map((e) => e.message).join(', ');
    } else if (err.name === 'SequelizeUniqueConstraintError') {
        statusCode = 409;
        message = 'Resource already exists';
    } else if (err.name === 'SequelizeForeignKeyConstraintError') {
        statusCode = 400;
        message = 'Invalid reference';
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    // Send error response
    const response = {
        success: false,
        error: message,
    };

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        error: `Route not found: ${req.method} ${req.path}`,
    });
};

module.exports = {
    errorHandler,
    notFoundHandler,
};
