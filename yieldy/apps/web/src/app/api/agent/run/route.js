import { buildCultiv8AgentWithCheckpointing } from '../langgraph/graph.js';
import { createInitialState } from '../langgraph/state';
import sql from '../../utils/sql';
import { rateLimitMiddleware } from '../../middleware/rateLimit';
import { authMiddleware } from '../../middleware/auth';
import { checkEmergencyPause } from '../../utils/circuitBreaker';
import { auditLog, AUDIT_ACTIONS, getIPFromRequest, getRequestIDFromRequest } from '../../utils/auditLogger';
import { log } from '../../utils/logger';
import { agentMemory } from '../memory/memory-manager.js';
import { safetyController } from '../safety/safety-controller.js';

/**
 * Agent Execution Endpoint
 * POST /api/agent/run
 * Runs the LangGraph AI agent for yield farming decisions
 */
export async function POST(request) {
  // Authentication required
  const authError = await authMiddleware(request);
  if (authError) return authError;

  // Check emergency pause
  const pauseError = await checkEmergencyPause(request);
  if (pauseError) return pauseError;

  // Rate limiting
  const rateLimitError = await rateLimitMiddleware(request, 'scan');
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const { userAddress, mode = 'autonomous' } = body;

    log.info('Agent execution started', {
      userAddress: userAddress || request.user?.address,
      mode,
    });

    // Get user context
    const userId = userAddress || request.user?.address;

    // Fetch agent configuration
    const configResult = await sql`
      SELECT * FROM agent_config ORDER BY id DESC LIMIT 1
    `;

    if (!configResult || configResult.length === 0) {
      return Response.json({
        success: false,
        error: 'Agent configuration not found',
      }, { status: 400 });
    }

    const config = configResult[0];

    // Get available funds
    const fundsResult = await sql`
      SELECT 
        COALESCE(SUM(CASE 
          WHEN type = 'deposit' THEN amount 
          WHEN type = 'adjustment' THEN amount
          WHEN type = 'withdrawal' THEN -amount 
          ELSE 0 END), 0) AS total_funds
      FROM agent_fund_transactions
    `;

    const investedResult = await sql`
      SELECT COALESCE(SUM(amount), 0) AS invested
      FROM investments
      WHERE status IN ('pending', 'confirmed')
    `;

    const totalFunds = parseFloat(fundsResult[0]?.total_funds || 0);
    const invested = parseFloat(investedResult[0]?.invested || 0);
    const availableFunds = Math.max(0, totalFunds - invested);

    // Get current positions
    const positions = await sql`
      SELECT * FROM investments
      WHERE status IN ('pending', 'confirmed')
      ORDER BY invested_at DESC
    `;

    // Create initial state
    const initialState = createInitialState({
      userAddress: userId,
      availableFunds,
      riskTolerance: config.max_risk_score,
      maxInvestmentPerOpp: config.max_investment_per_opportunity,
      currentPositions: positions || [],
    });

    // Build and run agent
    const agent = await buildCultiv8AgentWithCheckpointing();

    // Generate unique thread ID for this execution
    const threadId = `agent-${userId}-${Date.now()}`;

    // Configure execution with checkpointing
    const agentConfig = {
      configurable: {
        thread_id: threadId,
      },
    };

    log.info('Agent graph execution starting', { threadId });

    // Invoke agent
    const finalState = await agent.invoke(initialState, agentConfig);

    log.info('Agent graph execution completed', {
      threadId,
      strategiesGenerated: finalState.strategies?.length || 0,
      selectedStrategy: finalState.selectedStrategy?.protocol || null,
      needsApproval: finalState.humanApprovalRequired,
    });

    // Validate strategy with safety controller
    let validationResult = { valid: true, violations: [] };
    if (finalState.selectedStrategy && !finalState.humanApprovalRequired) {
      validationResult = await safetyController.validateStrategy(
        finalState.selectedStrategy,
        {
          userAddress: userId,
          maxInvestmentPerOpp: config.max_investment_per_opportunity,
          availableFunds,
          riskTolerance: config.max_risk_score,
          dailyLimit: config.max_total_investment,
        }
      );

      if (!validationResult.valid) {
        logSecurityEvent('STRATEGY_VALIDATION_FAILED', {
          violations: validationResult.violations,
          strategy: finalState.selectedStrategy,
        });

        // Trigger circuit breaker if high-risk violations
        if (validationResult.riskLevel === 'high') {
          await safetyController.triggerCircuitBreaker(
            `Strategy validation failed: ${validationResult.violations[0]?.type}`,
            { violations: validationResult.violations }
          );
        }
      }
    }

    // Store decision in memory system for learning
    let decisionId = null;
    if (finalState.selectedStrategy) {
      decisionId = await agentMemory.storeDecision(userId, {
        type: mode === 'autonomous' ? 'autonomous_strategy' : 'advisory_strategy',
        reasoning: finalState.reasoning,
        strategy: finalState.selectedStrategy,
        validationResult,
      });
    }

    // Audit log
    await auditLog({
      user_id: userId,
      action: AUDIT_ACTIONS.STRATEGY_EXECUTED,
      resource_type: 'agent_execution',
      metadata: {
        mode,
        threadId,
        strategiesGenerated: finalState.strategies?.length || 0,
        selectedStrategy: finalState.selectedStrategy?.protocol,
        needsApproval: finalState.humanApprovalRequired,
      },
      ip_address: getIPFromRequest(request),
      request_id: getRequestIDFromRequest(request),
      success: true,
    });

    return Response.json({
      success: true,
      threadId,
      strategy: finalState.selectedStrategy,
      executionPlan: finalState.executionPlan,
      reasoning: finalState.reasoning,
      needsApproval: finalState.humanApprovalRequired,
      circuitBreakerTriggered: finalState.circuitBreakerTriggered,
      errors: finalState.errors || [],
    });
  } catch (error) {
    log.error('Agent execution failed', { error: error.message, stack: error.stack });

    // Audit log failure
    await auditLog({
      user_id: request.user?.id || 'system',
      action: AUDIT_ACTIONS.STRATEGY_EXECUTED,
      resource_type: 'agent_execution',
      metadata: {
        error: error.message,
      },
      ip_address: getIPFromRequest(request),
      request_id: getRequestIDFromRequest(request),
      success: false,
    });

    return Response.json(
      {
        success: false,
        error: 'Agent execution failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

