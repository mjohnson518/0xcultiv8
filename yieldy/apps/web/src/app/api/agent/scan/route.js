import sql from "@/app/api/utils/sql";
import { rateLimitMiddleware } from "@/app/api/middleware/rateLimit";
import { authMiddleware } from "@/app/api/middleware/auth";
import { checkEmergencyPause, circuitBreaker } from "@/app/api/utils/circuitBreaker";

// ADD: helper to compute available agent funds
async function getAvailableAgentFunds() {
  try {
    await sql(
      `CREATE TABLE IF NOT EXISTS agent_fund_transactions (id SERIAL PRIMARY KEY, amount NUMERIC(20,2) NOT NULL, type VARCHAR(20) NOT NULL, note TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    );
  } catch (e) {}
  const [totals, investedRows] = await sql.transaction((txn) => [
    txn`SELECT COALESCE(SUM(CASE WHEN type='deposit' THEN amount WHEN type='adjustment' THEN amount WHEN type='withdrawal' THEN -amount ELSE 0 END),0) AS total_funds FROM agent_fund_transactions`,
    txn`SELECT COALESCE(SUM(amount),0) AS invested FROM investments WHERE status IN ('pending','confirmed')`,
  ]);
  const totalFunds = parseFloat(totals[0]?.total_funds || 0);
  const invested = parseFloat(investedRows[0]?.invested || 0);
  return Math.max(0, totalFunds - invested);
}

// NEW: helper to compute accrued simple return based on APY and holding period
function computeAccruedReturn(amount, apyPct, investedAt, now = new Date()) {
  try {
    const amt = Number(amount || 0);
    const apy = Number(apyPct || 0) / 100;
    const start = new Date(investedAt);
    if (!amt || !apy || !start || isNaN(start.getTime())) return 0;
    const ms = now.getTime() - start.getTime();
    const years = Math.max(0, ms / (365 * 24 * 60 * 60 * 1000));
    const accrued = amt * apy * years; // simple interest approximation
    return Math.round(accrued * 100) / 100;
  } catch (e) {
    return 0;
  }
}

// NEW: read performance fee percent (defaults to 10%)
async function getPerformanceFeePercent() {
  try {
    await sql(
      `CREATE TABLE IF NOT EXISTS performance_fee_config (id SERIAL PRIMARY KEY, percent NUMERIC(5,2) NOT NULL DEFAULT 10.00, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    );
    const rows =
      await sql`SELECT percent FROM performance_fee_config ORDER BY id DESC LIMIT 1`;
    const pct = parseFloat(rows[0]?.percent || 10);
    return isNaN(pct) ? 10 : pct;
  } catch (e) {
    return 10;
  }
}

// NEW: ensure fees ledger exists
async function ensureFeesLedger() {
  try {
    await sql(
      `CREATE TABLE IF NOT EXISTS performance_fees (id SERIAL PRIMARY KEY, investment_id INTEGER NOT NULL, fee_percent NUMERIC(5,2) NOT NULL, fee_amount NUMERIC(20,2) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    );
  } catch (e) {}
}

// NEW: simulate a withdrawal and mark realized return + performance fee
async function simulateWithdrawal(inv) {
  const mockHash = "0x" + Math.random().toString(16).slice(2).padEnd(64, "0");
  const nowIso = new Date().toISOString();
  const realized = computeAccruedReturn(
    inv.amount,
    inv.expected_apy ?? inv.current_apy ?? 0,
    inv.invested_at,
    new Date(nowIso),
  );

  // Calculate performance fee from realized profits
  const feePercent = await getPerformanceFeePercent();
  const feeAmount = Math.max(
    0,
    Math.round(realized * (feePercent / 100) * 100) / 100,
  );

  // Update investment realized return (gross) and mark withdrawn
  await sql`
    UPDATE investments
    SET status = 'withdrawn', withdrawn_at = ${nowIso}, withdrawal_hash = ${mockHash}, actual_return = COALESCE(actual_return, 0) + ${realized}
    WHERE id = ${inv.id}
  `;

  // Record performance fee: ledger + reduce available funds via withdrawal txn
  if (feeAmount > 0) {
    await ensureFeesLedger();
    try {
      await sql`INSERT INTO performance_fees (investment_id, fee_percent, fee_amount) VALUES (${inv.id}, ${feePercent}, ${feeAmount})`;
    } catch (e) {}
    try {
      await sql`INSERT INTO agent_fund_transactions (amount, type, note) VALUES (${feeAmount}, 'withdrawal', ${`Performance fee (${feePercent}%) for investment #${inv.id}`})`;
    } catch (e) {}
  }

  return {
    id: inv.id,
    amount: Number(inv.amount || 0),
    realized,
    feePercent,
    feeAmount,
  };
}

// AI Agent blockchain scanner
export async function POST(request) {
  // Authentication required for scan operations
  const authError = await authMiddleware(request);
  if (authError) return authError;

  // Rate limiting - scan tier for agent operations
  const rateLimitError = await rateLimitMiddleware(request, 'scan');
  if (rateLimitError) return rateLimitError;

  // Check emergency pause (block investments but allow scan-only)
  const body = await request.json();
  const { blockchain = "both", forceRun = false, scanOnly = false } = body;
  
  if (!scanOnly) {
    const pauseError = await checkEmergencyPause(request, { allowWithdrawals: false });
    if (pauseError) return pauseError;
  }

  try {

    // Get agent configuration (create default if missing)
    let configResult = await sql`
      SELECT * FROM agent_config ORDER BY id DESC LIMIT 1
    `;

    if (!configResult || configResult.length === 0) {
      const inserted = await sql`
        INSERT INTO agent_config (
          max_investment_per_opportunity, max_total_investment, min_apy_threshold, max_risk_score, auto_invest_enabled, scan_interval_minutes, preferred_protocols, blacklisted_protocols
        ) VALUES (1000, 10000, 5.0, 7, false, 1440, NULL, NULL)
        RETURNING *
      `;
      configResult = inserted;
    }

    const config = configResult[0];

    // Respect auto-invest for investing paths; but allow scan-only regardless
    if (!scanOnly && !config.auto_invest_enabled && !forceRun) {
      return Response.json(
        {
          success: false,
          error: "Auto-invest is disabled. Use forceRun=true to run manually.",
        },
        { status: 400 },
      );
    }

    // Compute funds and effective cap (allow forceRun to exceed config cap up to available funds)
    const [invSumRows] = await sql.transaction((txn) => [
      txn`SELECT COALESCE(SUM(amount), 0) as total FROM investments WHERE status IN ('pending','confirmed')`,
    ]);
    const currentTotalInvested = parseFloat(invSumRows[0]?.total || 0);
    const availableFundsGlobal = await getAvailableAgentFunds();
    const effectiveMaxTotal = forceRun
      ? Math.max(
          config.max_total_investment,
          currentTotalInvested + availableFundsGlobal,
        )
      : config.max_total_investment;

    const blockchainsToScan =
      blockchain === "both" ? ["ethereum", "base"] : [blockchain];
    const scanResults = [];

    for (const chain of blockchainsToScan) {
      // Start scan log
      const scanLogResult = await sql`
        INSERT INTO scan_logs (blockchain, status) 
        VALUES (${chain}, 'running') 
        RETURNING id
      `;
      const scanLogId = scanLogResult[0].id;

      try {
        // Simulate blockchain scanning and cultiv8 opportunity discovery
        const opportunities = await scanBlockchainForCultiv8Opportunities(
          chain,
          config,
        );

        // Store discovered opportunities
        let opportunitiesStored = 0;
        for (const opportunity of opportunities) {
          try {
            // Check if opportunity already exists
            const existing = await sql`
              SELECT id FROM cultiv8_opportunities 
              WHERE pool_address = ${opportunity.pool_address} 
              AND blockchain = ${chain}
            `;

            if (existing.length === 0) {
              await sql`
                INSERT INTO cultiv8_opportunities (
                  protocol_name, blockchain, pool_address, token_symbol, apy, tvl,
                  risk_score, protocol_type, minimum_deposit, lock_period, additional_info
                ) VALUES (
                  ${opportunity.protocol_name}, ${chain}, ${opportunity.pool_address}, 
                  ${opportunity.token_symbol}, ${opportunity.apy}, ${opportunity.tvl},
                  ${opportunity.risk_score}, ${opportunity.protocol_type}, 
                  ${opportunity.minimum_deposit}, ${opportunity.lock_period}, 
                  ${JSON.stringify(opportunity.additional_info)}
                )
              `;
              opportunitiesStored++;
            } else {
              // Update existing opportunity
              await sql`
                UPDATE cultiv8_opportunities 
                SET apy = ${opportunity.apy}, tvl = ${opportunity.tvl}, 
                    last_updated = CURRENT_TIMESTAMP
                WHERE pool_address = ${opportunity.pool_address} AND blockchain = ${chain}
              `;
            }
          } catch (error) {
            console.error(
              `Error storing opportunity for ${opportunity.protocol_name}:`,
              error,
            );
          }
        }

        // If scanOnly, complete log and continue without any portfolio actions
        if (scanOnly) {
          await sql`
            UPDATE scan_logs 
            SET scan_completed_at = CURRENT_TIMESTAMP, 
                opportunities_found = ${opportunities.length},
                status = 'completed'
            WHERE id = ${scanLogId}
          `;

          scanResults.push({
            blockchain: chain,
            opportunitiesFound: opportunities.length,
            opportunitiesStored,
            investmentsMade: 0,
            rebalanced: 0,
            status: "completed",
          });
          continue;
        }

        // NEW: Rebalance step prior to new investments
        let rebalanced = 0;
        try {
          // Active investments on this chain
          const active = await sql`
            SELECT i.*, y.apy as current_apy, y.risk_score as current_risk, y.is_active as opp_active
            FROM investments i
            LEFT JOIN cultiv8_opportunities y ON y.id = i.opportunity_id
            WHERE i.blockchain = ${chain}
              AND i.status IN ('pending','confirmed')
              AND i.withdrawn_at IS NULL
          `;
          // Best opp that meets risk/threshold
          const bestOppRows = await sql`
            SELECT * FROM cultiv8_opportunities
            WHERE blockchain = ${chain} AND is_active = true
              AND risk_score <= ${config.max_risk_score}
              AND apy >= ${config.min_apy_threshold}
            ORDER BY apy DESC
            LIMIT 1
          `;
          const bestOpp = bestOppRows[0] || null;
          const improvementThreshold = 1.0; // absolute % APY improvement required

          for (const inv of active) {
            const curApy = Number(inv.current_apy ?? inv.expected_apy ?? 0);
            const shouldExit =
              inv.opp_active === false ||
              curApy < Number(config.min_apy_threshold || 0) ||
              (bestOpp &&
                Number(bestOpp.apy || 0) - curApy >= improvementThreshold);

            if (shouldExit) {
              try {
                await simulateWithdrawal(inv);
                rebalanced++;
              } catch (e) {
                console.error("rebalance withdrawal error", e);
              }
            }
          }
        } catch (e) {
          console.error("rebalance step failed", e);
        }

        // Recompute totals after potential withdrawals
        const [invAfterRows] = await sql.transaction((txn) => [
          txn`SELECT COALESCE(SUM(amount), 0) as total FROM investments WHERE status IN ('pending','confirmed')`,
        ]);
        const currentTotalInvestedAfter = parseFloat(
          invAfterRows[0]?.total || 0,
        );

        // Analyze opportunities and make investment decisions (respect effective cap)
        const investmentDecisions = await analyzeAndDecideInvestments(
          chain,
          config,
          effectiveMaxTotal,
          currentTotalInvestedAfter,
          forceRun,
        );

        // Execute approved investments
        let investmentsMade = 0;
        let availableFunds = await getAvailableAgentFunds();
        for (const decision of investmentDecisions) {
          if (!decision.shouldInvest) continue;
          if (availableFunds <= 0) break;
          const amount = Math.min(decision.amount, availableFunds);
          if (amount <= 0) continue;
          try {
            // Simulate blockchain transaction
            const txHash = await simulateInvestment(decision);

            await sql`
              INSERT INTO investments (
                opportunity_id, amount, blockchain, transaction_hash, 
                expected_apy, status
              ) VALUES (
                ${decision.opportunity_id}, ${amount}, ${chain}, 
                ${txHash}, ${decision.expected_apy}, 'confirmed'
              )
            `;
            availableFunds -= amount;
            investmentsMade++;
          } catch (error) {
            console.error(`Error executing investment:`, error);
          }
        }

        // Complete scan log
        await sql`
          UPDATE scan_logs 
          SET scan_completed_at = CURRENT_TIMESTAMP, 
              opportunities_found = ${opportunities.length},
              status = 'completed'
          WHERE id = ${scanLogId}
        `;

        scanResults.push({
          blockchain: chain,
          opportunitiesFound: opportunities.length,
          opportunitiesStored,
          investmentsMade,
          rebalanced,
          status: "completed",
        });
      } catch (error) {
        console.error(`Error scanning ${chain}:`, error);

        // Record failure in circuit breaker
        await circuitBreaker.recordFailure(`scan:${chain}`, {
          error: error.message,
          blockchain: chain,
        });

        // Update scan log with error
        await sql`
          UPDATE scan_logs 
          SET scan_completed_at = CURRENT_TIMESTAMP,
              errors = ${error.message},
              status = 'failed'
          WHERE id = ${scanLogId}
        `;

        scanResults.push({
          blockchain: chain,
          status: "failed",
          error: error.message,
        });
      }
    }

    return Response.json({
      success: true,
      scanResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in agent scan:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to execute agent scan",
      },
      { status: 500 },
    );
  }
}

// Simulate blockchain scanning for cultiv8 opportunities
async function scanBlockchainForCultiv8Opportunities(blockchain, config) {
  // In a real implementation, this would connect to blockchain APIs
  // For demo purposes, we'll return simulated data

  const mockOpportunities = [
    {
      protocol_name: "Aave",
      pool_address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
      token_symbol: "USDC",
      apy: 4.25,
      tvl: 1500000000,
      risk_score: 3,
      protocol_type: "lending",
      minimum_deposit: 1,
      lock_period: 0,
      additional_info: { version: "v3", collateral_factor: 0.8 },
    },
    {
      protocol_name: "Compound",
      pool_address: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
      token_symbol: "USDC",
      apy: 3.85,
      tvl: 800000000,
      risk_score: 4,
      protocol_type: "lending",
      minimum_deposit: 1,
      lock_period: 0,
      additional_info: { version: "v3", governance_token: "COMP" },
    },
    {
      protocol_name: "Uniswap V3",
      pool_address: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
      token_symbol: "USDC",
      apy: 8.75,
      tvl: 250000000,
      risk_score: 7,
      protocol_type: "liquidity_pool",
      minimum_deposit: 100,
      lock_period: 0,
      additional_info: { fee_tier: 0.05, pair: "USDC/ETH" },
    },
  ];

  // Filter based on blockchain
  if (blockchain === "base") {
    return mockOpportunities.map((op) => ({
      ...op,
      protocol_name: op.protocol_name + " (Base)",
      pool_address: op.pool_address.replace("0x8", "0xB"), // Mock Base addresses
      apy: op.apy + 0.5, // Base typically has slightly higher yields
      tvl: op.tvl * 0.1, // Base has lower TVL
    }));
  }

  return mockOpportunities;
}

// Helper: ChatGPT request with timeout to avoid long-running scans
async function requestChatGPTWithTimeout(payload, timeoutMs = 5000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch("/integrations/chat-gpt/conversationgpt4", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch (e) {
    return null;
  }
}

// AI-powered investment decision making
async function analyzeAndDecideInvestments(
  blockchain,
  config,
  effectiveMaxTotal,
  currentTotalStart,
  skipAI = false,
) {
  try {
    // Get current opportunities that meet criteria
    const opportunities = await sql`
      SELECT * FROM cultiv8_opportunities 
      WHERE blockchain = ${blockchain} 
      AND is_active = true 
      AND apy >= ${config.min_apy_threshold}
      AND risk_score <= ${config.max_risk_score}
      ORDER BY apy DESC
    `;

    // Start from current invested total and plan within effective cap
    let plannedTotal = currentTotalStart || 0;
    const decisions = [];

    for (const opportunity of opportunities) {
      if (plannedTotal >= effectiveMaxTotal) break;

      // Fallback simple sizing: invest up to max per opp, but not exceeding cap
      const recommended = Math.min(
        config.max_investment_per_opportunity,
        effectiveMaxTotal - plannedTotal,
      );

      // If no budget left, stop
      if (recommended <= 0) break;

      if (!skipAI) {
        // Try AI sizing first with timeout
        const payload = {
          messages: [
            {
              role: "system",
              content: `You are a DeFi investment expert specializing in cultiv8 opportunities. Analyze investment opportunities and make decisions based on risk/reward profiles. Consider APY, TVL, protocol reputation, and risk scores.`,
            },
            {
              role: "user",
              content: `Analyze this cultiv8 opportunity:\n              \nProtocol: ${opportunity.protocol_name}\nBlockchain: ${opportunity.blockchain}\nAPY: ${opportunity.apy}%\nTVL: $${opportunity.tvl?.toLocaleString() || "Unknown"}\nRisk Score: ${opportunity.risk_score}/10\nProtocol Type: ${opportunity.protocol_type}\nMinimum Deposit: $${opportunity.minimum_deposit}\nLock Period: ${opportunity.lock_period} days\n\nBudget remaining: $${effectiveMaxTotal - plannedTotal}\nMax per opportunity: $${config.max_investment_per_opportunity}\n\nShould I invest? If yes, how much? Provide reasoning.`,
            },
          ],
          json_schema: {
            name: "investment_decision",
            schema: {
              type: "object",
              properties: {
                should_invest: { type: "boolean" },
                recommended_amount: { type: "number" },
                confidence_score: { type: "number" },
                reasoning: { type: "string" },
                risk_assessment: { type: "string" },
              },
              required: [
                "should_invest",
                "recommended_amount",
                "confidence_score",
                "reasoning",
                "risk_assessment",
              ],
              additionalProperties: false,
            },
          },
        };

        let plannedAmount = 0;
        let shouldInvest = false;
        const analysisResponse = await requestChatGPTWithTimeout(payload, 4500);
        if (analysisResponse && analysisResponse.ok) {
          try {
            const result = await analysisResponse.json();
            const analysis = JSON.parse(result.choices[0].message.content);
            plannedAmount = Math.max(
              0,
              Math.min(
                analysis.recommended_amount || 0,
                config.max_investment_per_opportunity,
                effectiveMaxTotal - plannedTotal,
              ),
            );
            shouldInvest = !!analysis.should_invest && plannedAmount > 0;

            decisions.push({
              opportunity_id: opportunity.id,
              shouldInvest,
              amount: plannedAmount,
              expected_apy: opportunity.apy,
              confidence: analysis.confidence_score,
              reasoning: analysis.reasoning,
              risk_assessment: analysis.risk_assessment,
            });

            if (shouldInvest) plannedTotal += plannedAmount;
            continue;
          } catch (e) {
            // fall through to fallback sizing below
          }
        }
      }

      // Fallback: invest recommended (sized by remaining budget)
      const fallbackShouldInvest =
        opportunity.apy > config.min_apy_threshold &&
        opportunity.risk_score <= config.max_risk_score &&
        recommended > 0;

      decisions.push({
        opportunity_id: opportunity.id,
        shouldInvest: fallbackShouldInvest,
        amount: fallbackShouldInvest ? recommended : 0,
        expected_apy: opportunity.apy,
        confidence: 0.5,
        reasoning: "Fallback decision based on basic criteria",
        risk_assessment: "Automated assessment",
      });

      if (fallbackShouldInvest) plannedTotal += recommended;
    }

    return decisions;
  } catch (error) {
    console.error("Error in investment analysis:", error);
    return [];
  }
}

// Simulate blockchain investment transaction
async function simulateInvestment(decision) {
  // In a real implementation, this would interact with Web3 wallets and smart contracts
  // For demo purposes, return a mock transaction hash
  const mockTxHash = "0x" + Math.random().toString(16).substr(2, 64);

  // Simulate transaction delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return mockTxHash;
}
