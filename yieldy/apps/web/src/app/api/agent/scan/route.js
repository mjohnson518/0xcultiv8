/**
 * Agent Scan Endpoint
 * Fetches live DeFi opportunities from protocol adapters
 * Falls back to demo data when RPC URLs are not configured
 *
 * Access: Authenticated users with credits OR x402 payment
 */

import { fetchAllProtocolData, getSupportedProtocols } from '../../protocols/adapters.js';
import { optionalAuth } from '../../middleware/auth.js';
import { log as logger } from '../../utils/logger.js';
import { checkPaymentOrCredits } from '../../middleware/x402Payment.js';
import { rateLimitMiddleware } from '../../middleware/rateLimit.js';
// Note: RiskEngine is dynamically imported only when needed (not in demo mode)

// x402 pricing for this endpoint (optimized for revenue)
const ENDPOINT_PRICE = 0.15; // $0.15 USD (increased from $0.10)

// Protocol metadata for risk calculation
const PROTOCOL_METADATA = {
  aave: {
    name: 'Aave V3',
    protocol_age_years: 4,
    audit_count: 12,
    has_bug_bounty: true,
    governance_type: 'decentralized',
    token: 'USDC',
    description: 'Leading DeFi lending protocol',
  },
  compound: {
    name: 'Compound V3',
    protocol_age_years: 5,
    audit_count: 10,
    has_bug_bounty: true,
    governance_type: 'decentralized',
    token: 'USDC',
    description: 'Autonomous interest rate protocol',
  },
  morpho: {
    name: 'Morpho Blue',
    protocol_age_years: 2,
    audit_count: 8,
    has_bug_bounty: true,
    governance_type: 'decentralized',
    token: 'USDC',
    description: 'Optimized lending protocol with better rates',
  },
  ethena: {
    name: 'Ethena',
    protocol_age_years: 1,
    audit_count: 6,
    has_bug_bounty: true,
    governance_type: 'decentralized',
    token: 'USDe',
    description: 'Synthetic dollar protocol with staking rewards',
  },
};

/**
 * Demo mode mock data - realistic DeFi opportunities with pre-calculated risk scores
 * Used when RPC URLs are not configured
 */
