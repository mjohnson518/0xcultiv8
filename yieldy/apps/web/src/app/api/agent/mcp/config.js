/**
 * MCP Servers Configuration
 * Centralized configuration for all Cultiv8 MCP servers
 *
 * Environment variables can override default values
 */

export const MCP_CONFIG = {
  // ==========================================
  // GENERAL SETTINGS
  // ==========================================

  /**
   * Maximum character limit for MCP responses
   * MCP protocol recommends keeping responses concise
   */
  CHARACTER_LIMIT: parseInt(process.env.MCP_CHARACTER_LIMIT || '25000'),

  /**
   * Supported blockchain networks
   */
  SUPPORTED_CHAINS: ['ethereum', 'base'],

  /**
   * Server versions
   */
  VERSIONS: {
    defi_oracle: '2.0.0',
    gas_optimizer: '2.0.0',
    portfolio_management: '2.0.0',
  },

  // ==========================================
  // PROTOCOL ADDRESSES
  // ==========================================

  PROTOCOLS: {
    aave_v3: {
      ethereum: process.env.AAVE_V3_ETHEREUM || '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      base: process.env.AAVE_V3_BASE || '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    },
    compound_v3: {
      ethereum: process.env.COMPOUND_V3_ETHEREUM || '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
      base: process.env.COMPOUND_V3_BASE || '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf',
    },
  },

  // ==========================================
  // RISK SCORING WEIGHTS
  // ==========================================

  /**
   * Multi-dimensional risk assessment weights
   * Total must equal 1.0
   */
  RISK_WEIGHTS: {
    protocol: parseFloat(process.env.RISK_WEIGHT_PROTOCOL || '0.40'),  // 40%
    financial: parseFloat(process.env.RISK_WEIGHT_FINANCIAL || '0.35'), // 35%
    technical: parseFloat(process.env.RISK_WEIGHT_TECHNICAL || '0.15'), // 15%
    market: parseFloat(process.env.RISK_WEIGHT_MARKET || '0.10'),       // 10%
  },

  /**
   * Risk score thresholds
   */
  RISK_THRESHOLDS: {
    very_low: 3,    // < 3 = Very Low Risk
    low: 5,         // < 5 = Low Risk
    moderate: 7,    // < 7 = Moderate Risk
    high: 9,        // < 9 = High Risk
                    // >= 9 = Very High Risk
  },

  // ==========================================
  // GAS OPTIMIZATION SETTINGS
  // ==========================================

  /**
   * Gas unit estimates by transaction type
   */
  GAS_ESTIMATES: {
    deposit: parseInt(process.env.GAS_ESTIMATE_DEPOSIT || '150000'),
    withdraw: parseInt(process.env.GAS_ESTIMATE_WITHDRAW || '180000'),
    rebalance: parseInt(process.env.GAS_ESTIMATE_REBALANCE || '250000'),
    swap: parseInt(process.env.GAS_ESTIMATE_SWAP || '200000'),
    compound: parseInt(process.env.GAS_ESTIMATE_COMPOUND || '120000'),
  },

  /**
   * Gas price multipliers by urgency level
   */
  GAS_MULTIPLIERS: {
    immediate: {
      base: 1.5,
      priority: 3.0,
    },
    fast: {
      base: 1.2,
      priority: 2.0,
    },
    normal: {
      base: 1.1,
      priority: 1.5,
    },
    slow: {
      base: 1.0,
      priority: 1.0,
    },
  },

  /**
   * Gas price thresholds (in gwei)
   */
  GAS_THRESHOLDS: {
    low: 10,        // < 10 gwei = Low congestion
    moderate: 30,   // < 30 gwei = Moderate congestion
    high: 50,       // < 50 gwei = High congestion
                    // >= 50 gwei = Very High congestion
  },

  // ==========================================
  // MEV PROTECTION SETTINGS
  // ==========================================

  /**
   * MEV risk thresholds by transaction value (USD)
   */
  MEV_THRESHOLDS: {
    critical: parseFloat(process.env.MEV_THRESHOLD_CRITICAL || '10000'), // > $10k = Critical
    high: parseFloat(process.env.MEV_THRESHOLD_HIGH || '1000'),          // > $1k = High
                                                                          // < $1k = Medium/Low
  },

  /**
   * Transaction types susceptible to MEV
   */
  MEV_RISK_TYPES: ['swap', 'deposit_large', 'withdraw_large', 'rebalance'],

  /**
   * MEV protection RPC endpoints
   */
  MEV_PROTECTION: {
    flashbots: process.env.FLASHBOTS_RPC_URL || null,
    eden: process.env.EDEN_RPC_URL || null,
  },

  // ==========================================
  // PORTFOLIO OPTIMIZATION SETTINGS
  // ==========================================

  /**
   * Portfolio rebalancing thresholds
   */
  REBALANCING: {
    default_threshold_percent: parseFloat(process.env.REBALANCE_THRESHOLD || '5.0'), // 5% drift
    max_gas_cost_percent: parseFloat(process.env.MAX_GAS_COST_PERCENT || '0.5'),    // 0.5% of portfolio
    min_rebalance_amount: parseFloat(process.env.MIN_REBALANCE_AMOUNT || '100'),    // $100 minimum
    max_single_position_percent: parseFloat(process.env.MAX_POSITION_PERCENT || '40'), // 40% max
  },

  /**
   * Kelly Criterion settings
   */
  KELLY_CRITERION: {
    full_kelly: 1.0,
    half_kelly: 0.5,
    quarter_kelly: 0.25,  // Recommended for safety
    default: 0.25,        // Use quarter Kelly by default
  },

  /**
   * Performance benchmarks (annual %)
   */
  BENCHMARKS: {
    risk_free: 3.0,        // Treasury rate
    market_average: 8.5,   // DeFi market average APY
    target_sharpe: 1.5,    // Target Sharpe ratio
  },

  // ==========================================
  // YIELD OPPORTUNITY FILTERS
  // ==========================================

  OPPORTUNITY_FILTERS: {
    min_apy: parseFloat(process.env.MIN_APY || '5.0'),           // 5% minimum APY
    max_risk: parseFloat(process.env.MAX_RISK || '7.0'),          // 7/10 max risk
    min_tvl: parseFloat(process.env.MIN_TVL || '1000000'),        // $1M minimum TVL
    min_liquidity: parseFloat(process.env.MIN_LIQUIDITY || '100000'), // $100k minimum liquidity
  },

  // ==========================================
  // DATABASE & CACHING
  // ==========================================

  DATABASE: {
    connection_timeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),  // 2 seconds
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '5000'),            // 5 seconds
    max_pool_size: parseInt(process.env.DB_MAX_POOL_SIZE || '20'),
    idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),             // 30 seconds
  },

  CACHE: {
    ttl: parseInt(process.env.CACHE_TTL || '60000'),             // 60 seconds default TTL
    max_entries: parseInt(process.env.CACHE_MAX_ENTRIES || '100'),

    // TTL by data type
    protocol_data: parseInt(process.env.CACHE_TTL_PROTOCOL || '300000'),        // 5 minutes
    gas_prices: parseInt(process.env.CACHE_TTL_GAS || '30000'),                 // 30 seconds
    portfolio_data: parseInt(process.env.CACHE_TTL_PORTFOLIO || '120000'),      // 2 minutes
    market_conditions: parseInt(process.env.CACHE_TTL_MARKET || '300000'),      // 5 minutes
  },

  // ==========================================
  // LOGGING & MONITORING
  // ==========================================

  LOGGING: {
    level: process.env.LOG_LEVEL || 'info',         // debug, info, warn, error
    format: process.env.LOG_FORMAT || 'json',       // json, simple
    mcp_operations: process.env.LOG_MCP_OPS !== 'false', // Log all MCP operations
    performance_tracking: process.env.LOG_PERF !== 'false', // Track performance metrics
  },

  MONITORING: {
    enabled: process.env.MONITORING_ENABLED !== 'false',
    metrics_interval: parseInt(process.env.METRICS_INTERVAL || '60000'), // 60 seconds
    health_check_interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
  },

  // ==========================================
  // RATE LIMITING
  // ==========================================

  RATE_LIMITS: {
    // Per MCP tool
    tools: {
      discover_yield_opportunities: {
        max_calls: parseInt(process.env.RATE_LIMIT_DISCOVER || '60'),
        window_ms: 60000, // per minute
      },
      optimize_transaction: {
        max_calls: parseInt(process.env.RATE_LIMIT_OPTIMIZE || '120'),
        window_ms: 60000,
      },
      analyze_rebalancing: {
        max_calls: parseInt(process.env.RATE_LIMIT_REBALANCE || '30'),
        window_ms: 60000,
      },
    },

    // Global per server
    global: {
      max_calls: parseInt(process.env.RATE_LIMIT_GLOBAL || '300'),
      window_ms: 60000,
    },
  },

  // ==========================================
  // FEATURE FLAGS
  // ==========================================

  FEATURES: {
    enable_resources: process.env.ENABLE_MCP_RESOURCES !== 'false',
    enable_prompts: process.env.ENABLE_MCP_PROMPTS !== 'false',
    enable_sampling: process.env.ENABLE_MCP_SAMPLING === 'true',
    enable_caching: process.env.ENABLE_MCP_CACHE !== 'false',
    enable_telemetry: process.env.ENABLE_MCP_TELEMETRY !== 'false',
    enable_mev_protection: process.env.ENABLE_MEV_PROTECTION !== 'false',
  },

  // ==========================================
  // ERROR HANDLING
  // ==========================================

  ERROR_HANDLING: {
    include_stack_traces: process.env.NODE_ENV === 'development',
    include_suggestions: true,
    include_request_id: true,
    retry_attempts: parseInt(process.env.ERROR_RETRY_ATTEMPTS || '3'),
    retry_delay_ms: parseInt(process.env.ERROR_RETRY_DELAY || '1000'),
  },

  // ==========================================
  // EXTERNAL SERVICES
  // ==========================================

  EXTERNAL_SERVICES: {
    // Price oracles
    eth_price_source: process.env.ETH_PRICE_SOURCE || 'coingecko',
    price_update_interval: parseInt(process.env.PRICE_UPDATE_INTERVAL || '60000'), // 1 minute

    // Gas oracles
    gas_oracle_source: process.env.GAS_ORACLE_SOURCE || 'rpc',

    // RPC providers
    rpc_timeout: parseInt(process.env.RPC_TIMEOUT || '10000'), // 10 seconds
    rpc_retry_attempts: parseInt(process.env.RPC_RETRY_ATTEMPTS || '3'),
  },
};

