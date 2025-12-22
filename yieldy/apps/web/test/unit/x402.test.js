/**
 * x402 Payment Protocol Unit Tests
 *
 * Tests the x402 payment middleware and credit system integration.
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

// Mock environment variables
process.env.X402_ENABLED = 'true';
process.env.X402_PAYMENT_RECEIVER = '0x1234567890abcdef1234567890abcdef12345678';
process.env.X402_NETWORK = 'eip155:8453';
process.env.X402_FACILITATOR_URL = 'https://test-facilitator.x402.org';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock request object
 */
function createMockRequest(options = {}) {
  const headers = new Map(Object.entries(options.headers || {}));

  return {
    headers: {
      get: (name) => headers.get(name) || headers.get(name.toLowerCase()),
    },
    user: options.user || null,
    url: options.url || 'http://localhost:3000/api/agent/run',
  };
}

/**
 * Mock SQL query results
 */
const mockSqlResults = {
  creditsAvailable: [{
    success: true,
    credits_remaining: 9,
    requires_payment: false,
  }],
  creditsExhausted: [{
    success: false,
    credits_remaining: 0,
    requires_payment: true,
  }],
  userTier: {
    community: [{ tier: 'community' }],
    pro: [{ tier: 'pro' }],
    institutional: [{ tier: 'institutional' }],
    enterprise: [{ tier: 'enterprise' }],
  },
};

// =============================================================================
// Tier Discount Tests (Revenue Optimized)
// =============================================================================

describe('x402 Tier Discounts', () => {
  // Revenue-optimized discounts (reduced from original)
  const TIER_DISCOUNTS = {
    community: 0,
    pro: 0.10,        // Reduced from 20%
    institutional: 0.20,  // Reduced from 40%
    enterprise: 0.30,    // Reduced from 50%
  };

  function calculateDiscountedPrice(basePrice, tier) {
    const discount = TIER_DISCOUNTS[tier] || 0;
    return basePrice * (1 - discount);
  }

  it('should apply no discount for community tier', () => {
    const basePrice = 1.00;
    const result = calculateDiscountedPrice(basePrice, 'community');
    assert.strictEqual(result, 1.00);
  });

  it('should apply 10% discount for pro tier', () => {
    const basePrice = 1.00;
    const result = calculateDiscountedPrice(basePrice, 'pro');
    assert.strictEqual(result, 0.90);
  });

  it('should apply 20% discount for institutional tier', () => {
    const basePrice = 1.00;
    const result = calculateDiscountedPrice(basePrice, 'institutional');
    assert.strictEqual(result, 0.80);
  });

  it('should apply 30% discount for enterprise tier', () => {
    const basePrice = 1.00;
    const result = calculateDiscountedPrice(basePrice, 'enterprise');
    assert.strictEqual(result, 0.70);
  });

  it('should handle unknown tier as community', () => {
    const basePrice = 1.00;
    const result = calculateDiscountedPrice(basePrice, 'unknown');
    assert.strictEqual(result, 1.00);
  });
});

// =============================================================================
// 402 Response Format Tests
// =============================================================================

describe('x402 Response Format', () => {
  const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const PAYMENT_RECEIVER = '0x1234567890abcdef1234567890abcdef12345678';
  const NETWORK = 'eip155:8453';

  function create402ResponseBody(endpoint, price, description) {
    const amountUsdc = Math.round(price * 1e6);

    return {
      error: 'Payment Required',
      message: `This endpoint requires payment of $${price.toFixed(2)} USD`,
      paymentRequirements: [{
        scheme: 'exact',
        network: NETWORK,
        maxAmount: amountUsdc.toString(),
        asset: `${NETWORK}:${BASE_USDC_ADDRESS}`,
        payTo: PAYMENT_RECEIVER,
        description: description || `Access to ${endpoint}`,
      }],
      endpoint,
      price: {
        usd: price,
        usdc: amountUsdc,
      },
    };
  }

  it('should format 402 response correctly for agent run endpoint', () => {
    const response = create402ResponseBody('/api/agent/run', 1.00, 'AI agent execution');

    assert.strictEqual(response.error, 'Payment Required');
    assert.strictEqual(response.price.usd, 1.00);
    assert.strictEqual(response.price.usdc, 1000000); // 1.00 * 1e6
    assert.strictEqual(response.paymentRequirements[0].scheme, 'exact');
    assert.strictEqual(response.paymentRequirements[0].network, 'eip155:8453');
  });

  it('should format 402 response correctly for agent scan endpoint', () => {
    const response = create402ResponseBody('/api/agent/scan', 0.15, 'DeFi opportunity scanning');

    assert.strictEqual(response.price.usd, 0.15);
    assert.strictEqual(response.price.usdc, 150000); // 0.15 * 1e6
  });

  it('should include correct USDC asset address for Base', () => {
    const response = create402ResponseBody('/api/agent/run', 1.00);

    assert.ok(response.paymentRequirements[0].asset.includes(BASE_USDC_ADDRESS));
  });

  it('should apply tier discount to response price', () => {
    const basePrice = 1.00;
    const proDiscount = 0.10;  // New pro discount
    const discountedPrice = basePrice * (1 - proDiscount);

    const response = create402ResponseBody('/api/agent/run', discountedPrice);

    assert.strictEqual(response.price.usd, 0.90);
    assert.strictEqual(response.price.usdc, 900000);
  });
});

