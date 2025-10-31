import sql from "@/app/api/utils/sql";
import { rateLimitMiddleware } from "@/app/api/middleware/rateLimit";
import {
  calculateMonthlyManagementFee,
  calculateAnnualManagementFee,
  calculatePerformanceFee,
  projectAnnualFees,
  FEE_TIERS,
} from "@/utils/feeCalculator";

/**
 * GET /api/fees/calculate
 * Calculate fees for current user configuration
 * 
 * Query params:
 * - type: 'management' | 'performance' | 'projection' (default: 'projection')
 * - amount: number (required for performance, uses AUM from DB for management)
 * - estimatedReturn: number (optional, default 10.0 for projections)
 */
export async function GET(request) {
  // Rate limiting
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  try {
    const url = new URL(request.url);
    const calculationType = url.searchParams.get('type') || 'projection';
    const amount = parseFloat(url.searchParams.get('amount') || '0');
    const estimatedReturn = parseFloat(url.searchParams.get('estimatedReturn') || '10.0');

    // Get user's current config and tier
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
          error: "No configuration found",
        },
        { status: 404 }
      );
    }

    const userConfig = config[0];
    const tier = userConfig.user_tier || 'community';
    const aum = parseFloat(userConfig.total_aum || 0);

    let result = {};

    switch (calculationType) {
      case 'management':
        // Calculate management fees
        const monthlyFee = calculateMonthlyManagementFee(aum, tier);
        const annualFee = calculateAnnualManagementFee(aum, tier);
        
        result = {
          type: 'management',
          tier,
          aum,
          monthlyFee,
          annualFee,
          feePercent: FEE_TIERS[tier].managementFeePercent,
          nextCollectionDate: getNextMonthFirstDay(),
        };
        break;

      case 'performance':
        // Calculate performance fee on given profit amount
        if (!amount || amount <= 0) {
          return Response.json(
            {
              success: false,
              error: "Amount parameter required for performance fee calculation",
            },
            { status: 400 }
          );
        }

        const performanceFee = calculatePerformanceFee(amount, tier);
        
        result = {
          type: 'performance',
          tier,
          profitAmount: amount,
          performanceFee,
          feePercent: FEE_TIERS[tier].performanceFeePercent,
          netProfit: amount - performanceFee,
        };
        break;

      case 'projection':
      default:
        // Full projection with both fee types
        const projection = projectAnnualFees(aum, tier, estimatedReturn);
        
        result = {
          type: 'projection',
          ...projection,
          tierDetails: FEE_TIERS[tier],
        };
        break;
    }

    return Response.json({
      success: true,
      calculation: result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Error calculating fees:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to calculate fees",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get first day of next month
 */
function getNextMonthFirstDay() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString().split('T')[0];
}

