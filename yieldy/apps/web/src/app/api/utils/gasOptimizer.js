import { ethers } from 'ethers';

/**
 * Gas Optimization and MEV Protection Utilities
 * Optimizes gas prices and protects against MEV attacks
 */
export class GasOptimizer {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Get optimal gas price for transaction based on priority
   * @param {string} priority - 'low' | 'medium' | 'high'
   * @returns {Promise<object>} - Gas price recommendation
   */
  async getOptimalGasPrice(priority = 'medium') {
    const feeData = await this.provider.getFeeData();

    const priorities = {
      low: { multiplier: 0.9, maxWaitBlocks: 10 },
      medium: { multiplier: 1.0, maxWaitBlocks: 3 },
      high: { multiplier: 1.2, maxWaitBlocks: 1 },
    };

    const config = priorities[priority] || priorities.medium;

    return {
      maxFeePerGas: (feeData.maxFeePerGas * BigInt(Math.floor(config.multiplier * 100))) / 100n,
      maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas * BigInt(Math.floor(config.multiplier * 100))) / 100n,
      estimatedWaitTime: config.maxWaitBlocks * 12, // seconds (12s per block)
      baseFee: feeData.gasPrice,
    };
  }

  /**
   * Assess MEV risk for a transaction
   * @param {object} transaction - Transaction to assess
   * @param {BigInt} amount - Amount involved
   * @returns {object} - MEV risk assessment
   */
  assessMEVRisk(transaction, amount) {
    const risks = [];
    let riskScore = 0;

    // Large value transactions are MEV targets
    const amountUSD = Number(amount) / 1e6; // Assuming USDC 6 decimals
    if (amountUSD > 100000) {
      risks.push('Large value transaction (>$100k)');
      riskScore += 4;
    } else if (amountUSD > 50000) {
      risks.push('Significant value transaction (>$50k)');
      riskScore += 3;
    } else if (amountUSD > 10000) {
      risks.push('Medium value transaction (>$10k)');
      riskScore += 2;
    }

    // DEX swaps are sandwich attack targets
    if (transaction.data && transaction.data.toLowerCase().includes('swap')) {
      risks.push('DEX swap detected - sandwich attack risk');
      riskScore += 5;
    }

    // Check for common MEV-prone function selectors
    if (transaction.data) {
      const selector = transaction.data.substring(0, 10);
      const mevProneSelectors = [
        '0x38ed1739', // swapExactTokensForTokens
        '0x7ff36ab5', // swapExactETHForTokens
        '0x18cbafe5', // swapExactTokensForETH
        '0xfb3bdb41', // swapETHForExactTokens
      ];

      if (mevProneSelectors.includes(selector)) {
        risks.push('MEV-prone function detected');
        riskScore += 4;
      }
    }

    // Liquidations are front-run targets
    if (transaction.data && transaction.data.includes('liquidate')) {
      risks.push('Liquidation transaction - front-running risk');
      riskScore += 5;
    }

    return {
      riskScore: Math.min(10, riskScore), // 0-10 scale
      riskLevel: riskScore > 7 ? 'HIGH' : riskScore > 4 ? 'MEDIUM' : 'LOW',
      risks,
      recommendation: riskScore > 7
        ? 'Use Flashbots or private mempool'
        : riskScore > 4
        ? 'Monitor closely or use private RPC'
        : 'Public mempool safe',
    };
  }

  /**
   * Build transaction with optimal gas and MEV protection
   * @param {object} transaction - Base transaction
   * @param {object} options - Options
   * @param {string} options.priority - Gas priority
   * @param {boolean} options.useFlashbots - Use Flashbots for MEV protection
   * @param {BigInt} options.amount - Amount for MEV risk assessment
   * @returns {Promise<object>} - Protected transaction with metadata
   */
  async buildProtectedTransaction(transaction, options = {}) {
    const {
      priority = 'medium',
      useFlashbots = false,
      amount = 0n,
    } = options;

    // Get optimal gas prices
    const gasPrice = await this.getOptimalGasPrice(priority);

    // Assess MEV risk
    const mevRisk = this.assessMEVRisk(transaction, amount);

    // Build protected transaction
    const protectedTx = {
      ...transaction,
      ...gasPrice,
      type: 2, // EIP-1559
    };

    // Add Flashbots metadata if requested and high risk
    if ((useFlashbots || mevRisk.riskScore > 7) && !transaction.flashbots) {
      const currentBlock = await this.provider.getBlockNumber();
      protectedTx.flashbots = {
        enabled: true,
        maxBlockNumber: currentBlock + 5, // Valid for next 5 blocks
        // Note: Actual Flashbots integration requires separate RPC endpoint
      };
    }

    // Estimate total cost
    const estimatedCost = await this.estimateTotalCost(protectedTx);

    return {
      transaction: protectedTx,
      mevRisk,
      estimatedCost,
      gasPrice,
      priority,
    };
  }

  /**
   * Estimate total transaction cost in USD
   * @param {object} transaction - Transaction with gas parameters
   * @returns {Promise<number>} - Cost in USD
   */
  async estimateTotalCost(transaction) {
    const gasLimit = transaction.gasLimit || 300000n;
    const maxFeePerGas = transaction.maxFeePerGas || 0n;
    const gasCostWei = gasLimit * maxFeePerGas;
    const gasCostEth = Number(gasCostWei) / 1e18;

    // Get ETH price (in production, use Chainlink or price oracle)
    // For now, fetch from a simple source or use estimate
    const ethPrice = await this.getETHPrice();

    return gasCostEth * ethPrice;
  }

  /**
   * Get current ETH price
   * @returns {Promise<number>} - ETH price in USD
   */
  async getETHPrice() {
    // TODO: Integrate with Chainlink price feed or reliable oracle
    // For now, return conservative estimate
    return 3000; // $3000 per ETH
  }

  /**
   * Batch multiple transactions using multicall
   * @param {Array<object>} transactions - Array of transactions
   * @returns {object} - Batched transaction
   */
  batchTransactions(transactions) {
    // Multicall3 is deployed at same address on all chains
    const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

    const calls = transactions.map(tx => ({
      target: tx.to,
      callData: tx.data,
      allowFailure: false,
    }));

    // Encode multicall aggregate3 function
    const multicallInterface = new ethers.Interface([
      'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) returns (tuple(bool success, bytes returnData)[])'
    ]);

    return {
      to: MULTICALL3_ADDRESS,
      data: multicallInterface.encodeFunctionData('aggregate3', [calls]),
      value: 0,
      description: `Batch ${transactions.length} transactions`,
    };
  }

  /**
   * Calculate slippage tolerance
   * @param {BigInt} expectedAmount - Expected amount
   * @param {number} slippagePercent - Slippage tolerance (default 0.5%)
   * @returns {BigInt} - Minimum amount with slippage
   */
  calculateMinAmountWithSlippage(expectedAmount, slippagePercent = 0.5) {
    const slippageBps = Math.floor(slippagePercent * 100); // Convert to basis points
    return (expectedAmount * BigInt(10000 - slippageBps)) / 10000n;
  }

  /**
   * Get user's current position in this protocol
   * @param {string} userAddress
   * @returns {Promise<object>} - Position details
   */
  async getUserPosition(userAddress) {
    throw new Error('getUserPosition() must be implemented by subclass');
  }

  /**
   * Helper to add buffer to gas estimates
   * @param {BigInt} estimate
   * @param {number} bufferPercent - Buffer percentage (default 20%)
   * @returns {BigInt}
   */
  addGasBuffer(estimate, bufferPercent = 20) {
    return (estimate * BigInt(100 + bufferPercent)) / 100n;
  }
}

