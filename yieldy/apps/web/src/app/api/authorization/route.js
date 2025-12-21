import { ethers, Contract } from 'ethers';
import sql from '@/app/api/utils/sql';
import { rateLimitMiddleware } from '@/app/api/middleware/rateLimit';
import { authMiddleware, optionalAuth } from '@/app/api/middleware/auth';
import { auditLog, AUDIT_ACTIONS, getIPFromRequest, getRequestIDFromRequest } from '@/app/api/utils/auditLogger';
import { log as logger } from '@/app/api/utils/logger';
import { CULTIV8_AGENT_ABI } from '@/contracts/abis';
import { getContractAddresses, areContractsDeployed } from '@/contracts/addresses';

/**
 * GET /api/authorization
 * Get user's on-chain authorization status
 * SECURITY: Requires authentication to prevent data exposure
 * Users can only query their own authorization status
 */
export async function GET(request) {
  // Rate limiting first
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  // Authentication required - users can only see their own data
  const authError = await authMiddleware(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    let userAddress = url.searchParams.get('address');
    const chainId = parseInt(url.searchParams.get('chainId') || '1');

    // SECURITY: Users can only query their own authorization
    // If address is provided, verify it matches authenticated user
    if (userAddress) {
      if (userAddress.toLowerCase() !== request.user?.address?.toLowerCase()) {
        logger.warn('Authorization query for different address blocked', {
          requested: userAddress,
          authenticated: request.user?.address,
        });
        return Response.json(
          { success: false, error: 'You can only query your own authorization status' },
          { status: 403 }
        );
      }
    } else {
      // Use authenticated user's address if not specified
      userAddress = request.user?.address;
    }

    if (!userAddress || !ethers.isAddress(userAddress)) {
      return Response.json(
        { success: false, error: 'Valid address parameter required' },
        { status: 400 }
      );
    }

    // Check if contracts are deployed
    if (!areContractsDeployed(chainId)) {
      return Response.json({
        success: true,
        authorization: null,
        contractsDeployed: false,
        message: `Contracts not yet deployed on chain ${chainId}`,
      });
    }

    const addresses = getContractAddresses(chainId);
    const rpcUrl = chainId === 1
      ? process.env.ETHEREUM_RPC_URL
      : process.env.BASE_RPC_URL;

    if (!rpcUrl) {
      return Response.json({
        success: true,
        authorization: null,
        contractsDeployed: true,
        message: 'RPC URL not configured for this chain',
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const agentContract = new Contract(addresses.cultiv8Agent, CULTIV8_AGENT_ABI, provider);

    // Fetch on-chain authorization
    const auth = await agentContract.getAuthorization(userAddress);
    const remainingDaily = await agentContract.getRemainingDailyLimit(userAddress);
    const canExecuteSmall = await agentContract.canExecute(userAddress, ethers.parseUnits('100', 6));

    // Get database records for additional context
    const dbRecords = await sql`
      SELECT * FROM user_authorizations
      WHERE user_address = ${userAddress.toLowerCase()}
      ORDER BY created_at DESC
      LIMIT 1
    `.catch(() => []);

    const authorization = {
      active: auth.active,
      agent: auth.agent,
      maxAmountPerTx: Number(auth.maxAmountPerTx) / 1e6,
      dailyLimit: Number(auth.dailyLimit) / 1e6,
      dailySpent: Number(auth.dailySpent) / 1e6,
      remainingDaily: Number(remainingDaily) / 1e6,
      authorizedAt: auth.active ? Number(auth.authorizedAt) : null,
      canExecute: canExecuteSmall,
      chainId,
      contractAddress: addresses.cultiv8Agent,
      // Database metadata
      dbSynced: dbRecords.length > 0,
      lastDbUpdate: dbRecords[0]?.updated_at || null,
    };

    return Response.json({
      success: true,
      authorization,
      contractsDeployed: true,
    });
  } catch (error) {
    logger.error('Error fetching authorization:', { error: error.message });
    return Response.json(
      { success: false, error: 'Failed to fetch authorization status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/authorization
 * Sync authorization to database after on-chain transaction
 */
export async function POST(request) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const rateLimitError = await rateLimitMiddleware(request, 'transaction');
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const {
      userAddress,
      chainId,
      transactionHash,
      action, // 'authorize' | 'revoke' | 'update'
      maxAmountPerTx,
      dailyLimit,
    } = body;

    if (!userAddress || !ethers.isAddress(userAddress)) {
      return Response.json(
        { success: false, error: 'Valid userAddress required' },
        { status: 400 }
      );
    }

    if (!transactionHash) {
      return Response.json(
        { success: false, error: 'transactionHash required' },
        { status: 400 }
      );
    }

    // Verify transaction on-chain
    const rpcUrl = chainId === 1
      ? process.env.ETHEREUM_RPC_URL
      : process.env.BASE_RPC_URL;

    if (rpcUrl) {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(transactionHash);

      if (!receipt || receipt.status !== 1) {
        return Response.json(
          { success: false, error: 'Transaction not confirmed or failed' },
          { status: 400 }
        );
      }
    }

    // Upsert authorization record in database
    await sql`
      INSERT INTO user_authorizations (
        user_address,
        chain_id,
        is_active,
        max_amount_per_tx,
        daily_limit,
        transaction_hash,
        action,
        created_at,
        updated_at
      ) VALUES (
        ${userAddress.toLowerCase()},
        ${chainId},
        ${action !== 'revoke'},
        ${maxAmountPerTx || 0},
        ${dailyLimit || 0},
        ${transactionHash},
        ${action},
        NOW(),
        NOW()
      )
      ON CONFLICT (user_address, chain_id)
      DO UPDATE SET
        is_active = EXCLUDED.is_active,
        max_amount_per_tx = EXCLUDED.max_amount_per_tx,
        daily_limit = EXCLUDED.daily_limit,
        transaction_hash = EXCLUDED.transaction_hash,
        action = EXCLUDED.action,
        updated_at = NOW()
    `;

    // Audit log
    await auditLog({
      user_id: request.user?.id || userAddress,
      action: action === 'authorize'
        ? AUDIT_ACTIONS.AGENT_AUTHORIZED
        : action === 'revoke'
          ? AUDIT_ACTIONS.AGENT_REVOKED
          : AUDIT_ACTIONS.CONFIG_UPDATED,
      resource_type: 'authorization',
      resource_id: transactionHash,
      metadata: {
        chainId,
        maxAmountPerTx,
        dailyLimit,
        action,
      },
      ip_address: getIPFromRequest(request),
      request_id: getRequestIDFromRequest(request),
      success: true,
    });

    return Response.json({
      success: true,
      message: `Authorization ${action} synced successfully`,
    });
  } catch (error) {
    logger.error('Error syncing authorization:', { error: error.message });
    return Response.json(
      { success: false, error: 'Failed to sync authorization' },
      { status: 500 }
    );
  }
}
