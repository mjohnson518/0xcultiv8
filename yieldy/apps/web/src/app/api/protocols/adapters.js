import { ethers } from 'ethers';
import { AaveV3Adapter } from './AaveV3Adapter.js';
import { CompoundV3Adapter } from './CompoundV3Adapter.js';
import { MorphoBlueAdapter } from './MorphoBlueAdapter.js';
import { EthenaAdapter } from './EthenaAdapter.js';

/**
 * Protocol Adapter Registry
 * Central point for accessing protocol adapters
 */

// Cache providers to avoid creating multiple instances
const providers = new Map();

// Track provider health for fallback
const providerHealth = new Map();

// Health check configuration
const HEALTH_CHECK_CONFIG = {
  intervalMs: parseInt(process.env.RPC_HEALTH_CHECK_INTERVAL) || 60000, // 1 minute
  timeoutMs: parseInt(process.env.RPC_HEALTH_CHECK_TIMEOUT) || 5000, // 5 seconds
  unhealthyThreshold: 3, // Mark unhealthy after 3 failed checks
  healthyThreshold: 2, // Mark healthy after 2 successful checks
};

// Track consecutive health check results
const healthCheckState = new Map();

/**
 * RPC Configuration with fallbacks
 *
 * SECURITY: Public RPC fallbacks have been removed for production safety.
 * Public RPCs have no SLA, are rate-limited, and could cause unpredictable behavior.
 * If primary and backup RPCs fail, the system will fail gracefully with a clear error.
 *
 * Required environment variables:
 * - ETHEREUM_RPC_URL: Primary Ethereum RPC (Alchemy, Infura, etc.)
 * - ETHEREUM_RPC_URL_BACKUP: Backup Ethereum RPC (optional but recommended)
 * - BASE_RPC_URL: Primary Base RPC
 * - BASE_RPC_URL_BACKUP: Backup Base RPC (optional but recommended)
 */
const RPC_CONFIG = {
  ethereum: {
    primary: () => process.env.ETHEREUM_RPC_URL,
    fallback: () => process.env.ETHEREUM_RPC_URL_BACKUP || process.env.ETHEREUM_RPC_FALLBACK,
  },
  base: {
    primary: () => process.env.BASE_RPC_URL,
    fallback: () => process.env.BASE_RPC_URL_BACKUP || process.env.BASE_RPC_FALLBACK,
  },
};

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

// =============================================================================
// RPC Health Checking
// =============================================================================

/**
 * Check health of a single RPC endpoint
 * @param {string} rpcUrl - RPC URL to check
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<{healthy: boolean, latencyMs: number, blockNumber?: number}>}
 */
async function checkRpcHealth(rpcUrl, timeoutMs = HEALTH_CHECK_CONFIG.timeoutMs) {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return { healthy: false, latencyMs, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    if (data.error) {
      return { healthy: false, latencyMs, error: data.error.message };
    }

    const blockNumber = parseInt(data.result, 16);
    return { healthy: true, latencyMs, blockNumber };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return { healthy: false, latencyMs, error: error.message };
  }
}

/**
 * Run health check for a chain and update state
 * @param {string} chain - Chain name
 */
async function runHealthCheck(chain) {
  const config = RPC_CONFIG[chain];
  if (!config) return;

  const primaryUrl = config.primary();
  const fallbackUrl = config.fallback();

  // Check primary
  if (primaryUrl) {
    const result = await checkRpcHealth(primaryUrl);
    updateHealthState(chain, 'primary', result.healthy);

    if (result.healthy) {
      console.log(`[RPC Health] ${chain} primary: OK (${result.latencyMs}ms, block ${result.blockNumber})`);
    } else {
      console.warn(`[RPC Health] ${chain} primary: FAILED - ${result.error}`);
    }
  }

  // Check fallback
  if (fallbackUrl) {
    const result = await checkRpcHealth(fallbackUrl);
    updateHealthState(chain, 'fallback', result.healthy);

    if (result.healthy) {
      console.log(`[RPC Health] ${chain} fallback: OK (${result.latencyMs}ms)`);
    } else {
      console.warn(`[RPC Health] ${chain} fallback: FAILED - ${result.error}`);
    }
  }
}

/**
 * Update health check state with hysteresis
 */
function updateHealthState(chain, type, isHealthy) {
  const key = `${chain}:${type}`;
  const state = healthCheckState.get(key) || {
    consecutiveSuccess: 0,
    consecutiveFailure: 0,
    healthy: true,
  };

  if (isHealthy) {
    state.consecutiveSuccess++;
    state.consecutiveFailure = 0;
    if (state.consecutiveSuccess >= HEALTH_CHECK_CONFIG.healthyThreshold) {
      state.healthy = true;
    }
  } else {
    state.consecutiveFailure++;
    state.consecutiveSuccess = 0;
    if (state.consecutiveFailure >= HEALTH_CHECK_CONFIG.unhealthyThreshold) {
      state.healthy = false;
      // Update provider health map to trigger fallback
      if (type === 'primary') {
        providerHealth.set(chain, { healthy: false, lastCheck: Date.now() });
        providers.delete(chain); // Force recreation with fallback
      }
    }
  }

  healthCheckState.set(key, state);
}

