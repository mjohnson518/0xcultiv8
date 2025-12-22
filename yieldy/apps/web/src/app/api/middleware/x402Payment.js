/**
 * x402 Payment Middleware for 0xCultiv8
 *
 * Integrates x402 payment protocol with the existing tier system:
 * - Authenticated users with credits get free access
 * - Users without credits or anonymous users pay per-request
 * - Tier-based discounts applied to payments
 *
 * @module x402Payment
 */

import { paymentMiddleware, x402ResourceServer } from '@x402/hono';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import sql from '../utils/sql.js';
import { log } from '../utils/logger.js';
import { optionalAuth } from './auth.js';

// =============================================================================
// Configuration
// =============================================================================

const X402_CONFIG = {
  facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
  paymentReceiver: process.env.X402_PAYMENT_RECEIVER,
  network: process.env.X402_NETWORK || 'eip155:8453', // Base mainnet
  enabled: process.env.X402_ENABLED !== 'false',
};

// USDC contract address on Base
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Tier discount percentages (optimized for revenue)
const TIER_DISCOUNTS = {
  community: 0,
  pro: 0.10,        // Reduced from 20%
  institutional: 0.20,  // Reduced from 40%
  enterprise: 0.30,    // Reduced from 50%
};

// Credit types per endpoint
const ENDPOINT_CREDIT_TYPES = {
  '/api/agent/run': 'agent_run',
  '/api/agent/scan': 'agent_scan',
};

// =============================================================================
// x402 Resource Server Setup
// =============================================================================

let resourceServer = null;

/**
 * Initialize the x402 resource server (lazy initialization)
 */
function getResourceServer() {
  if (resourceServer) return resourceServer;

  const facilitatorClient = new HTTPFacilitatorClient({
    url: X402_CONFIG.facilitatorUrl,
  });

  resourceServer = new x402ResourceServer(facilitatorClient)
    .register(X402_CONFIG.network, new ExactEvmScheme());

  return resourceServer;
}

// =============================================================================
// Credit Management
// =============================================================================

/**
 * Check if user has available credits and deduct if so
 * @param {string} userAddress - User's wallet address
 * @param {string} endpoint - API endpoint being accessed
 * @returns {Promise<{hasCredits: boolean, creditsRemaining: number}>}
 */
async function checkAndDeductCredits(userAddress, endpoint) {
  if (!userAddress) {
    return { hasCredits: false, creditsRemaining: 0 };
  }

  const creditType = ENDPOINT_CREDIT_TYPES[endpoint];
  if (!creditType) {
    return { hasCredits: false, creditsRemaining: 0 };
  }

  try {
    const result = await sql`
      SELECT * FROM deduct_user_credit(${userAddress.toLowerCase()}, ${creditType}, ${endpoint})
    `;

    if (result && result[0]) {
      return {
        hasCredits: result[0].success,
        creditsRemaining: result[0].credits_remaining,
        requiresPayment: result[0].requires_payment,
      };
    }
  } catch (error) {
    log.warn('Credit deduction failed, falling back to payment', { error: error.message, userAddress });
  }

  return { hasCredits: false, creditsRemaining: 0, requiresPayment: true };
}

/**
 * Get user's tier for discount calculation
 * @param {string} userAddress - User's wallet address
 * @returns {Promise<string>} - User's tier
 */
async function getUserTier(userAddress) {
  if (!userAddress) return 'community';

  try {
    const result = await sql`
      SELECT tier FROM user_credits WHERE user_address = ${userAddress.toLowerCase()}
    `;
    return result[0]?.tier || 'community';
  } catch {
    return 'community';
  }
}

/**
 * Calculate discounted price based on tier
 * @param {number} basePrice - Base price in USD
 * @param {string} tier - User's tier
 * @returns {number} - Discounted price
 */
function calculateDiscountedPrice(basePrice, tier) {
  const discount = TIER_DISCOUNTS[tier] || 0;
  return basePrice * (1 - discount);
}

// =============================================================================
// Payment Recording
// =============================================================================

/**
 * Record a successful x402 payment
 * @param {object} paymentData - Payment details
 */
