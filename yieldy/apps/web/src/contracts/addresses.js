/**
 * Smart Contract Addresses
 *
 * Deployed addresses for Cultiv8 smart contracts across supported chains.
 * These addresses should be updated after each deployment.
 *
 * SECURITY: All addresses can be overridden via environment variables.
 * This allows quick response to security incidents without code deployment.
 *
 * Environment variable format:
 *   - NEXT_PUBLIC_USDC_MAINNET - USDC token address on Ethereum mainnet
 *   - NEXT_PUBLIC_AAVE_V3_POOL_MAINNET - Aave V3 Pool on Ethereum mainnet
 *   - etc.
 */

// =============================================================================
// Default addresses (used as fallbacks if env vars not set)
// =============================================================================

const DEFAULT_ADDRESSES = {
  // Ethereum Mainnet
  mainnet: {
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    aaveV3Pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    compoundV3Comet: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
  },
  // Base Mainnet
  base: {
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    aaveV3Pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    morphoBlue: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
  },
  // Sepolia Testnet
  sepolia: {
    usdc: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
    aaveV3Pool: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
  },
  // Base Sepolia Testnet
  baseSepolia: {
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
};

// =============================================================================
// Contract Addresses (with environment variable overrides)
// =============================================================================

export const CONTRACT_ADDRESSES = {
  // Ethereum Mainnet (chainId: 1)
  1: {
    cultiv8Agent: process.env.NEXT_PUBLIC_CULTIV8_AGENT_MAINNET || '0x0000000000000000000000000000000000000000',
    agentVault: process.env.NEXT_PUBLIC_AGENT_VAULT_MAINNET || '0x0000000000000000000000000000000000000000',
    usdc: process.env.NEXT_PUBLIC_USDC_MAINNET || DEFAULT_ADDRESSES.mainnet.usdc,
    // Protocol addresses for whitelisting
    protocols: {
      aaveV3Pool: process.env.NEXT_PUBLIC_AAVE_V3_POOL_MAINNET || DEFAULT_ADDRESSES.mainnet.aaveV3Pool,
      compoundV3Comet: process.env.NEXT_PUBLIC_COMPOUND_V3_MAINNET || DEFAULT_ADDRESSES.mainnet.compoundV3Comet,
    },
  },

  // Base Mainnet (chainId: 8453)
  8453: {
    cultiv8Agent: process.env.NEXT_PUBLIC_CULTIV8_AGENT_BASE || '0x0000000000000000000000000000000000000000',
    agentVault: process.env.NEXT_PUBLIC_AGENT_VAULT_BASE || '0x0000000000000000000000000000000000000000',
    usdc: process.env.NEXT_PUBLIC_USDC_BASE || DEFAULT_ADDRESSES.base.usdc,
    protocols: {
      aaveV3Pool: process.env.NEXT_PUBLIC_AAVE_V3_POOL_BASE || DEFAULT_ADDRESSES.base.aaveV3Pool,
      morphoBlue: process.env.NEXT_PUBLIC_MORPHO_BLUE_BASE || DEFAULT_ADDRESSES.base.morphoBlue,
    },
  },

  // Sepolia Testnet (chainId: 11155111)
  11155111: {
    cultiv8Agent: process.env.NEXT_PUBLIC_CULTIV8_AGENT_SEPOLIA || '0x0000000000000000000000000000000000000000',
    agentVault: process.env.NEXT_PUBLIC_AGENT_VAULT_SEPOLIA || '0x0000000000000000000000000000000000000000',
    usdc: process.env.NEXT_PUBLIC_USDC_SEPOLIA || DEFAULT_ADDRESSES.sepolia.usdc,
    protocols: {
      aaveV3Pool: process.env.NEXT_PUBLIC_AAVE_V3_POOL_SEPOLIA || DEFAULT_ADDRESSES.sepolia.aaveV3Pool,
    },
  },

  // Base Sepolia Testnet (chainId: 84532)
  84532: {
    cultiv8Agent: process.env.NEXT_PUBLIC_CULTIV8_AGENT_BASE_SEPOLIA || '0x0000000000000000000000000000000000000000',
    agentVault: process.env.NEXT_PUBLIC_AGENT_VAULT_BASE_SEPOLIA || '0x0000000000000000000000000000000000000000',
    usdc: process.env.NEXT_PUBLIC_USDC_BASE_SEPOLIA || DEFAULT_ADDRESSES.baseSepolia.usdc,
    protocols: {},
  },
};

/**
 * Get contract addresses for a specific chain
 * @param {number} chainId - The chain ID
 * @returns {object} Contract addresses for the chain
 */
export function getContractAddresses(chainId) {
  const addresses = CONTRACT_ADDRESSES[chainId];
  if (!addresses) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return addresses;
}

/**
 * Check if a chain is supported
 * @param {number} chainId - The chain ID
 * @returns {boolean}
 */
export function isSupportedChain(chainId) {
  return chainId in CONTRACT_ADDRESSES;
}

/**
 * Get supported chain IDs
 * @returns {number[]}
 */
export function getSupportedChainIds() {
  return Object.keys(CONTRACT_ADDRESSES).map(Number);
}

/**
 * Check if contracts are deployed on a chain
 * @param {number} chainId - The chain ID
 * @returns {boolean}
 */
export function areContractsDeployed(chainId) {
  const addresses = CONTRACT_ADDRESSES[chainId];
  if (!addresses) return false;

  const zeroAddress = '0x0000000000000000000000000000000000000000';
  return (
    addresses.cultiv8Agent !== zeroAddress &&
    addresses.agentVault !== zeroAddress
  );
}

/**
 * Validate protocol addresses are set via environment variables in production
 * @param {number} chainId - The chain ID
 * @returns {object} Validation result with warnings
 */
export function validateProductionAddresses(chainId) {
  const isProduction = process.env.NODE_ENV === 'production';
  const warnings = [];

  if (!isProduction) {
    return { valid: true, warnings: [] };
  }

  const chain = CONTRACT_ADDRESSES[chainId];
  if (!chain) {
    return { valid: false, warnings: [`Unsupported chain: ${chainId}`] };
  }

  // Check Cultiv8 contract addresses
  const zeroAddress = '0x0000000000000000000000000000000000000000';
  if (chain.cultiv8Agent === zeroAddress) {
    warnings.push('CRITICAL: Cultiv8Agent address not set for production');
  }
  if (chain.agentVault === zeroAddress) {
    warnings.push('CRITICAL: AgentVault address not set for production');
  }

  // Check if using default protocol addresses (should be overridden in production)
  const defaultChain = DEFAULT_ADDRESSES[chainId === 1 ? 'mainnet' : chainId === 8453 ? 'base' : null];
  if (defaultChain) {
    if (chain.usdc === defaultChain.usdc && !process.env.NEXT_PUBLIC_USDC_MAINNET && !process.env.NEXT_PUBLIC_USDC_BASE) {
      warnings.push('WARNING: Using default USDC address - consider setting via env var for quick updates');
    }
    if (chain.protocols?.aaveV3Pool === defaultChain.aaveV3Pool) {
      warnings.push('WARNING: Using default Aave V3 Pool address - consider setting via env var');
    }
  }

  return {
    valid: warnings.filter(w => w.startsWith('CRITICAL')).length === 0,
    warnings,
  };
}
