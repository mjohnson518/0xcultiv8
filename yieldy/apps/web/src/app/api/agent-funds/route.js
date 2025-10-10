import sql from "@/app/api/utils/sql";
import { rateLimitMiddleware } from "@/app/api/middleware/rateLimit";
import { validateRequest } from "@/app/api/middleware/validation";
import { FundOperationSchema } from "@/app/api/schemas/funds";
import { requireAdmin } from "@/app/api/middleware/auth";

// Ensure ledger table exists
async function ensureLedger() {
  try {
    await sql(`
      CREATE TABLE IF NOT EXISTS agent_fund_transactions (
        id SERIAL PRIMARY KEY,
        amount NUMERIC(20,2) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('deposit','withdrawal','adjustment')),
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    // ignore if fails; next operations will error if truly missing
  }
}

export async function GET(request) {
  // Rate limiting - general tier for read operations
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  try {
    await ensureLedger();

    const totals = await sql`
      SELECT 
        COALESCE(SUM(CASE 
          WHEN type = 'deposit' THEN amount 
          WHEN type = 'adjustment' THEN amount
          WHEN type = 'withdrawal' THEN -amount 
          ELSE 0 END), 0) AS total_funds
      FROM agent_fund_transactions
    `;

    const investedRows = await sql`
      SELECT COALESCE(SUM(amount), 0) AS invested
      FROM investments 
      WHERE status IN ('pending','confirmed')
    `;

    const totalFunds = parseFloat(totals[0]?.total_funds || 0);
    const invested = parseFloat(investedRows[0]?.invested || 0);
    const available = Math.max(0, totalFunds - invested);

    const txs = await sql`
      SELECT id, amount, type, note, created_at
      FROM agent_fund_transactions
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return Response.json({
      success: true,
      balance: totalFunds,
      invested,
      available,
      transactions: txs,
    });
  } catch (error) {
    console.error("Error fetching agent funds:", error);
    return Response.json({ success: false, error: "Failed to fetch agent funds" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureLedger();
    
    // Admin authentication required for fund operations
    const adminError = await requireAdmin(request);
    if (adminError) return adminError;
    
    // Rate limiting - use withdrawal tier for fund operations (most restrictive)
    const rateLimitError = await rateLimitMiddleware(request, 'withdrawal');
    if (rateLimitError) return rateLimitError;

    // Input validation
    const validationError = await validateRequest(FundOperationSchema)(request);
    if (validationError) return validationError;

    const { amount, type, note } = request.validated;
    const amt = parseFloat(amount);
    if (!['deposit','withdrawal','adjustment'].includes(type)) {
      return Response.json({ success: false, error: "Invalid type" }, { status: 400 });
    }

    // If withdrawal, ensure sufficient available balance
    if (type === 'withdrawal') {
      const [totals, investedRows] = await sql.transaction((txn) => [
        txn`SELECT COALESCE(SUM(CASE WHEN type='deposit' THEN amount WHEN type='adjustment' THEN amount WHEN type='withdrawal' THEN -amount ELSE 0 END),0) AS total_funds FROM agent_fund_transactions`,
        txn`SELECT COALESCE(SUM(amount),0) AS invested FROM investments WHERE status IN ('pending','confirmed')`,
      ]);
      const totalFunds = parseFloat(totals[0]?.total_funds || 0);
      const invested = parseFloat(investedRows[0]?.invested || 0);
      const available = Math.max(0, totalFunds - invested);
      if (amt > available) {
        return Response.json({ success: false, error: "Withdrawal exceeds available balance" }, { status: 400 });
      }
    }

    const inserted = await sql`
      INSERT INTO agent_fund_transactions (amount, type, note)
      VALUES (${amt}, ${type}, ${note || null})
      RETURNING id, amount, type, note, created_at
    `;

    // Return updated balances
    const [totals2, investedRows2] = await sql.transaction((txn) => [
      txn`SELECT COALESCE(SUM(CASE WHEN type='deposit' THEN amount WHEN type='adjustment' THEN amount WHEN type='withdrawal' THEN -amount ELSE 0 END),0) AS total_funds FROM agent_fund_transactions`,
      txn`SELECT COALESCE(SUM(amount),0) AS invested FROM investments WHERE status IN ('pending','confirmed')`,
    ]);
    const totalFunds2 = parseFloat(totals2[0]?.total_funds || 0);
    const invested2 = parseFloat(investedRows2[0]?.invested || 0);

    return Response.json({
      success: true,
      transaction: inserted[0],
      balance: totalFunds2,
      invested: invested2,
      available: Math.max(0, totalFunds2 - invested2),
    });
  } catch (error) {
    console.error("Error updating agent funds:", error);
    return Response.json({ success: false, error: "Failed to update agent funds" }, { status: 500 });
  }
}
