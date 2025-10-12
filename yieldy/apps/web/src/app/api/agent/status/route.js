import { circuitBreaker } from '../../utils/circuitBreaker';
import { agentMemory } from '../memory/memory-manager';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import { authMiddleware } from '../../middleware/auth';
import sql from '../../utils/sql';

/**
 * Agent Status Endpoint
 * GET /api/agent/status
 * Returns current agent operational status
 */
export async function GET(request) {
  // Authentication required
  const authError = await authMiddleware(request);
  if (authError) return authError;

  // Rate limiting
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  try {
    const userAddress = request.user?.address || request.user?.id;

    // Get circuit breaker status
    const cbStatus = await circuitBreaker.isTripped();
    const cbStats = circuitBreaker.getStats();

    // Get agent configuration
    const config = await sql`
      SELECT * FROM agent_config ORDER BY id DESC LIMIT 1
    `;

    // Get user's performance metrics
    const performance = userAddress 
      ? await agentMemory.getPerformanceMetrics(userAddress)
      : null;

    // Get recent decisions count
    const recentDecisions = userAddress
      ? await agentMemory.getRecentDecisions(userAddress, 5)
      : [];

    return Response.json({
      success: true,
      status: {
        operational: !cbStatus.isPaused && config[0]?.auto_invest_enabled,
        paused: cbStatus.isPaused,
        pauseReason: cbStatus.reason,
        autoInvestEnabled: config[0]?.auto_invest_enabled || false,
      },
      config: config[0] || null,
      circuitBreaker: {
        tripped: cbStatus.isPaused,
        reason: cbStatus.reason,
        stats: cbStats,
      },
      performance,
      recentDecisions: recentDecisions.map(d => ({
        id: d.id,
        type: d.decision_type,
        outcome: d.outcome,
        createdAt: d.created_at,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching agent status:', error);
    return Response.json(
      { error: 'Failed to fetch agent status' },
      { status: 500 }
    );
  }
}

