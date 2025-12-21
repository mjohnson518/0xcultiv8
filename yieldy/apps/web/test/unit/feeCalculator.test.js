/**
 * Fee Calculator Unit Tests
 *
 * Tests for the Cultiv8 fee calculation system including:
 * - Management fee calculation by tier
 * - Performance fee calculation
 * - Fee validation
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMonthlyManagementFee,
  calculatePerformanceFee,
  FEE_TIERS,
} from '../../src/utils/feeCalculator';

describe('Fee Tiers', () => {
  it('should have correct management fees for all tiers', () => {
    expect(FEE_TIERS.community.managementFee).toBe(0.01); // 1%
    expect(FEE_TIERS.pro.managementFee).toBe(0.008); // 0.8%
    expect(FEE_TIERS.institutional.managementFee).toBe(0.005); // 0.5%
    expect(FEE_TIERS.enterprise.managementFee).toBe(0.0025); // 0.25%
  });

  it('should have correct performance fees for all tiers', () => {
    expect(FEE_TIERS.community.performanceFee).toBe(0.18); // 18%
    expect(FEE_TIERS.pro.performanceFee).toBe(0.15); // 15%
    expect(FEE_TIERS.institutional.performanceFee).toBe(0.12); // 12%
    expect(FEE_TIERS.enterprise.performanceFee).toBe(0.08); // 8%
  });
});

describe('Management Fee Calculation', () => {
  it('should calculate correct monthly fee for community tier', () => {
    const aum = 100000; // $100,000
    const fee = calculateMonthlyManagementFee(aum, 'community');

    // 1% annual = 0.0833% monthly
    const expectedFee = aum * (0.01 / 12);
    expect(fee).toBeCloseTo(expectedFee, 2);
  });

  it('should calculate correct monthly fee for pro tier', () => {
    const aum = 500000; // $500,000
    const fee = calculateMonthlyManagementFee(aum, 'pro');

    // 0.8% annual = 0.0667% monthly
    const expectedFee = aum * (0.008 / 12);
    expect(fee).toBeCloseTo(expectedFee, 2);
  });

  it('should calculate correct monthly fee for institutional tier', () => {
    const aum = 5000000; // $5,000,000
    const fee = calculateMonthlyManagementFee(aum, 'institutional');

    // 0.5% annual = 0.0417% monthly
    const expectedFee = aum * (0.005 / 12);
    expect(fee).toBeCloseTo(expectedFee, 2);
  });

  it('should calculate correct monthly fee for enterprise tier', () => {
    const aum = 50000000; // $50,000,000
    const fee = calculateMonthlyManagementFee(aum, 'enterprise');

    // 0.25% annual = 0.0208% monthly
    const expectedFee = aum * (0.0025 / 12);
    expect(fee).toBeCloseTo(expectedFee, 2);
  });

  it('should return 0 for 0 AUM', () => {
    const fee = calculateMonthlyManagementFee(0, 'community');
    expect(fee).toBe(0);
  });

  it('should default to community tier for unknown tier', () => {
    const aum = 100000;
    const fee = calculateMonthlyManagementFee(aum, 'unknown');
    const expectedFee = aum * (0.01 / 12);
    expect(fee).toBeCloseTo(expectedFee, 2);
  });
});

describe('Performance Fee Calculation', () => {
  it('should calculate correct fee for community tier', () => {
    const profit = 10000; // $10,000 profit
    const fee = calculatePerformanceFee(profit, 'community');

    // 18% of profit
    expect(fee).toBe(profit * 0.18);
  });

  it('should calculate correct fee for pro tier', () => {
    const profit = 50000;
    const fee = calculatePerformanceFee(profit, 'pro');

    // 15% of profit
    expect(fee).toBe(profit * 0.15);
  });

  it('should calculate correct fee for institutional tier', () => {
    const profit = 500000;
    const fee = calculatePerformanceFee(profit, 'institutional');

    // 12% of profit
    expect(fee).toBe(profit * 0.12);
  });

  it('should calculate correct fee for enterprise tier', () => {
    const profit = 5000000;
    const fee = calculatePerformanceFee(profit, 'enterprise');

    // 8% of profit
    expect(fee).toBe(profit * 0.08);
  });

  it('should return 0 for 0 profit', () => {
    const fee = calculatePerformanceFee(0, 'community');
    expect(fee).toBe(0);
  });

  it('should return 0 for negative profit', () => {
    const fee = calculatePerformanceFee(-1000, 'community');
    expect(fee).toBe(0);
  });
});

describe('Fee Comparison Across Tiers', () => {
  it('should show community tier pays highest fees', () => {
    const aum = 1000000;
    const profit = 100000;

    const communityMgmt = calculateMonthlyManagementFee(aum, 'community');
    const proMgmt = calculateMonthlyManagementFee(aum, 'pro');

    const communityPerf = calculatePerformanceFee(profit, 'community');
    const proPerf = calculatePerformanceFee(profit, 'pro');

    expect(communityMgmt).toBeGreaterThan(proMgmt);
    expect(communityPerf).toBeGreaterThan(proPerf);
  });

  it('should show enterprise tier pays lowest fees', () => {
    const aum = 1000000;
    const profit = 100000;

    const tiers = ['community', 'pro', 'institutional', 'enterprise'];
    const mgmtFees = tiers.map(tier => calculateMonthlyManagementFee(aum, tier));
    const perfFees = tiers.map(tier => calculatePerformanceFee(profit, tier));

    // Each tier should be lower than the previous
    for (let i = 1; i < tiers.length; i++) {
      expect(mgmtFees[i]).toBeLessThan(mgmtFees[i - 1]);
      expect(perfFees[i]).toBeLessThan(perfFees[i - 1]);
    }
  });
});
