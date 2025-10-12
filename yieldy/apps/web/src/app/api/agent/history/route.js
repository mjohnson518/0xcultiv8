import { agentMemory } from '../memory/memory-manager.js';
import { rateLimitMiddleware } from '../../middleware/rateLimit.js';
import { authMiddleware } from '../../middleware/auth.js';

/**
 * Agent History Endpoint
 * GET /api/agent/history
 * Returns agent decision history with reasoning chains
 */
export async function GET(request) {
  // Authentication required
  const authError = await authMiddleware(request);
  if (authError) return authError;

  // Rate limiting
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress') || request.user?.address;
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!userAddress) {
      return Response.json(
        { error: 'userAddress required' },
        { status: 400 }
      );
    }

    // Get recent decisions
    const decisions = await agentMemory.getRecentDecisions(userAddress, limit);

    // Get performance metrics
    const performance = await agentMemory.getPerformanceMetrics(userAddress);

    // Get lessons learned
    const lessons = await agentMemory.getLessonsLearned(userAddress);

    return Response.json({
      success: true,
      decisions: decisions.map(d => ({
        id: d.id,
        type: d.decision_type,
        strategy: d.selected_strategy,
        outcome: d.outcome,
        actualReturn: d.actual_return,
        reasoningSteps: d.reasoning_chain?.length || 0,
        createdAt: d.created_at,
        completedAt: d.completed_at,
      })),
      performance,
      lessons,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching agent history:', error);
    return Response.json(
      { error: 'Failed to fetch agent history' },
      { status: 500 }
    );
  }
}