/**
 * Get RPC health status for all chains
 * @returns {object} Health status by chain
 */
export function getRpcHealthStatus() {
  const status = {};

  for (const chain of Object.keys(RPC_CONFIG)) {
    const primaryState = healthCheckState.get(`${chain}:primary`);
    const fallbackState = healthCheckState.get(`${chain}:fallback`);

    status[chain] = {
      primary: {
        configured: !!RPC_CONFIG[chain].primary(),
        healthy: primaryState?.healthy ?? true,
        consecutiveFailures: primaryState?.consecutiveFailure ?? 0,
      },
      fallback: {
        configured: !!RPC_CONFIG[chain].fallback(),
        healthy: fallbackState?.healthy ?? true,
        consecutiveFailures: fallbackState?.consecutiveFailure ?? 0,
      },
      usingFallback: providerHealth.get(chain)?.healthy === false,
    };
  }

  return status;
}

/**
 * Start periodic health checks
 */
let healthCheckInterval = null;

export function startHealthChecks() {
  if (healthCheckInterval) return;

  console.log('[RPC Health] Starting periodic health checks');

  // Run immediately
  runAllHealthChecks();

  // Then run periodically
  healthCheckInterval = setInterval(
    runAllHealthChecks,
    HEALTH_CHECK_CONFIG.intervalMs
  );
}

/**
 * Stop periodic health checks
 */
export function stopHealthChecks() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('[RPC Health] Stopped periodic health checks');
  }
}

/**
 * Run health checks for all chains
 */
async function runAllHealthChecks() {
  for (const chain of Object.keys(RPC_CONFIG)) {
    await runHealthCheck(chain);
  }
}

