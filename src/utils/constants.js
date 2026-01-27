/**
 * Application constants and enums
 */

const CHALLENGE_STATES = {
    PENDING: 'PENDING',
    NOTIFYING: 'NOTIFYING',
    WAITING_RESPONSE: 'WAITING_RESPONSE',
    ACTIVE: 'ACTIVE',
    DECLINED: 'DECLINED',
    TIMEOUT: 'TIMEOUT',
    EXPIRED: 'EXPIRED',
};

const SESSION_STATES = {
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
    ABANDONED: 'ABANDONED',
};

const HANDSHAKE_RESPONSE = {
    ACCEPT: 'ACCEPT',
    DECLINE: 'DECLINE',
};

// Valid state transitions for challenges
const CHALLENGE_STATE_TRANSITIONS = {
    [CHALLENGE_STATES.PENDING]: [CHALLENGE_STATES.NOTIFYING, CHALLENGE_STATES.EXPIRED],
    [CHALLENGE_STATES.NOTIFYING]: [CHALLENGE_STATES.WAITING_RESPONSE],
    [CHALLENGE_STATES.WAITING_RESPONSE]: [
        CHALLENGE_STATES.ACTIVE,
        CHALLENGE_STATES.DECLINED,
        CHALLENGE_STATES.TIMEOUT,
    ],
    [CHALLENGE_STATES.ACTIVE]: [CHALLENGE_STATES.ACTIVE], // No transitions once active
    [CHALLENGE_STATES.DECLINED]: [],
    [CHALLENGE_STATES.TIMEOUT]: [],
    [CHALLENGE_STATES.EXPIRED]: [],
};

// Socket events
const SOCKET_EVENTS = {
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    HEARTBEAT: 'heartbeat',
    CHALLENGE_WAKE_UP: 'challenge:wake-up',
    CHALLENGE_RESPOND: 'challenge:respond',
    CHALLENGE_DECLINED: 'challenge:declined',
    CHALLENGE_TIMEOUT: 'challenge:timeout',
    SESSION_READY: 'session:ready',
    SESSION_JOIN: 'session:join',
    SESSION_LEAVE: 'session:leave',
    ERROR: 'error',
};

// Job queue names
const JOB_QUEUES = {
    HANDSHAKE_TIMEOUT: 'handshake-timeout',
    CHALLENGE_CLEANUP: 'challenge-cleanup',
    NOTIFICATION_RETRY: 'notification-retry',
};

// Redis key prefixes
const REDIS_KEYS = {
    PRESENCE: 'presence',
    CHALLENGE: 'challenge',
    SESSION: 'session',
    SOCKET: 'socket',
    USER_SOCKET: 'user_socket',
    LOCK: 'lock',
};

// Default values
const DEFAULTS = {
    CHALLENGE_EXPIRATION_SECONDS: parseInt(process.env.CHALLENGE_EXPIRATION_SECONDS, 10) || 3600,
    HANDSHAKE_TIMEOUT_SECONDS: parseInt(process.env.HANDSHAKE_TIMEOUT_SECONDS, 10) || 30,
    MAX_RETRY_ATTEMPTS: parseInt(process.env.MAX_RETRY_ATTEMPTS, 10) || 3,
    HEARTBEAT_INTERVAL_SECONDS: 30,
    PRESENCE_TTL_SECONDS: 60,
    LOCK_TTL_SECONDS: 10,
};

module.exports = {
    CHALLENGE_STATES,
    SESSION_STATES,
    HANDSHAKE_RESPONSE,
    CHALLENGE_STATE_TRANSITIONS,
    SOCKET_EVENTS,
    JOB_QUEUES,
    REDIS_KEYS,
    DEFAULTS,
};
