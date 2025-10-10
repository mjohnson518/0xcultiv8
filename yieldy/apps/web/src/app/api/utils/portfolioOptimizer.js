/**
 * Portfolio Optimization Engine
 * Implements Modern Portfolio Theory (MPT) for yield farming allocation
 * Calculates risk-adjusted returns and optimal position sizing
 */
export class PortfolioOptimizer {
  constructor(riskFreeRate = 0.04) {
    this.riskFreeRate = riskFreeRate; // 4% baseline (e.g., T-bills)
    this.maxProtocolAllocation = 0.40; // Max 40% in any single protocol
    this.minPositionSize = 100; // Minimum $100 position
  }

  /**
   * Calculate Sharpe Ratio
   * Measures risk-adjusted return
   * @param {number} returns - Expected return (as decimal, e.g., 0.05 for 5%)
   * @param {number} volatility - Return volatility (standard deviation)
   * @returns {number} - Sharpe ratio
   */
  calculateSharpeRatio(returns, volatility) {
    if (volatility === 0) return 0;
    return (returns - this.riskFreeRate) / volatility;
  }

  /**
   * Calculate Sortino Ratio
   * Like Sharpe but only penalizes downside volatility
   * @param {number} returns - Expected return
   * @param {number} downsideDeviation - Downside standard deviation
   * @returns {number} - Sortino ratio
   */
  calculateSortinoRatio(returns, downsideDeviation) {
    if (downsideDeviation === 0) return 0;
    return (returns - this.riskFreeRate) / downsideDeviation;
  }

  /**
   * Kelly Criterion for position sizing
   * Calculates optimal bet size to maximize log growth
   * @param {number} winProbability - Probability of positive return (0-1)
   * @param {number} winLossRatio - Average win / average loss
   * @param {number} maxKelly - Maximum Kelly fraction (default 0.25 for safety)
   * @returns {number} - Fraction of bankroll to allocate (0-1)
   */
  kellyFraction(winProbability, winLossRatio, maxKelly = 0.25) {
    const kelly = (winProbability * winLossRatio - (1 - winProbability)) / winLossRatio;
    const bounded = Math.max(0, Math.min(kelly, maxKelly));
    return bounded;
  }

  /**
   * Optimize portfolio allocation across opportunities
   * @param {Array} opportunities - Available opportunities
   * @param {object} constraints - Investment constraints
   * @returns {object} - Optimized allocation plan
   */
  optimizeAllocation(opportunities, constraints) {
    const {
      maxTotalInvestment,
      maxRiskScore,
      maxInvestmentPerOpportunity,
    } = constraints;

    // Filter by risk tolerance
    const eligible = opportunities.filter(
      (opp) => (opp.riskScore || opp.risk_score || 10) <= maxRiskScore
    );

    if (eligible.length === 0) {
      return {
        allocations: [],
        totalAllocated: 0,
        expectedReturn: 0,
        portfolioRisk: 0,
        sharpeRatio: 0,
      };
    }

    // Calculate risk-adjusted scores for each opportunity
    const scored = eligible.map((opp) => {
      const apy = Number(opp.apy || 0) / 100; // Convert to decimal
      const risk = (opp.riskScore || opp.risk_score || 5) / 10; // Normalize to 0-1
      const volatility = opp.volatility || risk * 0.15; // Estimate if not available

      // Calculate metrics
      const sharpe = this.calculateSharpeRatio(apy, volatility);
      const riskAdjustedReturn = apy / (1 + risk); // Simple risk adjustment

      return {
        ...opp,
        apy,
        risk,
        volatility,
        sharpe,
        riskAdjustedReturn,
        score: sharpe * 100 + riskAdjustedReturn * 50, // Combined score
      };
    });

    // Sort by composite score (Sharpe + risk-adjusted return)
    scored.sort((a, b) => b.score - a.score);

    // Allocate capital with diversification constraints
    const allocations = [];
    let remaining = maxTotalInvestment;
    const protocolAllocations = new Map(); // Track per-protocol allocation

    for (const opp of scored) {
      if (remaining < this.minPositionSize) break;

      // Calculate maximum we can allocate to this opportunity
      const protocolName = opp.protocol_name;
      const currentProtocolTotal = protocolAllocations.get(protocolName) || 0;
      const maxForProtocol = maxTotalInvestment * this.maxProtocolAllocation;

      // Available for this protocol
      const protocolCapacity = maxForProtocol - currentProtocolTotal;
      if (protocolCapacity < this.minPositionSize) continue;

      // Kelly-based sizing with safety margin
      const kellySize = this.kellyFraction(0.7, 2, 0.25); // Conservative estimate
      const rawAllocation = Math.min(
        remaining,
        maxInvestmentPerOpportunity || Infinity,
        protocolCapacity,
        remaining * kellySize
      );

      // Round down to avoid fractional shares
      const allocation = Math.floor(rawAllocation);

      if (allocation >= this.minPositionSize) {
        allocations.push({
          opportunity: opp,
          amount: allocation,
          percentage: (allocation / maxTotalInvestment) * 100,
          sharpe: opp.sharpe,
          riskAdjustedReturn: opp.riskAdjustedReturn,
        });

        remaining -= allocation;
        protocolAllocations.set(protocolName, currentProtocolTotal + allocation);
      }
    }

    // Calculate portfolio-level metrics
    const portfolioMetrics = this.calculatePortfolioMetrics(allocations, maxTotalInvestment);

    return {
      allocations,
      totalAllocated: maxTotalInvestment - remaining,
      remaining,
      ...portfolioMetrics,
    };
  }