// Auto-start health checks in production
if (process.env.NODE_ENV === 'production' && process.env.RPC_HEALTH_CHECK_ENABLED !== 'false') {
  // Delay start to allow app initialization
  setTimeout(startHealthChecks, 10000);
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute with retry and exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {object} options - Retry options
 * @returns {Promise<any>} - Result of function
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = RETRY_CONFIG.maxRetries,
    initialDelayMs = RETRY_CONFIG.initialDelayMs,
    maxDelayMs = RETRY_CONFIG.maxDelayMs,
    backoffMultiplier = RETRY_CONFIG.backoffMultiplier,
    onRetry = null,
  } = options;

  let lastError;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on non-retryable errors
      if (error.code === 'INVALID_ARGUMENT' || error.code === 'UNSUPPORTED_OPERATION') {
        throw error;
      }

      if (attempt < maxRetries) {
        if (onRetry) {
          onRetry(attempt + 1, error);
        }
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Get or create RPC provider for a chain with fallback support
 * @param {string} chain - 'ethereum' or 'base'
 * @param {boolean} forceNew - Force creating a new provider (for fallback)
 * @returns {JsonRpcProvider}
 */
function getProvider(chain, forceNew = false) {
  const cacheKey = chain;

  if (!forceNew && providers.has(cacheKey)) {
    const cached = providers.get(cacheKey);
    // Check if provider is healthy
    const health = providerHealth.get(cacheKey);
    if (!health || health.healthy) {
      return cached;
    }
  }

  const config = RPC_CONFIG[chain];
  if (!config) {
    throw new Error(`Unknown chain: ${chain}`);
  }

  // Try primary RPC
  let rpcUrl = config.primary();
  let usingFallback = false;

  // If primary is not available or unhealthy, try fallback
  const health = providerHealth.get(cacheKey);
  if (!rpcUrl || (health && !health.healthy)) {
    rpcUrl = config.fallback();
    if (rpcUrl) {
      console.log(`[RPC] Using fallback RPC for ${chain}`);
      usingFallback = true;
    }
  }

  // SECURITY: No public fallback - fail gracefully with clear error
  if (!rpcUrl) {
    const errorMsg = `No RPC URL configured for chain: ${chain}. ` +
      `Please set ${chain === 'ethereum' ? 'ETHEREUM_RPC_URL' : 'BASE_RPC_URL'} environment variable. ` +
      'Public RPC fallbacks are disabled for security.';
    console.error(`[RPC] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    staticNetwork: true, // Avoid extra network calls
    batchMaxCount: 10,   // Enable batching
  });

  providers.set(cacheKey, provider);
  providerHealth.set(cacheKey, { healthy: true, lastCheck: Date.now() });

  return provider;
}

/**
 * Mark a provider as unhealthy and get fallback
 * @param {string} chain - Chain name
 * @returns {JsonRpcProvider} - Fallback provider
 */
function switchToFallback(chain) {
  providerHealth.set(chain, { healthy: false, lastCheck: Date.now() });
  providers.delete(chain); // Force new provider creation
  return getProvider(chain, true);
}

// Export retry utility for use by other modules (e.g., LLM calls)
export { withRetry };

/**
 * Execute a provider operation with automatic fallback
 * @param {string} chain - Chain name
 * @param {Function} operation - Operation to execute with provider
 * @returns {Promise<any>} - Result of operation
 */
export async function executeWithFallback(chain, operation) {
  const maxAttempts = 2; // Primary + fallback

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const provider = getProvider(chain, attempt > 0);

    try {
      return await withRetry(() => operation(provider), {
        maxRetries: 2,
        onRetry: (retryNum, error) => {
          console.warn(`[RPC] Retry ${retryNum} for ${chain}: ${error.message}`);
        },
      });
    } catch (error) {
      console.error(`[RPC] Provider failed for ${chain}:`, error.message);

      if (attempt < maxAttempts - 1) {
        console.log(`[RPC] Switching to fallback provider for ${chain}`);
        switchToFallback(chain);
      } else {
        throw error;
      }
    }
  }
}

/**
 * Get protocol adapter instance
 * @param {string} protocol - Protocol name ('aave', 'compound')
 * @param {string} chain - Chain name ('ethereum', 'base')
 * @returns {BaseAdapter} - Protocol adapter instance
 */
export function getProtocolAdapter(protocol, chain) {
  const provider = getProvider(chain);
  const chainId = chain === 'ethereum' ? 1 : 8453;

  const protocolLower = protocol.toLowerCase();

  switch (protocolLower) {
    case 'aave':
    case 'aave_v3':
      return new AaveV3Adapter(provider, chainId);

    case 'compound':
    case 'compound_v3':
      return new CompoundV3Adapter(provider, chainId);

    case 'morpho':
    case 'morpho_blue':
      return new MorphoBlueAdapter(provider, chainId);

    case 'ethena':
    case 'susde':
      // Ethena only supports Ethereum mainnet
      if (chainId !== 1) {
        throw new Error('Ethena is only supported on Ethereum mainnet');
      }
      return new EthenaAdapter(provider, chainId);

    default:
      throw new Error(`Unsupported protocol: ${protocol}`);
  }
}

/**
 * Get all supported protocols for a chain
 * @param {string} chain - Chain name
 * @returns {Array<string>} - Array of supported protocol names
 */
export function getSupportedProtocols(chain) {
  const protocols = {
    ethereum: ['aave', 'compound', 'morpho', 'ethena'],
    base: ['aave', 'compound', 'morpho'],
  };

  return protocols[chain] || [];
}

/**
 * Fetch live data for all supported protocols on a chain
 * @param {string} chain - Chain name
 * @returns {Promise<Array>} - Array of protocol data
 */
export async function fetchAllProtocolData(chain) {
  const protocols = getSupportedProtocols(chain);

  const results = await Promise.all(
    protocols.map(async (protocol) => {
      try {
        const adapter = getProtocolAdapter(protocol, chain);
        const [apyData, tvlData] = await Promise.all([
          adapter.getCurrentAPY(),
          adapter.getTVL(),
        ]);

        return {
          protocol,
          chain,
          apy: apyData.apy,
          tvl: tvlData.tvl,
          metadata: adapter.getMetadata(),
          lastUpdated: new Date().toISOString(),
          success: true,
        };
      } catch (error) {
        console.error(`Error fetching data for ${protocol} on ${chain}:`, error);
        return {
          protocol,
          chain,
          apy: 0,
          tvl: 0,
          success: false,
          error: error.message,
        };
      }
    })
  );

  return results;
}

/**
 * Refresh opportunity data from on-chain sources
 * Updates database with latest APY and TVL
 * @param {number} opportunityId - Opportunity to refresh
 * @returns {Promise<object>} - Updated opportunity
 */
export async function refreshOpportunityData(opportunityId) {
  try {
    const sql = (await import('../utils/sql')).default;
    
    // Get opportunity
    const opp = await sql`
      SELECT * FROM cultiv8_opportunities WHERE id = ${opportunityId}
    `;

    if (!opp || opp.length === 0) {
      throw new Error(`Opportunity ${opportunityId} not found`);
    }

    const opportunity = opp[0];

    // Get adapter
    const adapter = getProtocolAdapter(
      opportunity.protocol_name,
      opportunity.blockchain
    );

    // Fetch fresh data
    const [apyData, tvlData] = await Promise.all([
      adapter.getCurrentAPY(),
      adapter.getTVL(),
    ]);

    // Update database
    const updated = await sql`
      UPDATE cultiv8_opportunities
      SET 
        apy = ${apyData.apy},
        tvl = ${tvlData.tvl},
        last_updated = NOW()
      WHERE id = ${opportunityId}
      RETURNING *
    `;

    return updated[0];
  } catch (error) {
    console.error('Error refreshing opportunity data:', error);
    throw error;
  }
}

