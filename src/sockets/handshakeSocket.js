const { authenticateSocket } = require('../middleware/auth');
const PresenceService = require('../services/PresenceService');
const HandshakeService = require('../services/HandshakeService');
const { SOCKET_EVENTS, HANDSHAKE_RESPONSE } = require('../utils/constants');
const logger = require('../utils/logger');

const setupHandshakeSocket = (io) => {
    HandshakeService.setSocketIO(io);

    io.use(authenticateSocket);

    io.on(SOCKET_EVENTS.CONNECTION, async (socket) => {
        const userId = socket.userId;
        const username = socket.username;

        logger.info(`🔌 Socket connected: ${socket.id} (User: ${username})`);

        try {
            await PresenceService.setUserOnline(userId, socket.id);

            socket.join(`user:${userId}`);
            logger.debug(`User ${username} joined room: user:${userId}`);

            socket.emit('connected', {
                success: true,
                userId,
                username,
                timestamp: Date.now(),
            });
        } catch (error) {
            logger.error(`Error in connection handler for user ${userId}:`, error);
        }

        socket.on(SOCKET_EVENTS.HEARTBEAT, async () => {
            try {
                await PresenceService.heartbeat(userId);
                socket.emit('heartbeat-ack', { timestamp: Date.now() });
            } catch (error) {
                logger.error(`Heartbeat error for user ${userId}:`, error);
            }
        });

        socket.on(SOCKET_EVENTS.CHALLENGE_RESPOND, async (data) => {
            try {
                const { challengeId, response } = data;

                logger.info(`📨 Challenge response from ${username}: ${response} for challenge ${challengeId}`);

                if (!Object.values(HANDSHAKE_RESPONSE).includes(response)) {
                    socket.emit(SOCKET_EVENTS.ERROR, {
                        error: 'Invalid response. Must be ACCEPT or DECLINE',
                    });
                    return;
                }

                const result = await HandshakeService.handleWakeUpResponse(
                    challengeId,
                    userId,
                    response,
                );

                socket.emit('challenge:respond-ack', {
                    success: true,
                    ...result,
                });
            } catch (error) {
                logger.error(`Error handling challenge response from ${username}:`, error);
                socket.emit(SOCKET_EVENTS.ERROR, {
                    error: error.message || 'Failed to process response',
                });
            }
        });

        socket.on(SOCKET_EVENTS.SESSION_JOIN, async (data) => {
            try {
                const { sessionId } = data;

                socket.join(`session:${sessionId}`);
                logger.info(`User ${username} joined session room: ${sessionId}`);

                socket.emit('session:join-ack', {
                    success: true,
                    sessionId,
                });
            } catch (error) {
                logger.error(`Error joining session for ${username}:`, error);
                socket.emit(SOCKET_EVENTS.ERROR, {
                    error: 'Failed to join session',
                });
            }
        });

        socket.on(SOCKET_EVENTS.SESSION_LEAVE, async (data) => {
            try {
                const { sessionId } = data;

                socket.leave(`session:${sessionId}`);
                logger.info(`User ${username} left session room: ${sessionId}`);

                socket.emit('session:leave-ack', {
                    success: true,
                    sessionId,
                });
            } catch (error) {
                logger.error(`Error leaving session for ${username}:`, error);
            }
        });

        socket.on(SOCKET_EVENTS.DISCONNECT, async (reason) => {
            logger.info(`🔌 Socket disconnected: ${socket.id} (User: ${username}, Reason: ${reason})`);

            try {
                await PresenceService.setUserOffline(userId, socket.id);
            } catch (error) {
                logger.error(`Error in disconnect handler for user ${userId}:`, error);
            }
        });

        socket.on('error', (error) => {
            logger.error(`Socket error for user ${userId}:`, error);
        });
    });

    io.engine.on('connection_error', (err) => {
        logger.error('Socket.IO connection error:', err);
    });

    logger.info('✓ Socket.IO handshake handlers configured');
};

module.exports = {
    setupHandshakeSocket,
};
