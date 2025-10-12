import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { fetchAllProtocolData } from '../../protocols/adapters';
import { log } from '../../utils/logger';

/**
 * LangGraph Agent Nodes
 * Each node represents a step in the agent's decision-making process
 */

/**
 * Node 1: Analyze Market
 * Uses Claude Sonnet 4.5 for strategic market analysis
 */
export async function analyzeMarket(state) {
  log.info('Agent node: analyzeMarket', { iteration: state.iteration });
  const startTime = Date.now();

  try {
    // Fetch real opportunities from both chains
    const [ethereumData, baseData] = await Promise.all([
      fetchAllProtocolData('ethereum').catch(() => []),
      fetchAllProtocolData('base').catch(() => []),
    ]);

    const allOpportunities = [...ethereumData, ...baseData]
      .filter(p => p.success && p.apy > 0)
      .map(p => ({
        protocol: p.protocol,
        chain: p.chain,
        apy: p.apy,
        tvl: p.tvl,
        // Will add risk scores in next step
      }));

    // Fetch current gas prices
    const gasPrice = {
      maxFeePerGas: '50000000000', // Will fetch real data
      maxPriorityFeePerGas: '2000000000',
      estimatedCost: 15, // USD estimate
    };

    // Use Claude for strategic analysis
    const claude = new ChatAnthropic({
      modelName: "claude-sonnet-4-20250514",
      temperature: 0.3,
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const prompt = `You are a DeFi yield farming strategist analyzing investment opportunities.

Current Portfolio:
- Available Funds: $${state.availableFunds}
- Risk Tolerance: ${state.riskTolerance}/10
- Max Per Opportunity: $${state.maxInvestmentPerOpp}
- Active Positions: ${state.currentPositions.length}

Active Positions:
${state.currentPositions.map(p => `  - ${p.blockchain}: $${p.amount} at ${p.expected_apy}% APY`).join('\n') || '  None'}

Available Opportunities:
${allOpportunities.map(o => `  - ${o.protocol} (${o.chain}): ${o.apy}% APY, TVL: $${(o.tvl / 1e6).toFixed(1)}M`).join('\n')}

Provide a strategic analysis covering:
1. Best opportunities given risk tolerance of ${state.riskTolerance}/10
2. Whether rebalancing is needed from current positions
3. Key risks to consider
4. Recommended allocation strategy
5. Market conditions assessment

Be specific and actionable. Focus on maximizing risk-adjusted returns.`;

    const response = await claude.invoke([{ role: "user", content: prompt }]);

    const duration = Date.now() - startTime;

    return {
      ...state,
      opportunities: allOpportunities,
      gasPrice,
      marketConditions: { gasLevel: 'medium', volatility: 'low' },
      analysis: response.content,
      reasoning: [
        ...state.reasoning,
        {
          step: "market_analysis",
          model: "claude-sonnet-4",
          input: { opportunitiesCount: allOpportunities.length, availableFunds: state.availableFunds },
          output: response.content,
          timestamp: Date.now(),
          duration,
        },
      ],
      iteration: state.iteration + 1,
    };
  } catch (error) {
    log.error('analyzeMarket node failed', { error: error.message });
    return {
      ...state,
      errors: [...state.errors, `Market analysis failed: ${error.message}`],
      circuitBreakerTriggered: true,
    };
  }
}

/**
 * Node 2: Generate Strategies
 * Uses Claude to generate 3-5 potential strategies
 */
export async function generateStrategies(state) {
  log.info('Agent node: generateStrategies', { iteration: state.iteration });
  const startTime = Date.now();

  try {
    const claude = new ChatAnthropic({
      modelName: "claude-sonnet-4-20250514",
      temperature: 0.5, // Higher temp for creative strategy generation
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const prompt = `Based on this market analysis:

${state.analysis}

Generate 3-5 specific investment strategies as a JSON array. Each strategy should include:
{
  "protocol": "protocol name",
  "blockchain": "ethereum or base",
  "action": "deposit, withdraw, or rebalance",
  "amount": dollar amount,
  "expectedAPY": percentage,
  "riskScore": 1-10,
  "rationale": "brief explanation",
  "confidence": 0-1
}

Available funds: $${state.availableFunds}
Max per opportunity: $${state.maxInvestmentPerOpp}
Risk tolerance: ${state.riskTolerance}/10

Return ONLY valid JSON array, no other text.`;

    const response = await claude.invoke([{ role: "user", content: prompt }]);

    // Parse strategies from Claude's response
    let strategies = [];
    try {
      // Extract JSON from response (Claude might wrap it in markdown)
      const content = response.content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        strategies = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback parsing
        strategies = JSON.parse(content);
      }
    } catch (parseError) {
      log.warn('Failed to parse strategies from Claude', { error: parseError.message, content: response.content });
      // Generate fallback strategy
      strategies = [{
        protocol: state.opportunities[0]?.protocol || 'aave',
        blockchain: state.opportunities[0]?.chain || 'ethereum',
        action: 'deposit',
        amount: Math.min(state.availableFunds, state.maxInvestmentPerOpp),
        expectedAPY: state.opportunities[0]?.apy || 4.0,
        riskScore: 5,
        rationale: 'Fallback strategy - Claude parsing failed',
        confidence: 0.3,
      }];
    }

    const duration = Date.now() - startTime;

    return {
      ...state,
      strategies,
      reasoning: [
        ...state.reasoning,
        {
          step: "strategy_generation",
          model: "claude-sonnet-4",
          input: state.analysis,
          output: strategies,
          timestamp: Date.now(),
          duration,
        },
      ],
    };
  } catch (error) {
    log.error('generateStrategies node failed', { error: error.message });
    return {
      ...state,
      errors: [...state.errors, `Strategy generation failed: ${error.message}`],
      circuitBreakerTripped: true,
    };
  }
}

/**
 * Node 3: Select Strategy
 * Uses heuristic scoring to select best strategy
 */
export async function selectStrategy(state) {
  log.info('Agent node: selectStrategy', { strategiesCount: state.strategies.length });
  const startTime = Date.now();

  try {
    if (state.strategies.length === 0) {
      return {
        ...state,
        selectedStrategy: null,
        humanApprovalRequired: true,
        errors: [...state.errors, 'No strategies generated'],
      };
    }

    // Score each strategy
    const scored = state.strategies.map(s => {
      let score = 0;

      // Confidence weight (0-30 points)
      score += s.confidence * 30;

      // APY weight (0-25 points, normalized)
      score += Math.min(s.expectedAPY / 20, 1) * 25;

      // Risk weight (0-25 points, inverse - lower risk is better)
      score += (10 - s.riskScore) / 10 * 25;

      // Amount efficiency (0-20 points)
      const utilizationRate = s.amount / state.availableFunds;
      score += Math.min(utilizationRate, 1) * 20;

      return {
        ...s,
        score,
      };
    });

    // Sort by score
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    // Check if human approval needed
    const needsApproval =
      best.amount > state.availableFunds * 0.5 || // >50% of funds
      best.riskScore > state.riskTolerance + 1 || // Exceeds risk tolerance
      best.confidence < 0.5; // Low confidence

    const duration = Date.now() - startTime;

    return {
      ...state,
      selectedStrategy: best,
      humanApprovalRequired: needsApproval,
      reasoning: [
        ...state.reasoning,
        {
          step: "strategy_selection",
          input: scored,
          output: { selected: best, needsApproval },
          timestamp: Date.now(),
          duration,
        },
      ],
    };
  } catch (error) {
    log.error('selectStrategy node failed', { error: error.message });
    return {
      ...state,
      errors: [...state.errors, `Strategy selection failed: ${error.message}`],
    };
  }
}

/**
 * Node 4: Build Execution Plan
 * Uses GPT-4 for detailed execution planning
 */
export async function buildExecutionPlan(state) {
  log.info('Agent node: buildExecutionPlan', { strategy: state.selectedStrategy?.protocol });
  const startTime = Date.now();

  try {
    if (!state.selectedStrategy) {
      return {
        ...state,
        executionPlan: null,
        errors: [...state.errors, 'No strategy selected'],
      };
    }

    const gpt4 = new ChatOpenAI({
      modelName: "gpt-4-turbo-preview",
      temperature: 0.1, // Low temp for precise execution planning
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Create a detailed execution plan for this DeFi strategy:

Strategy:
${JSON.stringify(state.selectedStrategy, null, 2)}

Current Gas Price: ${state.gasPrice?.maxFeePerGas || 'unknown'}
Available Funds: $${state.availableFunds}

Create an execution plan including:
1. Transaction sequence (approvals, deposits, etc.)
2. Gas optimization approach
3. Slippage protection settings
4. Risk mitigation steps
5. Expected outcomes

Return a JSON object with:
{
  "steps": ["step 1", "step 2", ...],
  "gasStrategy": "description",
  "slippageTolerance": 0.5,
  "estimatedDuration": "time estimate",
  "contingencies": ["what if X happens", ...]
}

Return ONLY valid JSON, no other text.`;

    const response = await gpt4.invoke([{ role: "user", content: prompt }]);

    // Parse execution plan
    let planDetails;
    try {
      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      planDetails = jsonMatch ? JSON.parse(jsonMatch[0]) : { steps: [], gasStrategy: 'standard' };
    } catch {
      planDetails = { steps: [], gasStrategy: 'standard' };
    }

    // Build actual transactions (will be done by backend)
    // For now, placeholder structure
    const executionPlan = {
      transactions: [],
      estimatedGasCost: state.gasPrice?.estimatedCost || 15,
      mevRisk: {
        score: 3,
        level: 'LOW',
        recommendations: [],
      },
      allSimulationsSucceed: true,
      planDetails,
    };

    const duration = Date.now() - startTime;

    return {
      ...state,
      executionPlan,
      reasoning: [
        ...state.reasoning,
        {
          step: "execution_planning",
          model: "gpt-4-turbo",
          input: state.selectedStrategy,
          output: executionPlan,
          timestamp: Date.now(),
          duration,
        },
      ],
    };
  } catch (error) {
    log.error('buildExecutionPlan node failed', { error: error.message });
    return {
      ...state,
      errors: [...state.errors, `Execution planning failed: ${error.message}`],
    };
  }
}

/**
 * Node 5: Execute Transactions
 * System node - actually submits transactions (if approved)
 */
export async function executeTransactions(state) {
  log.info('Agent node: executeTransactions', { plan: state.executionPlan ? 'ready' : 'missing' });
  const startTime = Date.now();

  try {
    if (!state.executionPlan || !state.selectedStrategy) {
      return {
        ...state,
        errors: [...state.errors, 'No execution plan available'],
      };
    }

    // In production, this would call the actual execution API
    // For now, simulate execution
    const results = [{
      status: 'simulated',
      strategy: state.selectedStrategy,
      message: 'Transaction execution ready - requires user signature',
    }];

    const duration = Date.now() - startTime;

    return {
      ...state,
      transactions: results,
      reasoning: [
        ...state.reasoning,
        {
          step: "transaction_execution",
          input: state.executionPlan,
          output: results,
          timestamp: Date.now(),
          duration,
        },
      ],
    };
  } catch (error) {
    log.error('executeTransactions node failed', { error: error.message });
    return {
      ...state,
      errors: [...state.errors, `Transaction execution failed: ${error.message}`],
      transactions: [],
    };
  }
}

