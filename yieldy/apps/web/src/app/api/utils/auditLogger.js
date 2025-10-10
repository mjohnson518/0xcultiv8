import sql from './sql';

/**
 * Centralized audit logging for all financial and security-sensitive operations
 * All logs are immutable and stored for compliance/forensics
 */

/**
 * Write audit log entry
 * @param {object} params - Audit log parameters
 * @param {string} params.user_id - User ID (address or internal ID)
 * @param {string} params.action - Action performed (e.g., 'investment_created', 'funds_withdrawn')
 * @param {string} params.resource_type - Type of resource (e.g., 'investment', 'funds', 'config')
 * @param {string} params.resource_id - ID of the resource affected
 * @param {number} params.amount - Financial amount involved (if applicable)
 * @param {object} params.metadata - Additional context data
 * @param {string} params.ip_address - IP address of request
 * @param {string} params.request_id - Request tracing ID
 * @param {boolean} params.success - Whether operation succeeded
 * @returns {Promise<void>}
 */
export async function auditLog({
  user_id,
  action,
  resource_type = null,
  resource_id = null,
  amount = null,
  metadata = {},
  ip_address = null,
  request_id = null,
  success = true,
}) {
  try {
    // Ensure audit_logs table exists
    await ensureAuditTable();

    // Insert audit log
    await sql`
      INSERT INTO audit_logs (
        user_id, 
        action, 
        resource_type, 
        resource_id, 
        amount, 
        metadata, 
        ip_address, 
        request_id, 
        success
      ) VALUES (
        ${user_id},
        ${action},
        ${resource_type},
        ${resource_id},
        ${amount},
        ${JSON.stringify(metadata)},
        ${ip_address},
        ${request_id},
        ${success}
      )
    `;

    // Also log to console for immediate visibility (structured)
    console.info('AUDIT', {
      user_id,
      action,
      resource_type,
      resource_id,
      amount,
      success,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // CRITICAL: Audit logging failure should never break the application
    // Log to console but don't throw
    console.error('❌ AUDIT LOGGING FAILED:', {
      error: error.message,
      audit: { user_id, action, resource_type, success },
    });

    // Attempt to log the failure itself (meta-logging)
    try {
      await sql`
        INSERT INTO audit_log_failures (
          attempted_action, error_message, occurred_at
        ) VALUES (
          ${action}, ${error.message}, NOW()
        )
      `;
    } catch {
      // If even this fails, we've done our best
    }
  }
}

/**
 * Ensure audit_logs table exists
 * Creates table with all necessary indexes on first run
 */
async function ensureAuditTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        user_id TEXT,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id TEXT,
        amount NUMERIC(20,2),
        metadata JSONB,
        ip_address INET,
        request_id TEXT,
        success BOOLEAN DEFAULT true
      )
    `;

    // Create indexes for efficient querying
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, timestamp DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_request ON audit_logs(request_id)`;

    // Create audit log failure tracking table
    await sql`
      CREATE TABLE IF NOT EXISTS audit_log_failures (
        id SERIAL PRIMARY KEY,
        attempted_action TEXT,
        error_message TEXT,
        occurred_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch (error) {
    // Table already exists or other non-critical error
    console.debug('Audit table setup:', error.message);
  }
}

/**
 * Query audit logs with filters
 * @param {object} filters - Filter criteria
 * @param {number} filters.limit - Max records to return
 * @param {number} filters.offset - Pagination offset
 * @param {string} filters.user_id - Filter by user
 * @param {string} filters.action - Filter by action
 * @param {string} filters.startDate - Start date (ISO string)
 * @param {string} filters.endDate - End date (ISO string)
 * @param {boolean} filters.success - Filter by success status
 * @returns {Promise<Array>} - Audit log records
 */
export async function queryAuditLogs(filters = {}) {
  const {
    limit = 100,
    offset = 0,
    user_id,
    action,
    startDate,
    endDate,
    success,
  } = filters;

  try {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (user_id) {
      paramCount++;
      query += ` AND user_id = $${paramCount}`;
      params.push(user_id);
    }

    if (action) {
      paramCount++;
      query += ` AND action = $${paramCount}`;
      params.push(action);
    }

    if (startDate) {
      paramCount++;
      query += ` AND timestamp >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND timestamp <= $${paramCount}`;
      params.push(endDate);
    }

    if (typeof success === 'boolean') {
      paramCount++;
      query += ` AND success = $${paramCount}`;
      params.push(success);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const logs = await sql(query, params);
    return logs || [];
  } catch (error) {
    console.error('Error querying audit logs:', error);
    return [];
  }
}

/**
 * Get audit statistics for a user
 * @param {string} user_id - User to get stats for
 * @returns {Promise<object>} - Audit statistics
 */
export async function getUserAuditStats(user_id) {
  try {
    const stats = await sql`
      SELECT 
        COUNT(*) as total_actions,
        COUNT(*) FILTER (WHERE success = true) as successful_actions,
        COUNT(*) FILTER (WHERE success = false) as failed_actions,
        COUNT(DISTINCT action) as unique_actions,
        SUM(amount) FILTER (WHERE resource_type = 'investment' AND success = true) as total_invested,
        SUM(amount) FILTER (WHERE action LIKE '%withdraw%' AND success = true) as total_withdrawn,
        MIN(timestamp) as first_action,
        MAX(timestamp) as last_action
      FROM audit_logs
      WHERE user_id = ${user_id}
    `;

    return stats[0] || {};
  } catch (error) {
    console.error('Error getting audit stats:', error);
    return {};
  }
}

/**
 * Helper to extract IP address from request
 * @param {Request} request
 * @returns {string|null} IP address
 */
export function getIPFromRequest(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    null
  );
}

/**
 * Helper to get request ID from request (if using request ID middleware)
 * @param {Request} request
 * @returns {string|null} Request ID
 */
export function getRequestIDFromRequest(request) {
  return request.headers.get('x-request-id') || null;
}

// Pre-defined audit action constants for consistency
export const AUDIT_ACTIONS = {
  // Investment actions
  INVESTMENT_CREATED: 'investment_created',
  INVESTMENT_WITHDRAWN: 'investment_withdrawn',
  INVESTMENT_FAILED: 'investment_failed',

  // Fund actions
  FUNDS_DEPOSITED: 'funds_deposited',
  FUNDS_WITHDRAWN: 'funds_withdrawn',
  FUNDS_ADJUSTED: 'funds_adjusted',

  // Configuration actions
  CONFIG_UPDATED: 'config_updated',
  EMERGENCY_PAUSE_TRIGGERED: 'emergency_pause_triggered',
  EMERGENCY_PAUSE_RELEASED: 'emergency_pause_released',

  // Agent actions
  SCAN_EXECUTED: 'scan_executed',
  REBALANCE_EXECUTED: 'rebalance_executed',
  STRATEGY_EXECUTED: 'strategy_executed',

  // Security actions
  AUTH_SUCCESS: 'auth_success',
  AUTH_FAILED: 'auth_failed',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',

  // Admin actions
  PROTOCOL_WHITELISTED: 'protocol_whitelisted',
  PROTOCOL_BLACKLISTED: 'protocol_blacklisted',
  CIRCUIT_BREAKER_TRIGGERED: 'circuit_breaker_triggered',
};

