import sql from './sql';
import { auditLog, AUDIT_ACTIONS } from './auditLogger';

/**
 * Circuit Breaker Pattern Implementation
 * Automatically pauses agent operations when failure threshold is exceeded
 * Protects user funds from cascading failures
 */
export class CircuitBreaker {
  constructor(config = {}) {
    this.threshold = config.threshold || parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 3;
    this.windowMs = config.windowMs || parseInt(process.env.CIRCUIT_BREAKER_WINDOW_MS) || 600000; // 10 minutes
    this.failureCount = new Map();
  }

  /**
   * Record a failure
   * @param {string} key - Identifier for the operation (e.g., 'investment', 'scan:ethereum')
   * @param {object} context - Additional context about the failure
   */
  async recordFailure(key, context = {}) {
    const count = (this.failureCount.get(key) || 0) + 1;
    this.failureCount.set(key, count);

    console.warn(`⚠️ Circuit breaker failure recorded: ${key} (${count}/${this.threshold})`, context);

    // Trip if threshold exceeded
    if (count >= this.threshold) {
      await this.trip(key, context);
    }

    // Auto-reset counter after window
    setTimeout(() => {
      const current = this.failureCount.get(key) || 0;
      if (current > 0) {
        this.failureCount.set(key, current - 1);
      }
    }, this.windowMs);
  }

  /**
   * Trip the circuit breaker - pause all agent operations
   * @param {string} reason - Why the breaker tripped
   * @param {object} context - Additional context
   */
  async trip(reason, context = {}) {
    console.error(`🔴 CIRCUIT BREAKER TRIPPED: ${reason}`, context);

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
      await auditLog({
        user_id: 'system',
        action: AUDIT_ACTIONS.CIRCUIT_BREAKER_TRIGGERED,
        resource_type: 'system',
        metadata: {
          reason,
          context,
          threshold: this.threshold,
          failureCount: this.failureCount.get(reason),
        },
        success: true,
      });

      // Reset failure counter
      this.failureCount.clear();

      // TODO: Send alert to admin (email, Slack, etc.)
      await this.sendAlert({
        severity: 'CRITICAL',
        title: 'Circuit Breaker Triggered',
        message: `Agent operations paused due to: ${reason}`,
        context,
      });
    } catch (error) {
      console.error('Failed to trip circuit breaker:', error);
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
      console.error('Error checking circuit breaker:', error);
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
      console.log(`✅ Circuit breaker reset by: ${resetBy}`);

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
      this.failureCount.clear();

      await this.sendAlert({
        severity: 'INFO',
        title: 'Circuit Breaker Reset',
        message: `Agent operations resumed by ${resetBy}`,
      });
    } catch (error) {
      console.error('Failed to reset circuit breaker:', error);
      throw error;
    }
  }

  /**
   * Send alert notification
   * @param {object} alert - Alert details
   */
  async sendAlert(alert) {
    // TODO: Implement actual alerting (email, Slack, Discord, etc.)
    console.log('🚨 ALERT:', alert);

    // For now, just log to console
    // In production, integrate with:
    // - SendGrid/AWS SES for email
    // - Slack webhook
    // - Discord webhook
    // - PagerDuty for critical alerts
  }

  /**
   * Get failure statistics
   * @returns {object} - Current failure counts
   */
  getStats() {
    const stats = {};
    for (const [key, count] of this.failureCount.entries()) {
      stats[key] = {
        failures: count,
        threshold: this.threshold,
        willTripAt: this.threshold - count,
      };
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

