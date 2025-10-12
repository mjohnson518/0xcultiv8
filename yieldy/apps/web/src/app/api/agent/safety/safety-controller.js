import sql from '../../utils/sql.js';
import { circuitBreaker } from '../../utils/circuitBreaker.js';
import { log, logSecurityEvent } from '../../utils/logger.js';

/**
 * Safety Controller
 * Validates agent strategies and prevents dangerous operations
 */
export class SafetyController {
  constructor(config = {}) {
    this.config = config;
    this.suspiciousPatternThreshold = 3;
  }

  /**
   * Validate strategy against all safety constraints
   * @param {object} strategy - Strategy to validate
   * @param {object} userContext - User's authorization and limits
   * @returns {Promise<object>} - Validation result with violations
   */
  async validateStrategy(strategy, userContext) {
    const violations = [];

    // Amount limit checks
    const amountViolation = this.checkAmountLimits(strategy, userContext);
    if (amountViolation) violations.push(amountViolation);

    // Risk tolerance check
    const riskViolation = this.checkRiskTolerance(strategy, userContext);
    if (riskViolation) violations.push(riskViolation);

    // Daily limit check (EIP-8004)
    const dailyViolation = await this.checkDailyLimit(strategy, userContext);
    if (dailyViolation) violations.push(dailyViolation);

    // Protocol whitelist check
    const protocolViolation = await this.checkProtocolWhitelist(strategy);
    if (protocolViolation) violations.push(protocolViolation);

    // Suspicious pattern detection
    const patternViolations = await this.detectSuspiciousPatterns(strategy, userContext);
    violations.push(...patternViolations);

    // Rate of change check
    const rateViolation = await this.checkRateOfChange(strategy, userContext);
    if (rateViolation) violations.push(rateViolation);

    return {
      valid: violations.length === 0,
      violations,
      riskLevel: this.assessOverallRisk(violations),
    };
  }

  /**
   * Check amount limits
   */
  checkAmountLimits(strategy, userContext) {
    if (strategy.amount > userContext.maxInvestmentPerOpp) {
      return {
        type: 'AMOUNT_LIMIT_EXCEEDED',
        severity: 'high',
        limit: userContext.maxInvestmentPerOpp,
        attempted: strategy.amount,
        message: `Amount $${strategy.amount} exceeds max per opportunity $${userContext.maxInvestmentPerOpp}`,
      };
    }

    if (strategy.amount > userContext.availableFunds) {
      return {
        type: 'INSUFFICIENT_FUNDS',
        severity: 'high',
        available: userContext.availableFunds,
        attempted: strategy.amount,
        message: `Insufficient funds: have $${userContext.availableFunds}, need $${strategy.amount}`,
      };
    }

    return null;
  }

  /**
   * Check risk tolerance
   */
  checkRiskTolerance(strategy, userContext) {
    if (strategy.riskScore > userContext.riskTolerance) {
      return {
        type: 'RISK_TOLERANCE_EXCEEDED',
        severity: 'medium',
        limit: userContext.riskTolerance,
        attempted: strategy.riskScore,
        message: `Risk score ${strategy.riskScore} exceeds tolerance ${userContext.riskTolerance}`,
      };
    }

    return null;
  }

  /**
   * Check daily spending limit
   */
  async checkDailyLimit(strategy, userContext) {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayInvestments = await sql`
        SELECT COALESCE(SUM(amount), 0) as spent_today
        FROM investments
        WHERE invested_at >= ${todayStart.toISOString()}
          AND status IN ('pending', 'confirmed')
      `;

      const spentToday = parseFloat(todayInvestments[0]?.spent_today || 0);
      const dailyLimit = userContext.dailyLimit || userContext.maxInvestmentPerOpp * 5;

      if (spentToday + strategy.amount > dailyLimit) {
        return {
          type: 'DAILY_LIMIT_EXCEEDED',
          severity: 'high',
          limit: dailyLimit,
          spent: spentToday,
          attempted: strategy.amount,
          message: `Daily limit exceeded: spent $${spentToday}, attempting $${strategy.amount}, limit $${dailyLimit}`,
        };
      }
    } catch (error) {
      log.error('Daily limit check failed', { error: error.message });
    }

