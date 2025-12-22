import { getProtocolAdapter } from '@/app/api/protocols/adapters';
import { ethers } from 'ethers';
import sql from '@/app/api/utils/sql';
import { rateLimitMiddleware } from '@/app/api/middleware/rateLimit';
import { authMiddleware } from '@/app/api/middleware/auth';
import { checkEmergencyPause, circuitBreaker } from '@/app/api/utils/circuitBreaker';
import { auditLog, AUDIT_ACTIONS, getIPFromRequest, getRequestIDFromRequest } from '@/app/api/utils/auditLogger';
import { validateRequest } from '@/app/api/middleware/validation';
import { z } from 'zod';
import { mevProtection, assessMEVRisk } from '@/app/api/utils/mevProtection';
import { alertManager, ALERT_TEMPLATES, SEVERITY, ALERT_TYPES } from '@/app/api/utils/alerting';
import { getAgentSigner, KEY_TYPES } from '@/app/api/utils/keyManager';
import { log as logger } from '@/app/api/utils/logger';

// Schema for execute request
const ExecuteSchema = z.object({
  userAddress: z.string().refine(val => ethers.isAddress(val)),
  protocol: z.enum(['aave', 'compound']),
  action: z.enum(['deposit', 'withdraw']),
  amount: z.string().or(z.number()),
  chainId: z.number().int().refine(val => [1, 8453].includes(val)),
  signedTransaction: z.string().optional(), // Pre-signed by user
});

/**
 * Transaction Execution Endpoint
 * POST /api/execute/submit
 * Executes real blockchain transactions (admin/backend use only)
 */
