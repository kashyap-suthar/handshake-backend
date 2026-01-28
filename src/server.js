require('dotenv').config();
const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('./utils/logger');

// Import configurations
const { testConnection, syncDatabase, closeConnection } = require('./config/database');
const { testRedisConnection, closeRedisConnection } = require('./config/redis');
const { initializeFirebase } = require('./config/firebase');
const { initializeSocketIO } = require('./config/socket');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');

// Import routes
const authRoutes = require('./routes/auth.routes');
const challengeRoutes = require('./routes/challenges.routes');
const presenceRoutes = require('./routes/presence.routes');
const sessionRoutes = require('./routes/sessions.routes');
const userRoutes = require('./routes/users.routes');

// Import socket handlers
const { setupHandshakeSocket } = require('./sockets/handshakeSocket');

// Import job queue manager
const queueManager = require('./jobs/jobQueueManager');
const { closeQueues } = require('./jobs/queueConfig');

// Create Express app
const app = express();
const server = http.createServer(app);

// Get API version from env or default to v1
const API_VERSION = process.env.API_VERSION || 'v1';

/**
 * Middleware setup
 */
app.use(helmet()); // Security headers
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
}));
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

/**
 * API routes
 */
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/challenges`, apiLimiter, challengeRoutes);
app.use(`/api/${API_VERSION}/presence`, apiLimiter, presenceRoutes);
app.use(`/api/${API_VERSION}/sessions`, apiLimiter, sessionRoutes);
app.use(`/api/${API_VERSION}/users`, apiLimiter, userRoutes);

/**
 * 404 handler
 */
app.use(notFoundHandler);

/**
 * Error handler (must be last)
 */
app.use(errorHandler);

/**
 * Initialize Socket.IO
 */
const io = initializeSocketIO(server);
setupHandshakeSocket(io);

/**
 * Initialize application
 */
const initializeApp = async () => {
    try {
        logger.info('🚀 Starting Handshake Backend...');

        // Test database connection
        const dbConnected = await testConnection();
        if (!dbConnected) {
            throw new Error('Failed to connect to PostgreSQL database');
        }

        // Sync database (create tables if they don't exist)
        await syncDatabase(false); // Set to true to force drop/recreate tables

        // Test Redis connection
        const redisConnected = await testRedisConnection();
        if (!redisConnected) {
            throw new Error('Failed to connect to Redis');
        }

        // Initialize Firebase (optional - won't throw if credentials missing)
        initializeFirebase();

        // Schedule recurring cleanup job
        await queueManager.scheduleCleanupJob();

        logger.info('✓ Application initialized successfully');
    } catch (error) {
        logger.error('✗ Failed to initialize application:', error);
        process.exit(1);
    }
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal) => {
    logger.info(`\n${signal} received, shutting down gracefully...`);

    // Close HTTP server (stop accepting new connections)
    server.close(async () => {
        logger.info('✓ HTTP server closed');

        try {
            // Close Socket.IO
            io.close(() => {
                logger.info('✓ Socket.IO closed');
            });

            // Close job queues
            await closeQueues();

            // Close database connection
            await closeConnection();

            // Close Redis connection
            await closeRedisConnection();

            logger.info('✓ Graceful shutdown complete');
            process.exit(0);
        } catch (error) {
            logger.error('✗ Error during shutdown:', error);
            process.exit(1);
        }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        logger.error('⚠ Forcefully shutting down after timeout');
        process.exit(1);
    }, 10000);
};

/**
 * Process event handlers
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

/**
 * Start server
 */
const PORT = process.env.PORT || 3000;

initializeApp().then(() => {
    server.listen(PORT, () => {
        logger.info(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🎮  Handshake Backend Server Running                  ║
║                                                          ║
║   📡  HTTP Server: http://localhost:${PORT}               ║
║   🔌  WebSocket: ws://localhost:${PORT}                  ║
║   📊  API Version: ${API_VERSION}                               ║
║   🌍  Environment: ${process.env.NODE_ENV || 'development'}                    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);
    });
});

// Export for testing
module.exports = { app, server, io };
