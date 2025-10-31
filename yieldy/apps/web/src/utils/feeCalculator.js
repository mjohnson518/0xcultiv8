/**
 * Fee Calculator for Cultiv8 Tiered Revenue Model
 * 
 * Calculates management and performance fees based on user tier
 * Ensures 15% net profit margins through tiered structure
 */

// ============================================================================
// Fee Tier Definitions
// ============================================================================
export const FEE_TIERS = {
  community: {
    name: 'Community',
    managementFeePercent: 1.0,    // 1.0% annual on AUM
    performanceFeePercent: 18.0,  // 18% on realized profits
    minimumAUM: 100,
    maxAUM: 9999,
    color: 'text-retro-green',
    icon: '◆',
  },
  pro: {
    name: 'Pro',
    managementFeePercent: 0.75,   // 0.75% annual on AUM
    performanceFeePercent: 22.0,  // 22% on realized profits
    minimumAUM: 10000,
    maxAUM: 249999,
    color: 'text-retro-blue',
    icon: '◈',
  },
  institutional: {
    name: 'Institutional',
    managementFeePercent: 0.5,    // 0.5% annual on AUM
    performanceFeePercent: 25.0,  // 25% on realized profits
    minimumAUM: 250000,
    maxAUM: 999999,
    color: 'text-retro-amber',
    icon: '◉',
  },
  enterprise: {
    name: 'Enterprise',
    managementFeePercent: 0.5,    // 0.5% annual on AUM
    performanceFeePercent: 30.0,  // 30% on realized profits
    minimumAUM: 1000000,
    maxAUM: Infinity,
    color: 'text-retro-red',
    icon: '◎',
  },
};

// ============================================================================
// Management Fee Calculations (Annual % of AUM, Collected Monthly)
// ============================================================================

/**
 * Calculate monthly management fee
 * @param {number} aum - Assets Under Management
 * @param {string} tier - User tier (community, pro, institutional, enterprise)
 * @returns {number} Monthly management fee amount
 */
export function calculateMonthlyManagementFee(aum, tier = 'community') {
  const tierConfig = FEE_TIERS[tier];
  if (!tierConfig) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  const annualFee = aum * (tierConfig.managementFeePercent / 100);
  const monthlyFee = annualFee / 12;
  
  return Number(monthlyFee.toFixed(2));
}

/**
 * Calculate annual management fee
 * @param {number} aum - Assets Under Management
 * @param {string} tier - User tier
 * @returns {number} Annual management fee amount
 */
export function calculateAnnualManagementFee(aum, tier = 'community') {
  const tierConfig = FEE_TIERS[tier];
  if (!tierConfig) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  const annualFee = aum * (tierConfig.managementFeePercent / 100);
  return Number(annualFee.toFixed(2));
}

// ============================================================================
// Performance Fee Calculations (% of Realized Profits)
// ============================================================================

/**
 * Calculate performance fee on realized profit
 * @param {number} profit - Realized profit amount
 * @param {string} tier - User tier
 * @returns {number} Performance fee amount
 */
export function calculatePerformanceFee(profit, tier = 'community') {
  if (profit <= 0) {
    return 0; // No fee on losses
  }

  const tierConfig = FEE_TIERS[tier];
  if (!tierConfig) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  const fee = profit * (tierConfig.performanceFeePercent / 100);
  return Number(fee.toFixed(2));
}

// ============================================================================
// Tier Determination Logic
// ============================================================================

/**
 * Determine appropriate tier based on AUM
 * @param {number} aum - Assets Under Management
 * @returns {string} Appropriate tier
 */
export function determineTier(aum) {
  if (aum >= FEE_TIERS.enterprise.minimumAUM) return 'enterprise';
  if (aum >= FEE_TIERS.institutional.minimumAUM) return 'institutional';
  if (aum >= FEE_TIERS.pro.minimumAUM) return 'pro';
  return 'community';
}

/**
 * Check if user is eligible for tier upgrade
 * @param {number} currentAUM - Current Assets Under Management
 * @param {string} currentTier - Current user tier
 * @returns {object} { eligible: boolean, nextTier: string|null, requiredAUM: number|null }
 */