export async function POST(request) {
  // Authentication required
  const authError = await authMiddleware(request);
  if (authError) return authError;

  // Check emergency pause
  const pauseError = await checkEmergencyPause(request);
  if (pauseError) return pauseError;

  // Rate limiting - use investment tier for actual executions
  const rateLimitError = await rateLimitMiddleware(request, 'investment');
  if (rateLimitError) return rateLimitError;

  // Input validation
  const validationError = await validateRequest(ExecuteSchema)(request);
  if (validationError) return validationError;

  try {
    const { userAddress, protocol, action, amount, chainId, signedTransaction } = request.validated;

    const chain = chainId === 1 ? 'ethereum' : 'base';

    // Get RPC provider
    const provider = new ethers.JsonRpcProvider(
      chainId === 1 ? process.env.ETHEREUM_RPC_URL : process.env.BASE_RPC_URL
    );

    // Get agent wallet through secure KeyManager
    // This uses KMS/Vault in production, env vars only in development
    let agentWallet;
    try {
      agentWallet = await getAgentSigner(provider);
    } catch (keyError) {
      logger.error('Failed to get agent signer', { error: keyError.message });
      return Response.json({
        success: false,
        error: 'Agent wallet not configured or unavailable',
      }, { status: 500 });
    }

    // Get protocol adapter
    const adapter = getProtocolAdapter(protocol, chain);

    // Parse amount
    const amountBN = ethers.parseUnits(amount.toString(), 6);
    const amountUSD = Number(amountBN) / 1e6;

    // MEV Risk Assessment for large transactions
    const mevRisk = assessMEVRisk({
      tokenAmount: amountUSD,
      txType: action,
      protocol,
    });

    // Log MEV risk for monitoring
    if (mevRisk.shouldUseProtection) {
      logger.info('MEV risk assessment', {
        action,
        riskLevel: mevRisk.riskLevel,
        riskScore: mevRisk.riskScore,
        recommendations: mevRisk.recommendations.map(r => r.action),
      });
    }

    // Alert on large fund movements
    if (amountUSD >= 10000) {
      await alertManager.send(ALERT_TEMPLATES.largeFundMovement(
        amountUSD,
        action === 'deposit' ? 'in' : 'out',
        { protocol, chain, userAddress, mevRiskLevel: mevRisk.riskLevel }
      ));
    }

    // CRITICAL: Create pending investment BEFORE blockchain execution
    // This ensures we have a record even if the blockchain tx succeeds but DB fails later
    let pendingInvestmentId = null;
    let opportunity = null;

    if (action === 'deposit') {
      // Find opportunity record
      const opportunityResult = await sql`
        SELECT id FROM cultiv8_opportunities
        WHERE protocol_name = ${protocol}
        AND blockchain = ${chain}
        LIMIT 1
      `;
      opportunity = opportunityResult?.[0];

      if (opportunity) {
        // Create pending investment record FIRST
        const pendingResult = await sql`
          INSERT INTO investments (
            opportunity_id, amount, blockchain, status, transaction_hash
          ) VALUES (
            ${opportunity.id},
            ${Number(amountBN) / 1e6},
            ${chain},
            'pending',
            NULL
          ) RETURNING id
        `;
        pendingInvestmentId = pendingResult?.[0]?.id;
        logger.info('Created pending investment record', { id: pendingInvestmentId });
      }
    }

    // Execute transaction (MEV protection applied in adapter if chainId === 1)
    let result;
    try {
      if (action === 'deposit') {
        result = await adapter.executeDeposit(agentWallet, amountBN, { mevRisk });
      } else {
        result = await adapter.executeWithdraw(agentWallet, amountBN, { mevRisk });
      }
    } catch (txError) {
      // If blockchain tx fails and we have a pending record, mark it as failed
      if (pendingInvestmentId) {
        await sql`
          UPDATE investments
          SET status = 'failed',
              updated_at = NOW()
          WHERE id = ${pendingInvestmentId}
        `.catch(dbErr => logger.error('Failed to update investment status', { error: dbErr.message }));
      }
      throw txError;
    }

    // Add MEV assessment to result
    result.mevRisk = mevRisk;

    // Update investment record to confirmed with transaction hash
    if (action === 'deposit' && pendingInvestmentId) {
      const txHash = result.receipts?.[result.receipts.length - 1]?.hash || result.hash;
      await sql`
        UPDATE investments
        SET status = 'confirmed',
            transaction_hash = ${txHash},
            updated_at = NOW()
        WHERE id = ${pendingInvestmentId}
      `;
      logger.info('Investment confirmed', { id: pendingInvestmentId, txHash });
    }

    // Audit log
    await auditLog({
      user_id: request.user?.id || userAddress,
      action: action === 'deposit' ? AUDIT_ACTIONS.INVESTMENT_CREATED : AUDIT_ACTIONS.INVESTMENT_WITHDRAWN,
      resource_type: 'transaction',
      resource_id: result.receipts?.[0]?.hash || result.hash,
      amount: Number(amountBN) / 1e6,
      metadata: {
        protocol,
        chain,
        action,
        gasUsed: result.totalGasUsed || result.gasUsed,
      },
      ip_address: getIPFromRequest(request),
      request_id: getRequestIDFromRequest(request),
      success: true,
    });

    return Response.json({
      success: true,
      result,
      protocol,
      action,
      amount: Number(amountBN) / 1e6,
    });
  } catch (error) {
    logger.error('Transaction execution error', { error: error.message, stack: error.stack });

    // Record failure in circuit breaker
    await circuitBreaker.recordFailure('transaction_execution', {
      error: error.message,
      protocol: request.validated?.protocol,
      action: request.validated?.action,
    });

    // Audit log failure
    await auditLog({
      user_id: request.user?.id || 'system',
      action: AUDIT_ACTIONS.INVESTMENT_FAILED,
      resource_type: 'transaction',
      amount: request.validated?.amount,
      metadata: {
        error: error.message,
        protocol: request.validated?.protocol,
        action: request.validated?.action,
      },
      ip_address: getIPFromRequest(request),
      request_id: getRequestIDFromRequest(request),
      success: false,
    });

    return Response.json(
      {
        success: false,
        error: 'Transaction execution failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