const DEMO_OPPORTUNITIES = [
  {
    id: 'aave-ethereum-demo',
    protocol: 'Aave V3',
    protocol_id: 'aave',
    blockchain: 'ethereum',
    apy: 4.82,
    tvl: 12500000000, // $12.5B
    token: 'USDC',
    description: 'Leading DeFi lending protocol',
    protocol_age_years: 4,
    audit_count: 12,
    has_bug_bounty: true,
    governance_type: 'decentralized',
    lastUpdated: new Date().toISOString(),
    // Pre-calculated risk score for demo
    risk_score: 2.8,
    risk_breakdown: { protocol: 2, financial: 3, technical: 4, market: 3 },
    risk_reasoning: 'Low protocol risk - established and well-audited. Strong financial health with deep liquidity.',
  },
  {
    id: 'compound-ethereum-demo',
    protocol: 'Compound V3',
    protocol_id: 'compound',
    blockchain: 'ethereum',
    apy: 5.14,
    tvl: 2800000000, // $2.8B
    token: 'USDC',
    description: 'Autonomous interest rate protocol',
    protocol_age_years: 5,
    audit_count: 10,
    has_bug_bounty: true,
    governance_type: 'decentralized',
    lastUpdated: new Date().toISOString(),
    risk_score: 3.0,
    risk_breakdown: { protocol: 2, financial: 3.5, technical: 4, market: 3 },
    risk_reasoning: 'Low protocol risk - established and well-audited. Strong financial health.',
  },
  {
    id: 'aave-base-demo',
    protocol: 'Aave V3',
    protocol_id: 'aave',
    blockchain: 'base',
    apy: 6.21,
    tvl: 890000000, // $890M
    token: 'USDC',
    description: 'Leading DeFi lending protocol on Base',
    protocol_age_years: 4,
    audit_count: 12,
    has_bug_bounty: true,
    governance_type: 'decentralized',
    lastUpdated: new Date().toISOString(),
    risk_score: 3.2,
    risk_breakdown: { protocol: 2, financial: 4, technical: 4, market: 3.5 },
    risk_reasoning: 'Low protocol risk - established and well-audited. Good financial health on Base L2.',
  },
  {
    id: 'compound-base-demo',
    protocol: 'Compound V3',
    protocol_id: 'compound',
    blockchain: 'base',
    apy: 5.87,
    tvl: 450000000, // $450M
    token: 'USDC',
    description: 'Autonomous interest rate protocol on Base',
    protocol_age_years: 5,
    audit_count: 10,
    has_bug_bounty: true,
    governance_type: 'decentralized',
    lastUpdated: new Date().toISOString(),
    risk_score: 3.4,
    risk_breakdown: { protocol: 2, financial: 4.5, technical: 4, market: 3.5 },
    risk_reasoning: 'Low protocol risk - established and well-audited. Solid financial health on Base L2.',
  },
  {
    id: 'morpho-ethereum-demo',
    protocol: 'Morpho Blue',
    protocol_id: 'morpho',
    blockchain: 'ethereum',
    apy: 7.35,
    tvl: 1200000000, // $1.2B
    token: 'USDC',
    description: 'Optimized lending protocol with better rates',
    protocol_age_years: 2,
    audit_count: 8,
    has_bug_bounty: true,
    governance_type: 'decentralized',
    lastUpdated: new Date().toISOString(),
    risk_score: 3.8,
    risk_breakdown: { protocol: 3, financial: 4, technical: 5, market: 4 },
    risk_reasoning: 'Moderate protocol risk - newer but well-audited. Good financial health with growing TVL.',
  },
  {
    id: 'ethena-ethereum-demo',
    protocol: 'Ethena',
    protocol_id: 'ethena',
    blockchain: 'ethereum',
    apy: 12.5,
    tvl: 2500000000, // $2.5B
    token: 'USDe',
    description: 'Synthetic dollar protocol with staking rewards',
    protocol_age_years: 1,
    audit_count: 6,
    has_bug_bounty: true,
    governance_type: 'decentralized',
    lastUpdated: new Date().toISOString(),
    risk_score: 5.2,
    risk_breakdown: { protocol: 5, financial: 5, technical: 6, market: 5 },
    risk_reasoning: 'Moderate risk - newer protocol with high yields. Synthetic stablecoin has additional complexity.',
  },
];

/**
 * Check if we're in demo mode (no RPC URLs configured)
 */
function isDemoMode() {
  return !process.env.ETHEREUM_RPC_URL && !process.env.BASE_RPC_URL;
}

