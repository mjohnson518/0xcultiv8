/**
 * Agent Scan Endpoint
 * Fetches live DeFi opportunities from protocol adapters
 */

import { fetchAllProtocolData, getSupportedProtocols } from '../../protocols/adapters.js';
import { RiskEngine } from '../../utils/riskEngine.js';
import { optionalAuth } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

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
};

export async function POST(request) {
  const startTime = Date.now();

  try {
    // Optional auth - attach user if authenticated
    await optionalAuth(request);

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { blockchain = 'both', riskTolerance = 'medium' } = body;

    logger.info('Scan initiated', {
      blockchain,
      riskTolerance,
      user: request.user?.address || 'anonymous',
    });

    // Determine which chains to scan
    const chainsToScan = blockchain === 'both'
      ? ['ethereum', 'base']
      : [blockchain];

    // Fetch live data from all protocols on all requested chains
    const allOpportunities = [];
    const errors = [];

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

    // Calculate risk scores for all opportunities
    const riskEngine = new RiskEngine();
    const opportunitiesWithRisk = await Promise.all(
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
      message: `Scan completed - found ${filteredOpportunities.length} opportunities matching criteria`,
      timestamp: new Date().toISOString(),
      scanParams: { blockchain, riskTolerance },
      stats: {
        totalScanned: allOpportunities.length,
        matchingCriteria: filteredOpportunities.length,
        chainsScanned: chainsToScan,
        duration,
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
