const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
    if (err.isOperational) {
        logger.warn(`Operational error: ${err.message}`);
    } else {
        logger.error('Unexpected error:', err);
    }

    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';
    let error = err;

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

    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    const response = {
        success: false,
        error: message,
    };

    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
};

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
