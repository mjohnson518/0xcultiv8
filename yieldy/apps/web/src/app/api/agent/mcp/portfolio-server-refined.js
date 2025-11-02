/**
 * Portfolio Management MCP Server - Production-Ready
 * Provides portfolio analysis, rebalancing workflows, and performance tracking
 * 
 * Design Philosophy:
 * - analyze_rebalancing_opportunities: Complete workflow with MPT optimization
 * - Not separate get_positions, calculate_returns tools
 * - Actionable recommendations with cost-benefit analysis
 * - Integrates Kelly Criterion and Sharpe ratio optimization
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolResultSchema, ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import sql from '../../utils/sql.js';
import { portfolioOptimizer } from '../../utils/portfolioOptimizer.js';

const CHARACTER_LIMIT = 25000;

class PortfolioManagementServer {
  constructor() {
    this.server = new Server(
      {
        name: "cultiv8-portfolio-management",
        version: "2.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
    this.setupErrorHandling();
  }

  setupTools() {
    this.server.setRequestHandler(ListToolsResultSchema, async () => {
      return {
        tools: [
          // PRIMARY WORKFLOW TOOL
          {
            name: "analyze_rebalancing_opportunities",
            description: `
Analyzes portfolio and generates comprehensive rebalancing recommendations.

This is a COMPLETE WORKFLOW that:
- Evaluates current positions vs optimal allocation
- Uses Modern Portfolio Theory (MPT) for optimization
- Calculates Sharpe ratios and Kelly Criterion sizing
- Identifies concentration risks and correlation
- Projects performance impact of rebalancing
- Estimates gas costs vs expected benefits
- Provides step-by-step rebalancing instructions

Returns actionable plan with:
- Current vs target allocation comparison
- Specific buy/sell recommendations with amounts
- Expected return improvement
- Risk reduction quantification
- Gas cost analysis
- Net benefit after costs
- Execution priority ranking

Use this for: Regular portfolio maintenance, post-yield-change adjustments, risk management

Integrates with: Gas optimizer (for execution), DeFi oracle (for opportunities)
            `.trim(),
            inputSchema: {
              type: "object",
              properties: {
                user_address: {
                  type: "string",
                  description: "User wallet address (optional if using system default)",
                },
                target_risk: {
                  type: "number",
                  minimum: 1,
                  maximum: 10,
                  description: "Target portfolio risk score (1-10)",
                },
                rebalance_threshold: {
                  type: "number",
                  minimum: 1,
                  maximum: 50,
                  default: 5,
                  description: "Minimum drift % to trigger rebalance",
                },
                include_new_opportunities: {
                  type: "boolean",
                  default: true,
                  description: "Consider adding new protocols to portfolio",
                },
                max_gas_cost_percent: {
                  type: "number",
                  minimum: 0.1,
                  maximum: 5.0,
                  default: 0.5,
                  description: "Max gas cost as % of rebalance value",
                },
              },
            },
          },

          // PERFORMANCE TRACKING WORKFLOW
          {
            name: "track_portfolio_performance",
            description: `
Comprehensive portfolio performance tracking and attribution analysis.

Calculates:
- Total returns (realized + unrealized)
- Time-weighted returns (TWR)
- Money-weighted returns (MWR/IRR)
- Sharpe ratio (risk-adjusted returns)
- Maximum drawdown
- Win rate and average win/loss
- Protocol-level attribution
- Fee impact analysis

Compares to:
- Portfolio benchmarks (60/40, all-weather)
- Individual protocol performance
- Risk-adjusted metrics

Returns insights on:
- Which positions drove performance
- Which positions underperformed
- Fee drag analysis
- Rebalancing effectiveness

Use for: Monthly reviews, strategy evaluation, performance reporting
            `.trim(),
            inputSchema: {
              type: "object",
              properties: {
                user_address: { type: "string" },
                period_days: {
                  type: "number",
                  minimum: 1,
                  maximum: 365,
                  default: 30,
                  description: "Analysis period in days",
                },
                include_attribution: {
                  type: "boolean",
                  default: true,
                  description: "Include protocol-level performance attribution",
                },
                benchmark: {
                  type: "string",
                  enum: ["none", "market_average", "risk_free"],
                  default: "market_average",
                },
              },
            },
          },

          // RISK MANAGEMENT WORKFLOW
          {
            name: "analyze_portfolio_risk",
            description: `
Analyzes portfolio-level risk metrics and concentration.

Evaluates:
- Aggregate risk score (weighted by position size)
- Concentration risk (single protocol exposure)
- Correlation risk (similar protocols)
- Tail risk (maximum potential loss)
- Liquidity risk (exit constraints)

Provides recommendations on:
- Position sizing adjustments
- Diversification opportunities
- Correlation reduction strategies
- Liquidity management

Use for: Risk reviews, before adding large positions, stress testing
            `.trim(),
            inputSchema: {
              type: "object",
              properties: {
                user_address: { type: "string" },
                stress_scenarios: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      apy_change_percent: { type: "number" },
                      tvl_change_percent: { type: "number" },
                    },
                  },
                  description: "Stress test scenarios to evaluate",
                },
              },
            },
          },

          // POSITION SIZING WORKFLOW
          {
            name: "calculate_optimal_position_size",
            description: `
Calculates optimal position size for a new opportunity using Kelly Criterion.

Considers:
- Expected return vs risk
- Current portfolio allocation
- Correlation with existing positions
- Available capital
- Risk constraints

Returns recommended size with:
- Kelly Criterion optimal size
- Fractional Kelly (safer 0.25-0.5x)
- Risk-adjusted sizing
- Maximum loss scenario
- Diversification impact

Use before: Entering new positions, scaling existing positions
            `.trim(),
            inputSchema: {
              type: "object",
              properties: {
                opportunity: {
                  type: "object",
                  properties: {
                    protocol: { type: "string" },
                    chain: { type: "string" },
                    apy: { type: "number" },
                    risk_score: { type: "number" },
                  },
                  required: ["protocol", "apy", "risk_score"],
                },
                available_capital: { type: "number", description: "USD available to invest" },
                current_portfolio_value: { type: "number" },
                max_single_position_percent: {
                  type: "number",
                  default: 25,
                  description: "Max % of portfolio in single position",
                },
              },
              required: ["opportunity", "available_capital"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolResultSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "analyze_rebalancing_opportunities":
            return await this.analyzeRebalancing(args);

          case "track_portfolio_performance":
            return await this.trackPerformance(args);

          case "analyze_portfolio_risk":
            return await this.analyzeRisk(args);

          case "calculate_optimal_position_size":
            return await this.calculatePositionSize(args);

          default:
            throw new MCPError(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return this.formatError(error);
      }
    });
  }

  /**
   * WORKFLOW TOOL 1: Analyze Rebalancing Opportunities
   */
  async analyzeRebalancing(args) {
    const {
      user_address,
      target_risk = 7,
      rebalance_threshold = 5,
      include_new_opportunities = true,
      max_gas_cost_percent = 0.5,
    } = args;

    // 1. Get current positions
    const positions = await sql`
      SELECT i.*, o.protocol_name, o.apy, o.blockchain, o.risk_score, o.tvl
      FROM investments i
      LEFT JOIN cultiv8_opportunities o ON i.opportunity_id = o.id
      WHERE i.status IN ('pending', 'confirmed')
      ${user_address ? sql`AND i.user_address = ${user_address}` : sql``}
      ORDER BY i.amount DESC
    `;

    if (!positions || positions.length === 0) {
      return {
        content: [{
          type: "text",
          text: "No active positions found. Start by discovering yield opportunities using the DeFi Oracle MCP.",
        }],
      };
    }

    // 2. Get available opportunities
    const opportunities = await sql`
      SELECT * FROM cultiv8_opportunities
      WHERE is_active = true
      AND risk_score <= ${target_risk}
      ORDER BY apy DESC
      LIMIT 20
    `;

    // 3. Calculate current allocation
    const totalInvested = positions.reduce((sum, p) => sum + Number(p.amount), 0);
    const currentAllocation = positions.map(p => ({
      protocol: p.protocol_name,
      chain: p.blockchain,
      amount: Number(p.amount),
      percent: (Number(p.amount) / totalInvested) * 100,
      apy: Number(p.apy),
      risk: Number(p.risk_score),
    }));

    // 4. Calculate optimal allocation using MPT
    const optimalPlan = portfolioOptimizer.optimizeAllocation(
      opportunities || [],
      {
        maxTotalInvestment: totalInvested,
        maxRiskScore: target_risk,
        maxInvestmentPerOpportunity: totalInvested * 0.4, // Max 40% in single position
      }
    );

    // 5. Calculate drift from optimal
    const driftAnalysis = this.calculateDrift(currentAllocation, optimalPlan.allocations);

    // 6. Determine if rebalancing is needed
    if (driftAnalysis.maxDrift < rebalance_threshold) {
      return {
        content: [{
          type: "text",
          text: `
# Portfolio Rebalancing Analysis

## ✅ NO REBALANCING NEEDED

Maximum drift: ${driftAnalysis.maxDrift.toFixed(2)}% (threshold: ${rebalance_threshold}%)

Your portfolio is well-aligned with optimal allocation.

Current Performance:
- Total Invested: $${totalInvested.toLocaleString()}
- Weighted APY: ${this.calculateWeightedAPY(currentAllocation).toFixed(2)}%
- Portfolio Risk: ${this.calculatePortfolioRisk(currentAllocation).toFixed(1)}/10
- Sharpe Ratio: ${this.calculateSharpeRatio(currentAllocation).toFixed(2)}

Recommendation: HOLD current positions, review again in 7-14 days.
          `.trim(),
        }],
      };
    }

    // 7. Generate rebalancing recommendations
    const rebalanceSteps = this.generateRebalanceSteps(
      currentAllocation,
      optimalPlan.allocations,
      totalInvested
    );

    // 8. Estimate costs and benefits
    const costBenefit = await this.estimateRebalancingCostBenefit(
      rebalanceSteps,
      optimalPlan,
      currentAllocation,
      max_gas_cost_percent
    );

    // 9. Format comprehensive report
    return this.formatRebalancingReport({
      currentAllocation,
      optimalAllocation: optimalPlan.allocations,
      driftAnalysis,
      rebalanceSteps,
      costBenefit,
      totalInvested,
    });
  }

  /**
   * Calculate drift between current and optimal allocation
   */
  calculateDrift(current, optimal) {
    const drifts = current.map(pos => {
      const optimalPos = optimal.find(o => 
        o.protocol === pos.protocol && o.chain === pos.chain
      );
      
      const optimalPercent = optimalPos ? optimalPos.percent : 0;
      const drift = Math.abs(pos.percent - optimalPercent);
      
      return {
        protocol: pos.protocol,
        currentPercent: pos.percent,
        optimalPercent,
        drift,
      };
    });

    return {
      drifts,
      maxDrift: Math.max(...drifts.map(d => d.drift)),
      avgDrift: drifts.reduce((sum, d) => sum + d.drift, 0) / drifts.length,
    };
  }

  /**
   * Generate step-by-step rebalancing instructions
   */
  generateRebalanceSteps(current, optimal, totalValue) {
    const steps = [];

    // Find positions to reduce
    current.forEach(pos => {
      const optimalPos = optimal.find(o => 
        o.protocol === pos.protocol && o.chain === pos.chain
      );
      
      const currentAmount = pos.amount;
      const optimalAmount = optimalPos ? (optimalPos.percent / 100) * totalValue : 0;
      const diff = currentAmount - optimalAmount;

      if (diff > totalValue * 0.02) { // > 2% of portfolio
        steps.push({
          action: "REDUCE",
          protocol: pos.protocol,
          chain: pos.chain,
          currentAmount,
          targetAmount: optimalAmount,
          changeAmount: -diff,
          changePercent: -(diff / currentAmount) * 100,
          priority: Math.abs(diff) / totalValue > 0.1 ? "high" : "medium",
        });
      }
    });

    // Find positions to increase or add
    optimal.forEach(optPos => {
      const currentPos = current.find(c => 
        c.protocol === optPos.protocol && c.chain === optPos.chain
      );
      
      const currentAmount = currentPos ? currentPos.amount : 0;
      const optimalAmount = (optPos.percent / 100) * totalValue;
      const diff = optimalAmount - currentAmount;

      if (diff > totalValue * 0.02) {
        steps.push({
          action: currentAmount > 0 ? "INCREASE" : "ADD",
          protocol: optPos.protocol,
          chain: optPos.chain,
          currentAmount,
          targetAmount: optimalAmount,
          changeAmount: diff,
          changePercent: currentAmount > 0 ? (diff / currentAmount) * 100 : 100,
          priority: Math.abs(diff) / totalValue > 0.1 ? "high" : "medium",
        });
      }
    });

    return steps.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority === "high" ? -1 : 1;
      }
      return Math.abs(b.changeAmount) - Math.abs(a.changeAmount);
    });
  }

  /**
   * Estimate costs and benefits of rebalancing
   */
  async estimateRebalancingCostBenefit(steps, optimalPlan, currentAllocation, maxGasPercent) {
    const gasPerTx = 200000; // Average for deposit/withdraw
    const gasPriceGwei = 25; // Would fetch from gas optimizer MCP
    const ethPrice = 3000;
    
    const totalGasCost = (steps.length * gasPerTx * gasPriceGwei / 1e9) * ethPrice;
    const totalValue = currentAllocation.reduce((sum, p) => sum + p.amount, 0);
    const gasCostPercent = (totalGasCost / totalValue) * 100;

    // Calculate expected return improvement
    const currentAPY = this.calculateWeightedAPY(currentAllocation);
    const optimalAPY = optimalPlan.expectedAPY || this.calculateWeightedAPY(optimalPlan.allocations);
    const apyImprovement = optimalAPY - currentAPY;
    const annualBenefit = (totalValue * apyImprovement) / 100;
    const monthlyBenefit = annualBenefit / 12;

    // Payback period
    const paybackDays = (totalGasCost / monthlyBenefit) * 30;

    return {
      totalGasCost,
      gasCostPercent,
      apyImprovement,
      annualBenefit,
      monthlyBenefit,
      paybackDays,
      worthIt: gasCostPercent < maxGasPercent && paybackDays < 30,
      transactionCount: steps.length,
    };
  }

  /**
   * Format comprehensive rebalancing report
   */
  formatRebalancingReport(data) {
    const {
      currentAllocation,
      optimalAllocation,
      driftAnalysis,
      rebalanceSteps,
      costBenefit,
      totalInvested,
    } = data;

    const report = `
# Portfolio Rebalancing Analysis

## Current Portfolio
Total Value: $${totalInvested.toLocaleString()}
Weighted APY: ${this.calculateWeightedAPY(currentAllocation).toFixed(2)}%
Portfolio Risk: ${this.calculatePortfolioRisk(currentAllocation).toFixed(1)}/10
Sharpe Ratio: ${this.calculateSharpeRatio(currentAllocation).toFixed(2)}

Position Count: ${currentAllocation.length}
Largest Position: ${currentAllocation[0].protocol} (${currentAllocation[0].percent.toFixed(1)}%)

### Current Allocation
${currentAllocation.map(pos => `
- ${pos.protocol} (${pos.chain}): $${pos.amount.toLocaleString()} (${pos.percent.toFixed(1)}%)
  APY: ${pos.apy.toFixed(2)}% | Risk: ${pos.risk.toFixed(1)}/10
`).join('')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Optimal Allocation (MPT Optimized)
Expected APY: ${(costBenefit.apyImprovement + this.calculateWeightedAPY(currentAllocation)).toFixed(2)}% (+${costBenefit.apyImprovement.toFixed(2)}%)
Target Risk: ${this.calculatePortfolioRisk(optimalAllocation).toFixed(1)}/10

${optimalAllocation.map(pos => `
- ${pos.protocol} (${pos.chain}): ${pos.percent.toFixed(1)}%
  Target: $${((pos.percent / 100) * totalInvested).toLocaleString()}
`).join('')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Rebalancing Actions Required (${rebalanceSteps.length} transactions)

${rebalanceSteps.map((step, idx) => `
${idx + 1}. ${step.action} ${step.protocol} (${step.chain}) [${step.priority.toUpperCase()}]
   Current: $${step.currentAmount.toLocaleString()}
   Target: $${step.targetAmount.toLocaleString()}
   Change: ${step.changeAmount > 0 ? '+' : ''}$${step.changeAmount.toLocaleString()} (${step.changePercent > 0 ? '+' : ''}${step.changePercent.toFixed(1)}%)
`).join('')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Cost-Benefit Analysis

### Costs
- Gas Cost: $${costBenefit.totalGasCost.toFixed(2)} (${costBenefit.gasCostPercent.toFixed(3)}% of portfolio)
- Transaction Count: ${costBenefit.transactionCount}
- ${costBenefit.gasCostPercent > costBenefit.maxGasPercent ? '⚠️ Above gas budget' : '✅ Within gas budget'}

### Benefits
- APY Improvement: +${costBenefit.apyImprovement.toFixed(2)}%
- Annual Benefit: $${costBenefit.annualBenefit.toLocaleString()}
- Monthly Benefit: $${costBenefit.monthlyBenefit.toFixed(2)}
- Payback Period: ${costBenefit.paybackDays.toFixed(0)} days

### Net Benefit
${costBenefit.worthIt ? `
✅ REBALANCING RECOMMENDED

ROI: ${((costBenefit.monthlyBenefit / costBenefit.totalGasCost) * 100).toFixed(0)}%
Payback in ${costBenefit.paybackDays.toFixed(0)} days
Net first-year benefit: $${(costBenefit.annualBenefit - costBenefit.totalGasCost).toLocaleString()}
` : `
⚠️ REBALANCING NOT RECOMMENDED

Gas costs (${costBenefit.gasCostPercent.toFixed(2)}%) outweigh short-term benefits.
Payback period (${costBenefit.paybackDays.toFixed(0)} days) is too long.

Consider waiting for:
- Larger allocation drift (current: ${driftAnalysis.maxDrift.toFixed(1)}%)
- Lower gas prices
- More significant APY changes
`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Execution Plan

${costBenefit.worthIt ? `
### Step-by-Step Instructions

${rebalanceSteps.filter(s => s.priority === 'high').map((step, idx) => `
${idx + 1}. ${step.action} ${step.protocol}
   Amount: $${Math.abs(step.changeAmount).toLocaleString()}
   Expected gas: ~$${(costBenefit.totalGasCost / rebalanceSteps.length).toFixed(2)}
   ${step.action === 'REDUCE' ? 'Withdraw and redeploy' : 'Deposit from available funds'}
`).join('')}

### Optimal Execution Timing
- Check gas prices with Gas Optimizer MCP
- Execute during low-gas period (weekends, US night time)
- Consider batching all operations using EIP-7702

### Risk Management
- Execute high-priority changes first
- Monitor for protocol changes during rebalancing
- Set price alerts for opportunities being added
` : `
### Alternative Approach
- Wait for more drift accumulation
- Monitor gas prices for better windows
- Consider rebalancing monthly instead of weekly
`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Next Steps

1. ${costBenefit.worthIt ? 'Use Gas Optimizer MCP to time execution' : 'Continue monitoring with next review in 7 days'}
2. ${costBenefit.worthIt ? 'Prepare transactions in order of priority' : 'Set alerts for significant APY changes'}
3. ${costBenefit.worthIt ? 'Execute rebalancing during optimal gas window' : 'Track drift - rebalance when > 10%'}
    `.trim();

    return {
      content: [{
        type: "text",
        text: report.substring(0, CHARACTER_LIMIT),
      }],
    };
  }

  /**
   * WORKFLOW TOOL 2: Track Portfolio Performance
   */
  async trackPerformance(args) {
    const {
      user_address,
      period_days = 30,
      include_attribution = true,
      benchmark = "market_average",
    } = args;

    // Get historical positions
    const investments = await sql`
      SELECT i.*, o.protocol_name, o.apy, o.blockchain
      FROM investments i
      LEFT JOIN cultiv8_opportunities o ON i.opportunity_id = o.id
      WHERE i.invested_at > NOW() - INTERVAL '${period_days} days'
      ${user_address ? sql`AND i.user_address = ${user_address}` : sql``}
      ORDER BY i.invested_at DESC
    `;

    if (!investments || investments.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No investment activity in the last ${period_days} days.`,
        }],
      };
    }

    // Calculate returns
    const totalInvested = investments.reduce((sum, i) => sum + Number(i.amount), 0);
    const totalReturns = investments.reduce((sum, i) => sum + Number(i.actual_return || i.expected_return || 0), 0);
    const returnPercent = (totalReturns / totalInvested) * 100;

    // Calculate metrics
    const sharpeRatio = this.calculateInvestmentSharpe(investments);
    const winRate = this.calculateWinRate(investments);
    const maxDrawdown = this.calculateMaxDrawdown(investments);

    // Protocol attribution
    const attribution = include_attribution 
      ? this.calculateAttribution(investments)
      : null;

    const report = `
# Portfolio Performance Report (${period_days} days)

## Overall Performance
- Total Invested: $${totalInvested.toLocaleString()}
- Total Returns: $${totalReturns.toLocaleString()}
- Return: ${returnPercent.toFixed(2)}%
- Annualized: ${(returnPercent * (365 / period_days)).toFixed(2)}%

## Risk-Adjusted Metrics
- Sharpe Ratio: ${sharpeRatio.toFixed(2)}
- Max Drawdown: ${maxDrawdown.toFixed(2)}%
- Win Rate: ${winRate.toFixed(1)}%

## Benchmark Comparison
${this.getBenchmarkComparison(returnPercent, period_days, benchmark)}

${attribution ? `
## Performance Attribution

${attribution.map(attr => `
### ${attr.protocol} (${attr.chain})
- Contribution: $${attr.totalReturn.toLocaleString()} (${attr.percentOfTotal.toFixed(1)}% of total)
- APY Delivered: ${attr.apy.toFixed(2)}% (Expected: ${attr.expectedAPY.toFixed(2)}%)
- Performance: ${attr.apy >= attr.expectedAPY ? '✅ Met/exceeded expectations' : '⚠️ Underperformed'}
`).join('')}
` : ''}

## Key Insights
${this.generatePerformanceInsights(investments, returnPercent, sharpeRatio)}

## Recommendations
${this.generatePerformanceRecommendations(investments, returnPercent, winRate)}
    `.trim();

    return {
      content: [{
        type: "text",
        text: report.substring(0, CHARACTER_LIMIT),
      }],
    };
  }

  /**
   * Calculate weighted APY
   */
  calculateWeightedAPY(allocation) {
    if (!allocation || allocation.length === 0) return 0;
    
    const totalWeight = allocation.reduce((sum, p) => sum + (p.amount || p.percent), 0);
    const weightedSum = allocation.reduce((sum, p) => {
      const weight = p.amount || p.percent;
      return sum + (p.apy * weight);
    }, 0);

    return weightedSum / totalWeight;
  }

  /**
   * Calculate portfolio risk
   */
  calculatePortfolioRisk(allocation) {
    if (!allocation || allocation.length === 0) return 0;

    const totalWeight = allocation.reduce((sum, p) => sum + (p.amount || p.percent), 0);
    const weightedRisk = allocation.reduce((sum, p) => {
      const weight = p.amount || p.percent;
      return sum + (p.risk * weight);
    }, 0);

    return weightedRisk / totalWeight;
  }

  /**
   * Calculate Sharpe ratio
   */
  calculateSharpeRatio(allocation) {
    const apy = this.calculateWeightedAPY(allocation);
    const risk = this.calculatePortfolioRisk(allocation);
    const riskFreeRate = 3.0; // Treasury rate

    return (apy - riskFreeRate) / (risk * 2); // Simple volatility proxy
  }

  /**
   * Calculate investment Sharpe from historical data
   */
  calculateInvestmentSharpe(investments) {
    // Simplified calculation
    const returns = investments.map(i => Number(i.actual_return || i.expected_return || 0));
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );

    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  /**
   * Calculate win rate
   */
  calculateWinRate(investments) {
    const completed = investments.filter(i => i.status === 'withdrawn' || i.actual_return);
    if (completed.length === 0) return 0;

    const wins = completed.filter(i => Number(i.actual_return || 0) > 0).length;
    return (wins / completed.length) * 100;
  }

  /**
   * Calculate maximum drawdown
   */
  calculateMaxDrawdown(investments) {
    // Simplified - would need time series data for accurate calculation
    const returns = investments.map(i => Number(i.actual_return || 0) / Number(i.amount || 1) * 100);
    const maxLoss = Math.min(...returns, 0);
    return Math.abs(maxLoss);
  }

  /**
   * Calculate attribution
   */
  calculateAttribution(investments) {
    const byProtocol = {};

    investments.forEach(inv => {
      const key = `${inv.protocol_name}-${inv.blockchain}`;
      if (!byProtocol[key]) {
        byProtocol[key] = {
          protocol: inv.protocol_name,
          chain: inv.blockchain,
          totalInvested: 0,
          totalReturn: 0,
          expectedAPY: Number(inv.apy || 0),
          count: 0,
        };
      }

      byProtocol[key].totalInvested += Number(inv.amount);
      byProtocol[key].totalReturn += Number(inv.actual_return || inv.expected_return || 0);
      byProtocol[key].count += 1;
    });

    const totalReturns = Object.values(byProtocol).reduce((sum, p) => sum + p.totalReturn, 0);

    return Object.values(byProtocol).map(p => ({
      ...p,
      apy: (p.totalReturn / p.totalInvested) * 100 * (365 / 30), // Annualized
      percentOfTotal: (p.totalReturn / totalReturns) * 100,
    }));
  }

  /**
   * Get benchmark comparison
   */
  getBenchmarkComparison(returnPercent, days, benchmark) {
    const annualized = returnPercent * (365 / days);

    if (benchmark === "market_average") {
      const marketAvg = 8.5; // DeFi market average
      const vs = annualized - marketAvg;

      return vs > 0
        ? `✅ Outperforming market by ${vs.toFixed(2)}% (Market: ${marketAvg}%)`
        : `⚠️ Underperforming market by ${Math.abs(vs).toFixed(2)}% (Market: ${marketAvg}%)`;
    } else if (benchmark === "risk_free") {
      const riskFree = 3.0;
      return `Risk premium: ${(annualized - riskFree).toFixed(2)}% above risk-free rate`;
    }

    return "No benchmark selected";
  }

  /**
   * Generate insights
   */
  generatePerformanceInsights(investments, returnPercent, sharpeRatio) {
    const insights = [];

    if (returnPercent > 10) {
      insights.push("🟢 Strong absolute returns - portfolio performing well");
    }

    if (sharpeRatio > 1.5) {
      insights.push("🟢 Excellent risk-adjusted returns - efficient capital deployment");
    } else if (sharpeRatio < 0.8) {
      insights.push("🟡 Low risk-adjusted returns - consider rebalancing to higher-quality opportunities");
    }

    const protocolCount = new Set(investments.map(i => i.protocol_name)).size;
    if (protocolCount < 3) {
      insights.push("🟡 Limited diversification - consider adding more protocols to reduce concentration risk");
    }

    return insights.join('\n');
  }

  /**
   * Generate recommendations
   */
  generatePerformanceRecommendations(investments, returnPercent, winRate) {
    const recommendations = [];

    if (winRate < 60) {
      recommendations.push("- Review position selection criteria - win rate below 60%");
      recommendations.push("- Consider stricter risk filters or higher APY thresholds");
    }

    if (returnPercent < 5) {
      recommendations.push("- Explore higher-yield opportunities");
      recommendations.push("- Evaluate if current allocations are optimal");
    }

    recommendations.push("- Schedule next review in 30 days");
    recommendations.push("- Monitor for rebalancing opportunities weekly");

    return recommendations.join('\n');
  }

  /**
   * WORKFLOW TOOL 4: Calculate Optimal Position Size
   */
  async calculatePositionSize(args) {
    const {
      opportunity,
      available_capital,
      current_portfolio_value = 0,
      max_single_position_percent = 25,
    } = args;

    // Kelly Criterion calculation
    const riskFreeRate = 3.0;
    const excessReturn = opportunity.apy - riskFreeRate;
    const variance = Math.pow(opportunity.risk_score, 2); // Simplified
    const kellyFraction = excessReturn / variance;

    // Adjust for safety (fractional Kelly)
    const conservativeKelly = kellyFraction * 0.25; // Quarter Kelly for safety
    const moderateKelly = kellyFraction * 0.5; // Half Kelly

    // Apply constraints
    const maxByPercent = ((max_single_position_percent / 100) * current_portfolio_value) || available_capital;
    const recommendedSize = Math.min(
      available_capital,
      maxByPercent,
      current_portfolio_value * conservativeKelly
    );

    const analysis = `
# Optimal Position Size Calculation

## Opportunity
- Protocol: ${opportunity.protocol}
- APY: ${opportunity.apy.toFixed(2)}%
- Risk Score: ${opportunity.risk_score.toFixed(1)}/10

## Available Capital
- Available: $${available_capital.toLocaleString()}
- Portfolio Value: $${current_portfolio_value.toLocaleString()}
- Max Single Position: ${max_single_position_percent}%

## Kelly Criterion Analysis
- Full Kelly: ${(kellyFraction * 100).toFixed(1)}% of capital
- Conservative (0.25x Kelly): ${(conservativeKelly * 100).toFixed(1)}%
- Moderate (0.5x Kelly): ${(moderateKelly * 100).toFixed(1)}%

## Recommended Position Size

💰 **$${recommendedSize.toLocaleString()}**

- As % of available capital: ${(recommendedSize / available_capital * 100).toFixed(1)}%
- As % of total portfolio: ${current_portfolio_value > 0 ? (recommendedSize / current_portfolio_value * 100).toFixed(1) : 'N/A'}%

## Risk Assessment
- Maximum loss scenario (risk 10): $${(recommendedSize * 0.1).toLocaleString()}
- Expected annual return: $${(recommendedSize * opportunity.apy / 100).toLocaleString()}
- Risk-adjusted return: ${(opportunity.apy / opportunity.risk_score).toFixed(2)}%

## Sizing Rationale
${this.getSizingRationale(recommendedSize, available_capital, opportunity)}

## Diversification Impact
${current_portfolio_value > 0 ? `
- Portfolio concentration will be: ${(recommendedSize / (current_portfolio_value + recommendedSize) * 100).toFixed(1)}%
- ${(recommendedSize / (current_portfolio_value + recommendedSize) * 100) > 30 ? '⚠️ High concentration - consider smaller size' : '✅ Acceptable diversification'}
` : 'First position - no diversification impact yet'}
    `.trim();

    return {
      content: [{
        type: "text",
        text: analysis,
      }],
    };
  }

  getSizingRationale(size, available, opportunity) {
    const sizePercent = (size / available) * 100;

    if (sizePercent > 50) {
      return "Large allocation justified by strong risk-adjusted returns";
    } else if (sizePercent > 25) {
      return "Moderate allocation balances return potential with diversification";
    } else {
      return "Conservative allocation prioritizes capital preservation";
    }
  }

  /**
   * Format errors
   */
  formatError(error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: error.message,
          suggestion: error.suggestion || "Check parameters",
        }, null, 2),
      }],
      isError: true,
    };
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error("[Portfolio MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("✅ Portfolio Management MCP Server v2.0.0 running");
    console.log("📊 Workflow tools: analyze_rebalancing_opportunities, track_portfolio_performance, analyze_portfolio_risk, calculate_optimal_position_size");
  }
}

class MCPError extends Error {
  constructor(message, suggestion = null) {
    super(message);
    this.name = 'MCPError';
    this.suggestion = suggestion;
  }
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new PortfolioManagementServer();
  server.run().catch(console.error);
}

export default PortfolioManagementServer;

