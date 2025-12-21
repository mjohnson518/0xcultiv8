/**
 * Smart Contract Addresses
 *
 * Deployed addresses for Cultiv8 smart contracts across supported chains.
 * These addresses should be updated after each deployment.
 */

export const CONTRACT_ADDRESSES = {
  // Ethereum Mainnet (chainId: 1)
  1: {
    cultiv8Agent: process.env.NEXT_PUBLIC_CULTIV8_AGENT_MAINNET || '0x0000000000000000000000000000000000000000',
    agentVault: process.env.NEXT_PUBLIC_AGENT_VAULT_MAINNET || '0x0000000000000000000000000000000000000000',
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    // Protocol addresses for whitelisting
    protocols: {
      aaveV3Pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      compoundV3Comet: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
    },
  },

  // Base Mainnet (chainId: 8453)
  8453: {
    cultiv8Agent: process.env.NEXT_PUBLIC_CULTIV8_AGENT_BASE || '0x0000000000000000000000000000000000000000',
    agentVault: process.env.NEXT_PUBLIC_AGENT_VAULT_BASE || '0x0000000000000000000000000000000000000000',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    protocols: {
      aaveV3Pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
      morphoBlue: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    },
  },

  // Sepolia Testnet (chainId: 11155111)
  11155111: {
    cultiv8Agent: process.env.NEXT_PUBLIC_CULTIV8_AGENT_SEPOLIA || '0x0000000000000000000000000000000000000000',
    agentVault: process.env.NEXT_PUBLIC_AGENT_VAULT_SEPOLIA || '0x0000000000000000000000000000000000000000',
    usdc: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8', // USDC on Sepolia
    protocols: {
      aaveV3Pool: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
    },
  },

  // Base Sepolia Testnet (chainId: 84532)
  84532: {
    cultiv8Agent: process.env.NEXT_PUBLIC_CULTIV8_AGENT_BASE_SEPOLIA || '0x0000000000000000000000000000000000000000',
    agentVault: process.env.NEXT_PUBLIC_AGENT_VAULT_BASE_SEPOLIA || '0x0000000000000000000000000000000000000000',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
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
