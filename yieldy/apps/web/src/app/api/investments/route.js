import sql from "@/app/api/utils/sql";
import { rateLimitMiddleware } from "@/app/api/middleware/rateLimit";
import { validateRequest } from "@/app/api/middleware/validation";
import { InvestmentSchema } from "@/app/api/schemas/investment";
import { authMiddleware } from "@/app/api/middleware/auth";
import { auditLog, AUDIT_ACTIONS, getIPFromRequest, getRequestIDFromRequest } from "@/app/api/utils/auditLogger";

// ADD: helper to compute available funds
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

// Get all investments with filtering
export async function GET(request) {
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

    // Validation already done by middleware, these checks are redundant but kept for safety
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

    // NEW: enforce agent funds availability
    const available = await getAvailableAgentFunds();
    if (amt > available) {
      return Response.json(
        { success: false, error: "Insufficient available agent funds" },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO investments (
        opportunity_id, amount, blockchain, transaction_hash, expected_apy, status
      ) VALUES (
        ${opportunity_id}, ${amt}, ${blockchain}, ${transaction_hash || null}, 
        ${expected_apy || opportunity[0].apy}, 'pending'
      ) RETURNING *
    `;

    // Audit log - investment created
    await auditLog({
      user_id: request.user?.id || 'system',
      action: AUDIT_ACTIONS.INVESTMENT_CREATED,
      resource_type: 'investment',
      resource_id: result[0].id.toString(),
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

    return Response.json({ success: true, investment: result[0] });
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

    return Response.json(
      { success: false, error: "Failed to create investment" },
      { status: 500 },
    );
  }
}
