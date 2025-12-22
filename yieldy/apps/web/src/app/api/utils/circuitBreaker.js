import sql from './sql';
import { auditLog, AUDIT_ACTIONS } from './auditLogger';
import { log, logSecurityEvent } from './logger';
import { alertManager, SEVERITY, ALERT_TYPES, ALERT_TEMPLATES } from './alerting.js';

// =============================================================================
// Redis Client for Distributed Circuit Breaker
// =============================================================================

let redisClient = null;
let redisInitialized = false;

/**
 * Initialize Redis client for distributed circuit breaker
 * Falls back to in-memory storage if Redis is not available
 *
 * PRODUCTION REQUIREMENT: REDIS_URL must be set in production
 */
async function initRedis() {
  if (redisInitialized) return redisClient;

  const isProduction = process.env.NODE_ENV === 'production';

  if (process.env.REDIS_URL) {
    try {
      const { createClient } = await import('redis');
      redisClient = createClient({ url: process.env.REDIS_URL });
      redisClient.on('error', (err) => {
        log.error('Redis client error (circuit breaker)', { error: err.message });
      });
      await redisClient.connect();
      log.info('Circuit breaker: Using Redis for distributed failure tracking');
    } catch (error) {
      if (isProduction) {
        log.error('CRITICAL: Circuit breaker Redis connection failed in production', {
          error: error.message,
        });
        // In production, we should not silently fall back to in-memory
        // Log critical alert but continue with fallback to avoid complete failure
        await alertManager?.send({
          title: 'Redis Connection Failed',
          message: 'Circuit breaker falling back to in-memory storage',
          severity: SEVERITY.CRITICAL,
          type: ALERT_TYPES.INFRASTRUCTURE,
        }).catch(() => {});
      } else {
        log.warn('Circuit breaker: Redis connection failed, using in-memory fallback', {
          error: error.message,
        });
      }
      redisClient = null;
    }
  } else {
    if (isProduction) {
      log.error('CRITICAL: REDIS_URL not set in production - circuit breaker will not work across instances');
      // Alert on missing Redis in production
      console.error('================================================================================');
      console.error('PRODUCTION WARNING: REDIS_URL not configured');
      console.error('Circuit breaker will use in-memory storage - NOT SUITABLE FOR PRODUCTION');
      console.error('Set REDIS_URL environment variable to enable distributed circuit breaker');
      console.error('================================================================================');
    } else {
      log.warn('Circuit breaker: REDIS_URL not set, using in-memory storage (development mode)');
    }
  }

  redisInitialized = true;
  return redisClient;
}

// Initialize on module load
initRedis().catch(console.error);

const CIRCUIT_BREAKER_PREFIX = 'cb:failures:';

/**
 * Circuit Breaker Pattern Implementation
 * Automatically pauses agent operations when failure threshold is exceeded
 * Protects user funds from cascading failures
 *
 * DISTRIBUTED: Uses Redis for failure tracking across multiple instances
 * Falls back to in-memory storage if Redis is not available
 */
export class CircuitBreaker {
  constructor(config = {}) {
    this.threshold = config.threshold || parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 3;
    this.windowMs = config.windowMs || parseInt(process.env.CIRCUIT_BREAKER_WINDOW_MS) || 600000; // 10 minutes
    // In-memory fallback for development/single-instance
    this.localFailureCount = new Map();
  }

  /**
   * Record a failure
   * @param {string} key - Identifier for the operation (e.g., 'investment', 'scan:ethereum')
   * @param {object} context - Additional context about the failure
   */
  async recordFailure(key, context = {}) {
    let count;

    if (redisClient) {
      // Use Redis for distributed failure tracking
      const redisKey = `${CIRCUIT_BREAKER_PREFIX}${key}`;
      try {
        // Increment and set TTL atomically
        count = await redisClient.incr(redisKey);
        // Set expiry on first failure (window duration)
        if (count === 1) {
          await redisClient.expire(redisKey, Math.ceil(this.windowMs / 1000));
        }
      } catch (error) {
        log.error('Redis error in recordFailure, falling back to local', { error: error.message });
        // Fall back to local storage
        count = (this.localFailureCount.get(key) || 0) + 1;
        this.localFailureCount.set(key, count);
      }
    } else {
      // In-memory fallback
      count = (this.localFailureCount.get(key) || 0) + 1;
      this.localFailureCount.set(key, count);

      // Auto-reset counter after window (only for in-memory)
      setTimeout(() => {
        const current = this.localFailureCount.get(key) || 0;
        if (current > 0) {
          this.localFailureCount.set(key, current - 1);
        }
      }, this.windowMs);
    }

    log.warn(`Circuit breaker failure recorded: ${key} (${count}/${this.threshold})`, context);

    // Trip if threshold exceeded
    if (count >= this.threshold) {
      await this.trip(key, context);
    }
  }