  /**
   * Calculate portfolio-level metrics
   * @param {Array} allocations
   * @param {number} totalInvestment
   * @returns {object}
   */
  calculatePortfolioMetrics(allocations, totalInvestment) {
    if (allocations.length === 0) {
      return {
        expectedReturn: 0,
        portfolioRisk: 0,
        portfolioVolatility: 0,
        sharpeRatio: 0,
      };
    }

    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);

    // Weighted average return
    const expectedReturn = allocations.reduce((sum, a) => {
      const weight = a.amount / totalAllocated;
      return sum + weight * a.opportunity.apy;
    }, 0);

    // Weighted average risk
    const portfolioRisk = allocations.reduce((sum, a) => {
      const weight = a.amount / totalAllocated;
      return sum + weight * a.opportunity.risk;
    }, 0);

    // Portfolio volatility (simplified - assumes uncorrelated for now)
    const portfolioVolatility = Math.sqrt(
      allocations.reduce((sum, a) => {
        const weight = a.amount / totalAllocated;
        return sum + Math.pow(weight * a.opportunity.volatility, 2);
      }, 0)
    );

    // Portfolio Sharpe ratio
    const sharpeRatio = this.calculateSharpeRatio(expectedReturn, portfolioVolatility);

    // Diversification score (0-10, higher is better)
    const diversificationScore = Math.min(10, allocations.length * 2);

    return {
      expectedReturn: expectedReturn * 100, // Convert back to percentage
      portfolioRisk: portfolioRisk * 10,    // Convert back to 0-10 scale
      portfolioVolatility: portfolioVolatility * 100,
      sharpeRatio,
      diversificationScore,
    };
  }

  /**
   * Calculate correlation matrix between opportunities
   * @param {Array} opportunities - Opportunities with historical data
   * @returns {Array<Array<number>>} - Correlation matrix
   */
  calculateCorrelationMatrix(opportunities) {
    // Placeholder - would need historical APY data
    // For now, assume lending protocols are moderately correlated (0.6)
    // and different types are less correlated (0.3)
    const n = opportunities.length;
    const matrix = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0; // Perfect self-correlation
        } else {
          const sameType = opportunities[i].protocol_type === opportunities[j].protocol_type;
          matrix[i][j] = sameType ? 0.6 : 0.3;
        }
      }
    }

    return matrix;
  }

  /**
   * Check if portfolio needs rebalancing
   * @param {Array} currentPositions - Current portfolio positions
   * @param {Array} optimalAllocations - Optimal allocation from optimization
   * @param {number} thresholdPercent - Drift threshold (default 5%)
   * @returns {object} - Rebalancing recommendation
   */
  needsRebalancing(currentPositions, optimalAllocations, thresholdPercent = 5) {
    const rebalanceActions = [];
    let totalDrift = 0;

    // Check each position for drift from target
    for (const optimal of optimalAllocations) {
      const current = currentPositions.find(
        (p) => p.opportunity_id === optimal.opportunity.id
      );

      const currentAmount = current?.amount || 0;
      const targetAmount = optimal.amount;
      const drift = Math.abs(currentAmount - targetAmount);
      const driftPercent = (drift / targetAmount) * 100;

      totalDrift += driftPercent;

      if (driftPercent > thresholdPercent) {
        rebalanceActions.push({
          opportunity: optimal.opportunity.protocol_name,
          currentAmount,
          targetAmount,
          action: currentAmount < targetAmount ? 'increase' : 'decrease',
          amount: Math.abs(currentAmount - targetAmount),
          driftPercent,
        });
      }
    }

    return {
      needsRebalance: rebalanceActions.length > 0,
      averageDrift: totalDrift / optimalAllocations.length,
      actions: rebalanceActions,
      recommendation: rebalanceActions.length > 0
        ? `Portfolio has drifted ${(totalDrift / optimalAllocations.length).toFixed(1)}% from target`
        : 'Portfolio is within rebalancing threshold',
    };
  }

  /**
   * Calculate risk parity allocation
   * Equal risk contribution from each position
   * @param {Array} opportunities
   * @param {number} totalInvestment
   * @returns {Array} - Allocations
   */
  calculateRiskParity(opportunities, totalInvestment) {
    if (opportunities.length === 0) return [];

    // Calculate total risk
    const totalRisk = opportunities.reduce(
      (sum, opp) => sum + (opp.risk || opp.riskScore || 5),
      0
    );

    // Allocate inversely proportional to risk
    const allocations = opportunities.map((opp) => {
      const risk = opp.risk || opp.riskScore || 5;
      const riskWeight = (totalRisk - risk) / (totalRisk * (opportunities.length - 1));
      const amount = Math.floor(totalInvestment * riskWeight);

      return {
        opportunity: opp,
        amount,
        percentage: (amount / totalInvestment) * 100,
        riskContribution: risk * riskWeight,
      };
    });

    return allocations;
  }
}

// Singleton instance
export const portfolioOptimizer = new PortfolioOptimizer();