/**
 * Validate configuration on load
 */
export function validateConfig() {
  const errors = [];

  // Validate risk weights sum to 1.0
  const riskWeightSum = Object.values(MCP_CONFIG.RISK_WEIGHTS).reduce((a, b) => a + b, 0);
  if (Math.abs(riskWeightSum - 1.0) > 0.01) {
    errors.push(`Risk weights must sum to 1.0, got ${riskWeightSum}`);
  }

  // Validate required protocol addresses
  for (const [protocol, chains] of Object.entries(MCP_CONFIG.PROTOCOLS)) {
    for (const [chain, address] of Object.entries(chains)) {
      if (!address || !address.startsWith('0x') || address.length !== 42) {
        errors.push(`Invalid ${protocol} address for ${chain}: ${address}`);
      }
    }
  }

  // Validate numeric ranges
  if (MCP_CONFIG.CHARACTER_LIMIT < 1000 || MCP_CONFIG.CHARACTER_LIMIT > 100000) {
    errors.push(`CHARACTER_LIMIT out of range: ${MCP_CONFIG.CHARACTER_LIMIT}`);
  }

  if (errors.length > 0) {
    console.error('❌ MCP Configuration validation failed:');
    errors.forEach(err => console.error(`  - ${err}`));
    throw new Error('Invalid MCP configuration');
  }

  console.log('✅ MCP Configuration validated successfully');
  return true;
}

/**
 * Get configuration value with fallback
 */
export function getConfig(path, fallback = null) {
  const parts = path.split('.');
  let value = MCP_CONFIG;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return fallback;
    }
  }

  return value;
}

/**
 * Export default configuration
 */
export default MCP_CONFIG;

// Validate configuration on module load
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}
