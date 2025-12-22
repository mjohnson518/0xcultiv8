/**
 * Background Job Queue using Bull.js
 *
 * Provides reliable async job processing for:
 * - Agent execution tasks
 * - Transaction monitoring
 * - Scheduled opportunity scans
 * - Email/notification delivery
 * - Data aggregation jobs
 *
 * REQUIRES: Redis connection (REDIS_URL environment variable)
 */

import { log } from './logger.js';

// =============================================================================
// Queue Configuration
// =============================================================================

const QUEUE_CONFIG = {
  // Default job options
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 seconds initial delay
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500, // Keep last 500 failed jobs for debugging
  },

  // Queue-specific settings
  queues: {
    agent: {
      name: 'agent-execution',
      concurrency: 2, // Limit concurrent agent runs
      limiter: {
        max: 10,
        duration: 60000, // 10 jobs per minute max
      },
    },
    transactions: {
      name: 'transaction-monitor',
      concurrency: 5,
    },
    scans: {
      name: 'opportunity-scan',
      concurrency: 3,
    },
    notifications: {
      name: 'notifications',
      concurrency: 10,
    },
    analytics: {
      name: 'analytics',
      concurrency: 2,
    },
  },
};

// =============================================================================
// Queue Manager Class
// =============================================================================

let Bull = null;
let queues = new Map();
let initialized = false;

/**
 * Initialize Bull.js and create queues
 */
async function initializeQueues() {
  if (initialized) return true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    log.warn('[JobQueue] REDIS_URL not configured - job queue disabled');
    return false;
  }

  try {
    // Dynamic import Bull.js
    const bullModule = await import('bull');
    Bull = bullModule.default;

    // Create queues
    for (const [key, config] of Object.entries(QUEUE_CONFIG.queues)) {
      const queue = new Bull(config.name, redisUrl, {
        defaultJobOptions: QUEUE_CONFIG.defaultJobOptions,
        limiter: config.limiter,
      });

      // Set up event handlers
      queue.on('completed', (job, result) => {
        log.debug(`[JobQueue] Job ${job.id} completed`, { queue: config.name, result });
      });

      queue.on('failed', (job, error) => {
        log.error(`[JobQueue] Job ${job.id} failed`, {
          queue: config.name,
          error: error.message,
          attempts: job.attemptsMade,
        });
      });

      queue.on('stalled', (job) => {
        log.warn(`[JobQueue] Job ${job.id} stalled`, { queue: config.name });
      });

      queues.set(key, queue);
    }

    initialized = true;
    log.info('[JobQueue] Queues initialized successfully');
    return true;
  } catch (error) {
    log.error('[JobQueue] Failed to initialize queues', { error: error.message });
    return false;
  }
}

// Initialize on module load
initializeQueues().catch(console.error);

// =============================================================================
// Job Types
// =============================================================================

export const JOB_TYPES = {
  // Agent jobs
  AGENT_EXECUTE: 'agent:execute',
  AGENT_ANALYZE: 'agent:analyze',

  // Transaction jobs
  TX_MONITOR: 'tx:monitor',
  TX_CONFIRM: 'tx:confirm',

  // Scan jobs
  SCAN_OPPORTUNITIES: 'scan:opportunities',
  SCAN_PROTOCOLS: 'scan:protocols',
  SCAN_RISKS: 'scan:risks',

  // Notification jobs
  NOTIFY_EMAIL: 'notify:email',
  NOTIFY_SLACK: 'notify:slack',
  NOTIFY_DISCORD: 'notify:discord',

  // Analytics jobs
  ANALYTICS_AGGREGATE: 'analytics:aggregate',
  ANALYTICS_REPORT: 'analytics:report',
};

// =============================================================================
// Queue Operations
// =============================================================================

/**
 * Add a job to the appropriate queue
 * @param {string} queueKey - Queue key (agent, transactions, scans, notifications, analytics)
 * @param {string} jobType - Job type from JOB_TYPES
 * @param {object} data - Job data
 * @param {object} options - Job options (delay, priority, etc.)
 * @returns {Promise<object>} - Job info
 */
