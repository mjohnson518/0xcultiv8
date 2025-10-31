import sql from "@/app/api/utils/sql";
import { rateLimitMiddleware } from "@/app/api/middleware/rateLimit";
import { authMiddleware } from "@/app/api/middleware/auth";
import { auditLog, AUDIT_ACTIONS, getIPFromRequest, getRequestIDFromRequest } from "@/app/api/utils/auditLogger";
import {
  calculateMonthlyManagementFee,
  calculatePerformanceFee,
} from "@/utils/feeCalculator";

/**
 * POST /api/fees/collect
 * Collect fees (management or performance)
 * 
 * Body:
 * {
 *   feeType: 'management' | 'performance',
 *   userAddress: string,
 *   amount?: number (required for performance fees - the profit amount),
 *   investmentId?: number (optional for performance fees),
 *   period?: string (YYYY-MM format, defaults to current month for management)
 * }
 */
export async function POST(request) {
  // Authentication required
  const authError = await authMiddleware(request);
  if (authError) return authError;

  // Rate limiting
  const rateLimitError = await rateLimitMiddleware(request, 'transaction');
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const {
      feeType,
      userAddress,
      amount,
      investmentId,
      period = getCurrentPeriod(),
    } = body;

    // Validate inputs
    if (!feeType || !['management', 'performance'].includes(feeType)) {
      return Response.json(
        {
          success: false,
          error: "Invalid feeType. Must be 'management' or 'performance'",
        },
        { status: 400 }
      );
    }

    if (!userAddress) {
      return Response.json(
        {
          success: false,
          error: "userAddress is required",
        },
        { status: 400 }
      );
    }

    // Get user's config and tier
    const config = await sql`
      SELECT 
        user_tier,
        management_fee_percent,
        performance_fee_percent,
        total_aum
      FROM agent_config 
      ORDER BY id DESC 
      LIMIT 1
    `;

    if (!config || config.length === 0) {
      return Response.json(
        {
          success: false,
          error: "User configuration not found",
        },
        { status: 404 }
      );
    }

    const userConfig = config[0];
    const tier = userConfig.user_tier || 'community';
    const aum = parseFloat(userConfig.total_aum || 0);

    let feeRecord;

    if (feeType === 'management') {
      // Management fee collection
      
      // Check if already collected for this period
      const existing = await sql`
        SELECT id FROM management_fees
        WHERE user_address = ${userAddress}
        AND collection_period = ${period}
        AND status = 'collected'
      `;

      if (existing && existing.length > 0) {
        return Response.json(
          {
            success: false,
            error: `Management fee already collected for period ${period}`,
          },
          { status: 409 }
        );
      }

      const feeAmount = calculateMonthlyManagementFee(aum, tier);

      // Insert management fee record
      const mgmtFee = await sql`
        INSERT INTO management_fees (
          user_address,
          collection_period,
          aum_snapshot,
          management_fee_percent,
          fee_amount,
          user_tier,
          status,
          collected_at
        ) VALUES (
          ${userAddress},
          ${period},
          ${aum},
          ${userConfig.management_fee_percent},
          ${feeAmount},
          ${tier},
          'collected',
          NOW()
        )
        RETURNING *
      `;

      feeRecord = mgmtFee[0];

      // Add to history
      await sql`
        INSERT INTO fee_collection_history (
          user_address,
          fee_type,
          fee_amount,
          base_amount,
          fee_percent,
          user_tier,
          status,
          reference_id
        ) VALUES (
          ${userAddress},
          'management',
          ${feeAmount},
          ${aum},
          ${userConfig.management_fee_percent},
          ${tier},
          'collected',
          ${feeRecord.id}
        )
      `;

      // Update last collection timestamp
      await sql`
        UPDATE agent_config
        SET last_management_fee_collected_at = NOW()
        WHERE id = (SELECT id FROM agent_config ORDER BY id DESC LIMIT 1)
      `;

    } else if (feeType === 'performance') {
      // Performance fee collection
      
      if (!amount || amount <= 0) {
        return Response.json(
          {
            success: false,
            error: "Amount (profit) is required for performance fee collection",
          },
          { status: 400 }
        );
      }

      const feeAmount = calculatePerformanceFee(amount, tier);

      // Insert performance fee record
      const perfFee = await sql`
        INSERT INTO performance_fees (
          user_address,
          investment_id,
          profit_amount,
          performance_fee_percent,
          fee_amount,
          user_tier,
          status,
          realized_at
        ) VALUES (
          ${userAddress},
          ${investmentId || null},
          ${amount},
          ${userConfig.performance_fee_percent},
          ${feeAmount},
          ${tier},
          'collected',
          NOW()
        )
        RETURNING *
      `;

      feeRecord = perfFee[0];

      // Add to history
      await sql`
        INSERT INTO fee_collection_history (
          user_address,
          fee_type,
          fee_amount,
          base_amount,
          fee_percent,
          user_tier,
          status,
          reference_id
        ) VALUES (
          ${userAddress},
          'performance',
          ${feeAmount},
          ${amount},
          ${userConfig.performance_fee_percent},
          ${tier},
          'collected',
          ${feeRecord.id}
        )
      `;
    }

    // Audit log
    await auditLog({
      user_id: request.user?.id || userAddress,
      action: AUDIT_ACTIONS.FEE_COLLECTED || 'FEE_COLLECTED',
      resource_type: 'fee',
      resource_id: feeRecord.id.toString(),
      metadata: {
        feeType,
        amount: feeRecord.fee_amount,
        tier,
        period: feeType === 'management' ? period : undefined,
        investmentId: feeType === 'performance' ? investmentId : undefined,
      },
      ip_address: getIPFromRequest(request),
      request_id: getRequestIDFromRequest(request),
      success: true,
    });

    return Response.json({
      success: true,
      feeRecord,
      message: `${feeType} fee collected successfully`,
    });

  } catch (error) {
    console.error("Error collecting fee:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to collect fee",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fees/collect
 * Get fee collection history
 */
export async function GET(request) {
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  try {
    const url = new URL(request.url);
    const userAddress = url.searchParams.get('userAddress');
    const feeType = url.searchParams.get('feeType'); // management | performance
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query;
    
    if (userAddress && feeType) {
      query = sql`
        SELECT * FROM fee_collection_history
        WHERE user_address = ${userAddress}
        AND fee_type = ${feeType}
        ORDER BY collected_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (userAddress) {
      query = sql`
        SELECT * FROM fee_collection_history
        WHERE user_address = ${userAddress}
        ORDER BY collected_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (feeType) {
      query = sql`
        SELECT * FROM fee_collection_history
        WHERE fee_type = ${feeType}
        ORDER BY collected_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = sql`
        SELECT * FROM fee_collection_history
        ORDER BY collected_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const history = await query;

    // Get total count
    const countQuery = userAddress
      ? sql`SELECT COUNT(*) as count FROM fee_collection_history WHERE user_address = ${userAddress}`
      : sql`SELECT COUNT(*) as count FROM fee_collection_history`;
    
    const countResult = await countQuery;
    const totalCount = parseInt(countResult[0].count);

    return Response.json({
      success: true,
      history,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });

  } catch (error) {
    console.error("Error fetching fee history:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch fee history",
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get current period (YYYY-MM format)
 */
function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