async function recordPayment(paymentData) {
  try {
    await sql`
      INSERT INTO x402_payments (
        payment_hash,
        user_address,
        endpoint,
        amount_usd,
        amount_usdc,
        network,
        user_tier,
        status,
        verified_at,
        metadata
      ) VALUES (
        ${paymentData.paymentHash},
        ${paymentData.userAddress?.toLowerCase() || null},
        ${paymentData.endpoint},
        ${paymentData.amountUsd},
        ${paymentData.amountUsdc},
        ${paymentData.network},
        ${paymentData.tier},
        'verified',
        NOW(),
        ${JSON.stringify(paymentData.metadata || {})}
      )
    `;

    log.info('x402 payment recorded', {
      endpoint: paymentData.endpoint,
      amount: paymentData.amountUsd,
      tier: paymentData.tier,
    });
  } catch (error) {
    log.error('Failed to record x402 payment', { error: error.message });
    // Don't throw - payment was successful, just logging failed
  }
}

// =============================================================================
// Endpoint Pricing
// =============================================================================

/**
 * Get pricing for an endpoint from database
 * @param {string} endpoint - API endpoint
 * @returns {Promise<{basePrice: number, description: string} | null>}
 */
async function getEndpointPricing(endpoint) {
  try {
    const result = await sql`
      SELECT base_price_usd, description
      FROM x402_endpoint_pricing
      WHERE endpoint_pattern = ${endpoint} AND is_active = true
    `;
    return result[0] ? {
      basePrice: parseFloat(result[0].base_price_usd),
      description: result[0].description,
    } : null;
  } catch (error) {
    log.error('Failed to get endpoint pricing', { error: error.message, endpoint });
    return null;
  }
}

// =============================================================================
// 402 Response Generation
// =============================================================================

/**
 * Create a 402 Payment Required response
 * @param {string} endpoint - API endpoint
 * @param {number} price - Price in USD
 * @param {string} description - Description of the resource
 * @returns {Response}
 */
function create402Response(endpoint, price, description) {
  const amountUsdc = Math.round(price * 1e6); // USDC has 6 decimals

  return Response.json({
    error: 'Payment Required',
    message: `This endpoint requires payment of $${price.toFixed(2)} USD`,
    paymentRequirements: [{
      scheme: 'exact',
      network: X402_CONFIG.network,
      maxAmount: amountUsdc.toString(),
      asset: `${X402_CONFIG.network}:${BASE_USDC_ADDRESS}`,
      payTo: X402_CONFIG.paymentReceiver,
      description: description || `Access to ${endpoint}`,
    }],
    endpoint,
    price: {
      usd: price,
      usdc: amountUsdc,
    },
  }, {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Required': 'true',
    },
  });
}

// =============================================================================
// Main Middleware
// =============================================================================

/**
 * x402 Payment or Credits middleware
 *
 * Checks if user has credits, otherwise requires x402 payment.
 *
 * @param {Request} request - Incoming request
 * @param {object} options - Configuration
 * @param {string} options.endpoint - Endpoint path
 * @param {number} options.basePrice - Base price in USD
 * @param {string} [options.description] - Resource description
 * @returns {Promise<{proceed: boolean, response?: Response, paymentUsed: boolean, creditsUsed: boolean}>}
 */
