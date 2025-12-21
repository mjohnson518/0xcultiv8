/**
 * MEV Protection Monitoring
 * Tracks transaction execution and detects potential MEV attacks
 */

import { getRedis } from '../../../../lib/redis.js';

/**
 * Transaction monitoring data structure
 */
class MEVMonitor {
  constructor() {
    this.redis = getRedis();
  }

  /**
   * Record transaction for MEV monitoring
   * @param {object} tx - Transaction details
   * @returns {Promise<void>}
   */
  async recordTransaction(tx) {
    const {
      hash,
      from,
      to,
      value,
      gasPrice,
      maxPriorityFeePerGas,
      timestamp = Date.now(),
      type, // 'swap', 'deposit', 'withdraw', etc.
    } = tx;

    const key = `mev:tx:${hash}`;
    const data = {
      hash,
      from,
      to,
      value: value.toString(),
      gasPrice: gasPrice?.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
      timestamp,
      type,
      monitored: true,
    };

    try {
      // Store for 7 days
      await this.redis?.set(key, JSON.stringify(data), { ex: 604800 });
      
      // Add to user's transaction list
      await this.redis?.lpush(`mev:user:${from}`, hash);
      await this.redis?.ltrim(`mev:user:${from}`, 0, 99); // Keep last 100
    } catch (error) {
      console.error('Failed to record MEV transaction:', error);
    }
  }

  /**
   * Check if transaction was front-run
   * @param {string} hash - Transaction hash
   * @param {number} blockNumber - Block number
   * @returns {Promise<object>} Analysis result
   */
  async checkFrontRunning(hash, blockNumber) {
    try {
      const key = `mev:tx:${hash}`;
      const data = await this.redis?.get(key);
      
      if (!data) {
        return { detected: false, reason: 'Transaction not monitored' };
      }

      const tx = JSON.parse(data);
      
      // Check for suspicious patterns:
      // 1. Transaction in same block with higher gas price
      // 2. Sandwich attack pattern
      // 3. Unusual slippage

      // For now, return basic monitoring status
      return {
        detected: false,
        hash,
        blockNumber,
        gasPrice: tx.gasPrice,
        monitored: true,
        timestamp: tx.timestamp,
      };
    } catch (error) {
      console.error('Failed to check front-running:', error);
      return { detected: false, error: error.message };
    }
  }

  /**
   * Get MEV statistics for a user
   * @param {string} address - User address
   * @returns {Promise<object>} MEV stats
   */
  async getUserMEVStats(address) {
    try {
      const txHashes = await this.redis?.lrange(`mev:user:${address}`, 0, -1) || [];
      
      const transactions = await Promise.all(
        txHashes.slice(0, 10).map(async (hash) => {
          const data = await this.redis?.get(`mev:tx:${hash}`);
          return data ? JSON.parse(data) : null;
        })
      );

      // Analyze transactions for MEV patterns
      const validTxs = transactions.filter(Boolean);
      const mevAnalysis = this.analyzeMEVPatterns(validTxs);

      return {
        totalTransactions: txHashes.length,
        recentTransactions: validTxs,
        mevDetected: mevAnalysis.detectedCount,
        potentialSavings: mevAnalysis.estimatedSavings,
        patterns: mevAnalysis.patterns,
      };
    } catch (error) {
      console.error('Failed to get MEV stats:', error);
      return {
        totalTransactions: 0,
        recentTransactions: [],
        error: error.message,
      };
    }
  }

  /**
   * Check if using Flashbots/private RPC
   * @param {string} rpcUrl - RPC URL being used
   * @returns {boolean} True if using MEV-protected RPC
   */
  isProtectedRPC(rpcUrl) {
    const protectedProviders = [
      'flashbots.net',
      'rpc.flashbots.net',
      'relay.flashbots.net',
      'builder0x69',
    ];

    return protectedProviders.some(provider => rpcUrl?.includes(provider));
  }

