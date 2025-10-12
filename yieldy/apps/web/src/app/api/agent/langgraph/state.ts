/**
 * LangGraph Agent State Definition
 * Defines the complete state structure for the Cultiv8 AI agent
 */

export interface Position {
  id: number;
  opportunity_id: number;
  amount: number;
  blockchain: string;
  expected_apy: number;
  invested_at: string;
}

export interface Opportunity {
  id: number;
  protocol_name: string;
  blockchain: string;
  pool_address: string;
  apy: number;
  tvl: number;
  risk_score: number;
  protocol_type: string;
}

export interface Strategy {
  protocol: string;
  blockchain: string;
  action: 'deposit' | 'withdraw' | 'rebalance';
  amount: number;
  expectedAPY: number;
  riskScore: number;
  rationale: string;
  confidence: number;
}

export interface ExecutionPlan {
  transactions: Transaction[];
  estimatedGasCost: number;
  mevRisk: {
    score: number;
    level: string;
    recommendations: string[];
  };
  allSimulationsSucceed: boolean;
}

export interface Transaction {
  to: string;
  data: string;
  value: number;
  description: string;
  gasEstimate?: string;
}

export interface ReasoningStep {
  step: string;
  model?: string;
  input: any;
  output: any;
  timestamp: number;
  duration?: number;
}

export interface GasData {
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  estimatedCost: number;
}

/**
 * Complete Agent State
 * This state flows through all nodes in the graph
 */
export interface AgentState {
  // Input context
  userAddress: string;
  availableFunds: number;
  riskTolerance: number;
  maxInvestmentPerOpp: number;
  currentPositions: Position[];

  // Market data (populated by analyzeMarket)
  opportunities: Opportunity[];
  gasPrice: GasData | null;
  marketConditions: any;

  // Analysis (populated by analyzeMarket)
  analysis: string | null;

  // Strategy generation (populated by generateStrategies)
  strategies: Strategy[];

  // Selection (populated by selectStrategy)
  selectedStrategy: Strategy | null;

  // Execution planning (populated by buildExecutionPlan)
  executionPlan: ExecutionPlan | null;

  // Results (populated by executeTransactions)
  transactions: any[];

  // Reasoning chain (accumulated across all nodes)
  reasoning: ReasoningStep[];

  // Control flow
  humanApprovalRequired: boolean;
  circuitBreakerTriggered: boolean;
  iteration: number;
  errors: string[];
}

/**
 * Initial state factory
 * Creates a fresh state object with defaults
 */
export function createInitialState(userContext: {
  userAddress: string;
  availableFunds: number;
  riskTolerance: number;
  maxInvestmentPerOpp: number;
  currentPositions?: Position[];
}): AgentState {
  return {
    userAddress: userContext.userAddress,
    availableFunds: userContext.availableFunds,
    riskTolerance: userContext.riskTolerance,
    maxInvestmentPerOpp: userContext.maxInvestmentPerOpp,
    currentPositions: userContext.currentPositions || [],
    
    opportunities: [],
    gasPrice: null,
    marketConditions: null,
    analysis: null,
    strategies: [],
    selectedStrategy: null,
    executionPlan: null,
    transactions: [],
    reasoning: [],
    
    humanApprovalRequired: false,
    circuitBreakerTriggered: false,
    iteration: 0,
    errors: [],
  };
}

