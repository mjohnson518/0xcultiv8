/**
 * Execution Fee Middleware
 *
 * Calculates and records fees for DeFi transaction execution.
 * Fee: 0.10% of transaction value, capped at $25.
 *
 * @module executionFee
 */

import sql from '../utils/sql.js';
import { log } from '../utils/logger.js';

// =============================================================================
// Configuration
// =============================================================================

const EXECUTION_FEE_CONFIG = {
  feePercent: 0.0010,  // 0.10%
  feeCap: 25.00,       // $25 maximum
  enabled: process.env.EXECUTION_FEES_ENABLED !== 'false',
};

// =============================================================================
// Fee Calculation
// =============================================================================

/**
 * Calculate execution fee for a transaction
 * @param {number} transactionValueUsd - Transaction value in USD
 * @returns {{feeUsd: number, feePercent: number, capped: boolean}}
 */
export function calculateExecutionFee(transactionValueUsd) {
  if (!EXECUTION_FEE_CONFIG.enabled || transactionValueUsd <= 0) {
    return { feeUsd: 0, feePercent: 0, capped: false };
  }

  const rawFee = transactionValueUsd * EXECUTION_FEE_CONFIG.feePercent;
  const capped = rawFee > EXECUTION_FEE_CONFIG.feeCap;
  const feeUsd = capped ? EXECUTION_FEE_CONFIG.feeCap : rawFee;

  return {
    feeUsd: Math.round(feeUsd * 100) / 100,  // Round to cents
    feePercent: EXECUTION_FEE_CONFIG.feePercent,
    capped,
  };
}

// =============================================================================
// Fee Recording
// =============================================================================

/**
 * Record a pending execution fee
 * @param {object} params - Fee parameters
 * @returns {Promise<{id: number, feeUsd: number}>}
 */
export async function recordExecutionFee(params) {
  const {
    userAddress,
    transactionHash,
    transactionValueUsd,
    protocol,
    action,  // 'deposit', 'withdraw', 'rebalance'
  } = params;

  const { feeUsd, feePercent, capped } = calculateExecutionFee(transactionValueUsd);

  if (feeUsd <= 0) {
    return { id: null, feeUsd: 0 };
  }

  try {
    const result = await sql`
      INSERT INTO execution_fees (
        user_address,
        transaction_hash,
        transaction_value_usd,
        fee_percent,
        fee_usd,
        fee_cap_usd,
        protocol,
        action,
        status
      ) VALUES (
        ${userAddress.toLowerCase()},
        ${transactionHash},
        ${transactionValueUsd},
        ${feePercent},
        ${feeUsd},
        ${EXECUTION_FEE_CONFIG.feeCap},
        ${protocol},
        ${action},
        'pending'
      )
      RETURNING id, fee_usd
    `;

    log.info('Execution fee recorded', {
      userAddress,
      transactionHash,
      transactionValueUsd,
      feeUsd,
      capped,
      protocol,
      action,
    });

    return {
      id: result[0].id,
      feeUsd: parseFloat(result[0].fee_usd),
    };
  } catch (error) {
    log.error('Failed to record execution fee', { error: error.message, userAddress });
    // Don't block transaction on fee recording failure
    return { id: null, feeUsd };
  }
}

/**
 * Mark execution fee as collected
 * @param {number} feeId - Fee record ID
 * @returns {Promise<boolean>}
 */
export async function collectExecutionFee(feeId) {
  try {
    await sql`
      UPDATE execution_fees SET
        status = 'collected',
        collected_at = NOW()
      WHERE id = ${feeId}
    `;
    return true;
  } catch (error) {
    log.error('Failed to collect execution fee', { error: error.message, feeId });
    return false;
  }
}

/**
 * Waive execution fee (e.g., for enterprise users or promotions)
 * @param {number} feeId - Fee record ID
 * @param {string} reason - Reason for waiving
 * @returns {Promise<boolean>}
 */
export async function waiveExecutionFee(feeId, reason) {
  try {
    await sql`
      UPDATE execution_fees SET
        status = 'waived',
        collected_at = NOW()
      WHERE id = ${feeId}
    `;

    log.info('Execution fee waived', { feeId, reason });
    return true;
  } catch (error) {
    log.error('Failed to waive execution fee', { error: error.message, feeId });
    return false;
  }
}

// =============================================================================
// Fee Queries
// =============================================================================

/**
 * Get pending fees for a user
 * @param {string} userAddress - User's wallet address
 * @returns {Promise<Array>}
 */
export async function getPendingFees(userAddress) {
  try {
    const result = await sql`
      SELECT
        id,
        transaction_hash,
        transaction_value_usd,
        fee_usd,
        protocol,
        action,
        created_at
      FROM execution_fees
      WHERE user_address = ${userAddress.toLowerCase()}
        AND status = 'pending'
      ORDER BY created_at DESC
    `;

    return result;
  } catch (error) {
    log.error('Failed to get pending fees', { error: error.message, userAddress });
    return [];
  }
}

/**
 * Get total fees collected for a user
 * @param {string} userAddress - User's wallet address
 * @returns {Promise<{totalFees: number, transactionCount: number}>}
 */
export async function getUserFeeStats(userAddress) {
  try {
    const result = await sql`
      SELECT
        COALESCE(SUM(fee_usd), 0) as total_fees,
        COUNT(*) as transaction_count
      FROM execution_fees
      WHERE user_address = ${userAddress.toLowerCase()}
        AND status = 'collected'
    `;

    return {
      totalFees: parseFloat(result[0].total_fees),
      transactionCount: parseInt(result[0].transaction_count),
    };
  } catch (error) {
    log.error('Failed to get user fee stats', { error: error.message, userAddress });
    return { totalFees: 0, transactionCount: 0 };
  }
}

// =============================================================================
// Middleware for Execute Endpoint
// =============================================================================

/**
 * Middleware to calculate and attach execution fee to request
 * Use this in the execute endpoint before processing transaction
 *
 * @param {Request} request - Incoming request
 * @param {object} transactionDetails - Transaction details
 * @returns {Promise<{feeUsd: number, feeId: number | null}>}
 */
export async function attachExecutionFee(request, transactionDetails) {
  const {
    userAddress,
    transactionHash,
    transactionValueUsd,
    protocol,
    action,
  } = transactionDetails;

  // Check if user is enterprise (waive fees)
  const userTier = request.user?.tier;
  if (userTier === 'enterprise') {
    log.debug('Execution fee waived for enterprise user', { userAddress });
    return { feeUsd: 0, feeId: null, waived: true };
  }

  // Calculate and record fee
  const { id, feeUsd } = await recordExecutionFee({
    userAddress,
    transactionHash,
    transactionValueUsd,
    protocol,
    action,
  });

  return { feeUsd, feeId: id, waived: false };
}

// =============================================================================
// Exports
// =============================================================================

export default {
  calculateExecutionFee,
  recordExecutionFee,
  collectExecutionFee,
  waiveExecutionFee,
  getPendingFees,
  getUserFeeStats,
  attachExecutionFee,
  EXECUTION_FEE_CONFIG,
};