  /**
   * Analyze transactions for MEV patterns
   * Detects sandwich attacks, front-running, and other MEV extractions
   * @param {Array} transactions - Array of transaction objects
   * @returns {object} Analysis results
   */
  analyzeMEVPatterns(transactions) {
    if (!transactions || transactions.length === 0) {
      return { detectedCount: 0, estimatedSavings: 0, patterns: [] };
    }

    const patterns = [];
    let detectedCount = 0;
    let estimatedSavings = 0;

    // Sort transactions by timestamp
    const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < sorted.length; i++) {
      const tx = sorted[i];

      // Pattern 1: Abnormally high gas price for swap transactions
      if (tx.type === 'swap' && tx.gasPrice) {
        const gasPriceGwei = Number(tx.gasPrice) / 1e9;
        if (gasPriceGwei > 100) { // Unusually high gas price
          patterns.push({
            type: 'high_gas_price',
            txHash: tx.hash,
            gasPrice: gasPriceGwei,
            timestamp: tx.timestamp,
            severity: gasPriceGwei > 500 ? 'high' : 'medium',
          });
          detectedCount++;
          // Estimate savings: difference from average gas price
          estimatedSavings += (gasPriceGwei - 50) * 21000 / 1e9; // Rough ETH estimate
        }
      }

      // Pattern 2: Rapid sequential transactions (potential sandwich)
      if (i > 0 && i < sorted.length - 1) {
        const prevTx = sorted[i - 1];
        const nextTx = sorted[i + 1];
        const timeDiff1 = tx.timestamp - prevTx.timestamp;
        const timeDiff2 = nextTx.timestamp - tx.timestamp;

        // Check for sandwich pattern: buy -> victim -> sell in quick succession
        if (timeDiff1 < 15000 && timeDiff2 < 15000) { // Within 15 seconds each
          if (prevTx.type === 'swap' && tx.type === 'swap' && nextTx.type === 'swap') {
            patterns.push({
              type: 'potential_sandwich',
              txHashes: [prevTx.hash, tx.hash, nextTx.hash],
              timestamps: [prevTx.timestamp, tx.timestamp, nextTx.timestamp],
              severity: 'high',
            });
            detectedCount++;
            // Estimate: 0.5-2% of transaction value
            estimatedSavings += Number(tx.value) * 0.01 / 1e6;
          }
        }
      }

      // Pattern 3: Large value transaction without MEV protection
      const valueUSD = Number(tx.value) / 1e6;
      if (valueUSD > 10000 && !tx.mevProtected) {
        patterns.push({
          type: 'unprotected_large_tx',
          txHash: tx.hash,
          value: valueUSD,
          timestamp: tx.timestamp,
          severity: valueUSD > 100000 ? 'critical' : 'high',
          recommendation: 'Use Flashbots RPC for large transactions',
        });
      }
    }

    return {
      detectedCount,
      estimatedSavings: Math.round(estimatedSavings * 100) / 100,
      patterns,
      analyzedCount: transactions.length,
    };
  }

  /**
   * Get recommended RPC based on transaction type
   * @param {string} txType - Transaction type ('swap', 'deposit', etc.)
   * @param {number} value - Transaction value in wei
   * @returns {string} Recommended RPC URL
   */
  getRecommendedRPC(txType, value) {
    const enableMEV = process.env.ENABLE_MEV_PROTECTION === 'true';
    const flashbotsRPC = process.env.FLASHBOTS_RPC_URL;

    // Use Flashbots for swaps and high-value transactions
    const mevProneTxTypes = ['swap', 'exchange', 'trade'];
    const isHighValue = value > 1000 * 1e6; // > $1000

    if (enableMEV && flashbotsRPC && (mevProneTxTypes.includes(txType) || isHighValue)) {
      return flashbotsRPC;
    }

    // Default to public RPC for simple transactions
    return process.env.ETHEREUM_RPC_URL || process.env.BASE_RPC_URL;
  }

  /**
   * Log MEV protection decision
   * @param {object} decision - MEV protection decision details
   * @returns {Promise<void>}
   */
  async logMEVDecision(decision) {
    const {
      transactionHash,
      rpcUsed,
      protectionEnabled,
      reason,
      timestamp = Date.now(),
    } = decision;

    try {
      const key = `mev:decision:${transactionHash}`;
      await this.redis?.set(
        key,
        JSON.stringify({ rpcUsed, protectionEnabled, reason, timestamp }),
        { ex: 604800 } // 7 days
      );

      // Increment counters for analytics
      if (protectionEnabled) {
        await this.redis?.incr('mev:stats:protected');
      } else {
        await this.redis?.incr('mev:stats:unprotected');
      }
    } catch (error) {
      console.error('Failed to log MEV decision:', error);
    }
  }

  /**
   * Get MEV protection statistics
   * @returns {Promise<object>} MEV stats
   */
  async getProtectionStats() {
    try {
      const protectedCount = await this.redis?.get('mev:stats:protected') || 0;
      const unprotectedCount = await this.redis?.get('mev:stats:unprotected') || 0;
      const total = Number(protectedCount) + Number(unprotectedCount);

      return {
        totalTransactions: total,
        protectedTransactions: Number(protectedCount),
        unprotectedTransactions: Number(unprotectedCount),
        protectionRate: total > 0 ? ((Number(protectedCount) / total) * 100).toFixed(2) : 0,
      };
    } catch (error) {
      console.error('Failed to get protection stats:', error);
      return {
        totalTransactions: 0,
        protectedTransactions: 0,
        unprotectedTransactions: 0,
        protectionRate: 0,
        error: error.message,
      };
    }
  }
}

// Singleton instance
let mevMonitor = null;

export function getMEVMonitor() {
  if (!mevMonitor) {
    mevMonitor = new MEVMonitor();
  }
  return mevMonitor;
}

export default getMEVMonitor;

