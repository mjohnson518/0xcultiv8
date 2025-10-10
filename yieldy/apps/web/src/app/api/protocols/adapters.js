import { ethers } from 'ethers';
import { AaveV3Adapter } from './AaveV3Adapter';
import { CompoundV3Adapter } from './CompoundV3Adapter';

/**
 * Protocol Adapter Registry
 * Central point for accessing protocol adapters
 */

// Cache providers to avoid creating multiple instances
const providers = new Map();

/**
 * Get or create RPC provider for a chain
 * @param {string} chain - 'ethereum' or 'base'
 * @returns {JsonRpcProvider}
 */
function getProvider(chain) {
  if (providers.has(chain)) {
    return providers.get(chain);
  }

  const rpcUrl = chain === 'ethereum' 
    ? process.env.ETHEREUM_RPC_URL 
    : process.env.BASE_RPC_URL;

  if (!rpcUrl) {
    throw new Error(`RPC URL not configured for chain: ${chain}`);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  providers.set(chain, provider);

  return provider;
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
    ethereum: ['aave', 'compound'],
    base: ['aave', 'compound'],
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

