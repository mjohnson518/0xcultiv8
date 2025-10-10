import Redis from 'ioredis';
import sql from './sql';

/**
 * Multi-Dimensional Risk Engine for DeFi Opportunities
 * Calculates composite risk scores based on protocol, financial, technical, and market factors
 */
export class RiskEngine {
  constructor() {
    // Risk scoring weights (must sum to 1.0)
    this.weights = {
      protocol: 0.40,  // Protocol maturity, audits, reputation
      financial: 0.35, // TVL, APY sustainability, liquidity
      technical: 0.15, // Smart contract complexity, dependencies
      market: 0.10,    // Volatility, market conditions
    };

    // Initialize Redis for caching (with fallback)
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      });
      this.redis.on('error', () => {
        this.redis = null; // Disable caching on error
      });
    } catch {
      this.redis = null;
    }

    this.cacheTTL = 900; // 15 minutes
  }

  /**
   * Calculate comprehensive risk score for an opportunity
   * @param {object} opportunity - Opportunity data
   * @returns {Promise<object>} - Risk score with breakdown
   */
  async calculateRisk(opportunity) {
    // Check cache first
    const cached = await this.getCachedRisk(opportunity.id);
    if (cached) return cached;

    // Calculate individual risk components
    const scores = {
      protocol: await this.protocolRisk(opportunity),
      financial: await this.financialRisk(opportunity),
      technical: await this.technicalRisk(opportunity),
      market: await this.marketRisk(opportunity),
    };

    // Calculate weighted composite score
    const composite = Object.entries(scores).reduce((sum, [key, value]) => {
      return sum + (value * this.weights[key]);
    }, 0);

    const result = {
      composite: Math.round(composite * 10) / 10, // Round to 1 decimal
      breakdown: scores,
      weights: this.weights,
      reasoning: this.explainRisk(scores),
      calculatedAt: new Date().toISOString(),
    };

    // Cache the result
    await this.cacheRisk(opportunity.id, result);

    return result;
  }

  /**
   * Protocol Risk Scoring (40% weight)
   * Evaluates protocol maturity, audits, and reputation
   * @param {object} opp - Opportunity
   * @returns {Promise<number>} - Risk score 0-10 (10 = highest risk)
   */
  async protocolRisk(opp) {
    let score = 10; // Start with maximum risk

    // Age factor: Older protocols are generally safer
    const ageYears = opp.protocol_age_years || 0;
    if (ageYears >= 3) score -= 3;
    else if (ageYears >= 2) score -= 2;
    else if (ageYears >= 1) score -= 1;

    // Audit factor: More audits = lower risk
    const audits = opp.audit_count || 0;
    if (audits >= 5) score -= 3;
    else if (audits >= 3) score -= 2;
    else if (audits >= 1) score -= 1;

    // Bug bounty program: Active program reduces risk
    if (opp.has_bug_bounty) score -= 1;

    // Governance: Decentralized governance is safer
    if (opp.governance_type === 'decentralized') score -= 1;
    else if (opp.governance_type === 'multisig') score -= 0.5;

    // Known reputable protocols get bonus reduction
    const establishedProtocols = ['aave', 'compound', 'uniswap', 'curve', 'balancer'];
    const protocolLower = (opp.protocol_name || '').toLowerCase();
    if (establishedProtocols.some(p => protocolLower.includes(p))) {
      score -= 2;
    }

    // Team doxxed/known
    if (opp.team_doxxed) score -= 1;

    return Math.max(0, Math.min(10, score));
  }

  /**
   * Financial Risk Scoring (35% weight)
   * Evaluates TVL, APY sustainability, and financial health
   * @param {object} opp - Opportunity
   * @returns {Promise<number>} - Risk score 0-10
   */
  async financialRisk(opp) {
    let score = 10; // Start high risk

    // TVL factor: Higher TVL = lower risk
    const tvl = Number(opp.tvl || 0);
    if (tvl > 1000000000) score -= 4;       // >$1B TVL
    else if (tvl > 500000000) score -= 3.5; // >$500M
    else if (tvl > 100000000) score -= 3;   // >$100M
    else if (tvl > 50000000) score -= 2;    // >$50M
    else if (tvl > 10000000) score -= 1.5;  // >$10M
    else if (tvl > 1000000) score -= 1;     // >$1M

    // APY sustainability: Too high is suspicious, too low might indicate problems
    const apy = Number(opp.apy || 0);
    if (apy > 200) score += 4;     // Extremely high, likely ponzi
    else if (apy > 100) score += 3; // Very high, unsustainable
    else if (apy > 50) score += 1;  // High, verify carefully
    else if (apy < 1) score += 1;   // Too low, might be dying protocol

    // Liquidity depth: Deeper liquidity = lower risk
    const liquidityDepth = opp.liquidity_depth || 'unknown';
    if (liquidityDepth === 'deep') score -= 1;
    else if (liquidityDepth === 'shallow') score += 1;

    // Revenue model: Clear, sustainable revenue is safer
    if (opp.has_sustainable_revenue) score -= 1;

    // Token economics: Non-inflationary is better
    if (opp.is_inflationary === false) score -= 0.5;

    // Historical volatility of returns
    const volatility = opp.apy_volatility_30d || 0;
    if (volatility < 5) score -= 0.5;  // Stable returns
    else if (volatility > 20) score += 1; // Highly volatile

    return Math.max(0, Math.min(10, score));
  }

  /**
   * Technical Risk Scoring (15% weight)
   * Evaluates smart contract complexity and dependencies
   * @param {object} opp - Opportunity
   * @returns {Promise<number>} - Risk score 0-10
   */
  async technicalRisk(opp) {
    let score = 5; // Start neutral

    // Smart contract complexity
    const complexity = opp.contract_complexity || 'medium';
    if (complexity === 'simple') score -= 1.5;
    else if (complexity === 'complex') score += 1.5;
    else if (complexity === 'very_complex') score += 2.5;

    // Upgradeability: Immutable contracts are safer
    if (opp.is_upgradeable === true) score += 1;
    else if (opp.is_upgradeable === false) score -= 1;

    // Oracle dependencies: More oracles = more attack surface
    const oracleDeps = opp.oracle_dependencies || 0;
    if (oracleDeps === 0) score -= 0.5;
    else if (oracleDeps > 2) score += 1;

    // Protocol dependencies: Fewer is safer
    const protocolDeps = opp.protocol_dependencies || 0;
    if (protocolDeps === 0) score -= 0.5;
    else if (protocolDeps > 3) score += 1;

    // Composability: Complex integrations add risk
    if (opp.high_composability) score += 0.5;

    return Math.max(0, Math.min(10, score));
  }

  /**
   * Market Risk Scoring (10% weight)
   * Evaluates market conditions and external factors
   * @param {object} opp - Opportunity
   * @returns {Promise<number>} - Risk score 0-10
   */
  async marketRisk(opp) {
    let score = 5; // Start neutral

    // APY volatility over time periods
    const vol30d = opp.apy_volatility_30d || 0;
    const vol90d = opp.apy_volatility_90d || 0;

    if (vol30d > 50 || vol90d > 40) score += 2;      // High volatility
    else if (vol30d > 20 || vol90d > 15) score += 1; // Medium volatility
    else if (vol30d < 5 && vol90d < 5) score -= 1;   // Very stable

    // Regulatory risk (certain protocol types have more regulatory exposure)
    const protocolType = opp.protocol_type || 'other';
    if (protocolType === 'options' || protocolType === 'structured_product') {
      score += 1; // Higher regulatory scrutiny
    }

    // Network risk: Ethereum generally safer than newer L2s
    const blockchain = opp.blockchain || 'ethereum';
    if (blockchain === 'ethereum') score -= 0.5;
    // Base and other L2s are neutral (no adjustment)

    // Market sentiment (placeholder - could integrate real sentiment analysis)
    // const sentiment = await this.getMarketSentiment();
    // if (sentiment === 'fearful') score += 1;

    return Math.max(0, Math.min(10, score));
  }

  /**
   * Generate human-readable risk explanation
   * @param {object} scores - Individual risk scores
   * @returns {string} - Explanation text
   */
  explainRisk(scores) {
    const explanations = [];

    // Protocol risk explanation
    if (scores.protocol > 7) {
      explanations.push("High protocol risk due to unproven track record or limited audits");
    } else if (scores.protocol < 3) {
      explanations.push("Low protocol risk - established and well-audited");
    }

    // Financial risk explanation
    if (scores.financial > 7) {
      explanations.push("High financial risk due to low TVL or unsustainable APY");
    } else if (scores.financial < 3) {
      explanations.push("Strong financial health with deep liquidity");
    }

    // Technical risk explanation
    if (scores.technical > 7) {
      explanations.push("High technical complexity with multiple dependencies");
    }

    // Market risk explanation
    if (scores.market > 7) {
      explanations.push("Significant market volatility or regulatory concerns");
    }

    return explanations.length > 0 
      ? explanations.join('. ') + '.'
      : 'Moderate balanced risk profile across all factors.';
  }

  /**
   * Get cached risk score
   * @param {number} opportunityId
   * @returns {Promise<object|null>}
   */
  async getCachedRisk(opportunityId) {
    if (!this.redis) return null;

    try {
      const cached = await this.redis.get(`risk:${opportunityId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Check if cache is still valid (not older than TTL)
        const age = Date.now() - new Date(parsed.calculatedAt).getTime();
        if (age < this.cacheTTL * 1000) {
          return parsed;
        }
      }
    } catch (error) {
      console.debug('Cache read error:', error.message);
    }

    return null;
  }

  /**
   * Cache risk score in Redis
   * @param {number} opportunityId
   * @param {object} riskScore
   */
  async cacheRisk(opportunityId, riskScore) {
    if (!this.redis) return;

    try {
      await this.redis.setex(
        `risk:${opportunityId}`,
        this.cacheTTL,
        JSON.stringify(riskScore)
      );

      // Also store in database for long-term tracking
      await sql`
        INSERT INTO risk_scores_cache (
          opportunity_id, composite_score, breakdown, calculated_at
        ) VALUES (
          ${opportunityId},
          ${riskScore.composite},
          ${JSON.stringify(riskScore.breakdown)},
          NOW()
        )
        ON CONFLICT (opportunity_id)
        DO UPDATE SET
          composite_score = ${riskScore.composite},
          breakdown = ${JSON.stringify(riskScore.breakdown)},
          calculated_at = NOW()
      `;
    } catch (error) {
      console.debug('Cache write error:', error.message);
    }
  }

  /**
   * Batch calculate risk scores for multiple opportunities
   * @param {Array} opportunities - Array of opportunities
   * @returns {Promise<Array>} - Opportunities with risk scores attached
   */
  async batchCalculateRisk(opportunities) {
    const results = await Promise.all(
      opportunities.map(async (opp) => {
        const risk = await this.calculateRisk(opp);
        return {
          ...opp,
          riskScore: risk.composite,
          riskBreakdown: risk.breakdown,
          riskReasoning: risk.reasoning,
        };
      })
    );

    return results;
  }

  /**
   * Get historical risk trends for an opportunity
   * @param {number} opportunityId
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array>} - Historical risk scores
   */
  async getRiskHistory(opportunityId, days = 30) {
    try {
      const history = await sql`
        SELECT 
          composite_score,
          breakdown,
          calculated_at
        FROM risk_scores_cache
        WHERE opportunity_id = ${opportunityId}
          AND calculated_at > NOW() - INTERVAL '${days} days'
        ORDER BY calculated_at DESC
      `;

      return history || [];
    } catch (error) {
      console.error('Error fetching risk history:', error);
      return [];
    }
  }

  /**
   * Compare risk profiles of multiple opportunities
   * @param {Array<number>} opportunityIds
   * @returns {Promise<object>} - Comparison matrix
   */
  async compareRisks(opportunityIds) {
    const risks = await Promise.all(
      opportunityIds.map(async (id) => {
        const opp = await sql`SELECT * FROM cultiv8_opportunities WHERE id = ${id}`;
        if (!opp || opp.length === 0) return null;
        
        const risk = await this.calculateRisk(opp[0]);
        return {
          id,
          protocol: opp[0].protocol_name,
          composite: risk.composite,
          breakdown: risk.breakdown,
        };
      })
    );

    return risks.filter(r => r !== null);
  }
}

/**
 * Ensure risk_scores_cache table exists
 */
export async function ensureRiskScoreTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS risk_scores_cache (
        opportunity_id INTEGER PRIMARY KEY,
        composite_score NUMERIC(4,2) NOT NULL,
        breakdown JSONB NOT NULL,
        calculated_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (opportunity_id) REFERENCES cultiv8_opportunities(id) ON DELETE CASCADE
      )
    `;

    // Add index for querying by date
    await sql`
      CREATE INDEX IF NOT EXISTS idx_risk_calculated_at 
      ON risk_scores_cache(calculated_at DESC)
    `;

    // Add risk_breakdown column to cultiv8_opportunities if it doesn't exist
    await sql`
      ALTER TABLE cultiv8_opportunities 
      ADD COLUMN IF NOT EXISTS risk_breakdown JSONB
    `;
  } catch (error) {
    console.debug('Risk score table setup:', error.message);
  }
}

// Initialize table on module load
ensureRiskScoreTable();

// Singleton instance
export const riskEngine = new RiskEngine();

/**
 * Convenience function to calculate risk for an opportunity by ID
 * @param {number} opportunityId
 * @returns {Promise<object>} - Risk score
 */
export async function calculateOpportunityRisk(opportunityId) {
  const opp = await sql`
    SELECT * FROM cultiv8_opportunities WHERE id = ${opportunityId}
  `;

  if (!opp || opp.length === 0) {
    throw new Error(`Opportunity ${opportunityId} not found`);
  }

  return await riskEngine.calculateRisk(opp[0]);
}