export async function POST(request) {
  const startTime = Date.now();
  const demoMode = isDemoMode();

  // Rate limiting first (before any payment/auth checks)
  const rateLimitError = await rateLimitMiddleware(request, 'scan');
  if (rateLimitError) return rateLimitError;

  // x402 Payment or Credits check
  // Users with tier credits get free access; others pay per-request
  const paymentResult = await checkPaymentOrCredits(request, {
    endpoint: '/api/agent/scan',
    basePrice: ENDPOINT_PRICE,
    description: 'DeFi opportunity scanning and risk analysis',
  });

  if (!paymentResult.proceed) {
    return paymentResult.response;
  }

  try {
    // Optional auth - attach user if authenticated (may already be set by payment check)
    if (!request.user) {
      await optionalAuth(request);
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { blockchain = 'both', riskTolerance = 'medium' } = body;

    logger.info('Scan initiated', {
      blockchain,
      riskTolerance,
      user: request.user?.address || 'anonymous',
      demoMode,
    });

    // Determine which chains to scan
    const chainsToScan = blockchain === 'both'
      ? ['ethereum', 'base']
      : [blockchain];

    // Fetch opportunities - use demo data if no RPC URLs configured
    let allOpportunities = [];
    const errors = [];

    if (demoMode) {
      // Use demo data - filter by requested chains
      allOpportunities = DEMO_OPPORTUNITIES.filter(
        opp => chainsToScan.includes(opp.blockchain)
      ).map(opp => ({
        ...opp,
        id: `${opp.protocol_id}-${opp.blockchain}-${Date.now()}`,
        lastUpdated: new Date().toISOString(),
      }));

      logger.info('Using demo mode data', {
        count: allOpportunities.length,
        chains: chainsToScan
      });
    } else {
      // Fetch live data from all protocols on all requested chains
      for (const chain of chainsToScan) {
        try {
          const protocolData = await fetchAllProtocolData(chain);

          for (const data of protocolData) {
            if (!data.success) {
              errors.push({ chain, protocol: data.protocol, error: data.error });
              continue;
            }

            // Enrich with metadata
            const metadata = PROTOCOL_METADATA[data.protocol] || {};

            allOpportunities.push({
              id: `${data.protocol}-${chain}-${Date.now()}`,
              protocol: metadata.name || data.protocol,
              protocol_id: data.protocol,
              blockchain: chain,
              apy: data.apy,
              tvl: data.tvl,
              token: metadata.token || 'USDC',
              description: metadata.description || `${data.protocol} on ${chain}`,
              lastUpdated: data.lastUpdated,
              // Include metadata for risk calculation
              protocol_age_years: metadata.protocol_age_years,
              audit_count: metadata.audit_count,
              has_bug_bounty: metadata.has_bug_bounty,
              governance_type: metadata.governance_type,
            });
          }
        } catch (error) {
          logger.error('Chain scan failed', { chain, error: error.message });
          errors.push({ chain, error: error.message });
        }
      }
    }

    // Calculate risk scores for all opportunities
    // Skip RiskEngine in demo mode - demo data has pre-calculated scores
    let opportunitiesWithRisk;
    if (demoMode) {
      // Demo opportunities already have risk scores
      opportunitiesWithRisk = allOpportunities;
    } else {
      // Use RiskEngine for live data
      const { RiskEngine } = await import('../../utils/riskEngine.js');
      const riskEngine = new RiskEngine();
      opportunitiesWithRisk = await Promise.all(
        allOpportunities.map(async (opp) => {
          try {
            const riskResult = await riskEngine.calculateRisk(opp);
            return {
              ...opp,
              risk_score: riskResult.composite,
              risk_breakdown: riskResult.breakdown,
              risk_reasoning: riskResult.reasoning,
            };
          } catch (error) {
            logger.warn('Risk calculation failed', { opportunity: opp.id, error: error.message });
            // Default risk score for established protocols
            return {
              ...opp,
              risk_score: opp.protocol_id === 'aave' ? 3.0 : opp.protocol_id === 'compound' ? 3.2 : 5.0,
              risk_breakdown: null,
              risk_reasoning: 'Default risk score applied',
            };
          }
        })
      );
    }

    // Filter by risk tolerance
    const riskThresholds = {
      low: 4.0,
      medium: 6.0,
      high: 8.0,
    };
    const maxRisk = riskThresholds[riskTolerance] || 6.0;

    const filteredOpportunities = opportunitiesWithRisk.filter(
      opp => opp.risk_score <= maxRisk
    );

    // Sort by APY descending
    filteredOpportunities.sort((a, b) => b.apy - a.apy);

    const duration = Date.now() - startTime;

    logger.info('Scan completed', {
      totalFound: allOpportunities.length,
      afterRiskFilter: filteredOpportunities.length,
      duration,
      errors: errors.length,
    });

    return Response.json({
      success: true,
      opportunities: filteredOpportunities,
      message: demoMode
        ? `Demo scan completed - showing ${filteredOpportunities.length} sample opportunities`
        : `Scan completed - found ${filteredOpportunities.length} opportunities matching criteria`,
      timestamp: new Date().toISOString(),
      scanParams: { blockchain, riskTolerance },
      stats: {
        totalScanned: allOpportunities.length,
        matchingCriteria: filteredOpportunities.length,
        chainsScanned: chainsToScan,
        duration,
        demoMode,
        x402: {
          paid: paymentResult.paymentUsed,
          usedCredits: paymentResult.creditsUsed,
        },
      },
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    logger.error('Scan failed', { error: error.message, stack: error.stack });

    return Response.json({
      success: false,
      error: 'Scan failed',
      message: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