export function checkTierUpgradeEligibility(currentAUM, currentTier) {
  const tierOrder = ['community', 'pro', 'institutional', 'enterprise'];
  const currentIndex = tierOrder.indexOf(currentTier);
  
  if (currentIndex === -1 || currentIndex === tierOrder.length - 1) {
    return { eligible: false, nextTier: null, requiredAUM: null };
  }

  const nextTier = tierOrder[currentIndex + 1];
  const nextTierConfig = FEE_TIERS[nextTier];
  
  if (currentAUM >= nextTierConfig.minimumAUM) {
    return {
      eligible: true,
      nextTier: nextTier,
      requiredAUM: nextTierConfig.minimumAUM,
      currentAUM: currentAUM,
    };
  }

  return {
    eligible: false,
    nextTier: nextTier,
    requiredAUM: nextTierConfig.minimumAUM,
    currentAUM: currentAUM,
    shortfall: nextTierConfig.minimumAUM - currentAUM,
  };
}

// ============================================================================
// Fee Projection Utilities
// ============================================================================

/**
 * Project total fees for a year based on AUM and estimated returns
 * @param {number} aum - Assets Under Management
 * @param {string} tier - User tier
 * @param {number} estimatedAnnualReturn - Estimated annual return percentage (e.g., 8.5 for 8.5%)
 * @returns {object} Fee projections
 */
export function projectAnnualFees(aum, tier, estimatedAnnualReturn = 10.0) {
  const managementFee = calculateAnnualManagementFee(aum, tier);
  
  // Calculate projected profit and performance fee
  const projectedProfit = aum * (estimatedAnnualReturn / 100);
  const performanceFee = calculatePerformanceFee(projectedProfit, tier);
  
  const totalFees = managementFee + performanceFee;
  const netReturn = projectedProfit - performanceFee;
  
  return {
    aum,
    tier,
    estimatedReturn: estimatedAnnualReturn,
    projectedProfit: Number(projectedProfit.toFixed(2)),
    managementFee: Number(managementFee.toFixed(2)),
    performanceFee: Number(performanceFee.toFixed(2)),
    totalFees: Number(totalFees.toFixed(2)),
    netReturn: Number(netReturn.toFixed(2)),
    effectiveFeeRate: Number(((totalFees / aum) * 100).toFixed(2)),
  };
}

// ============================================================================
// Fee Formatting Utilities
// ============================================================================

/**
 * Format fee amount for display
 * @param {number} amount - Fee amount
 * @param {boolean} includeSign - Whether to include $ sign
 * @returns {string} Formatted amount
 */
export function formatFeeAmount(amount, includeSign = true) {
  const formatted = Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return includeSign ? `$${formatted}` : formatted;
}

/**
 * Format percentage for display
 * @param {number} percent - Percentage value
 * @returns {string} Formatted percentage
 */
export function formatPercent(percent) {
  return `${Number(percent).toFixed(2)}%`;
}

// ============================================================================
// Revenue Model Analysis
// ============================================================================

/**
 * Calculate platform revenue from multiple users
 * Used for business model validation
 * @param {Array} users - Array of user objects with { aum, tier, annualReturn }
 * @returns {object} Platform revenue summary
 */
export function calculatePlatformRevenue(users) {
  let totalAUM = 0;
  let totalManagementFees = 0;
  let totalPerformanceFees = 0;
  
  const tierBreakdown = {
    community: { count: 0, aum: 0, fees: 0 },
    pro: { count: 0, aum: 0, fees: 0 },
    institutional: { count: 0, aum: 0, fees: 0 },
    enterprise: { count: 0, aum: 0, fees: 0 },
  };

  users.forEach(user => {
    const { aum, tier, annualReturn = 10.0 } = user;
    const projection = projectAnnualFees(aum, tier, annualReturn);
    
    totalAUM += aum;
    totalManagementFees += projection.managementFee;
    totalPerformanceFees += projection.performanceFee;
    
    if (tierBreakdown[tier]) {
      tierBreakdown[tier].count++;
      tierBreakdown[tier].aum += aum;
      tierBreakdown[tier].fees += projection.totalFees;
    }
  });

  const totalRevenue = totalManagementFees + totalPerformanceFees;
  
  return {
    userCount: users.length,
    totalAUM: Number(totalAUM.toFixed(2)),
    totalManagementFees: Number(totalManagementFees.toFixed(2)),
    totalPerformanceFees: Number(totalPerformanceFees.toFixed(2)),
    totalRevenue: Number(totalRevenue.toFixed(2)),
    averageRevenuePerUser: Number((totalRevenue / users.length).toFixed(2)),
    tierBreakdown,
  };
}

// ============================================================================
// Export Everything
// ============================================================================

export default {
  FEE_TIERS,
  calculateMonthlyManagementFee,
  calculateAnnualManagementFee,
  calculatePerformanceFee,
  determineTier,
  checkTierUpgradeEligibility,
  projectAnnualFees,
  formatFeeAmount,
  formatPercent,
  calculatePlatformRevenue,
};

