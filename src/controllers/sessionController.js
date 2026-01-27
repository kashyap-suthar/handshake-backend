const SessionService = require('../services/SessionService');

/**
 * Get session details
 */
const getSession = async (req, res, next) => {
    try {
        const { id: sessionId } = req.params;

        const session = await SessionService.getSession(sessionId);

        res.json({
            success: true,
            data: { session },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get active sessions for current user
 */
const getActiveSessions = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const sessions = await SessionService.getActiveSessions(userId);

        res.json({
            success: true,
            data: {
                sessions,
                count: sessions.length,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * End a session
 */
const endSession = async (req, res, next) => {
    try {
        const { id: sessionId } = req.params;
        const { state, metadata } = req.body;

        const session = await SessionService.endSession(sessionId, state, metadata);

        res.json({
            success: true,
            data: { session },
            message: 'Session ended successfully',
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSession,
    getActiveSessions,
    endSession,
};