  /**
   * Trip the circuit breaker - pause all agent operations
   * @param {string} reason - Why the breaker tripped
   * @param {object} context - Additional context
   */
  async trip(reason, context = {}) {
    logSecurityEvent('CIRCUIT_BREAKER_TRIPPED', { reason, ...context });

    try {
      // Ensure agent_config has emergency_pause column
      await ensureEmergencyColumns();

      // Set emergency pause flag
      await sql`
        UPDATE agent_config
        SET emergency_pause = true,
            pause_reason = ${reason},
            paused_at = NOW(),
            updated_at = NOW()
      `;

      // Audit log
      // Get current failure count for audit log
      let currentFailureCount = 0;
      if (redisClient) {
        try {
          currentFailureCount = parseInt(await redisClient.get(`${CIRCUIT_BREAKER_PREFIX}${reason}`)) || 0;
        } catch (e) {
          currentFailureCount = this.localFailureCount.get(reason) || 0;
        }
      } else {
        currentFailureCount = this.localFailureCount.get(reason) || 0;
      }

      await auditLog({
        user_id: 'system',
        action: AUDIT_ACTIONS.CIRCUIT_BREAKER_TRIGGERED,
        resource_type: 'system',
        metadata: {
          reason,
          context,
          threshold: this.threshold,
          failureCount: currentFailureCount,
        },
        success: true,
      });

      // Reset failure counters
      await this.clearFailureCounts();

      // Send critical alert via PagerDuty, Slack, Discord, Email
      await this.sendAlert({
        severity: 'CRITICAL',
        title: 'Circuit Breaker Triggered',
        message: `Agent operations paused due to: ${reason}`,
        context,
      });
    } catch (error) {
      log.error('Failed to trip circuit breaker', { error: error.message });
    }
  }

  /**
   * Check if circuit breaker is currently tripped
   * @returns {Promise<object>} - Status object with isPaused, reason, pausedAt
   */
  async isTripped() {
    try {
      const result = await sql`
        SELECT emergency_pause, pause_reason, paused_at
        FROM agent_config
        ORDER BY id DESC
        LIMIT 1
      `;

      if (!result || result.length === 0) {
        return { isPaused: false, reason: null, pausedAt: null };
      }

      return {
        isPaused: result[0].emergency_pause || false,
        reason: result[0].pause_reason || null,
        pausedAt: result[0].paused_at || null,
      };
    } catch (error) {
      log.error('Error checking circuit breaker', { error: error.message });
      // Fail safe: assume paused if we can't check
      return { isPaused: true, reason: 'Unable to verify status', pausedAt: null };
    }
  }

  /**
   * Reset the circuit breaker - resume operations
   * @param {string} resetBy - User/admin who reset the breaker
   */
  async reset(resetBy = 'admin') {
    try {
      log.info(`Circuit breaker reset by: ${resetBy}`);

      await sql`
        UPDATE agent_config
        SET emergency_pause = false,
            pause_reason = NULL,
            paused_at = NULL,
            updated_at = NOW()
      `;

      await auditLog({
        user_id: resetBy,
        action: AUDIT_ACTIONS.EMERGENCY_PAUSE_RELEASED,
        resource_type: 'system',
        metadata: {
          resetBy,
        },
        success: true,
      });

      // Clear failure counters
      await this.clearFailureCounts();

      await this.sendAlert({
        severity: 'INFO',
        title: 'Circuit Breaker Reset',
        message: `Agent operations resumed by ${resetBy}`,
      });
    } catch (error) {
      log.error('Failed to reset circuit breaker', { error: error.message });
      throw error;
    }
  }

