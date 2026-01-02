import sql from "@/app/api/utils/sql";
import { rateLimitMiddleware } from "@/app/api/middleware/rateLimit";
import { validateRequest } from "@/app/api/middleware/validation";
import { InvestmentSchema } from "@/app/api/schemas/investment";
import { authMiddleware } from "@/app/api/middleware/auth";
import { auditLog, AUDIT_ACTIONS, getIPFromRequest, getRequestIDFromRequest } from "@/app/api/utils/auditLogger";
import { checkEmergencyPause, circuitBreaker } from "@/app/api/utils/circuitBreaker";

// Ensure tables exist
async function ensureTables() {
  try {
    await sql(
      `CREATE TABLE IF NOT EXISTS agent_fund_transactions (id SERIAL PRIMARY KEY, amount NUMERIC(20,2) NOT NULL, type VARCHAR(20) NOT NULL, note TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    );
  } catch (e) {}
}

/**
 * Get available agent funds (for read-only checks)
 * NOTE: For investment creation, use createInvestmentAtomic() instead
 */
async function getAvailableAgentFunds() {
  await ensureTables();
  const [totals, investedRows] = await sql.transaction((txn) => [
    txn`SELECT COALESCE(SUM(CASE WHEN type='deposit' THEN amount WHEN type='adjustment' THEN amount WHEN type='withdrawal' THEN -amount ELSE 0 END),0) AS total_funds FROM agent_fund_transactions`,
    txn`SELECT COALESCE(SUM(amount),0) AS invested FROM investments WHERE status IN ('pending','confirmed')`,
  ]);
  const totalFunds = parseFloat(totals[0]?.total_funds || 0);
  const invested = parseFloat(investedRows[0]?.invested || 0);
  return Math.max(0, totalFunds - invested);
}

/**
 * Create investment with atomic fund validation
 * CRITICAL: Uses transaction to prevent TOCTOU race conditions
 *
 * @param {object} investmentData - Investment details
 * @param {object} opportunity - Validated opportunity record
 * @returns {Promise<{success: boolean, investment?: object, error?: string}>}
 */
async function createInvestmentAtomic(investmentData, opportunity) {
  const { opportunity_id, amount, blockchain, transaction_hash, expected_apy } = investmentData;
  const amt = parseFloat(amount);

  try {
    // Use transaction with serializable isolation for consistency
    const result = await sql.transaction(async (txn) => {
      // 1. Lock and calculate available funds within transaction
      // Using FOR UPDATE prevents concurrent modifications
      const totals = await txn`
        SELECT COALESCE(SUM(CASE
          WHEN type='deposit' THEN amount
          WHEN type='adjustment' THEN amount
          WHEN type='withdrawal' THEN -amount
          ELSE 0 END),0) AS total_funds
        FROM agent_fund_transactions
        FOR UPDATE
      `;

      const investedRows = await txn`
        SELECT COALESCE(SUM(amount),0) AS invested
        FROM investments
        WHERE status IN ('pending','confirmed')
        FOR UPDATE
      `;

      const totalFunds = parseFloat(totals[0]?.total_funds || 0);
      const invested = parseFloat(investedRows[0]?.invested || 0);
      const available = Math.max(0, totalFunds - invested);

      // 2. Check funds within transaction (atomically)
      if (amt > available) {
        throw new Error(`INSUFFICIENT_FUNDS:${available}`);
      }

      // 3. Create investment (still within transaction)
      const inserted = await txn`
        INSERT INTO investments (
          opportunity_id, amount, blockchain, transaction_hash, expected_apy, status
        ) VALUES (
          ${opportunity_id}, ${amt}, ${blockchain}, ${transaction_hash || null},
          ${expected_apy || opportunity.apy}, 'pending'
        ) RETURNING *
      `;

      return inserted[0];
    });

    return { success: true, investment: result };
  } catch (error) {
    // Handle insufficient funds error specifically
    if (error.message.startsWith('INSUFFICIENT_FUNDS:')) {
      const available = error.message.split(':')[1];
      return {
        success: false,
        error: `Insufficient available agent funds. Available: ${available}`,
        code: 'INSUFFICIENT_FUNDS'
      };
    }
    throw error; // Re-throw other errors
  }
}

// Get all investments with filtering
// SECURITY: Authentication required to view investment data
export async function GET(request) {
  // Authentication required - prevents unauthorized access to investment data
  const authError = await authMiddleware(request);
  if (authError) return authError;

  // Rate limiting - general tier for read operations
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const blockchain = searchParams.get("blockchain");
    const limit = searchParams.get("limit") || "50";

    let query = `
      SELECT i.*, yo.protocol_name, yo.apy as current_apy, yo.protocol_type
      FROM investments i
      LEFT JOIN yield_opportunities yo ON i.opportunity_id = yo.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND i.status = $${paramCount}`;
      params.push(status);
    }

    if (blockchain) {
      paramCount++;
      query += ` AND i.blockchain = $${paramCount}`;
      params.push(blockchain);
    }

    query += ` ORDER BY i.invested_at DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));

    const investments = await sql(query, params);

    return Response.json({
      success: true,
      investments: investments || [],
    });
  } catch (error) {
    console.error("Error fetching investments:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch investments",
      },
      { status: 500 },
    );
  }
}

