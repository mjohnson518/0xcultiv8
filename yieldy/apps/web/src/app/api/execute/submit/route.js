import { getProtocolAdapter } from '@/app/api/protocols/adapters';
import { ethers } from 'ethers';
import sql from '@/app/api/utils/sql';
import { rateLimitMiddleware } from '@/app/api/middleware/rateLimit';
import { authMiddleware } from '@/app/api/middleware/auth';
import { checkEmergencyPause, circuitBreaker } from '@/app/api/utils/circuitBreaker';
import { auditLog, AUDIT_ACTIONS, getIPFromRequest, getRequestIDFromRequest } from '@/app/api/utils/auditLogger';
import { validateRequest } from '@/app/api/middleware/validation';
import { z } from 'zod';

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

    // For backend execution, need agent private key (SECURE)
    if (!process.env.AGENT_PRIVATE_KEY) {
      return Response.json({
        success: false,
        error: 'Agent wallet not configured',
      }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(
      chainId === 1 ? process.env.ETHEREUM_RPC_URL : process.env.BASE_RPC_URL
    );

    // Create agent wallet (backend signer)
    const agentWallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);

    // Get protocol adapter
    const adapter = getProtocolAdapter(protocol, chain);

    // Parse amount
    const amountBN = ethers.parseUnits(amount.toString(), 6);

    // Execute transaction
    let result;
    if (action === 'deposit') {
      result = await adapter.executeDeposit(agentWallet, amountBN);
    } else {
      result = await adapter.executeWithdraw(agentWallet, amountBN);
    }

    // Record in database
    if (action === 'deposit') {
      // Find or create opportunity record
      const opportunity = await sql`
        SELECT id FROM cultiv8_opportunities
        WHERE protocol_name = ${protocol}
        AND blockchain = ${chain}
        LIMIT 1
      `;

      if (opportunity && opportunity.length > 0) {
        await sql`
          INSERT INTO investments (
            opportunity_id, amount, blockchain, transaction_hash, status
          ) VALUES (
            ${opportunity[0].id},
            ${Number(amountBN) / 1e6},
            ${chain},
            ${result.receipts?.[result.receipts.length - 1]?.hash || result.hash},
            'confirmed'
          )
        `;
      }
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
    console.error('Execution error:', error);

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

