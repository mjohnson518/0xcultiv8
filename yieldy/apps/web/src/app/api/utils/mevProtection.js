/**
 * MEV Protection Module
 * Protects transactions from sandwich attacks, front-running, and other MEV extraction
 *
 * Features:
 * - Flashbots Protect RPC integration
 * - Private mempool submission
 * - Transaction simulation
 * - Slippage protection
 * - MEV risk assessment
 *
 * @module mevProtection
 */

import { ethers } from 'ethers';
import { log } from './logger.js';
import { alertManager, ALERT_TEMPLATES } from './alerting.js';

/**
 * MEV Risk Levels
 */
export const MEV_RISK_LEVEL = {
  NONE: 'none',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * Flashbots RPC endpoints
 */
const FLASHBOTS_RPC = {
  mainnet: 'https://rpc.flashbots.net',
  goerli: 'https://rpc-goerli.flashbots.net',
  sepolia: 'https://rpc-sepolia.flashbots.net',
};

/**
 * MEV-protected RPC endpoints (alternatives)
 */
const PROTECTED_RPC = {
  // Flashbots Protect
  flashbots: {
    mainnet: 'https://rpc.flashbots.net',
    description: 'Flashbots Protect - sends txs directly to builders',
  },
  // MEV Blocker by CoW Protocol
  mevBlocker: {
    mainnet: 'https://rpc.mevblocker.io',
    description: 'MEV Blocker - OFA with MEV rebates',
  },
  // Securerpc by Manifold
  secureRpc: {
    mainnet: 'https://api.securerpc.com/v1',
    description: 'Secure RPC - frontrunning protection',
  },
};

/**
 * MEV Protection Manager
 */
export class MEVProtection {
  constructor(config = {}) {
    this.config = {
      enabled: process.env.MEV_PROTECTION_ENABLED !== 'false',
      preferredProvider: process.env.MEV_PROVIDER || 'flashbots',
      maxSlippageBps: parseInt(process.env.MAX_SLIPPAGE_BPS) || 50, // 0.5%
      simulateBeforeSubmit: true,
      alertOnHighRisk: true,
      ...config,
    };

    // Transaction value thresholds for MEV risk assessment
    this.riskThresholds = {
      low: 1000,      // $1k - minimal risk
      medium: 10000,  // $10k - moderate risk
      high: 50000,    // $50k - high risk
      critical: 100000, // $100k - critical risk
    };

    // Initialize protected provider
    this.protectedProvider = null;
    this.standardProvider = null;
  }

  /**
   * Initialize MEV-protected provider
   * @param {number} chainId - Chain ID
   * @returns {ethers.JsonRpcProvider}
   */
  async getProtectedProvider(chainId = 1) {
    if (chainId !== 1) {
      // Flashbots only fully supports mainnet
      log.warn('MEV protection limited on non-mainnet chains', { chainId });
      return null;
    }

    if (this.protectedProvider) {
      return this.protectedProvider;
    }

    const provider = this.config.preferredProvider;
    const rpcUrl = PROTECTED_RPC[provider]?.mainnet || FLASHBOTS_RPC.mainnet;

    this.protectedProvider = new ethers.JsonRpcProvider(rpcUrl);

    log.info('MEV protected provider initialized', { provider, rpcUrl });
    return this.protectedProvider;
  }

  /**
   * Assess MEV risk for a transaction
   * @param {object} txDetails - Transaction details
   * @returns {object} - Risk assessment
   */
  assessMEVRisk(txDetails) {
    const {
      value = 0,
      tokenAmount = 0,
      txType = 'unknown',
      protocol = 'unknown',
      gasPrice = 0,
    } = txDetails;

    // Calculate value in USD (simplified - in production, use price feeds)
    const valueUSD = Math.max(value, tokenAmount);

    // Determine base risk level from value
    let riskLevel = MEV_RISK_LEVEL.NONE;
    let riskScore = 0;

    if (valueUSD >= this.riskThresholds.critical) {
      riskLevel = MEV_RISK_LEVEL.CRITICAL;
      riskScore = 90;
    } else if (valueUSD >= this.riskThresholds.high) {
      riskLevel = MEV_RISK_LEVEL.HIGH;
      riskScore = 70;
    } else if (valueUSD >= this.riskThresholds.medium) {
      riskLevel = MEV_RISK_LEVEL.MEDIUM;
      riskScore = 50;
    } else if (valueUSD >= this.riskThresholds.low) {
      riskLevel = MEV_RISK_LEVEL.LOW;
      riskScore = 20;
    }

    // Adjust risk based on transaction type
    const typeMultipliers = {
      swap: 1.5,          // Swaps are highly MEV-vulnerable
      deposit: 0.5,       // Deposits are less vulnerable
      withdraw: 0.7,      // Withdrawals moderately vulnerable
      approve: 0.1,       // Approvals minimal risk
      transfer: 0.3,      // Simple transfers low risk
      rebalance: 1.2,     // Rebalances moderately vulnerable
      unknown: 1.0,
    };

    riskScore *= typeMultipliers[txType] || 1.0;

    // Adjust based on gas price (high gas = more competition = more MEV risk)
    const avgGas = 30; // gwei baseline
    if (gasPrice > avgGas * 2) {
      riskScore *= 1.2; // High congestion
    }

    // Final risk level
    if (riskScore >= 80) riskLevel = MEV_RISK_LEVEL.CRITICAL;
    else if (riskScore >= 60) riskLevel = MEV_RISK_LEVEL.HIGH;
    else if (riskScore >= 40) riskLevel = MEV_RISK_LEVEL.MEDIUM;
    else if (riskScore >= 15) riskLevel = MEV_RISK_LEVEL.LOW;

    const recommendations = this.getRecommendations(riskLevel, txDetails);

    return {
      riskLevel,
      riskScore: Math.min(100, Math.round(riskScore)),
      valueUSD,
      recommendations,
      shouldUseProtection: riskLevel !== MEV_RISK_LEVEL.NONE,
      protectedRpcRecommended: riskScore >= 40,
    };
  }

  /**
   * Get recommendations based on risk level
   */
  getRecommendations(riskLevel, txDetails) {
    const recommendations = [];

    if (riskLevel === MEV_RISK_LEVEL.CRITICAL || riskLevel === MEV_RISK_LEVEL.HIGH) {
      recommendations.push({
        action: 'use_flashbots',
        description: 'Submit transaction through Flashbots Protect to avoid public mempool',
        priority: 'critical',
      });
      recommendations.push({
        action: 'increase_slippage',
        description: 'Consider slightly higher slippage tolerance to ensure execution',
        priority: 'medium',
      });
      recommendations.push({
        action: 'split_transaction',
        description: 'Consider splitting into smaller transactions',
        priority: 'optional',
      });
    }

    if (riskLevel === MEV_RISK_LEVEL.MEDIUM) {
      recommendations.push({
        action: 'use_protected_rpc',
        description: 'Use MEV-protected RPC endpoint',
        priority: 'recommended',
      });
    }

    if (txDetails.txType === 'swap') {
      recommendations.push({
        action: 'set_deadline',
        description: 'Set reasonable transaction deadline to prevent stale execution',
        priority: 'high',
      });
      recommendations.push({
        action: 'use_twap',
        description: 'For large swaps, consider TWAP execution',
        priority: riskLevel === MEV_RISK_LEVEL.CRITICAL ? 'high' : 'optional',
      });
    }

    return recommendations;
  }

  /**
   * Calculate optimal slippage tolerance
   * @param {object} txDetails - Transaction details
   * @returns {object} - Slippage recommendation
   */
  calculateSlippage(txDetails) {
    const { valueUSD = 0, txType = 'unknown', volatility = 'normal' } = txDetails;

    // Base slippage in basis points
    let slippageBps = 30; // 0.3% default

    // Adjust by transaction type
    const typeAdjustments = {
      swap: 50,      // Swaps need more slippage
      deposit: 10,   // Deposits minimal
      withdraw: 20,  // Withdrawals low
      rebalance: 30, // Rebalances moderate
    };

    slippageBps = typeAdjustments[txType] || slippageBps;

    // Adjust by value (larger = tighter slippage needed for better execution)
    if (valueUSD > 100000) {
      slippageBps = Math.max(slippageBps, 100); // At least 1% for large trades
    } else if (valueUSD > 50000) {
      slippageBps = Math.max(slippageBps, 75);
    }

    // Adjust by volatility
    if (volatility === 'high') {
      slippageBps *= 1.5;
    } else if (volatility === 'extreme') {
      slippageBps *= 2;
    }

    // Cap at max configured slippage
    slippageBps = Math.min(slippageBps, this.config.maxSlippageBps);

    return {
      slippageBps,
      slippagePercent: slippageBps / 100,
      minAmountOut: valueUSD * (1 - slippageBps / 10000),
      recommendation: slippageBps <= 50 ? 'tight' : slippageBps <= 100 ? 'moderate' : 'wide',
    };
  }

  /**
   * Submit transaction through protected RPC
   * @param {object} tx - Signed transaction
   * @param {object} options - Submission options
   * @returns {Promise<object>} - Submission result
   */
  async submitProtected(tx, options = {}) {
    const { chainId = 1, signer, waitForInclusion = true } = options;

    if (!this.config.enabled) {
      log.warn('MEV protection disabled, using standard submission');
      return this.submitStandard(tx, options);
    }

    try {
      const provider = await this.getProtectedProvider(chainId);

      if (!provider) {
        log.warn('Protected provider not available, falling back to standard');
        return this.submitStandard(tx, options);
      }

      // Assess risk before submission
      const riskAssessment = this.assessMEVRisk({
        value: tx.value ? parseFloat(ethers.formatEther(tx.value)) : 0,
        tokenAmount: options.tokenAmountUSD || 0,
        txType: options.txType || 'unknown',
      });

      // Alert on high-risk transactions
      if (this.config.alertOnHighRisk && riskAssessment.riskLevel === MEV_RISK_LEVEL.CRITICAL) {
        await alertManager.send(ALERT_TEMPLATES.mevDetected(
          tx.hash || 'pending',
          riskAssessment.valueUSD,
          { riskLevel: riskAssessment.riskLevel, riskScore: riskAssessment.riskScore }
        ));
      }

      log.info('Submitting transaction through protected RPC', {
        provider: this.config.preferredProvider,
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.riskScore,
      });

      // Submit to protected RPC
      const response = await provider.broadcastTransaction(tx.serialized || tx);

      log.info('Transaction submitted to protected mempool', {
        hash: response.hash,
        nonce: response.nonce,
      });

      if (waitForInclusion) {
        const receipt = await response.wait();
        log.info('Protected transaction confirmed', {
          hash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
        });
        return {
          success: true,
          hash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          protected: true,
          riskAssessment,
        };
      }

      return {
        success: true,
        hash: response.hash,
        protected: true,
        riskAssessment,
      };
    } catch (error) {
      log.error('Protected submission failed', { error: error.message });

      // Check if we should fallback or fail
      if (options.allowFallback !== false) {
        log.warn('Falling back to standard submission');
        return this.submitStandard(tx, { ...options, fallbackReason: error.message });
      }

      throw error;
    }
  }

  /**
   * Submit transaction through standard RPC (with warnings)
   */
  async submitStandard(tx, options = {}) {
    const { chainId = 1, fallbackReason = null } = options;

    const rpcUrl = chainId === 1
      ? process.env.ETHEREUM_RPC_URL
      : process.env.BASE_RPC_URL;

    if (!this.standardProvider || this.standardProvider._network?.chainId !== chainId) {
      this.standardProvider = new ethers.JsonRpcProvider(rpcUrl);
    }

    const riskAssessment = this.assessMEVRisk({
      value: tx.value ? parseFloat(ethers.formatEther(tx.value)) : 0,
      tokenAmount: options.tokenAmountUSD || 0,
      txType: options.txType || 'unknown',
    });

    if (riskAssessment.riskLevel !== MEV_RISK_LEVEL.NONE) {
      log.warn('Submitting MEV-vulnerable transaction to public mempool', {
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.riskScore,
        fallbackReason,
      });
    }

    const response = await this.standardProvider.broadcastTransaction(tx.serialized || tx);
    const receipt = await response.wait();

    return {
      success: true,
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      protected: false,
      riskAssessment,
      fallbackReason,
    };
  }

  /**
   * Simulate transaction to check for potential issues
   * @param {object} tx - Transaction object
   * @param {ethers.Provider} provider - Provider to use
   * @returns {Promise<object>} - Simulation result
   */
  async simulateTransaction(tx, provider) {
    try {
      const result = await provider.call({
        to: tx.to,
        data: tx.data,
        value: tx.value,
        from: tx.from,
        gasLimit: tx.gasLimit,
      });

      // Check for revert
      if (result.startsWith('0x08c379a0')) {
        // Error(string) selector
        const reason = ethers.AbiCoder.defaultAbiCoder().decode(
          ['string'],
          '0x' + result.slice(10)
        )[0];
        return {
          success: false,
          reverted: true,
          reason,
        };
      }

      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Detect potential sandwich attack by analyzing pending transactions
   * (Requires mempool access - simplified implementation)
   */
  async detectSandwichRisk(tx, options = {}) {
    // In production, this would:
    // 1. Monitor pending transactions in the mempool
    // 2. Look for transactions to the same DEX/pool
    // 3. Analyze if your transaction could be sandwiched

    // Simplified risk assessment based on transaction characteristics
    const { protocol, slippage, valueUSD } = options;

    const indicators = {
      highValue: valueUSD > 50000,
      wideSlippage: slippage > 100, // > 1%
      popularDex: ['uniswap', 'sushiswap', 'curve'].includes(protocol?.toLowerCase()),
      isSwap: tx.data?.includes('0x38ed1739') || tx.data?.includes('0x7ff36ab5'), // swap signatures
    };

    const sandwichRisk =
      (indicators.highValue ? 40 : 0) +
      (indicators.wideSlippage ? 25 : 0) +
      (indicators.popularDex ? 20 : 0) +
      (indicators.isSwap ? 15 : 0);

    return {
      risk: sandwichRisk > 60 ? 'high' : sandwichRisk > 30 ? 'medium' : 'low',
      score: sandwichRisk,
      indicators,
      recommendation: sandwichRisk > 60
        ? 'Strongly recommend using Flashbots Protect'
        : sandwichRisk > 30
          ? 'Consider using protected RPC'
          : 'Standard submission acceptable',
    };
  }

  /**
   * Get current MEV protection status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      preferredProvider: this.config.preferredProvider,
      maxSlippageBps: this.config.maxSlippageBps,
      protectedProviderConnected: !!this.protectedProvider,
      supportedChains: [1], // Currently only mainnet
    };
  }
}

// Singleton instance
export const mevProtection = new MEVProtection();

/**
 * Convenience function to submit with MEV protection
 */
export async function submitWithMEVProtection(tx, options = {}) {
  return mevProtection.submitProtected(tx, options);
}

/**
 * Convenience function to assess MEV risk
 */
export function assessMEVRisk(txDetails) {
  return mevProtection.assessMEVRisk(txDetails);
}

/**
 * Convenience function to calculate slippage
 */
export function calculateSlippage(txDetails) {
  return mevProtection.calculateSlippage(txDetails);
}