export async function addJob(queueKey, jobType, data, options = {}) {
  if (!initialized) {
    await initializeQueues();
  }

  const queue = queues.get(queueKey);
  if (!queue) {
    log.error(`[JobQueue] Unknown queue: ${queueKey}`);
    // Fallback: execute synchronously if queue not available
    return { id: null, queued: false, reason: 'Queue not available' };
  }

  try {
    const job = await queue.add(jobType, data, {
      ...QUEUE_CONFIG.defaultJobOptions,
      ...options,
    });

    log.info(`[JobQueue] Job added`, {
      id: job.id,
      queue: queueKey,
      type: jobType,
    });

    return {
      id: job.id,
      queued: true,
      queue: queueKey,
      type: jobType,
    };
  } catch (error) {
    log.error(`[JobQueue] Failed to add job`, {
      queue: queueKey,
      type: jobType,
      error: error.message,
    });
    return { id: null, queued: false, error: error.message };
  }
}

/**
 * Add a delayed job
 */
export async function addDelayedJob(queueKey, jobType, data, delayMs) {
  return addJob(queueKey, jobType, data, { delay: delayMs });
}

/**
 * Add a repeating job (cron-style)
 */
export async function addRepeatingJob(queueKey, jobType, data, cronExpression) {
  return addJob(queueKey, jobType, data, {
    repeat: { cron: cronExpression },
    jobId: `${jobType}-recurring`, // Prevent duplicates
  });
}

/**
 * Get job status
 */
export async function getJobStatus(queueKey, jobId) {
  const queue = queues.get(queueKey);
  if (!queue) return null;

  try {
    const job = await queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return {
      id: job.id,
      state,
      data: job.data,
      progress: job.progress(),
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
    };
  } catch (error) {
    log.error(`[JobQueue] Failed to get job status`, { error: error.message });
    return null;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(queueKey) {
  const queue = queues.get(queueKey);
  if (!queue) return null;

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      queue: queueKey,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
    };
  } catch (error) {
    log.error(`[JobQueue] Failed to get queue stats`, { error: error.message });
    return null;
  }
}

/**
 * Get all queue statistics
 */
export async function getAllQueueStats() {
  const stats = {};
  for (const key of queues.keys()) {
    stats[key] = await getQueueStats(key);
  }
  return stats;
}

// =============================================================================
// Worker Registration
// =============================================================================

/**
 * Register a job processor
 * @param {string} queueKey - Queue key
 * @param {string} jobType - Job type to process
 * @param {function} processor - Async function to process job
 */
export function registerProcessor(queueKey, jobType, processor) {
  const queue = queues.get(queueKey);
  if (!queue) {
    log.error(`[JobQueue] Cannot register processor - queue not found: ${queueKey}`);
    return false;
  }

  const config = QUEUE_CONFIG.queues[queueKey];

  queue.process(jobType, config?.concurrency || 5, async (job) => {
    log.info(`[JobQueue] Processing job ${job.id}`, { type: jobType });

    try {
      const result = await processor(job.data, job);
      return result;
    } catch (error) {
      log.error(`[JobQueue] Job processor error`, {
        jobId: job.id,
        type: jobType,
        error: error.message,
      });
      throw error; // Bull will handle retries
    }
  });

  log.info(`[JobQueue] Registered processor for ${queueKey}:${jobType}`);
  return true;
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Graceful shutdown - close all queues
 */
export async function closeQueues() {
  log.info('[JobQueue] Shutting down queues...');

  for (const [key, queue] of queues) {
    try {
      await queue.close();
      log.debug(`[JobQueue] Closed queue: ${key}`);
    } catch (error) {
      log.error(`[JobQueue] Error closing queue ${key}`, { error: error.message });
    }
  }

  queues.clear();
  initialized = false;
  log.info('[JobQueue] All queues closed');
}

/**
 * Clean old jobs from queues
 * @param {number} gracePeriodMs - Keep jobs newer than this
 */
export async function cleanOldJobs(gracePeriodMs = 7 * 24 * 60 * 60 * 1000) {
  for (const [key, queue] of queues) {
    try {
      await queue.clean(gracePeriodMs, 'completed');
      await queue.clean(gracePeriodMs, 'failed');
      log.debug(`[JobQueue] Cleaned old jobs from ${key}`);
    } catch (error) {
      log.error(`[JobQueue] Error cleaning queue ${key}`, { error: error.message });
    }
  }
}

// =============================================================================
// Export convenience object
// =============================================================================

export const jobQueue = {
  addJob,
  addDelayedJob,
  addRepeatingJob,
  getJobStatus,
  getQueueStats,
  getAllQueueStats,
  registerProcessor,
  closeQueues,
  cleanOldJobs,
  JOB_TYPES,
  isInitialized: () => initialized,
};

export default jobQueue;