  /**
   * Send alert notification via AlertManager
   * Supports PagerDuty, Slack, Discord, and Email
   * @param {object} alert - Alert details
   */
  async sendAlert(alert) {
    const { severity = 'CRITICAL', title, message, context = {} } = alert;

    try {
      // Use AlertManager for production-grade alerting
      const result = await alertManager.send({
        title: title || 'Circuit Breaker Alert',
        message: message || 'An alert was triggered by the circuit breaker',
        severity: severity === 'CRITICAL' ? SEVERITY.CRITICAL :
                 severity === 'INFO' ? SEVERITY.INFO : SEVERITY.HIGH,
        type: ALERT_TYPES.CIRCUIT_BREAKER,
        dedupeKey: `circuit-breaker-${title || 'generic'}`,
        context: {
          ...context,
          threshold: this.threshold,
          windowMs: this.windowMs,
        },
      });

      if (result.success) {
        log.info('Alert sent successfully', { title, channels: result.results?.filter(r => r.success).map(r => r.channel) });
      } else {
        log.warn('Some alert channels failed', { title, results: result.results });
      }

      return result;
    } catch (error) {
      // Fallback to logger if AlertManager fails
      log.error('ALERT - AlertManager failed', { alert, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all failure counters
   * Used when circuit breaker trips or is reset
   */
  async clearFailureCounts() {
    // Clear local counters
    this.localFailureCount.clear();

    // Clear Redis counters
    if (redisClient) {
      try {
        const keys = await redisClient.keys(`${CIRCUIT_BREAKER_PREFIX}*`);
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      } catch (error) {
        log.error('Failed to clear Redis failure counters', { error: error.message });
      }
    }
  }

  /**
   * Get failure statistics
   * @returns {Promise<object>} - Current failure counts
   */
  async getStats() {
    const stats = {};

    if (redisClient) {
      try {
        const keys = await redisClient.keys(`${CIRCUIT_BREAKER_PREFIX}*`);
        for (const key of keys) {
          const shortKey = key.replace(CIRCUIT_BREAKER_PREFIX, '');
          const count = parseInt(await redisClient.get(key)) || 0;
          const ttl = await redisClient.ttl(key);
          stats[shortKey] = {
            failures: count,
            threshold: this.threshold,
            willTripAt: Math.max(0, this.threshold - count),
            ttlSeconds: ttl,
          };
        }
      } catch (error) {
        log.error('Failed to get Redis stats, using local', { error: error.message });
        // Fall back to local stats
        for (const [key, count] of this.localFailureCount.entries()) {
          stats[key] = {
            failures: count,
            threshold: this.threshold,
            willTripAt: Math.max(0, this.threshold - count),
          };
        }
      }
    } else {
      // In-memory stats
      for (const [key, count] of this.localFailureCount.entries()) {
        stats[key] = {
          failures: count,
          threshold: this.threshold,
          willTripAt: Math.max(0, this.threshold - count),
        };
      }
    }

    return stats;
  }
}

/**
 * Ensure emergency_pause columns exist in agent_config
 */
async function ensureEmergencyColumns() {
  try {
    await sql`
      ALTER TABLE agent_config 
      ADD COLUMN IF NOT EXISTS emergency_pause BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS pause_reason TEXT,
      ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ
    `;
  } catch (error) {
    // Columns likely already exist
    console.debug('Emergency columns setup:', error.message);
  }
}

// Singleton instance
export const circuitBreaker = new CircuitBreaker();

/**
 * Check if operations are paused before executing
 * Middleware helper for routes
 * @param {Request} request
 * @param {object} options - Options for checking
 * @param {boolean} options.allowWithdrawals - Whether to allow withdrawals during pause
 * @returns {Response|null} - Error response if paused, null if ok to proceed
 */
export async function checkEmergencyPause(request, options = {}) {
  const { allowWithdrawals = true } = options;

  const status = await circuitBreaker.isTripped();

  if (status.isPaused) {
    // During emergency pause, we may allow certain operations
    const url = new URL(request.url);
    const isWithdrawal = url.pathname.includes('withdraw') || 
                        request.validated?.type === 'withdrawal';

    if (isWithdrawal && allowWithdrawals) {
      // Allow withdrawals even during pause (users can always exit)
      return null;
    }

    return new Response(
      JSON.stringify({
        error: 'Service temporarily paused',
        message: 'Agent operations are currently paused for safety',
        reason: status.reason,
        pausedAt: status.pausedAt,
        allowedOperations: allowWithdrawals ? ['withdrawals'] : [],
      }),
      {
        status: 503, // Service Unavailable
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '300', // Suggest retry in 5 minutes
        },
      }
    );
  }

  return null; // Not paused, proceed
}

