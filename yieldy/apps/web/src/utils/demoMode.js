/**
 * Demo Mode Utilities
 * Centralized logic for demo mode detection and security guards
 *
 * SECURITY: Demo mode should NEVER be active in production.
 * This module enforces strict environment checks.
 */

/**
 * Check if demo mode is safely enabled
 * Returns false if any production indicators are detected
 * @returns {boolean}
 */
export function isDemoModeEnabled() {
  // Must explicitly enable demo mode
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
    return false;
  }

  // NEVER allow in production - check multiple indicators
  if (isProductionEnvironment()) {
    console.warn('[Security] Demo mode blocked - production environment detected');
    return false;
  }

  return true;
}

/**
 * Check if we're in a production environment
 * Uses multiple signals to detect production
 * @returns {boolean}
 */
export function isProductionEnvironment() {
  // Check NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    return true;
  }

  // Check for production URLs
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Production domains
    if (hostname === '0xcultiv8.xyz' ||
        hostname === 'cultiv8.xyz' ||
        hostname.endsWith('.railway.app') ||
        hostname.endsWith('.pages.dev')) {
      return true;
    }
  }

  // Check for production RPC URLs (server-side)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.ETHEREUM_RPC_URL?.includes('mainnet') ||
        process.env.BASE_RPC_URL?.includes('mainnet')) {
      return true;
    }

    // Check for production database
    if (process.env.DATABASE_URL?.includes('neon.tech') &&
        !process.env.DATABASE_URL?.includes('staging') &&
        !process.env.DATABASE_URL?.includes('dev')) {
      return true;
    }
  }

  return false;
}

/**
 * Get demo mode status with metadata
 * Useful for debugging and display
 * @returns {object}
 */
export function getDemoModeStatus() {
  const enabled = isDemoModeEnabled();
  const production = isProductionEnvironment();

  return {
    enabled,
    blocked: process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && !enabled,
    reason: production ? 'production_environment' : enabled ? 'demo_active' : 'not_configured',
    environment: process.env.NODE_ENV || 'unknown',
  };
}

/**
 * Demo mode guard - throws if demo mode operations are attempted in production
 * @param {string} operation - Name of the operation being attempted
 * @throws {Error} If operation is blocked in current environment
 */
export function guardDemoOperation(operation) {
  if (isProductionEnvironment()) {
    const error = new Error(`[Security] Demo operation "${operation}" blocked in production`);
    console.error(error.message);
    throw error;
  }
}

/**
 * Safe demo wallet address
 * Returns a safe demo address or null if demo mode is disabled
 * @returns {string|null}
 */
export function getDemoWalletAddress() {
  if (!isDemoModeEnabled()) {
    return null;
  }
  return '0xDemo0000000000000000000000000000000001';
}