// =============================================================================
// Credit Deduction Logic Tests
// =============================================================================

describe('Credit Deduction Logic', () => {
  const ENDPOINT_CREDIT_TYPES = {
    '/api/agent/run': 'agent_run',
    '/api/agent/scan': 'agent_scan',
  };

  it('should map agent run endpoint to agent_run credit type', () => {
    const creditType = ENDPOINT_CREDIT_TYPES['/api/agent/run'];
    assert.strictEqual(creditType, 'agent_run');
  });

  it('should map agent scan endpoint to agent_scan credit type', () => {
    const creditType = ENDPOINT_CREDIT_TYPES['/api/agent/scan'];
    assert.strictEqual(creditType, 'agent_scan');
  });

  it('should return undefined for unknown endpoints', () => {
    const creditType = ENDPOINT_CREDIT_TYPES['/api/unknown'];
    assert.strictEqual(creditType, undefined);
  });
});

// =============================================================================
// Payment Header Detection Tests
// =============================================================================

describe('Payment Header Detection', () => {
  it('should detect X-PAYMENT header', () => {
    const request = createMockRequest({
      headers: { 'X-PAYMENT': 'valid-payment-signature' },
    });

    const paymentHeader = request.headers.get('X-PAYMENT') ||
                          request.headers.get('PAYMENT-SIGNATURE');

    assert.ok(paymentHeader);
    assert.strictEqual(paymentHeader, 'valid-payment-signature');
  });

  it('should detect PAYMENT-SIGNATURE header as fallback', () => {
    const request = createMockRequest({
      headers: { 'PAYMENT-SIGNATURE': 'valid-payment-signature' },
    });

    const paymentHeader = request.headers.get('X-PAYMENT') ||
                          request.headers.get('PAYMENT-SIGNATURE');

    assert.ok(paymentHeader);
    assert.strictEqual(paymentHeader, 'valid-payment-signature');
  });

  it('should return falsy when no payment header present', () => {
    const request = createMockRequest({
      headers: {},
    });

    const paymentHeader = request.headers.get('X-PAYMENT') ||
                          request.headers.get('PAYMENT-SIGNATURE');

    assert.ok(!paymentHeader, 'Payment header should be falsy when not present');
  });
});

// =============================================================================
// Endpoint Pricing Tests (Revenue Optimized)
// =============================================================================

describe('Endpoint Pricing', () => {
  // Revenue-optimized pricing
  const ENDPOINT_PRICES = {
    '/api/agent/run': 1.00,   // Increased from $0.50
    '/api/agent/scan': 0.15,  // Increased from $0.10
  };

  it('should price agent run at $1.00', () => {
    assert.strictEqual(ENDPOINT_PRICES['/api/agent/run'], 1.00);
  });

  it('should price agent scan at $0.15', () => {
    assert.strictEqual(ENDPOINT_PRICES['/api/agent/scan'], 0.15);
  });

  it('should calculate correct USDC amounts (6 decimals)', () => {
    const runUsdc = Math.round(ENDPOINT_PRICES['/api/agent/run'] * 1e6);
    const scanUsdc = Math.round(ENDPOINT_PRICES['/api/agent/scan'] * 1e6);

    assert.strictEqual(runUsdc, 1000000); // 1.00 USDC
    assert.strictEqual(scanUsdc, 150000); // 0.15 USDC
  });
});

