import { StateGraph, END } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";
import { analyzeMarket, generateStrategies, selectStrategy, buildExecutionPlan, executeTransactions } from './nodes.js';
import { log } from '../../utils/logger.js';

/**
 * Build Cultiv8 Agent LangGraph
 * Creates the state machine for AI-powered yield farming decisions
 */
export function buildCultiv8Agent() {
  // Define state channels
  const stateDefinition = {
    channels: {
      userAddress: null,
      availableFunds: null,
      riskTolerance: null,
      maxInvestmentPerOpp: null,
      currentPositions: null,
      opportunities: null,
      gasPrice: null,
      marketConditions: null,
      analysis: null,
      strategies: null,
      selectedStrategy: null,
      executionPlan: null,
      transactions: null,
      reasoning: null,
      humanApprovalRequired: null,
      circuitBreakerTriggered: null,
      iteration: null,
      errors: null,
    },
  };

  // Create state graph
  const workflow = new StateGraph(stateDefinition);

  // Add nodes
  workflow.addNode("analyze", analyzeMarket);
  workflow.addNode("generate", generateStrategies);
  workflow.addNode("select", selectStrategy);
  workflow.addNode("plan", buildExecutionPlan);
  workflow.addNode("execute", executeTransactions);

  // Define edges (flow between nodes)
  workflow.addEdge("analyze", "generate");
  workflow.addEdge("generate", "select");
  workflow.addEdge("select", "plan");

  // Conditional routing after planning
  workflow.addConditionalEdges(
    "plan",
    shouldContinueToExecution,
    {
      execute: "execute",
      end: END,
    }
  );

  workflow.addEdge("execute", END);

  // Set entry point
  workflow.setEntryPoint("analyze");

  // Compile the graph
  const compiledGraph = workflow.compile();

  log.info('Cultiv8 agent graph compiled successfully');

  return compiledGraph;
}

/**
 * Conditional routing logic
 * Determines whether to proceed to execution or stop for approval
 */
function shouldContinueToExecution(state) {
  // Stop if circuit breaker triggered
  if (state.circuitBreakerTriggered) {
    log.warn('Circuit breaker triggered, stopping execution');
    return "end";
  }

  // Stop if human approval required
  if (state.humanApprovalRequired) {
    log.info('Human approval required, pausing for review');
    return "end";
  }

  // Stop if execution plan failed simulation
  if (state.executionPlan && !state.executionPlan.allSimulationsSucceed) {
    log.warn('Transaction simulation failed, stopping execution');
    return "end";
  }

  // Stop if there are errors
  if (state.errors && state.errors.length > 0) {
    log.error('Errors detected in state, stopping execution', { errors: state.errors });
    return "end";
  }

  // All checks passed - proceed to execution
  return "execute";
}

/**
 * Create PostgreSQL checkpointer for state persistence
 * Allows resuming agent execution from any point
 */
export async function createCheckpointer() {
  try {
    if (!process.env.DATABASE_URL) {
      log.warn('No DATABASE_URL configured, checkpointing disabled');
      return null;
    }

    // Create PostgreSQL connection pool
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    });

    // Test connection
    await pool.query('SELECT 1');

    // Create checkpointer
    const checkpointer = new PostgresSaver(pool);

    // Setup checkpoint tables
    await checkpointer.setup();

    log.info('PostgreSQL checkpointer initialized');

    return checkpointer;
  } catch (error) {
    log.error('Failed to create checkpointer', { error: error.message });
    return null;
  }
}

/**
 * Build agent with checkpointing
 * Returns compiled graph with state persistence
 */
export async function buildCultiv8AgentWithCheckpointing() {
  const graph = buildCultiv8Agent();
  const checkpointer = await createCheckpointer();

  if (checkpointer) {
    // Compile with checkpointing enabled
    return graph.compile({ checkpointer });
  }

  // Compile without checkpointing (state won't persist)
  log.warn('Running agent without state persistence');
  return graph.compile();
}

