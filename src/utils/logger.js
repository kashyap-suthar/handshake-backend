const winston = require('winston');
require('winston-daily-rotate-file');

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
    if (stack) {
        return `${ts} [${level}]: ${message}\n${stack}`;
    }
    return `${ts} [${level}]: ${message}`;
});

// File rotation transport
const fileRotateTransport = new winston.transports.DailyRotateFile({
    filename: `${process.env.LOG_FILE_PATH || './logs'}/handshake-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat,
    ),
});

// Console transport with colors
const consoleTransport = new winston.transports.Console({
    format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat,
    ),
});

// Create logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
        fileRotateTransport,
        consoleTransport,
    ],
    exitOnError: false,
});

// Export logger
module.exports = logger;