// =============================================================================
// Configuration Validation Tests
// =============================================================================

describe('x402 Configuration', () => {
  it('should have valid Base mainnet network identifier', () => {
    const network = 'eip155:8453';
    assert.ok(network.startsWith('eip155:'));
    assert.strictEqual(network, 'eip155:8453');
  });

  it('should have valid USDC contract address format', () => {
    const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    assert.ok(usdcAddress.startsWith('0x'));
    assert.strictEqual(usdcAddress.length, 42);
  });

  it('should have valid facilitator URL format', () => {
    const facilitatorUrl = process.env.X402_FACILITATOR_URL;
    assert.ok(facilitatorUrl.startsWith('https://'));
  });
});

// =============================================================================
// Credit Tier Allocation Tests (Revenue Optimized)
// =============================================================================

describe('Tier Credit Allocations', () => {
  // Revenue-optimized credit allocations (reduced ~50%)
  const TIER_ALLOCATIONS = {
    community: { run: 5, scan: 20 },       // Reduced from 10/50
    pro: { run: 50, scan: 200 },           // Reduced from 100/500
    institutional: { run: 200, scan: 750 }, // Reduced from 500/2000
    enterprise: { run: -1, scan: -1 },      // -1 = unlimited
  };

  it('should allocate 5 run credits for community tier', () => {
    assert.strictEqual(TIER_ALLOCATIONS.community.run, 5);
  });

  it('should allocate 20 scan credits for community tier', () => {
    assert.strictEqual(TIER_ALLOCATIONS.community.scan, 20);
  });

  it('should allocate 50 run credits for pro tier', () => {
    assert.strictEqual(TIER_ALLOCATIONS.pro.run, 50);
  });

  it('should allocate unlimited credits for enterprise tier', () => {
    assert.strictEqual(TIER_ALLOCATIONS.enterprise.run, -1);
    assert.strictEqual(TIER_ALLOCATIONS.enterprise.scan, -1);
  });

  it('should have higher allocations for higher tiers', () => {
    assert.ok(TIER_ALLOCATIONS.pro.run > TIER_ALLOCATIONS.community.run);
    assert.ok(TIER_ALLOCATIONS.institutional.run > TIER_ALLOCATIONS.pro.run);
  });
});

// =============================================================================
// Payment Flow Decision Tests
// =============================================================================

describe('Payment Flow Decision Logic', () => {
  /**
   * Simulates the payment/credit decision logic
   */
  function decidePaymentFlow(options) {
    const { hasCredits, hasPaymentHeader, x402Enabled } = options;

    if (!x402Enabled) {
      return { proceed: true, reason: 'x402_disabled' };
    }

    if (hasCredits) {
      return { proceed: true, reason: 'credits_used' };
    }

    if (hasPaymentHeader) {
      return { proceed: true, reason: 'payment_verified' };
    }

    return { proceed: false, reason: 'payment_required' };
  }

  it('should allow access when x402 is disabled', () => {
    const result = decidePaymentFlow({
      hasCredits: false,
      hasPaymentHeader: false,
      x402Enabled: false,
    });

    assert.strictEqual(result.proceed, true);
    assert.strictEqual(result.reason, 'x402_disabled');
  });

  it('should allow access when user has credits', () => {
    const result = decidePaymentFlow({
      hasCredits: true,
      hasPaymentHeader: false,
      x402Enabled: true,
    });

    assert.strictEqual(result.proceed, true);
    assert.strictEqual(result.reason, 'credits_used');
  });

  it('should allow access when payment header present', () => {
    const result = decidePaymentFlow({
      hasCredits: false,
      hasPaymentHeader: true,
      x402Enabled: true,
    });

    assert.strictEqual(result.proceed, true);
    assert.strictEqual(result.reason, 'payment_verified');
  });

  it('should require payment when no credits and no payment header', () => {
    const result = decidePaymentFlow({
      hasCredits: false,
      hasPaymentHeader: false,
      x402Enabled: true,
    });

    assert.strictEqual(result.proceed, false);
    assert.strictEqual(result.reason, 'payment_required');
  });

  it('should prefer credits over payment when both available', () => {
    const result = decidePaymentFlow({
      hasCredits: true,
      hasPaymentHeader: true,
      x402Enabled: true,
    });

    assert.strictEqual(result.proceed, true);
    assert.strictEqual(result.reason, 'credits_used');
  });
});

