import Redis from 'ioredis';
import sql from '../../utils/sql.js';
import { log } from '../../utils/logger.js';

/**
 * Agent Memory & Learning System
 * Stores decisions, tracks outcomes, learns from results
 */
export class AgentMemoryManager {
  constructor() {
    // Initialize Redis for short-term memory
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      });
      this.redis.on('error', () => {
        this.redis = null;
      });
    } catch {
      this.redis = null;
    }

    this.ensureSchema();
  }

  /**
   * Ensure agent_decisions table exists
   */
  async ensureSchema() {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS agent_decisions (
          id SERIAL PRIMARY KEY,
          user_address TEXT NOT NULL,
          decision_type VARCHAR(50),
          reasoning_chain JSONB NOT NULL,
          selected_strategy JSONB,
          outcome VARCHAR(20) DEFAULT 'pending',
          actual_return NUMERIC(10,2),
          lessons_learned JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          completed_at TIMESTAMPTZ
        )
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_decisions_user ON agent_decisions(user_address, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_decisions_outcome ON agent_decisions(outcome)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_decisions_type ON agent_decisions(decision_type)`;
    } catch (error) {
      log.debug('Agent decisions table setup', { error: error.message });
    }
  }

  /**
   * Store a decision
   * @param {string} userAddress - User address
   * @param {object} decision - Decision details
   * @returns {Promise<number>} - Decision ID
   */
  async storeDecision(userAddress, decision) {
    try {
      const key = `agent:decision:${userAddress}:${Date.now()}`;

      // Short-term memory (Redis, 7 days)
      if (this.redis) {
        await this.redis.setex(
          key,
          7 * 24 * 60 * 60,
          JSON.stringify(decision)
        );
      }

      // Long-term memory (Postgres)
      const result = await sql`
        INSERT INTO agent_decisions (
          user_address,
          decision_type,
          reasoning_chain,
          selected_strategy
        ) VALUES (
          ${userAddress},
          ${decision.type || 'autonomous_strategy'},
          ${JSON.stringify(decision.reasoning)},
          ${JSON.stringify(decision.strategy)}
        ) RETURNING id
      `;

      log.info('Agent decision stored', {
        userAddress,
        decisionId: result[0].id,
        type: decision.type,
      });

      return result[0].id;
    } catch (error) {
      log.error('Failed to store decision', { error: error.message });
      throw error;
    }
  }

  /**
   * Get recent decisions for a user
   * @param {string} userAddress - User address
   * @param {number} limit - Number of decisions to retrieve
   * @returns {Promise<Array>} - Recent decisions
   */
  async getRecentDecisions(userAddress, limit = 10) {
    try {
      return await sql`
        SELECT * FROM agent_decisions
        WHERE user_address = ${userAddress}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } catch (error) {
      log.error('Failed to fetch decisions', { error: error.message });
      return [];
    }
  }

  /**
   * Record outcome of a decision
   * @param {number} decisionId - Decision ID
   * @param {object} outcome - Outcome details
   */
  async recordOutcome(decisionId, outcome) {
    try {
      await sql`
        UPDATE agent_decisions
        SET outcome = ${outcome.status || 'completed'},
            actual_return = ${outcome.return || null},
            lessons_learned = ${JSON.stringify(outcome.lessons || {})},
            completed_at = NOW()
        WHERE id = ${decisionId}
      `;

      log.info('Decision outcome recorded', {
        decisionId,
        outcome: outcome.status,
        return: outcome.return,
      });
    } catch (error) {
      log.error('Failed to record outcome', { error: error.message, decisionId });
    }
  }

  /**
   * Get performance metrics for a user
   * @param {string} userAddress - User address
   * @returns {Promise<object>} - Performance metrics
   */
  async getPerformanceMetrics(userAddress) {
    try {
      const metrics = await sql`
        SELECT 
          COUNT(*) as total_decisions,
          COUNT(*) FILTER (WHERE outcome = 'success') as successful_decisions,
          COUNT(*) FILTER (WHERE outcome = 'failed') as failed_decisions,
          COUNT(*) FILTER (WHERE outcome = 'pending') as pending_decisions,
          AVG(actual_return) FILTER (WHERE outcome = 'success') as avg_return,
          SUM(actual_return) FILTER (WHERE outcome = 'success') as total_return,
          MAX(actual_return) as best_return,
          MIN(actual_return) FILTER (WHERE outcome = 'success' AND actual_return > 0) as worst_return
        FROM agent_decisions
        WHERE user_address = ${userAddress}
          AND created_at > NOW() - INTERVAL '90 days'
      `;

      const result = metrics[0] || {};

      return {
        totalDecisions: Number(result.total_decisions) || 0,
        successRate: result.total_decisions > 0
          ? (Number(result.successful_decisions) / Number(result.total_decisions)) * 100
          : 0,
        avgReturn: Number(result.avg_return) || 0,
        totalReturn: Number(result.total_return) || 0,
        bestReturn: Number(result.best_return) || 0,
        worstReturn: Number(result.worst_return) || 0,
        pendingDecisions: Number(result.pending_decisions) || 0,
      };
    } catch (error) {
      log.error('Failed to calculate performance metrics', { error: error.message });
      return {
        totalDecisions: 0,
        successRate: 0,
        avgReturn: 0,
        totalReturn: 0,
      };
    }
  }

  /**
   * Get lessons learned from past decisions
   * Analyzes patterns in successful vs failed decisions
   * @param {string} userAddress - User address
   * @returns {Promise<object>} - Lessons and patterns
   */
  async getLessonsLearned(userAddress) {
    try {
      const decisions = await sql`
        SELECT 
          decision_type,
          selected_strategy,
          outcome,
          actual_return,
          lessons_learned
        FROM agent_decisions
        WHERE user_address = ${userAddress}
          AND outcome != 'pending'
        ORDER BY created_at DESC
        LIMIT 50
      `;

      // Analyze patterns
      const successful = decisions.filter(d => d.outcome === 'success');
      const failed = decisions.filter(d => d.outcome === 'failed');

      const lessons = {
        successPatterns: this.extractPatterns(successful),
        failurePatterns: this.extractPatterns(failed),
        recommendations: this.generateRecommendations(successful, failed),
      };

      return lessons;
    } catch (error) {
      log.error('Failed to get lessons learned', { error: error.message });
      return {
        successPatterns: [],
        failurePatterns: [],
        recommendations: [],
      };
    }
  }

  /**
   * Extract patterns from decisions
   * @param {Array} decisions - Array of decisions
   * @returns {Array} - Patterns found
   */
  extractPatterns(decisions) {
    const patterns = [];

    if (decisions.length === 0) return patterns;

    // Protocol success patterns
    const protocolCounts = {};
    decisions.forEach(d => {
      if (d.selected_strategy?.protocol) {
        const protocol = d.selected_strategy.protocol;
        protocolCounts[protocol] = (protocolCounts[protocol] || 0) + 1;
      }
    });

    Object.entries(protocolCounts).forEach(([protocol, count]) => {
      if (count > 2) {
        patterns.push({
          type: 'protocol_preference',
          protocol,
          occurrences: count,
        });
      }
    });

    return patterns;
  }

  /**
   * Generate recommendations based on history
   * @param {Array} successful - Successful decisions
   * @param {Array} failed - Failed decisions  
   * @returns {Array} - Recommendations
   */
  generateRecommendations(successful, failed) {
    const recommendations = [];

    // If more successes than failures, agent is performing well
    if (successful.length > failed.length * 2) {
      recommendations.push({
        type: 'positive',
        message: 'Agent performance is strong - consider increasing allocation',
      });
    }

    // If high failure rate, recommend conservative approach
    if (failed.length > successful.length) {
      recommendations.push({
        type: 'caution',
        message: 'High failure rate detected - recommend reducing risk tolerance',
      });
    }

    return recommendations;
  }

  /**
   * Clear old memories (cleanup)
   * @param {number} daysToKeep - Keep decisions from last N days
   */
  async cleanupOldMemories(daysToKeep = 180) {
    try {
      const deleted = await sql`
        DELETE FROM agent_decisions
        WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
          AND outcome != 'pending'
        RETURNING id
      `;

      log.info('Old memories cleaned up', { count: deleted.length });
    } catch (error) {
      log.error('Cleanup failed', { error: error.message });
    }
  }
}

// Singleton instance
export const agentMemory = new AgentMemoryManager();

