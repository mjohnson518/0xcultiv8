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

      return {
        totalTransactions: txHashes.length,
        recentTransactions: transactions.filter(Boolean),
        mevDetected: 0, // TODO: Implement detection logic
        potentialSavings: 0,
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
      const protected = await this.redis?.get('mev:stats:protected') || 0;
      const unprotected = await this.redis?.get('mev:stats:unprotected') || 0;
      const total = Number(protected) + Number(unprotected);

      return {
        totalTransactions: total,
        protectedTransactions: Number(protected),
        unprotectedTransactions: Number(unprotected),
        protectionRate: total > 0 ? ((Number(protected) / total) * 100).toFixed(2) : 0,
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

