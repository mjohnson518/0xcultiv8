/**
 * Credits Management Endpoint
 * GET /api/credits - Get user's remaining credits and tier info
 * POST /api/credits/reset - Admin: Reset user credits (or trigger monthly reset)
 *
 * @module credits
 */

import sql from '../utils/sql.js';
import { authMiddleware } from '../middleware/auth.js';
import { log } from '../utils/logger.js';

/**
 * GET /api/credits
 * Returns the authenticated user's credit balance and tier information
 */
export async function GET(request) {
  // Require authentication
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const userAddress = request.user?.address;

  if (!userAddress) {
    return Response.json({
      success: false,
      error: 'User address not found',
    }, { status: 400 });
  }

  try {
    // Get user credits
    const creditsResult = await sql`
      SELECT
        uc.user_address,
        uc.tier,
        uc.agent_run_credits,
        uc.agent_scan_credits,
        uc.credits_reset_at,
        uc.updated_at,
        tca.agent_run_credits as tier_run_allocation,
        tca.agent_scan_credits as tier_scan_allocation,
        tca.discount_percent,
        tca.reset_period_days
      FROM user_credits uc
      LEFT JOIN tier_credit_allocations tca ON uc.tier = tca.tier
      WHERE uc.user_address = ${userAddress.toLowerCase()}
    `;

    if (!creditsResult || creditsResult.length === 0) {
      // User has no credit record - return community tier defaults
      const defaultTier = await sql`
        SELECT * FROM tier_credit_allocations WHERE tier = 'community'
      `;

      return Response.json({
        success: true,
        credits: {
          tier: 'community',
          agent_run_credits: 0,
          agent_scan_credits: 0,
          tier_allocation: {
            agent_run: defaultTier[0]?.agent_run_credits || 10,
            agent_scan: defaultTier[0]?.agent_scan_credits || 50,
          },
          discount_percent: 0,
          needs_initialization: true,
        },
        message: 'No credit record found. Credits will be initialized on first use.',
      });
    }

    const credits = creditsResult[0];
    const isUnlimited = credits.agent_run_credits === -1;

    return Response.json({
      success: true,
      credits: {
        tier: credits.tier,
        agent_run_credits: isUnlimited ? 'unlimited' : credits.agent_run_credits,
        agent_scan_credits: isUnlimited ? 'unlimited' : credits.agent_scan_credits,
        tier_allocation: {
          agent_run: credits.tier_run_allocation === -1 ? 'unlimited' : credits.tier_run_allocation,
          agent_scan: credits.tier_scan_allocation === -1 ? 'unlimited' : credits.tier_scan_allocation,
        },
        discount_percent: parseFloat(credits.discount_percent) || 0,
        reset_period_days: credits.reset_period_days || 30,
        credits_reset_at: credits.credits_reset_at,
        last_updated: credits.updated_at,
      },
    });
  } catch (error) {
    log.error('Failed to fetch credits', { error: error.message, userAddress });

    return Response.json({
      success: false,
      error: 'Failed to fetch credits',
      message: error.message,
    }, { status: 500 });
  }
}

/**
 * POST /api/credits
 * Initialize or upgrade user credits
 * Body: { tier?: string } - Optional tier to set (admin only for upgrades)
 */
export async function POST(request) {
  // Require authentication
  const authError = await authMiddleware(request);
  if (authError) return authError;

  const userAddress = request.user?.address;

  if (!userAddress) {
    return Response.json({
      success: false,
      error: 'User address not found',
    }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const requestedTier = body.tier;

    // If tier upgrade requested, verify it's valid
    if (requestedTier) {
      const validTiers = ['community', 'pro', 'institutional', 'enterprise'];
      if (!validTiers.includes(requestedTier)) {
        return Response.json({
          success: false,
          error: 'Invalid tier',
          valid_tiers: validTiers,
        }, { status: 400 });
      }
    }

    // Initialize/reset credits using database function
    const result = await sql`
      SELECT * FROM reset_user_credits(${userAddress.toLowerCase()}, ${requestedTier || null})
    `;

    if (!result || result.length === 0) {
      return Response.json({
        success: false,
        error: 'Failed to initialize credits',
      }, { status: 500 });
    }

    const credits = result[0];

    log.info('User credits initialized/reset', {
      userAddress,
      tier: credits.tier,
      runCredits: credits.agent_run_credits,
      scanCredits: credits.agent_scan_credits,
    });

    return Response.json({
      success: true,
      message: 'Credits initialized successfully',
      credits: {
        tier: credits.tier,
        agent_run_credits: credits.agent_run_credits === -1 ? 'unlimited' : credits.agent_run_credits,
        agent_scan_credits: credits.agent_scan_credits === -1 ? 'unlimited' : credits.agent_scan_credits,
        credits_reset_at: credits.credits_reset_at,
      },
    });
  } catch (error) {
    log.error('Failed to initialize credits', { error: error.message, userAddress });

    return Response.json({
      success: false,
      error: 'Failed to initialize credits',
      message: error.message,
    }, { status: 500 });
  }
}