export async function checkPaymentOrCredits(request, options) {
  const { endpoint, basePrice, description } = options;

  // Check if x402 is enabled
  if (!X402_CONFIG.enabled) {
    return { proceed: true, paymentUsed: false, creditsUsed: false };
  }

  // Check if payment receiver is configured
  if (!X402_CONFIG.paymentReceiver) {
    log.warn('x402 payment receiver not configured, allowing free access');
    return { proceed: true, paymentUsed: false, creditsUsed: false };
  }

  // Try to get authenticated user
  await optionalAuth(request);
  const userAddress = request.user?.address;

  // Check for available credits first
  if (userAddress) {
    const creditResult = await checkAndDeductCredits(userAddress, endpoint);

    if (creditResult.hasCredits) {
      log.debug('Access granted via credits', {
        endpoint,
        userAddress,
        creditsRemaining: creditResult.creditsRemaining,
      });
      return { proceed: true, paymentUsed: false, creditsUsed: true };
    }
  }

  // No credits - check for x402 payment header
  const paymentHeader = request.headers.get('X-PAYMENT') ||
                        request.headers.get('PAYMENT-SIGNATURE');

  if (!paymentHeader) {
    // No payment provided - return 402
    const tier = await getUserTier(userAddress);
    const finalPrice = calculateDiscountedPrice(basePrice, tier);

    log.debug('Payment required', { endpoint, basePrice, finalPrice, tier });

    return {
      proceed: false,
      response: create402Response(endpoint, finalPrice, description),
      paymentUsed: false,
      creditsUsed: false,
    };
  }

  // Payment header present - verify with x402 server
  try {
    const server = getResourceServer();
    const tier = await getUserTier(userAddress);
    const finalPrice = calculateDiscountedPrice(basePrice, tier);

    // Verify the payment
    const verifyResult = await server.verify({
      paymentHeader,
      expectedAmount: Math.round(finalPrice * 1e6).toString(),
      network: X402_CONFIG.network,
      payTo: X402_CONFIG.paymentReceiver,
    });

    if (verifyResult.valid) {
      // Record the payment
      await recordPayment({
        paymentHash: verifyResult.paymentHash || paymentHeader.slice(0, 64),
        userAddress,
        endpoint,
        amountUsd: finalPrice,
        amountUsdc: Math.round(finalPrice * 1e6),
        network: X402_CONFIG.network,
        tier,
        metadata: { verifyResult },
      });

      log.info('x402 payment verified', { endpoint, amount: finalPrice, tier });

      return { proceed: true, paymentUsed: true, creditsUsed: false };
    } else {
      log.warn('x402 payment verification failed', { endpoint, reason: verifyResult.reason });

      return {
        proceed: false,
        response: Response.json({
          error: 'Payment verification failed',
          reason: verifyResult.reason,
        }, { status: 402 }),
        paymentUsed: false,
        creditsUsed: false,
      };
    }
  } catch (error) {
    log.error('x402 payment verification error', { error: error.message, endpoint });

    return {
      proceed: false,
      response: Response.json({
        error: 'Payment processing error',
        message: error.message,
      }, { status: 500 }),
      paymentUsed: false,
      creditsUsed: false,
    };
  }
}

/**
 * Express-style middleware wrapper for route handlers
 *
 * @param {object} options - Configuration
 * @param {number} options.price - Price in USD
 * @param {string} [options.description] - Resource description
 * @returns {Function} - Middleware function
 */
export function requirePayment(options) {
  return async (request) => {
    const endpoint = new URL(request.url).pathname;

    const result = await checkPaymentOrCredits(request, {
      endpoint,
      basePrice: options.price,
      description: options.description,
    });

    if (!result.proceed) {
      return result.response;
    }

    // Attach payment info to request for downstream use
    request.x402 = {
      paid: result.paymentUsed,
      usedCredits: result.creditsUsed,
    };

    return null; // Proceed to handler
  };
}

// =============================================================================
// Hono Middleware Integration
// =============================================================================

/**
 * Create x402 Hono middleware for protected routes
 *
 * @param {object} routeConfig - Route pricing configuration
 * @returns {MiddlewareHandler}
 */
export function createX402Middleware(routeConfig) {
  if (!X402_CONFIG.enabled || !X402_CONFIG.paymentReceiver) {
    // Return pass-through middleware if x402 is disabled
    return async (c, next) => {
      await next();
    };
  }

  const server = getResourceServer();

  // Convert route config to x402 format
  const x402Routes = {};
  for (const [route, config] of Object.entries(routeConfig)) {
    x402Routes[route] = {
      accepts: {
        scheme: 'exact',
        price: `$${config.price.toFixed(2)}`,
        network: X402_CONFIG.network,
        payTo: X402_CONFIG.paymentReceiver,
      },
      description: config.description,
    };
  }

  return paymentMiddleware(x402Routes, server);
}

// =============================================================================
// Exports
// =============================================================================

export default {
  checkPaymentOrCredits,
  requirePayment,
  createX402Middleware,
  getEndpointPricing,
  getUserTier,
  X402_CONFIG,
};
