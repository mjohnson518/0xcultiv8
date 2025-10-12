import { getProtocolAdapter } from '@/app/api/protocols/adapters';
import { GasOptimizer } from '@/app/api/utils/gasOptimizer';
import { ethers } from 'ethers';
import { rateLimitMiddleware } from '@/app/api/middleware/rateLimit';
import { authMiddleware } from '@/app/api/middleware/auth';
import { validateRequest } from '@/app/api/middleware/validation';
import { z } from 'zod';

// Schema for transaction preview request
const PreviewSchema = z.object({
  userAddress: z.string().refine(val => ethers.isAddress(val)),
  protocol: z.enum(['aave', 'compound']),
  action: z.enum(['deposit', 'withdraw']),
  amount: z.string().or(z.number()),
  chainId: z.number().int().refine(val => [1, 8453].includes(val)),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

/**
 * Transaction Preview Endpoint
 * POST /api/execute/preview
 * Simulates transaction and returns gas estimates, MEV risk, success probability
 */
export async function POST(request) {
  // Authentication required
  const authError = await authMiddleware(request);
  if (authError) return authError;

  // Rate limiting
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  // Input validation
  const validationError = await validateRequest(PreviewSchema)(request);
  if (validationError) return validationError;

  try {
    const { userAddress, protocol, action, amount, chainId, priority } = request.validated;

    const chain = chainId === 1 ? 'ethereum' : 'base';
    const provider = new ethers.JsonRpcProvider(
      chainId === 1 ? process.env.ETHEREUM_RPC_URL : process.env.BASE_RPC_URL
    );

    // Get protocol adapter
    const adapter = getProtocolAdapter(protocol, chain);

    // Parse amount
    const amountBN = ethers.parseUnits(amount.toString(), 6); // USDC decimals

    // Build transactions
    let transactions;
    if (action === 'deposit') {
      transactions = await adapter.buildDepositTransaction(userAddress, amountBN);
    } else {
      transactions = [await adapter.buildWithdrawTransaction(userAddress, amountBN)];
    }

    // Simulate each transaction
    const simulations = await Promise.all(
      transactions.map(async (tx) => {
        const willSucceed = await adapter.simulateTransaction(tx, userAddress);
        return {
          transaction: tx,
          willSucceed,
        };
      })
    );

    // Check if any simulation failed
    const allWillSucceed = simulations.every(s => s.willSucceed);
    if (!allWillSucceed) {
      return Response.json({
        success: false,
        error: 'Transaction simulation failed - would revert on-chain',
        simulations: simulations.map(s => ({
          description: s.transaction.description,
          willSucceed: s.willSucceed,
        })),
      });
    }

    // Optimize gas for each transaction
    const gasOptimizer = new GasOptimizer(provider);
    const optimizedTxs = await Promise.all(
      transactions.map(async (tx) => {
        return await gasOptimizer.buildProtectedTransaction(tx, {
          priority: priority || 'medium',
          amount: amountBN,
        });
      })
    );

    // Calculate totals
    const totalGasCost = optimizedTxs.reduce((sum, tx) => sum + tx.estimatedCost, 0);
    const highestMEVRisk = Math.max(...optimizedTxs.map(tx => tx.mevRisk.riskScore));

    // Calculate net return after gas
    const netReturn = action === 'deposit'
      ? 0 // Will accrue over time
      : Number(amountBN) / 1e6 - totalGasCost;

    return Response.json({
      success: true,
      preview: {
        protocol,
        action,
        amount: Number(amountBN) / 1e6,
        chain,
        transactions: optimizedTxs.map((tx, i) => ({
          description: transactions[i].description,
          to: transactions[i].to,
          estimatedGas: tx.transaction.gasLimit?.toString() || 'N/A',
          estimatedCost: tx.estimatedCost.toFixed(2),
          mevRisk: tx.mevRisk,
        })),
        totalGasCost: totalGasCost.toFixed(2),
        netReturn: netReturn.toFixed(2),
        mevRisk: {
          score: highestMEVRisk,
          level: highestMEVRisk > 7 ? 'HIGH' : highestMEVRisk > 4 ? 'MEDIUM' : 'LOW',
          recommendations: optimizedTxs.flatMap(tx => tx.mevRisk.risks),
        },
        willSucceed: true,
        priority: priority || 'medium',
      },
    });
  } catch (error) {
    console.error('Preview error:', error);
    return Response.json(
      {
        success: false,
        error: 'Failed to generate transaction preview',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

