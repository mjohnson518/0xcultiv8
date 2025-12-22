/**
 * Credit Packs Endpoint
 * GET /api/credits/packs - List available credit packs
 * POST /api/credits/packs - Purchase a credit pack
 *
 * @module creditPacks
 */

import sql from '../../utils/sql.js';
import { authMiddleware, optionalAuth } from '../../middleware/auth.js';
import { log } from '../../utils/logger.js';

// =============================================================================
// GET /api/credits/packs - List Available Packs
// =============================================================================

export async function GET(request) {
  try {
    // Get all active credit packs
    const packs = await sql`
      SELECT
        id,
        name,
        credit_type,
        agent_run_credits,
        agent_scan_credits,
        price_usd,
        discount_percent
      FROM credit_packs
      WHERE is_active = true
      ORDER BY price_usd ASC
    `;

    // Calculate per-credit cost for comparison
    const packsWithValue = packs.map(pack => {
      const runValue = pack.agent_run_credits * 1.00;  // $1.00 per run
      const scanValue = pack.agent_scan_credits * 0.15;  // $0.15 per scan
      const totalValue = runValue + scanValue;
      const savings = totalValue - parseFloat(pack.price_usd);

      return {
        id: pack.id,
        name: pack.name,
        creditType: pack.credit_type,
        credits: {
          agentRun: pack.agent_run_credits,
          agentScan: pack.agent_scan_credits,
        },
        price: parseFloat(pack.price_usd),
        discountPercent: parseFloat(pack.discount_percent),
        value: {
          fullPrice: Math.round(totalValue * 100) / 100,
          savings: Math.round(savings * 100) / 100,
        },
      };
    });

    return Response.json({
      success: true,
      packs: packsWithValue,
      pricing: {
        agentRunPerCredit: 1.00,
        agentScanPerCredit: 0.15,
      },
    });
  } catch (error) {
    log.error('Failed to fetch credit packs', { error: error.message });

    return Response.json({
      success: false,
      error: 'Failed to fetch credit packs',
    }, { status: 500 });
  }
}

// =============================================================================
// POST /api/credits/packs - Purchase a Pack
// =============================================================================

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
    const body = await request.json();
    const { packId, paymentHash } = body;

    if (!packId) {
      return Response.json({
        success: false,
        error: 'Pack ID is required',
      }, { status: 400 });
    }

    // Verify pack exists and is active
    const packResult = await sql`
      SELECT * FROM credit_packs WHERE id = ${packId} AND is_active = true
    `;

    if (!packResult || packResult.length === 0) {
      return Response.json({
        success: false,
        error: 'Credit pack not found or inactive',
      }, { status: 404 });
    }

    const pack = packResult[0];

    // Check for payment verification if paymentHash provided
    // In production, verify the payment through x402 or other payment system
    if (paymentHash) {
      // TODO: Verify payment hash with x402 facilitator
      log.info('Credit pack purchase with payment', {
        userAddress,
        packId,
        paymentHash,
        amount: pack.price_usd,
      });
    }

    // Use database function to purchase pack
    const purchaseResult = await sql`
      SELECT * FROM purchase_credit_pack(
        ${userAddress.toLowerCase()},
        ${packId},
        ${paymentHash || null}
      )
    `;

    if (!purchaseResult || !purchaseResult[0]?.success) {
      return Response.json({
        success: false,
        error: 'Failed to process credit pack purchase',
      }, { status: 500 });
    }

    const result = purchaseResult[0];

    log.info('Credit pack purchased', {
      userAddress,
      packId,
      packName: pack.name,
      runCreditsAdded: result.run_credits_added,
      scanCreditsAdded: result.scan_credits_added,
      amountPaid: pack.price_usd,
    });

    return Response.json({
      success: true,
      message: `Successfully purchased ${pack.name}`,
      purchase: {
        packName: pack.name,
        creditsAdded: {
          agentRun: result.run_credits_added,
          agentScan: result.scan_credits_added,
        },
        amountPaid: parseFloat(pack.price_usd),
      },
      balance: {
        agentRunCredits: result.total_run_credits === -1 ? 'unlimited' : result.total_run_credits,
        agentScanCredits: result.total_scan_credits === -1 ? 'unlimited' : result.total_scan_credits,
      },
    });
  } catch (error) {
    log.error('Failed to purchase credit pack', { error: error.message, userAddress });

    return Response.json({
      success: false,
      error: 'Failed to purchase credit pack',
      message: error.message,
    }, { status: 500 });
  }
}
