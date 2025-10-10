import { EIP7702TransactionBuilder } from './transactionBuilder';
import { ethers } from 'ethers';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { authMiddleware } from '../middleware/auth';

/**
 * EIP-7702 Transaction Building Endpoint
 * POST /api/eip7702
 */
export async function POST(request) {
  // Authentication required
  const authError = await authMiddleware(request);
  if (authError) return authError;

  // Rate limiting
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  try {
    const { userAddress, strategy, action } = await request.json();

    const chain = strategy.blockchain || 'ethereum';
    const provider = new ethers.JsonRpcProvider(
      chain === 'ethereum' 
        ? process.env.ETHEREUM_RPC_URL 
        : process.env.BASE_RPC_URL
    );

    const builder = new EIP7702TransactionBuilder(
      provider,
      process.env.CULTIV8_AGENT_ADDRESS || ethers.ZeroAddress,
      process.env.AGENT_VAULT_ADDRESS || ethers.ZeroAddress
    );

    switch (action) {
      case 'build': {
        // Build unsigned transaction for user to sign in frontend
        const result = await builder.buildUnsignedTransaction({
          userAddress,
          targetProtocol: strategy.protocolAddress,
          strategyCalldata: strategy.calldata,
          amount: strategy.amount,
        });

        return Response.json({
          success: true,
          ...result
        });
      }

      case 'estimate': {
        // Estimate gas cost
        const gasEstimate = await builder.estimateGas(strategy);
        const feeData = await provider.getFeeData();
        
        const gasCostWei = gasEstimate * (feeData.maxFeePerGas || 0n);
        const gasCostETH = Number(gasCostWei) / 1e18;

        return Response.json({
          success: true,
          gasEstimate: gasEstimate.toString(),
          estimatedCostETH: gasCostETH.toFixed(6),
          estimatedCostUSD: (gasCostETH * 3000).toFixed(2), // Rough ETH price estimate
        });
      }

      default:
        return Response.json(
          { error: 'Invalid action. Must be "build" or "estimate"' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('EIP-7702 error:', error);
    return Response.json(
      {
        error: 'Failed to build EIP-7702 transaction',
        message: error.message
      },
      { status: 500 }
    );
  }
}