    return null;
  }

  /**
   * Check protocol whitelist
   */
  async checkProtocolWhitelist(strategy) {
    // Get whitelisted protocols from config
    const whitelisted = ['aave', 'compound']; // In production, fetch from database

    if (!whitelisted.includes(strategy.protocol.toLowerCase())) {
      return {
        type: 'PROTOCOL_NOT_WHITELISTED',
        severity: 'high',
        protocol: strategy.protocol,
        message: `Protocol ${strategy.protocol} is not whitelisted`,
      };
    }

    return null;
  }

  /**
   * Detect suspicious patterns
   */
  async detectSuspiciousPatterns(strategy, userContext) {
    const patterns = [];

    // Rapid repeated investments to same protocol
    const recent = await this.getRecentInvestments(
      strategy.protocol,
      strategy.blockchain,
      '1 hour'
    );

    if (recent.length >= this.suspiciousPatternThreshold) {
      patterns.push({
        type: 'RAPID_REPEATED_INVESTMENTS',
        severity: 'medium',
        count: recent.length,
        timeframe: '1 hour',
        message: `${recent.length} investments to ${strategy.protocol} in last hour`,
      });
    }

    // Unrealistic APY
    if (strategy.expectedAPY > 100) {
      patterns.push({
        type: 'UNREALISTIC_APY',
        severity: 'high',
        apy: strategy.expectedAPY,
        message: `APY of ${strategy.expectedAPY}% exceeds realistic threshold`,
      });
    }

    // Large portion of funds
    if (strategy.amount > userContext.availableFunds * 0.8) {
      patterns.push({
        type: 'HIGH_CONCENTRATION',
        severity: 'medium',
        percentage: (strategy.amount / userContext.availableFunds) * 100,
        message: `Strategy uses ${((strategy.amount / userContext.availableFunds) * 100).toFixed(1)}% of available funds`,
      });
    }

    return patterns;
  }

  /**
   * Check rate of change (how quickly strategies are changing)
   */
  async checkRateOfChange(strategy, userContext) {
    // Get last strategy
    const lastStrategy = await sql`
      SELECT selected_strategy, created_at
      FROM agent_decisions
      WHERE user_address = ${userContext.userAddress || 'unknown'}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (lastStrategy && lastStrategy.length > 0) {
      const timeSinceLastMinutes = (Date.now() - new Date(lastStrategy[0].created_at).getTime()) / 60000;

      if (timeSinceLastMinutes < 5) {
        return {
          type: 'RAPID_STRATEGY_CHANGES',
          severity: 'medium',
          timeSinceLastMinutes,
          message: `Strategy changed ${timeSinceLastMinutes.toFixed(1)} minutes after last decision`,
        };
      }
    }

    return null;
  }

  /**
   * Assess overall risk level from violations
   */
  assessOverallRisk(violations) {
    if (violations.length === 0) return 'none';

    const highSeverity = violations.filter(v => v.severity === 'high').length;
    const mediumSeverity = violations.filter(v => v.severity === 'medium').length;

    if (highSeverity > 0) return 'high';
    if (mediumSeverity > 1) return 'medium';
    return 'low';
  }

  /**
   * Get recent investments
   */
  async getRecentInvestments(protocol, blockchain, timeframe) {
    try {
      const result = await sql`
        SELECT i.* FROM investments i
        LEFT JOIN cultiv8_opportunities o ON i.opportunity_id = o.id
        WHERE o.protocol_name ILIKE ${protocol}
          AND i.blockchain = ${blockchain}
          AND i.invested_at > NOW() - INTERVAL '${timeframe}'
        ORDER BY i.invested_at DESC
      `;

      return result || [];
    } catch (error) {
      log.error('Failed to fetch recent investments', { error: error.message });
      return [];
    }
  }

  /**
   * Trigger circuit breaker with context
   */
  async triggerCircuitBreaker(reason, context = {}) {
    logSecurityEvent('SAFETY_VIOLATION_CIRCUIT_BREAKER', {
      reason,
      ...context,
    });

    await circuitBreaker.trip(reason, context);
  }

  /**
   * Validate and sanitize strategy before execution
   * Returns sanitized strategy or throws error
   */
  async sanitizeStrategy(strategy) {
    return {
      ...strategy,
      amount: Math.max(0, Math.floor(strategy.amount)), // No negative or fractional
      expectedAPY: Math.min(1000, Math.max(0, strategy.expectedAPY)), // Clamp APY
      riskScore: Math.min(10, Math.max(1, Math.round(strategy.riskScore))), // Clamp risk
    };
  }
}

// Singleton instance
export const safetyController = new SafetyController();

