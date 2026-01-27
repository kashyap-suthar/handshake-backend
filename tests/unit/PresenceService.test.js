const PresenceService = require('../../src/services/PresenceService');
const { redisClient } = require('../../src/config/redis');

// Mock Redis client
jest.mock('../../src/config/redis', () => ({
    redisClient: {
        set: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        expire: jest.fn(),
        sadd: jest.fn(),
        srem: jest.fn(),
        smembers: jest.fn(),
        scard: jest.fn(),
        hset: jest.fn(),
        hgetall: jest.fn(),
    },
    testRedisConnection: jest.fn().mockResolvedValue(true),
    closeRedisConnection: jest.fn().mockResolvedValue(undefined),
}));

describe('PresenceService', () => {
    const userId = 'user-123';
    const socketId = 'socket-abc';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('setUserOnline', () => {
        it('should set user online and update presence', async () => {
            redisClient.sadd.mockResolvedValue(1);
            redisClient.scard.mockResolvedValue(1);
            redisClient.set.mockResolvedValue('OK');
            redisClient.hset.mockResolvedValue(1);

            await PresenceService.setUserOnline(userId, socketId);

            expect(redisClient.sadd).toHaveBeenCalledWith(
                `user_socket:${userId}`,
                socketId,
            );
            expect(redisClient.set).toHaveBeenCalled();
            expect(redisClient.hset).toHaveBeenCalled();
        });

        it('should increment connection count for multiple devices', async () => {
            redisClient.sadd.mockResolvedValue(1);
            redisClient.scard.mockResolvedValue(2); // Second device
            redisClient.set.mockResolvedValue('OK');
            redisClient.hset.mockResolvedValue(1);

            await PresenceService.setUserOnline(userId, 'socket-xyz');

            expect(redisClient.scard).toHaveBeenCalled();
        });
    });

    describe('setUserOffline', () => {
        it('should set user offline when no more connections', async () => {
            redisClient.srem.mockResolvedValue(1);
            redisClient.scard.mockResolvedValue(0); // No more connections
            redisClient.del.mockResolvedValue(1);
            redisClient.hset.mockResolvedValue(1);

            await PresenceService.setUserOffline(userId, socketId);

            expect(redisClient.srem).toHaveBeenCalledWith(
                `user_socket:${userId}`,
                socketId,
            );
            expect(redisClient.hset).toHaveBeenCalledWith(
                `presence:${userId}`,
                expect.objectContaining({
                    isOnline: 'false',
                }),
            );
        });

        it('should keep user online if other connections exist', async () => {
            redisClient.srem.mockResolvedValue(1);
            redisClient.scard.mockResolvedValue(1); // Still has 1 connection
            redisClient.del.mockResolvedValue(1);
            redisClient.hset.mockResolvedValue(1);

            await PresenceService.setUserOffline(userId, socketId);

            expect(redisClient.hset).toHaveBeenCalledWith(
                `presence:${userId}`,
                expect.objectContaining({
                    connectionCount: '1',
                }),
            );
        });
    });

    describe('isUserOnline', () => {
        it('should return true when user is online', async () => {
            redisClient.hgetall.mockResolvedValue({
                isOnline: 'true',
                lastSeen: Date.now().toString(),
                connectionCount: '1',
            });

            const result = await PresenceService.isUserOnline(userId);

            expect(result).toBe(true);
        });

        it('should return false when user is offline', async () => {
            redisClient.hgetall.mockResolvedValue({
                isOnline: 'false',
                lastSeen: Date.now().toString(),
                connectionCount: '0',
            });

            const result = await PresenceService.isUserOnline(userId);

            expect(result).toBe(false);
        });
    });

    describe('getUserSockets', () => {
        it('should return all socket IDs for a user', async () => {
            const sockets = ['socket-1', 'socket-2', 'socket-3'];
            redisClient.smembers.mockResolvedValue(sockets);

            const result = await PresenceService.getUserSockets(userId);

            expect(result).toEqual(sockets);
            expect(redisClient.smembers).toHaveBeenCalledWith(`user_socket:${userId}`);
        });
    });

    describe('heartbeat', () => {
        it('should refresh presence TTL and update lastSeen', async () => {
            redisClient.exists.mockResolvedValue(1);
            redisClient.expire.mockResolvedValue(1);
            redisClient.hset.mockResolvedValue(1);

            await PresenceService.heartbeat(userId);

            expect(redisClient.expire).toHaveBeenCalledWith(`presence:${userId}`, 60);
            expect(redisClient.hset).toHaveBeenCalled();
        });

        it('should not update if presence does not exist', async () => {
            redisClient.exists.mockResolvedValue(0);

            await PresenceService.heartbeat(userId);

            expect(redisClient.expire).not.toHaveBeenCalled();
        });
    });
});
