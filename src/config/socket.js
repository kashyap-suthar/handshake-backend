const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { redisClient } = require('./redis');
const Redis = require('ioredis');
const logger = require('../utils/logger');

/**
 * Initialize Socket.IO server with Redis adapter
 * @param {object} httpServer - HTTP server instance
 * @returns {object} - Socket.IO instance
 */
const initializeSocketIO = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // Set up Redis adapter for horizontal scaling
    try {
        const pubClient = redisClient;
        const subClient = pubClient.duplicate();

        io.adapter(createAdapter(pubClient, subClient));
        logger.info('✓ Socket.IO Redis adapter configured');
    } catch (error) {
        logger.warn('⚠ Failed to configure Socket.IO Redis adapter, using default adapter:', error.message);
    }

    return io;
};

module.exports = {
    initializeSocketIO,
};
