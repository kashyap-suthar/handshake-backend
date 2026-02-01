require('dotenv').config();
const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('./utils/logger');

const { testConnection, syncDatabase, closeConnection } = require('./config/database');
const { testRedisConnection, closeRedisConnection } = require('./config/redis');
const { initializeFirebase } = require('./config/firebase');
const { initializeSocketIO } = require('./config/socket');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');

const authRoutes = require('./routes/auth.routes');
const challengeRoutes = require('./routes/challenges.routes');
const presenceRoutes = require('./routes/presence.routes');
const sessionRoutes = require('./routes/sessions.routes');
const userRoutes = require('./routes/users.routes');

const { setupHandshakeSocket } = require('./sockets/handshakeSocket');

const queueManager = require('./jobs/jobQueueManager');
const { closeQueues } = require('./jobs/queueConfig');

const app = express();
const server = http.createServer(app);

const API_VERSION = process.env.API_VERSION || 'v1';

app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/challenges`, apiLimiter, challengeRoutes);
app.use(`/api/${API_VERSION}/presence`, apiLimiter, presenceRoutes);
app.use(`/api/${API_VERSION}/sessions`, apiLimiter, sessionRoutes);
app.use(`/api/${API_VERSION}/users`, apiLimiter, userRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const io = initializeSocketIO(server);
setupHandshakeSocket(io);

const initializeApp = async () => {
    try {
        logger.info('🚀 Starting Handshake Backend...');

        const dbConnected = await testConnection();
        if (!dbConnected) {
            throw new Error('Failed to connect to PostgreSQL database');
        }

        await syncDatabase(false);

        const redisConnected = await testRedisConnection();
        if (!redisConnected) {
            throw new Error('Failed to connect to Redis');
        }

        initializeFirebase();

        await queueManager.scheduleCleanupJob();

        logger.info('✓ Application initialized successfully');
    } catch (error) {
        logger.error('✗ Failed to initialize application:', error);
        process.exit(1);
    }
};

const gracefulShutdown = async (signal) => {
    logger.info(`\n${signal} received, shutting down gracefully...`);

    server.close(async () => {
        logger.info('✓ HTTP server closed');

        try {
            io.close(() => {
                logger.info('✓ Socket.IO closed');
            });

            await closeQueues();
            await closeConnection();
            await closeRedisConnection();

            logger.info('✓ Graceful shutdown complete');
            process.exit(0);
        } catch (error) {
            logger.error('✗ Error during shutdown:', error);
            process.exit(1);
        }
    });

    setTimeout(() => {
        logger.error('⚠ Forcefully shutting down after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

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

module.exports = { app, server, io };
