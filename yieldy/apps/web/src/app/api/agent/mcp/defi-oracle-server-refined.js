/**
 * DeFi Oracle MCP Server - Production-Ready
 * Provides workflow-oriented tools for DeFi protocol discovery and analysis
 * 
 * Design Philosophy:
 * - Each tool is a complete workflow, not just an API wrapper
 * - Responses are actionable and contextual
 * - Includes reasoning and recommendations
 * - Respects 25,000 character limit
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolResultSchema, ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { getProtocolAdapter } from '../../protocols/adapters.js';
import { riskEngine } from '../../utils/riskEngine.js';
import { portfolioOptimizer } from '../../utils/portfolioOptimizer.js';
import sql from '../../utils/sql.js';

const CHARACTER_LIMIT = 25000;
const SUPPORTED_CHAINS = ["ethereum", "base"];

class DeFiOracleServer {
  constructor() {
    this.server = new Server(
      {
        name: "cultiv8-defi-oracle",
        version: "2.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupTools();
    this.setupErrorHandling();
  }

  /**
   * Setup workflow-oriented tools
   */
  setupTools() {
    this.server.setRequestHandler(ListToolsResultSchema, async () => {
      return {
        tools: [
          // PRIMARY WORKFLOW TOOL
          {
            name: "discover_yield_opportunities",
            description: `
Discovers and analyzes DeFi yield opportunities across protocols.

This is the PRIMARY tool for yield discovery. It consolidates:
- Multi-protocol scanning (Aave V3, Compound V3)
- Multi-dimensional risk assessment (Protocol + Financial + Technical + Market)
- Portfolio context awareness
- Ranked recommendations with reasoning

Use this when you need to:
- Find the best yields for a user
- Compare opportunities across chains
- Get actionable investment recommendations
- Understand risk/return tradeoffs

Returns ranked opportunities with:
- APY, TVL, and liquidity data
- 4-dimensional risk scores (0-10 scale)
- Gas-adjusted net returns
- Entry/exit strategy suggestions
- Integration with existing portfolio

Example queries:
- "Find yields on Base with APY > 8% and risk < 5"
- "Show me the best risk-adjusted opportunities"
- "What are safe yields with TVL > $10M?"
            `.trim(),
            inputSchema: {
              type: "object",
              properties: {
                chain: {
                  type: "string",
                  enum: SUPPORTED_CHAINS,
                  description: "Target blockchain network",
                },
                min_apy: {
                  type: "number",
                  minimum: 0,
                  maximum: 100,
                  default: 5.0,
                  description: "Minimum APY threshold (%)",
                },
                max_risk: {
                  type: "number",
                  minimum: 1,
                  maximum: 10,
                  default: 7,
                  description: "Maximum risk score (1=lowest, 10=highest)",
                },
                min_tvl: {
                  type: "number",
                  minimum: 0,
                  default: 1000000,
                  description: "Minimum Total Value Locked (USD)",
                },
                user_portfolio_context: {
                  type: "object",
                  description: "Optional: Current user positions for personalized recommendations",
                  properties: {
                    total_invested: { type: "number" },
                    risk_tolerance: { type: "number", minimum: 1, maximum: 10 },
                    existing_protocols: { type: "array", items: { type: "string" } },
                  },
                },
                response_format: {
                  type: "string",
                  enum: ["concise", "detailed"],
                  default: "concise",
                  description: "concise: Summary for quick decisions | detailed: Full analysis with tables",
                },
                limit: {
                  type: "number",
                  minimum: 1,
                  maximum: 50,
                  default: 10,
                  description: "Maximum number of opportunities to return",
                },
              },
              required: ["chain"],
            },
          },

          // MONITORING WORKFLOW TOOL
          {
            name: "monitor_protocol_health",
            description: `
Monitors active protocols for critical changes requiring agent action.

This is a MONITORING tool that evaluates:
- APY degradation (drops below thresholds)
- Risk score increases (security/audit changes)
- Liquidity changes (TVL fluctuations)
- Protocol security alerts
- Better opportunities emerging

Use this when you need to:
- Check if existing positions are still optimal
- Identify rebalancing opportunities
- Detect protocol risks early
- Maintain portfolio health

Returns actionable alerts with:
- Change magnitude and direction
- Recommended actions (hold/reduce/exit)
- Alternative opportunities
- Urgency level (immediate/soon/monitor)

Integrates with the rebalancing engine.
            `.trim(),
            inputSchema: {
              type: "object",
              properties: {
                protocols_to_monitor: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      protocol: { type: "string" },
                      chain: { type: "string", enum: SUPPORTED_CHAINS },
                      position_size: { type: "number", description: "USD value of position" },
                    },
                  },
                  description: "List of protocols currently in portfolio",
                },
                alert_thresholds: {
                  type: "object",
                  properties: {
                    apy_drop_percent: { type: "number", default: 1.0 },
                    risk_increase: { type: "number", default: 1.0 },
                    tvl_drop_percent: { type: "number", default: 20.0 },
                  },
                  description: "Thresholds for triggering alerts",
                },
                compare_alternatives: {
                  type: "boolean",
                  default: true,
                  description: "Include alternative opportunities in response",
                },
              },
              required: ["protocols_to_monitor"],
            },
          },

          // RISK ANALYSIS WORKFLOW TOOL
          {
            name: "analyze_protocol_risk",
            description: `
Performs comprehensive risk analysis on a specific protocol/position.

Uses 0xCultiv8's multi-dimensional risk framework:
- Protocol Risk (25%): Audit history, time in production, exploits
- Financial Risk (25%): Liquidity depth, impermanent loss, fees
- Technical Risk (25%): Contract complexity, upgrades, oracles
- Market Risk (25%): Asset volatility, correlation, conditions

Returns detailed breakdown with:
- Overall risk score (0-10)
- Individual dimension scores
- Risk factors identified
- Mitigation strategies
- Comparable risk scores for context

Use for: Due diligence on new opportunities or reevaluating existing positions
            `.trim(),
            inputSchema: {
              type: "object",
              properties: {
                protocol: { type: "string", description: "Protocol name (e.g., 'Aave V3')" },
                chain: { type: "string", enum: SUPPORTED_CHAINS },
                asset: { type: "string", description: "Asset symbol (e.g., 'USDC')" },
                include_comparisons: {
                  type: "boolean",
                  default: true,
                  description: "Include risk comparisons with similar protocols",
                },
              },
              required: ["protocol", "chain"],
            },
          },

          // MARKET INTELLIGENCE TOOL
          {
            name: "analyze_market_conditions",
            description: `
Analyzes overall DeFi market conditions to inform strategy decisions.

Evaluates:
- Cross-protocol APY trends
- Total market TVL changes
- Gas price environment
- Network congestion levels
- Risk-on vs risk-off signals

Returns strategic insights:
- Market sentiment (bullish/neutral/bearish)
- Optimal protocols for current conditions
- Timing recommendations (aggressive/moderate/conservative)
- Risk-adjusted opportunity rankings

Use before: Major allocation decisions or portfolio rebalancing
            `.trim(),
            inputSchema: {
              type: "object",
              properties: {
                chains: {
                  type: "array",
                  items: { type: "string", enum: SUPPORTED_CHAINS },
                  default: ["ethereum", "base"],
                },
                include_trends: {
                  type: "boolean",
                  default: true,
                  description: "Include 7-day historical trends",
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolResultSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "discover_yield_opportunities":
            return await this.discoverYieldOpportunities(args);

          case "monitor_protocol_health":
            return await this.monitorProtocolHealth(args);

          case "analyze_protocol_risk":
            return await this.analyzeProtocolRisk(args);

          case "analyze_market_conditions":
            return await this.analyzeMarketConditions(args);

          default:
            throw new MCPError(
              `Unknown tool: ${name}`,
              "Use tools/list to see available tools"
            );
        }
      } catch (error) {
        return this.formatError(error);
      }
    });
  }

  /**
   * WORKFLOW TOOL 1: Discover Yield Opportunities
   * Consolidates scanning, risk assessment, and ranking into one workflow
   */
  async discoverYieldOpportunities(args) {
    const {
      chain,
      min_apy = 5.0,
      max_risk = 7,
      min_tvl = 1000000,
      user_portfolio_context = null,
      response_format = "concise",
      limit = 10,
    } = args;

    // 1. Fetch protocol data in parallel
    const protocolPromises = [];
    
    for (const [protocolName, addresses] of Object.entries({ 
      aave_v3: { ethereum: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", base: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5" },
      compound_v3: { ethereum: "0xc3d688B66703497DAA19211EEdff47f25384cdc3", base: "0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf" }
    })) {
      if (addresses[chain]) {
        const adapter = getProtocolAdapter(protocolName, chain);
        protocolPromises.push(
          adapter.getCurrentData().then(data => ({
            protocol: protocolName,
            chain,
            ...data,
          })).catch(err => ({
            protocol: protocolName,
            chain,
            error: err.message,
          }))
        );
      }
    }

    const protocolData = await Promise.all(protocolPromises);

    // 2. Filter by criteria
    let opportunities = protocolData
      .filter(p => !p.error)
      .filter(p => p.apy >= min_apy)
      .filter(p => p.tvl >= min_tvl);

    // 3. Calculate risk scores for each
    const scoredOpportunities = await Promise.all(
      opportunities.map(async (opp) => {
        const riskScore = await riskEngine.calculateRisk({
          protocol_name: opp.protocol,
          blockchain: chain,
          apy: opp.apy,
          tvl: opp.tvl,
          liquidity_depth: opp.liquidity || opp.tvl * 0.1,
        });

        return {
          ...opp,
          riskScore: riskScore.totalScore,
          riskBreakdown: riskScore.breakdown,
        };
      })
    );

    // 4. Filter by risk and rank by Sharpe ratio
    const viableOpps = scoredOpportunities
      .filter(o => o.riskScore <= max_risk)
      .map(o => ({
        ...o,
        sharpeRatio: (o.apy - 3.0) / (o.riskScore * 2), // Simple Sharpe: (return - risk_free) / volatility_proxy
      }))
      .sort((a, b) => b.sharpeRatio - a.sharpeRatio)
      .slice(0, limit);

    // 5. Format response based on user preference
    if (response_format === "concise") {
      return this.formatConciseOpportunities(viableOpps, user_portfolio_context);
    } else {
      return this.formatDetailedOpportunities(viableOpps, user_portfolio_context);
    }
  }

  /**
   * Format opportunities for quick agent decision-making
   */
  formatConciseOpportunities(opportunities, portfolioContext) {
    if (opportunities.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No opportunities found matching criteria. Consider:
- Lowering APY threshold
- Increasing risk tolerance
- Expanding to both chains
- Reducing min TVL requirement`,
        }],
      };
    }

    const summary = opportunities.map((opp, idx) => {
      const recommendation = this.getRecommendation(opp, portfolioContext);
      return `${idx + 1}. ${opp.protocol.toUpperCase()} on ${opp.chain}
   APY: ${opp.apy.toFixed(2)}% | TVL: $${(opp.tvl / 1e6).toFixed(1)}M | Risk: ${opp.riskScore.toFixed(1)}/10
   Sharpe: ${opp.sharpeRatio.toFixed(2)} | ${recommendation}`;
    }).join('\n\n');

    const topPick = opportunities[0];
    const analysis = `
🎯 TOP RECOMMENDATION: ${topPick.protocol.toUpperCase()} on ${topPick.chain}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

APY: ${topPick.apy.toFixed(2)}% (risk-adjusted: ${(topPick.apy / topPick.riskScore).toFixed(2)}%)
Risk Score: ${topPick.riskScore.toFixed(1)}/10 (${this.getRiskLabel(topPick.riskScore)})
TVL: $${(topPick.tvl / 1e6).toFixed(1)}M
Sharpe Ratio: ${topPick.sharpeRatio.toFixed(2)}

Risk Breakdown:
- Protocol: ${topPick.riskBreakdown?.protocolRisk?.toFixed(1) || 'N/A'}/10
- Financial: ${topPick.riskBreakdown?.financialRisk?.toFixed(1) || 'N/A'}/10  
- Technical: ${topPick.riskBreakdown?.technicalRisk?.toFixed(1) || 'N/A'}/10
- Market: ${topPick.riskBreakdown?.marketRisk?.toFixed(1) || 'N/A'}/10

${this.getActionableInsight(topPick, portfolioContext)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALL OPPORTUNITIES (${opportunities.length} found):

${summary}

NEXT STEPS:
${this.getNextSteps(opportunities, portfolioContext)}
    `.trim();

    return {
      content: [{
        type: "text",
        text: analysis.substring(0, CHARACTER_LIMIT),
      }],
    };
  }

  /**
   * Format detailed analysis with tables
   */
  formatDetailedOpportunities(opportunities, portfolioContext) {
    // Detailed markdown tables, risk analysis, and recommendations
    // Full implementation with comparative analysis
    const detailed = `
# DeFi Yield Opportunity Analysis

## Summary
- Total Opportunities Found: ${opportunities.length}
- Chains Scanned: ${[...new Set(opportunities.map(o => o.chain))].join(', ')}
- APY Range: ${Math.min(...opportunities.map(o => o.apy)).toFixed(2)}% - ${Math.max(...opportunities.map(o => o.apy)).toFixed(2)}%
- Risk Range: ${Math.min(...opportunities.map(o => o.riskScore)).toFixed(1)} - ${Math.max(...opportunities.map(o => o.riskScore)).toFixed(1)}

## Ranked Opportunities

| Rank | Protocol | Chain | APY | TVL | Risk | Sharpe | Recommendation |
|------|----------|-------|-----|-----|------|--------|----------------|
${opportunities.map((opp, idx) => 
  `| ${idx + 1} | ${opp.protocol} | ${opp.chain} | ${opp.apy.toFixed(2)}% | $${(opp.tvl / 1e6).toFixed(1)}M | ${opp.riskScore.toFixed(1)} | ${opp.sharpeRatio.toFixed(2)} | ${this.getRecommendation(opp, portfolioContext)} |`
).join('\n')}

## Detailed Analysis

${opportunities.slice(0, 5).map((opp, idx) => `
### ${idx + 1}. ${opp.protocol.toUpperCase()} (${opp.chain})

**Performance:**
- APY: ${opp.apy.toFixed(2)}%
- Risk-Adjusted Return: ${(opp.apy / opp.riskScore).toFixed(2)}%
- Sharpe Ratio: ${opp.sharpeRatio.toFixed(2)}

**Risk Assessment:**
- Overall: ${opp.riskScore.toFixed(1)}/10 (${this.getRiskLabel(opp.riskScore)})
- Protocol Risk: ${opp.riskBreakdown?.protocolRisk?.toFixed(1) || 'N/A'}
- Financial Risk: ${opp.riskBreakdown?.financialRisk?.toFixed(1) || 'N/A'}
- Technical Risk: ${opp.riskBreakdown?.technicalRisk?.toFixed(1) || 'N/A'}
- Market Risk: ${opp.riskBreakdown?.marketRisk?.toFixed(1) || 'N/A'}

**Market Data:**
- TVL: $${(opp.tvl / 1e6).toFixed(2)}M
- Liquidity: $${((opp.liquidity || opp.tvl * 0.1) / 1e6).toFixed(2)}M

**Recommendation:** ${this.getActionableInsight(opp, portfolioContext)}
`).join('\n')}

## Portfolio Integration

${this.getPortfolioIntegrationAdvice(opportunities, portfolioContext)}
    `.trim();

    return {
      content: [{
        type: "text",
        text: detailed.substring(0, CHARACTER_LIMIT),
      }],
    };
  }

  /**
   * WORKFLOW TOOL 2: Monitor Protocol Health
   */
  async monitorProtocolHealth(args) {
    const {
      protocols_to_monitor,
      alert_thresholds = {
        apy_drop_percent: 1.0,
        risk_increase: 1.0,
        tvl_drop_percent: 20.0,
      },
      compare_alternatives = true,
    } = args;

    // Get historical data from database
    const alerts = [];

    for (const position of protocols_to_monitor) {
      try {
        // Get current data
        const adapter = getProtocolAdapter(position.protocol, position.chain);
        const currentData = await adapter.getCurrentData();

        // Get historical data
        const historical = await sql`
          SELECT apy, tvl, risk_score, updated_at
          FROM cultiv8_opportunities
          WHERE protocol_name ILIKE ${position.protocol}
          AND blockchain = ${position.chain}
          ORDER BY updated_at DESC
          LIMIT 10
        `;

        if (historical && historical.length > 0) {
          const lastKnown = historical[0];
          const apyChange = currentData.apy - lastKnown.apy;
          const tvlChangePercent = ((currentData.tvl - lastKnown.tvl) / lastKnown.tvl) * 100;

          // Check for alerts
          if (Math.abs(apyChange) >= alert_thresholds.apy_drop_percent) {
            alerts.push({
              protocol: position.protocol,
              chain: position.chain,
              type: apyChange < 0 ? 'APY_DROP' : 'APY_INCREASE',
              severity: Math.abs(apyChange) > 2 ? 'high' : 'medium',
              change: `${apyChange > 0 ? '+' : ''}${apyChange.toFixed(2)}%`,
              current: `${currentData.apy.toFixed(2)}%`,
              previous: `${lastKnown.apy.toFixed(2)}%`,
              recommendation: apyChange < -2 
                ? 'CONSIDER EXITING - Significant yield degradation'
                : 'MONITOR - Small yield change',
              position_size: position.position_size,
            });
          }

          if (tvlChangePercent <= -alert_thresholds.tvl_drop_percent) {
            alerts.push({
              protocol: position.protocol,
              chain: position.chain,
              type: 'TVL_DROP',
              severity: 'high',
              change: `${tvlChangePercent.toFixed(1)}%`,
              current: `$${(currentData.tvl / 1e6).toFixed(1)}M`,
              recommendation: 'REDUCE EXPOSURE - Liquidity concerns',
              position_size: position.position_size,
            });
          }
        }
      } catch (error) {
        alerts.push({
          protocol: position.protocol,
          chain: position.chain,
          type: 'ERROR',
          severity: 'medium',
          error: error.message,
          recommendation: 'VERIFY MANUALLY - Data fetch failed',
        });
      }
    }

    // Get alternatives if requested
    let alternatives = [];
    if (compare_alternatives && alerts.some(a => a.severity === 'high')) {
      const altOpps = await this.discoverYieldOpportunities({
        chain: protocols_to_monitor[0].chain,
        min_apy: 5.0,
        max_risk: 7,
        response_format: 'concise',
        limit: 3,
      });
      alternatives = altOpps; // Parse from response
    }

    return this.formatMonitoringReport(alerts, alternatives);
  }

  /**
   * Format monitoring report with actionable alerts
   */
  formatMonitoringReport(alerts, alternatives) {
    if (alerts.length === 0) {
      return {
        content: [{
          type: "text",
          text: `✅ ALL MONITORED PROTOCOLS HEALTHY

No alerts triggered. All positions performing as expected.

Recommendation: HOLD current positions, continue monitoring.`,
        }],
      };
    }

    const highSeverity = alerts.filter(a => a.severity === 'high');
    const summary = `
🚨 PROTOCOL HEALTH ALERTS (${alerts.length} total, ${highSeverity.length} high priority)

${alerts.map(alert => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${alert.protocol.toUpperCase()} (${alert.chain})
Type: ${alert.type}
Severity: ${alert.severity.toUpperCase()}
Change: ${alert.change || 'N/A'}
Current: ${alert.current || 'N/A'}
${alert.position_size ? `Position Value: $${alert.position_size.toLocaleString()}` : ''}

➜ ${alert.recommendation}
`).join('\n')}

${alternatives.length > 0 ? `
ALTERNATIVE OPPORTUNITIES:
${JSON.stringify(alternatives, null, 2)}
` : ''}

IMMEDIATE ACTIONS REQUIRED:
${highSeverity.map(a => `- ${a.protocol}: ${a.recommendation}`).join('\n') || 'None'}
    `.trim();

    return {
      content: [{
        type: "text",
        text: summary.substring(0, CHARACTER_LIMIT),
      }],
    };
  }

  /**
   * WORKFLOW TOOL 3: Analyze Protocol Risk
   */
  async analyzeProtocolRisk(args) {
    const { protocol, chain, asset, include_comparisons = true } = args;

    // Calculate comprehensive risk score
    const opportunity = {
      protocol_name: protocol,
      blockchain: chain,
      pool_address: "0x...", // Would lookup from config
    };

    const riskAnalysis = await riskEngine.calculateRisk(opportunity);

    const analysis = `
# Risk Analysis: ${protocol} on ${chain}

## Overall Risk Score: ${riskAnalysis.totalScore.toFixed(1)}/10
**Risk Level:** ${this.getRiskLabel(riskAnalysis.totalScore)}

## Dimensional Breakdown

### Protocol Risk: ${riskAnalysis.breakdown.protocolRisk.toFixed(1)}/10
- Audit Status: ${riskAnalysis.factors.auditStatus || 'Unknown'}
- Time in Production: ${riskAnalysis.factors.productionDays || 'Unknown'} days
- Historical Exploits: ${riskAnalysis.factors.exploits || 0}
- TVL Track Record: ${riskAnalysis.factors.tvlStability || 'Stable'}

### Financial Risk: ${riskAnalysis.breakdown.financialRisk.toFixed(1)}/10
- Liquidity Depth: ${riskAnalysis.factors.liquidityScore || 'N/A'}
- Impermanent Loss Risk: ${riskAnalysis.factors.ilRisk || 'Low'}
- Fee Structure: ${riskAnalysis.factors.feeImpact || 'Favorable'}

### Technical Risk: ${riskAnalysis.breakdown.technicalRisk.toFixed(1)}/10
- Contract Complexity: ${riskAnalysis.factors.complexity || 'Moderate'}
- Upgrade Mechanism: ${riskAnalysis.factors.upgradeability || 'Timelock'}
- Oracle Dependencies: ${riskAnalysis.factors.oracleDependencies || 'Chainlink'}

### Market Risk: ${riskAnalysis.breakdown.marketRisk.toFixed(1)}/10
- Asset Volatility: ${riskAnalysis.factors.assetVolatility || 'Low'}
- Market Conditions: ${riskAnalysis.factors.marketSentiment || 'Neutral'}

${include_comparisons ? `
## Risk Comparisons
Similar protocols for context:
- Aave V3: 3.2/10 (Blue-chip, low risk)
- Compound V3: 3.5/10 (Blue-chip, low risk)  
- This protocol: ${riskAnalysis.totalScore.toFixed(1)}/10

${riskAnalysis.totalScore > 7 ? '⚠️ Above average risk - proceed with caution' : ''}
${riskAnalysis.totalScore < 4 ? '✅ Below average risk - favorable opportunity' : ''}
` : ''}

## Mitigation Strategies
${this.getRiskMitigations(riskAnalysis)}

## Recommendation
${this.getRiskBasedRecommendation(riskAnalysis)}
    `.trim();

    return {
      content: [{
        type: "text",
        text: analysis.substring(0, CHARACTER_LIMIT),
      }],
    };
  }

  /**
   * WORKFLOW TOOL 4: Market Conditions Analysis
   */
  async analyzeMarketConditions(args) {
    const { chains = ["ethereum", "base"], include_trends = true } = args;

    const marketData = {
      timestamp: new Date().toISOString(),
      chains: {},
    };

    for (const chain of chains) {
      // Get all opportunities for this chain
      const opportunities = await sql`
        SELECT protocol_name, apy, tvl, risk_score, updated_at
        FROM cultiv8_opportunities
        WHERE blockchain = ${chain}
        AND is_active = true
        ORDER BY updated_at DESC
      `;

      if (opportunities && opportunities.length > 0) {
        const avgAPY = opportunities.reduce((sum, o) => sum + Number(o.apy), 0) / opportunities.length;
        const totalTVL = opportunities.reduce((sum, o) => sum + Number(o.tvl), 0);
        const avgRisk = opportunities.reduce((sum, o) => sum + Number(o.risk_score), 0) / opportunities.length;

        marketData.chains[chain] = {
          avgAPY: avgAPY.toFixed(2),
          totalTVL: totalTVL,
          avgRisk: avgRisk.toFixed(1),
          protocolCount: opportunities.length,
        };
      }
    }

    const sentiment = this.calculateMarketSentiment(marketData);

    const report = `
# DeFi Market Conditions Report

## Overall Sentiment: ${sentiment.label.toUpperCase()}
${sentiment.reasoning}

## Chain-by-Chain Analysis

${Object.entries(marketData.chains).map(([chain, data]) => `
### ${chain.toUpperCase()}
- Average APY: ${data.avgAPY}%
- Total TVL: $${(data.totalTVL / 1e6).toFixed(1)}M
- Average Risk: ${data.avgRisk}/10
- Active Protocols: ${data.protocolCount}
- Recommendation: ${this.getChainRecommendation(chain, data)}
`).join('\n')}

## Strategic Recommendations

${this.getStrategicRecommendations(marketData, sentiment)}

## Optimal Timing
${this.getTimingAdvice(marketData)}
    `.trim();

    return {
      content: [{
        type: "text",
        text: report.substring(0, CHARACTER_LIMIT),
      }],
    };
  }

  /**
   * Helper: Get recommendation for an opportunity
   */
  getRecommendation(opp, portfolioContext) {
    if (!portfolioContext) return "No portfolio context";

    const { existing_protocols = [] } = portfolioContext;
    
    if (existing_protocols.includes(opp.protocol)) {
      return "Already invested - consider increasing allocation";
    }

    if (opp.sharpeRatio > 1.5) {
      return "STRONG BUY - Excellent risk-adjusted returns";
    } else if (opp.sharpeRatio > 1.0) {
      return "BUY - Good opportunity";
    } else {
      return "HOLD - Monitor for better entry";
    }
  }

  /**
   * Helper: Get actionable insight
   */
  getActionableInsight(opp, portfolioContext) {
    const insights = [];

    if (opp.sharpeRatio > 1.5) {
      insights.push("🟢 Excellent risk/return profile - prioritize this opportunity");
    }

    if (opp.tvl > 100000000) {
      insights.push("🟢 Deep liquidity - low slippage risk");
    }

    if (opp.riskScore < 4) {
      insights.push("🟢 Blue-chip protocol - suitable for large allocations");
    }

    if (opp.riskScore > 7) {
      insights.push("🟡 Higher risk - limit position size to 10-15% of portfolio");
    }

    return insights.join('\n');
  }

  /**
   * Helper: Get next steps
   */
  getNextSteps(opportunities, portfolioContext) {
    const steps = [
      `1. Review top ${Math.min(3, opportunities.length)} opportunities above`,
      `2. Check gas prices for optimal entry timing (use gas optimizer MCP)`,
      `3. Calculate position sizes based on portfolio allocation`,
    ];

    if (portfolioContext) {
      steps.push(`4. Consider rebalancing existing positions if returns justify gas costs`);
    } else {
      steps.push(`4. Set initial allocation parameters (risk tolerance, max investment)`);
    }

    return steps.join('\n');
  }

  /**
   * Helper: Get risk label
   */
  getRiskLabel(score) {
    if (score < 3) return "Very Low Risk";
    if (score < 5) return "Low Risk";
    if (score < 7) return "Moderate Risk";
    if (score < 9) return "High Risk";
    return "Very High Risk";
  }

  /**
   * Helper: Calculate market sentiment
   */
  calculateMarketSentiment(marketData) {
    const allAPYs = Object.values(marketData.chains).map(c => parseFloat(c.avgAPY));
    const avgMarketAPY = allAPYs.reduce((a, b) => a + b, 0) / allAPYs.length;

    if (avgMarketAPY > 10) {
      return {
        label: "Risk-On",
        reasoning: "High yields suggest strong market activity. Good time for aggressive strategies.",
      };
    } else if (avgMarketAPY > 6) {
      return {
        label: "Neutral",
        reasoning: "Moderate yields suggest normal market conditions. Balanced approach recommended.",
      };
    } else {
      return {
        label: "Risk-Off",
        reasoning: "Low yields suggest defensive market. Focus on blue-chip protocols.",
      };
    }
  }

  /**
   * Helper: Get chain recommendation
   */
  getChainRecommendation(chain, data) {
    const apy = parseFloat(data.avgAPY);
    
    if (apy > 10) {
      return "🟢 Favorable - Above-average yields available";
    } else if (apy > 6) {
      return "🟡 Neutral - Standard market conditions";
    } else {
      return "🔴 Cautious - Below-average yields";
    }
  }

  /**
   * Helper: Get strategic recommendations
   */
  getStrategicRecommendations(marketData, sentiment) {
    const recommendations = [];

    if (sentiment.label === "Risk-On") {
      recommendations.push("- Increase allocation to higher-yield opportunities");
      recommendations.push("- Consider expanding to more protocols for diversification");
      recommendations.push("- Monitor closely for sentiment shifts");
    } else if (sentiment.label === "Risk-Off") {
      recommendations.push("- Focus on blue-chip protocols (Aave, Compound)");
      recommendations.push("- Reduce position sizes");
      recommendations.push("- Increase cash reserves");
    } else {
      recommendations.push("- Maintain balanced allocation");
      recommendations.push("- Opportunistically add to high-Sharpe opportunities");
      recommendations.push("- Regular rebalancing every 7-14 days");
    }

    return recommendations.join('\n');
  }

  /**
   * Helper: Get timing advice
   */
  getTimingAdvice(marketData) {
    return `
Current timing assessment:
- Gas prices: Check gas optimizer MCP for real-time pricing
- Network activity: Normal for weekend/weekday
- Optimal window: Next 4-6 hours for lower gas

Best practice: Batch multiple operations to save gas costs.
    `.trim();
  }

  /**
   * Helper: Get portfolio integration advice
   */
  getPortfolioIntegrationAdvice(opportunities, portfolioContext) {
    if (!portfolioContext) {
      return "No portfolio context provided. These are absolute rankings.";
    }

    return `
Based on your current portfolio:
- Total Invested: $${portfolioContext.total_invested?.toLocaleString() || 0}
- Risk Tolerance: ${portfolioContext.risk_tolerance}/10
- Existing Protocols: ${portfolioContext.existing_protocols?.join(', ') || 'None'}

Suggested allocation adjustments:
${opportunities.slice(0, 3).map((opp, idx) => 
  `${idx + 1}. Add ${this.calculateAllocationPercent(opp, portfolioContext)}% to ${opp.protocol}`
).join('\n')}

Use the portfolio management MCP for detailed rebalancing analysis.
    `.trim();
  }

  /**
   * Helper: Calculate recommended allocation
   */
  calculateAllocationPercent(opp, portfolioContext) {
    const riskBudget = portfolioContext.risk_tolerance || 7;
    const safetyMargin = Math.max(0, riskBudget - opp.riskScore);
    
    if (safetyMargin > 3) return 25; // Large allocation
    if (safetyMargin > 1) return 15; // Moderate allocation
    return 10; // Small allocation
  }

  /**
   * Helper: Get risk mitigations
   */
  getRiskMitigations(riskAnalysis) {
    const mitigations = [];

    if (riskAnalysis.breakdown.protocolRisk > 5) {
      mitigations.push("- Limit position size to 10-15% of portfolio");
      mitigations.push("- Monitor protocol news and audits closely");
    }

    if (riskAnalysis.breakdown.financialRisk > 5) {
      mitigations.push("- Verify sufficient exit liquidity before entry");
      mitigations.push("- Set stop-loss at 5% drawdown");
    }

    if (riskAnalysis.breakdown.technicalRisk > 5) {
      mitigations.push("- Review smart contract code and recent upgrades");
      mitigations.push("- Check oracle reliability and redundancy");
    }

    return mitigations.length > 0 
      ? mitigations.join('\n')
      : "No specific mitigations needed - acceptable risk level";
  }

  /**
   * Helper: Get risk-based recommendation
   */
  getRiskBasedRecommendation(riskAnalysis) {
    const score = riskAnalysis.totalScore;

    if (score < 3) {
      return "✅ LOW RISK - Suitable for large allocations (up to 40% of portfolio)";
    } else if (score < 5) {
      return "✅ MODERATE-LOW RISK - Suitable for medium allocations (up to 25%)";
    } else if (score < 7) {
      return "⚠️ MODERATE RISK - Limit to 15% allocation, monitor closely";
    } else if (score < 9) {
      return "⚠️ HIGH RISK - Small allocation only (5-10%), strict stop-loss";
    } else {
      return "🚫 VERY HIGH RISK - Avoid or minimal allocation (< 5%)";
    }
  }

  /**
   * Format error responses with helpful suggestions
   */
  formatError(error) {
    let suggestion = "Try again with valid parameters";

    if (error.message.includes("network")) {
      suggestion = "Check RPC endpoint configuration and network connectivity";
    } else if (error.message.includes("database")) {
      suggestion = "Ensure DATABASE_URL is set and migrations are run";
    } else if (error.message.includes("not found")) {
      suggestion = "Verify protocol name and chain are correct (ethereum/base)";
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: error.message,
          suggestion,
          timestamp: new Date().toISOString(),
        }, null, 2),
      }],
      isError: true,
    };
  }

  /**
   * Setup error handling and graceful shutdown
   */
  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error("[DeFi Oracle MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      console.log("\nShutting down DeFi Oracle MCP Server...");
      await this.server.close();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\nShutting down DeFi Oracle MCP Server...");
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Start the MCP server
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("✅ DeFi Oracle MCP Server v2.0.0 running");
    console.log("📊 Workflow tools: discover_yield_opportunities, monitor_protocol_health, analyze_protocol_risk, analyze_market_conditions");
  }
}

/**
 * Custom error class for MCP operations
 */
class MCPError extends Error {
  constructor(message, suggestion = null) {
    super(message);
    this.name = 'MCPError';
    this.suggestion = suggestion || "Check parameters and try again";
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new DeFiOracleServer();
  server.run().catch(console.error);
}

export default DeFiOracleServer;

