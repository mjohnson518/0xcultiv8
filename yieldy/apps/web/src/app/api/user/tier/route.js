import sql from "@/app/api/utils/sql";
import { rateLimitMiddleware } from "@/app/api/middleware/rateLimit";
import { authMiddleware } from "@/app/api/middleware/auth";
import { auditLog, AUDIT_ACTIONS, getIPFromRequest, getRequestIDFromRequest } from "@/app/api/utils/auditLogger";
import {
  determineTier,
  checkTierUpgradeEligibility,
  FEE_TIERS,
} from "@/utils/feeCalculator";

/**
 * GET /api/user/tier
 * Get current user tier and eligibility info
 */
export async function GET(request) {
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  try {
    // Get current config
    const config = await sql`
      SELECT 
        user_tier,
        management_fee_percent,
        performance_fee_percent,
        total_aum,
        tier_upgraded_at
      FROM agent_config 
      ORDER BY id DESC 
      LIMIT 1
    `;

    if (!config || config.length === 0) {
      return Response.json(
        {
          success: false,
          error: "Configuration not found",
        },
        { status: 404 }
      );
    }

    const userConfig = config[0];
    const currentTier = userConfig.user_tier || 'community';
    const currentAUM = parseFloat(userConfig.total_aum || 0);

    // Check tier upgrade eligibility
    const upgradeInfo = checkTierUpgradeEligibility(currentAUM, currentTier);

    // Get tier details
    const tierDetails = FEE_TIERS[currentTier];

    // Get upgrade history
    const history = await sql`
      SELECT * FROM tier_upgrade_history
      ORDER BY upgraded_at DESC
      LIMIT 10
    `;

    return Response.json({
      success: true,
      currentTier: {
        tier: currentTier,
        ...tierDetails,
        currentAUM,
        upgradedAt: userConfig.tier_upgraded_at,
      },
      upgradeEligibility: upgradeInfo,
      allTiers: FEE_TIERS,
      upgradeHistory: history,
    });

  } catch (error) {
    console.error("Error fetching tier info:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch tier information",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/tier
 * Upgrade user tier (auto or manual)
 * 
 * Body:
 * {
 *   userAddress: string,
 *   newAUM?: number (optional - triggers auto-upgrade check),
 *   forceTier?: string (admin only - force specific tier)
 * }
 */
export async function POST(request) {
  // Authentication required
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const rateLimitError = await rateLimitMiddleware(request, 'config');
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const { userAddress, newAUM, forceTier } = body;

    if (!userAddress) {
      return Response.json(
        {
          success: false,
          error: "userAddress is required",
        },
        { status: 400 }
      );
    }

    // Get current config
    const config = await sql`
      SELECT 
        id,
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
          error: "Configuration not found",
        },
        { status: 404 }
      );
    }

    const userConfig = config[0];
    const currentTier = userConfig.user_tier || 'community';
    let currentAUM = parseFloat(userConfig.total_aum || 0);

    // Update AUM if provided
    if (newAUM !== undefined && newAUM !== null) {
      currentAUM = parseFloat(newAUM);
      await sql`
        UPDATE agent_config
        SET total_aum = ${currentAUM}
        WHERE id = ${userConfig.id}
      `;
    }

    let newTier;
    let triggerReason;

    if (forceTier) {
      // Admin override
      if (!FEE_TIERS[forceTier]) {
        return Response.json(
          {
            success: false,
            error: `Invalid tier: ${forceTier}`,
          },
          { status: 400 }
        );
      }
      newTier = forceTier;
      triggerReason = 'admin_override';

    } else {
      // Auto-determine tier based on AUM
      newTier = determineTier(currentAUM);
      triggerReason = 'aum_threshold';
    }

    // Check if upgrade is needed
    if (newTier === currentTier) {
      return Response.json({
        success: true,
        message: "User already at appropriate tier",
        currentTier,
        aum: currentAUM,
      });
    }

    // Validate upgrade direction (never downgrade automatically)
    const tierOrder = ['community', 'pro', 'institutional', 'enterprise'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const newIndex = tierOrder.indexOf(newTier);

    if (newIndex < currentIndex && triggerReason !== 'admin_override') {
      return Response.json({
        success: false,
        error: "Automatic tier downgrades are not allowed. Current tier is preserved.",
        currentTier,
      });
    }

    // Get new tier fee structure
    const newTierConfig = FEE_TIERS[newTier];

    // Update agent config with new tier
    await sql`
      UPDATE agent_config
      SET 
        user_tier = ${newTier},
        management_fee_percent = ${newTierConfig.managementFeePercent},
        performance_fee_percent = ${newTierConfig.performanceFeePercent},
        tier_upgraded_at = NOW()
      WHERE id = ${userConfig.id}
    `;

    // Record upgrade in history
    await sql`
      INSERT INTO tier_upgrade_history (
        user_address,
        previous_tier,
        new_tier,
        trigger_reason,
        aum_at_upgrade,
        notes
      ) VALUES (
        ${userAddress},
        ${currentTier},
        ${newTier},
        ${triggerReason},
        ${currentAUM},
        ${`Upgraded from ${currentTier} to ${newTier} due to ${triggerReason}`}
      )
    `;

    // Audit log
    await auditLog({
      user_id: request.user?.id || userAddress,
      action: AUDIT_ACTIONS.TIER_UPGRADED || 'TIER_UPGRADED',
      resource_type: 'tier',
      resource_id: userConfig.id.toString(),
      metadata: {
        previousTier: currentTier,
        newTier,
        triggerReason,
        aum: currentAUM,
      },
      ip_address: getIPFromRequest(request),
      request_id: getRequestIDFromRequest(request),
      success: true,
    });

    return Response.json({
      success: true,
      message: `Tier upgraded from ${currentTier} to ${newTier}`,
      previousTier: currentTier,
      newTier,
      newFeeStructure: {
        managementFeePercent: newTierConfig.managementFeePercent,
        performanceFeePercent: newTierConfig.performanceFeePercent,
      },
      aum: currentAUM,
      upgradedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Error upgrading tier:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to upgrade tier",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/tier
 * Update AUM and check for auto-upgrade
 * 
 * Body:
 * {
 *   userAddress: string,
 *   aum: number
 * }
 */
export async function PUT(request) {
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const { userAddress, aum } = body;

    if (!userAddress || aum === undefined) {
      return Response.json(
        {
          success: false,
          error: "userAddress and aum are required",
        },
        { status: 400 }
      );
    }

    // Get current config
    const config = await sql`
      SELECT 
        id,
        user_tier,
        total_aum
      FROM agent_config 
      ORDER BY id DESC 
      LIMIT 1
    `;

    if (!config || config.length === 0) {
      return Response.json(
        {
          success: false,
          error: "Configuration not found",
        },
        { status: 404 }
      );
    }

    const userConfig = config[0];
    const currentTier = userConfig.user_tier || 'community';
    const newAUM = parseFloat(aum);

    // Update AUM
    await sql`
      UPDATE agent_config
      SET total_aum = ${newAUM}
      WHERE id = ${userConfig.id}
    `;

    // Check if tier upgrade is needed
    const appropriateTier = determineTier(newAUM);
    const upgradeInfo = checkTierUpgradeEligibility(newAUM, currentTier);

    return Response.json({
      success: true,
      message: "AUM updated successfully",
      currentTier,
      aum: newAUM,
      appropriateTier,
      upgradeAvailable: upgradeInfo.eligible,
      upgradeInfo,
    });

  } catch (error) {
    console.error("Error updating AUM:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to update AUM",
      },
      { status: 500 }
    );
  }
}