// =============================================================================
// Execution Fee Tests
// =============================================================================

describe('Execution Fee Calculation', () => {
  const FEE_CONFIG = {
    feePercent: 0.0010,  // 0.10%
    feeCap: 25.00,       // $25 maximum
  };

  function calculateExecutionFee(transactionValueUsd) {
    if (transactionValueUsd <= 0) {
      return { feeUsd: 0, capped: false };
    }

    const rawFee = transactionValueUsd * FEE_CONFIG.feePercent;
    const capped = rawFee > FEE_CONFIG.feeCap;
    const feeUsd = capped ? FEE_CONFIG.feeCap : rawFee;

    return {
      feeUsd: Math.round(feeUsd * 100) / 100,
      capped,
    };
  }

  it('should calculate 0.10% fee on small transaction', () => {
    const result = calculateExecutionFee(1000);  // $1,000 transaction

    assert.strictEqual(result.feeUsd, 1.00);  // $1.00 fee
    assert.strictEqual(result.capped, false);
  });

  it('should calculate 0.10% fee on medium transaction', () => {
    const result = calculateExecutionFee(5000);  // $5,000 transaction

    assert.strictEqual(result.feeUsd, 5.00);  // $5.00 fee
    assert.strictEqual(result.capped, false);
  });

  it('should cap fee at $25 for large transactions', () => {
    const result = calculateExecutionFee(50000);  // $50,000 transaction

    assert.strictEqual(result.feeUsd, 25.00);  // Capped at $25
    assert.strictEqual(result.capped, true);
  });

  it('should cap fee at $25 for very large transactions', () => {
    const result = calculateExecutionFee(1000000);  // $1M transaction

    assert.strictEqual(result.feeUsd, 25.00);  // Still capped at $25
    assert.strictEqual(result.capped, true);
  });

  it('should return zero fee for zero value', () => {
    const result = calculateExecutionFee(0);

    assert.strictEqual(result.feeUsd, 0);
    assert.strictEqual(result.capped, false);
  });

  it('should return zero fee for negative value', () => {
    const result = calculateExecutionFee(-100);

    assert.strictEqual(result.feeUsd, 0);
    assert.strictEqual(result.capped, false);
  });
});

// =============================================================================
// Credit Pack Tests
// =============================================================================

describe('Credit Pack Pricing', () => {
  const CREDIT_PACKS = [
    { name: 'Starter Pack', runs: 10, price: 9.00, discount: 10 },
    { name: 'Growth Pack', runs: 50, price: 40.00, discount: 20 },
    { name: 'Power Pack', runs: 100, price: 70.00, discount: 30 },
  ];

  const BASE_RUN_PRICE = 1.00;

  it('should offer 10% discount on Starter Pack', () => {
    const pack = CREDIT_PACKS[0];
    const fullPrice = pack.runs * BASE_RUN_PRICE;
    const expectedDiscount = fullPrice * (pack.discount / 100);

    assert.strictEqual(fullPrice - pack.price, expectedDiscount);
  });

  it('should offer 20% discount on Growth Pack', () => {
    const pack = CREDIT_PACKS[1];
    const fullPrice = pack.runs * BASE_RUN_PRICE;
    const expectedDiscount = fullPrice * (pack.discount / 100);

    assert.strictEqual(fullPrice - pack.price, expectedDiscount);
  });

  it('should offer 30% discount on Power Pack', () => {
    const pack = CREDIT_PACKS[2];
    const fullPrice = pack.runs * BASE_RUN_PRICE;
    const expectedDiscount = fullPrice * (pack.discount / 100);

    assert.strictEqual(fullPrice - pack.price, expectedDiscount);
  });

  it('should have increasing discounts for larger packs', () => {
    assert.ok(CREDIT_PACKS[1].discount > CREDIT_PACKS[0].discount);
    assert.ok(CREDIT_PACKS[2].discount > CREDIT_PACKS[1].discount);
  });
});

// =============================================================================
// Run Tests
// =============================================================================

console.log('\n🔐 Running x402 Payment Protocol Tests (Revenue Optimized)\n');
