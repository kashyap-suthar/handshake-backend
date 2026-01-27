const { timeoutQueue, cleanupQueue } = require('./queueConfig');
const HandshakeService = require('../services/HandshakeService');
const ChallengeService = require('../services/ChallengeService');
const { DEFAULTS } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Job Queue Manager - Manage all background jobs
 */
class JobQueueManager {
    constructor() {
        this.setupProcessors();
    }

    /**
     * Set up job processors
     */
    setupProcessors() {
        // Timeout job processor
        timeoutQueue.process(async (job) => {
            const { challengeId, attemptNumber } = job.data;

            logger.info(`Processing timeout job for challenge ${challengeId} (attempt ${attemptNumber})`);

            try {
                await HandshakeService.handleTimeout(challengeId, attemptNumber);
                return { success: true, challengeId, attemptNumber };
            } catch (error) {
                logger.error(`Timeout job failed for challenge ${challengeId}:`, error);
                throw error;
            }
        });

        // Cleanup job processor
        cleanupQueue.process(async (job) => {
            logger.info('Processing challenge cleanup job');

            try {
                // Mark expired challenges
                const expiredCount = await ChallengeService.markExpiredChallenges();

                // Delete old challenges (older than 30 days)
                const deletedCount = await ChallengeService.deleteOldChallenges(30);

                logger.info(`Cleanup completed: ${expiredCount} expired, ${deletedCount} deleted`);

                return {
                    success: true,
                    expiredCount,
                    deletedCount,
                };
            } catch (error) {
                logger.error('Cleanup job failed:', error);
                throw error;
            }
        });

        logger.info('✓ Job processors configured');
    }

    /**
     * Schedule timeout job for a challenge
     * @param {string} challengeId - Challenge ID
     * @param {number} attemptNumber - Attempt number
     */
    async scheduleTimeoutJob(challengeId, attemptNumber) {
        try {
            const delay = DEFAULTS.HANDSHAKE_TIMEOUT_SECONDS * 1000; // Convert to milliseconds

            await timeoutQueue.add(
                {
                    challengeId,
                    attemptNumber,
                },
                {
                    delay,
                    jobId: `timeout-${challengeId}-${attemptNumber}`,
                    removeOnComplete: true,
                },
            );

            logger.debug(`Scheduled timeout job for challenge ${challengeId} (attempt ${attemptNumber}, delay ${delay}ms)`);
        } catch (error) {
            logger.error(`Failed to schedule timeout job for challenge ${challengeId}:`, error);
            throw error;
        }
    }

    /**
     * Cancel timeout job for a challenge
     * @param {string} challengeId - Challenge ID
     * @param {number} attemptNumber - Attempt number
     */
    async cancelTimeoutJob(challengeId, attemptNumber) {
        try {
            const jobId = `timeout-${challengeId}-${attemptNumber}`;
            const job = await timeoutQueue.getJob(jobId);

            if (job) {
                await job.remove();
                logger.debug(`Cancelled timeout job ${jobId}`);
                return true;
            }

            return false;
        } catch (error) {
            logger.error(`Failed to cancel timeout job for challenge ${challengeId}:`, error);
            return false;
        }
    }

    /**
     * Schedule recurring cleanup job
     * Schedule to run every 5 minutes
     */
    async scheduleCleanupJob() {
        try {
            // Add repeatable job (cron-like)
            await cleanupQueue.add(
                {},
                {
                    repeat: {
                        cron: '*/5 * * * *', // Every 5 minutes
                    },
                    jobId: 'challenge-cleanup',
                },
            );

            logger.info('✓ Scheduled recurring cleanup job (every 5 minutes)');
        } catch (error) {
            logger.error('Failed to schedule cleanup job:', error);
        }
    }

    /**
     * Get queue statistics
     */
    async getStats() {
        try {
            const [timeoutCounts, cleanupCounts] = await Promise.all([
                timeoutQueue.getJobCounts(),
                cleanupQueue.getJobCounts(),
            ]);

            return {
                timeout: timeoutCounts,
                cleanup: cleanupCounts,
            };
        } catch (error) {
            logger.error('Failed to get queue stats:', error);
            return null;
        }
    }
}

// Export singleton instance
const queueManager = new JobQueueManager();

// Inject queue manager into HandshakeService
HandshakeService.setQueueManager(queueManager);

module.exports = queueManager;
