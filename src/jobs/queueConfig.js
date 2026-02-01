const Bull = require('bull');
const { redisClient } = require('../config/redis');
const { JOB_QUEUES } = require('../utils/constants');
const logger = require('../utils/logger');

const createQueue = (name, options = {}) => {
    const defaultOptions = {
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: process.env.REDIS_DB || 0,
        },
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
            removeOnComplete: 100,
            removeOnFail: 500,
        },
    };

    const queue = new Bull(name, { ...defaultOptions, ...options });

    queue.on('error', (error) => {
        logger.error(`Queue ${name} error:`, error);
    });

    queue.on('failed', (job, error) => {
        logger.error(`Job ${job.id} failed in queue ${name}:`, error);
    });

    queue.on('completed', (job) => {
        logger.debug(`Job ${job.id} completed in queue ${name}`);
    });

    logger.info(`✓ Queue ${name} initialized`);

    return queue;
};

const timeoutQueue = createQueue(JOB_QUEUES.HANDSHAKE_TIMEOUT);
const cleanupQueue = createQueue(JOB_QUEUES.CHALLENGE_CLEANUP);

const closeQueues = async () => {
    logger.info('Closing job queues...');
    await Promise.all([
        timeoutQueue.close(),
        cleanupQueue.close(),
    ]);
    logger.info('✓ All queues closed');
};

module.exports = {
    createQueue,
    timeoutQueue,
    cleanupQueue,
    closeQueues,
};