// Create new investment
export async function POST(request) {
  // Authentication required for creating investments
  const authError = await authMiddleware(request);
  if (authError) return authError;

  // Check emergency pause
  const pauseError = await checkEmergencyPause(request, { allowWithdrawals: false });
  if (pauseError) return pauseError;

  // Rate limiting - investment tier for write operations
  const rateLimitError = await rateLimitMiddleware(request, 'investment');
  if (rateLimitError) return rateLimitError;

  // Input validation
  const validationError = await validateRequest(InvestmentSchema)(request);
  if (validationError) return validationError;

  try {
    // Use validated data
    const {
      opportunity_id,
      amount,
      blockchain,
      transaction_hash,
      expected_apy,
    } = request.validated;

    const amt = parseFloat(amount);

    // Verify the opportunity exists and is active
    const opportunity = await sql`
      SELECT * FROM yield_opportunities WHERE id = ${opportunity_id} AND is_active = true
    `;
    if (!opportunity || opportunity.length === 0) {
      return Response.json(
        { success: false, error: "Invalid or inactive yield opportunity" },
        { status: 400 },
      );
    }

    // CRITICAL: Use atomic transaction to prevent race conditions
    // This ensures fund check and investment creation happen atomically
    const investmentResult = await createInvestmentAtomic(
      { opportunity_id, amount: amt, blockchain, transaction_hash, expected_apy },
      opportunity[0]
    );

    if (!investmentResult.success) {
      // Handle insufficient funds error
      return Response.json(
        { success: false, error: investmentResult.error, code: investmentResult.code },
        { status: 400 },
      );
    }

    const investment = investmentResult.investment;

    // Audit log - investment created
    await auditLog({
      user_id: request.user?.id || 'system',
      action: AUDIT_ACTIONS.INVESTMENT_CREATED,
      resource_type: 'investment',
      resource_id: investment.id.toString(),
      amount: amt,
      metadata: {
        opportunity_id,
        blockchain,
        expected_apy: expected_apy || opportunity[0].apy,
        protocol: opportunity[0].protocol_name,
      },
      ip_address: getIPFromRequest(request),
      request_id: getRequestIDFromRequest(request),
      success: true,
    });

    return Response.json({ success: true, investment });
  } catch (error) {
    console.error("Error creating investment:", error);

    // Audit log - investment failed
    await auditLog({
      user_id: request.user?.id || 'system',
      action: AUDIT_ACTIONS.INVESTMENT_FAILED,
      resource_type: 'investment',
      amount: request.validated?.amount,
      metadata: {
        error: error.message,
        opportunity_id: request.validated?.opportunity_id,
      },
      ip_address: getIPFromRequest(request),
      request_id: getRequestIDFromRequest(request),
      success: false,
    });

    // Record failure in circuit breaker
    await circuitBreaker.recordFailure('investment', {
      error: error.message,
      opportunity_id: request.validated?.opportunity_id,
    });

    return Response.json(
      { success: false, error: "Failed to create investment" },
      { status: 500 },
    );
  }
}
