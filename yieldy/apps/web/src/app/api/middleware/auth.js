import { getToken } from '@auth/core/jwt';
import crypto from 'crypto';
import { log as logger } from '../utils/logger.js';

// Track if AUTH_SECRET has been validated
let authSecretValidated = false;

/**
 * Validate AUTH_SECRET on first use
 * Ensures the secret is strong enough for production
 */
function validateAuthSecret() {
  if (authSecretValidated) return true;

  const authSecret = process.env.AUTH_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!authSecret) {
    const msg = 'AUTH_SECRET environment variable is not set';
    if (isProduction) {
      logger.error(msg);
      throw new Error(msg);
    }
    logger.warn(msg);
    return false;
  }

  // In production, enforce minimum secret length (32 bytes = 256 bits)
  if (isProduction && authSecret.length < 32) {
    const msg = 'AUTH_SECRET must be at least 32 characters in production for security';
    logger.error(msg);
    throw new Error(msg);
  }

  // Warn about weak secrets in development
  if (!isProduction && authSecret.length < 32) {
    logger.warn('AUTH_SECRET is less than 32 characters - use a stronger secret in production');
  }

  authSecretValidated = true;
  return true;
}

// Known production hostnames - demo mode will NEVER be allowed on these
const PRODUCTION_HOSTNAMES = [
  '0xcultiv8.xyz',
  'cultiv8.finance',
  'cultiv8.com',
  'api.0xcultiv8.xyz',
  'app.0xcultiv8.xyz',
];

// Demo mode cache to avoid repeated checks
let demoModeResult = null;
let demoModeCheckTime = 0;
const DEMO_MODE_CACHE_MS = 5000; // Re-check every 5 seconds

/**
 * Check if we're in a safe development environment
 * Multiple conditions must be true for demo mode to be allowed
 * SECURITY: Demo mode is completely blocked in production with no exceptions
 *
 * This function implements defense-in-depth:
 * 1. Runtime environment check (NODE_ENV)
 * 2. Explicit opt-in required (BYPASS_AUTH or NEXT_PUBLIC_DEMO_MODE)
 * 3. Production indicators blocked (RPC URLs, database URLs, domains)
 * 4. Real funds indicators blocked (mainnet references)
 */
function isDemoModeAllowed(request = null) {
  // Use cached result if recent (performance optimization)
  if (demoModeResult !== null && Date.now() - demoModeCheckTime < DEMO_MODE_CACHE_MS) {
    return demoModeResult;
  }

  // ==========================================================================
  // LAYER 1: Runtime environment check - absolute first gate
  // ==========================================================================
  if (process.env.NODE_ENV === 'production') {
    // Log security violation if demo mode vars are set in production
    if (process.env.BYPASS_AUTH === 'true' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      logger.error('SECURITY VIOLATION: Demo mode environment variables detected in production - BLOCKING', {
        bypassAuth: process.env.BYPASS_AUTH,
        demoMode: process.env.NEXT_PUBLIC_DEMO_MODE,
      });
    }
    demoModeResult = false;
    demoModeCheckTime = Date.now();
    return false;
  }

  // ==========================================================================
  // LAYER 2: Require explicit opt-in
  // ==========================================================================
  if (process.env.BYPASS_AUTH !== 'true' && process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
    demoModeResult = false;
    demoModeCheckTime = Date.now();
    return false;
  }

  // ==========================================================================
  // LAYER 3: Block if any production indicators detected
  // ==========================================================================

  // Check for production hostnames in request (if available)
  if (request) {
    try {
      const host = request.headers?.get?.('host') || '';
      if (PRODUCTION_HOSTNAMES.some(h => host.includes(h))) {
        logger.error('Demo mode blocked - production hostname detected in request', { host });
        demoModeResult = false;
        demoModeCheckTime = Date.now();
        return false;
      }
    } catch {
      // Ignore request parsing errors
    }
  }

  // Check production RPC URLs (indicates real mainnet access)
  const ethereumRpc = process.env.ETHEREUM_RPC_URL || '';
  const baseRpc = process.env.BASE_RPC_URL || '';

  if (ethereumRpc.includes('mainnet') || baseRpc.includes('mainnet') ||
      ethereumRpc.includes('alchemy.com/v2') || ethereumRpc.includes('infura.io/v3')) {
    logger.warn('Demo mode blocked - production RPC detected');
    demoModeResult = false;
    demoModeCheckTime = Date.now();
    return false;
  }

  // Check for production database (neon.tech without staging/dev qualifier)
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes('neon.tech') &&
      !dbUrl.includes('staging') && !dbUrl.includes('dev') && !dbUrl.includes('test')) {
    logger.warn('Demo mode blocked - production database detected');
    demoModeResult = false;
    demoModeCheckTime = Date.now();
    return false;
  }

  // Check for production domains in configuration
  const authUrl = process.env.AUTH_URL || '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  for (const prodHost of PRODUCTION_HOSTNAMES) {
    if (authUrl.includes(prodHost) || appUrl.includes(prodHost)) {
      logger.warn('Demo mode blocked - production domain detected', { authUrl, appUrl });
      demoModeResult = false;
      demoModeCheckTime = Date.now();
      return false;
    }
  }

  // Check for Railway or other production platform indicators
  if (process.env.RAILWAY_ENVIRONMENT === 'production' ||
      process.env.VERCEL_ENV === 'production' ||
      process.env.FLY_APP_NAME) {
    logger.warn('Demo mode blocked - production platform detected');
    demoModeResult = false;
    demoModeCheckTime = Date.now();
    return false;
  }

  // ==========================================================================
  // All checks passed - demo mode is allowed
  // ==========================================================================
  logger.debug('Demo mode allowed in development environment');
  demoModeResult = true;
  demoModeCheckTime = Date.now();
  return true;
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user context to request
 * @param {Request} request - Incoming request
 * @returns {Response|null} - Error response if unauthorized, null if authorized
 */
export async function authMiddleware(request) {
  // Validate AUTH_SECRET on first use (throws in production if invalid)
  try {
    validateAuthSecret();
  } catch (error) {
    logger.error('Auth secret validation failed', { error: error.message });
    return new Response(
      JSON.stringify({
        error: 'Configuration error',
        message: 'Authentication is not properly configured',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Demo mode bypass - ONLY in development with strict multi-layer checks
  if (isDemoModeAllowed(request)) {
    logger.debug('Demo mode active - auth bypassed (development only)');
    request.user = {
      id: 'demo-user',
      address: '0xDemo0000000000000000000000000000000001',
      isDemo: true,
    };
    return null;
  }

  // Production auth logic...
  try {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.AUTH_URL?.startsWith('https') || process.env.NODE_ENV === 'production',
    });

    if (!token) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required. Please sign in.',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer realm="API"',
          },
        }
      );
    }

    // Attach user context to request
    request.user = {
      id: token.sub,
      email: token.email,
      name: token.name,
      address: token.address || token.sub, // Wallet address if available
      image: token.picture,
      sessionExpiry: token.exp,
    };

    return null; // Success - proceed to next middleware/handler
  } catch (error) {
    logger.error('Auth middleware error', { error: error.message });
    return new Response(
      JSON.stringify({
        error: 'Authentication error',
        message: 'Failed to verify authentication token',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Admin authorization middleware
 * Requires authentication AND admin role
 * @param {Request} request - Incoming request
 * @returns {Response|null} - Error if not admin, null if authorized
 */
export async function requireAdmin(request) {
  // First verify authentication
  const authError = await authMiddleware(request);
  if (authError) return authError;

  // Check admin status
  const isAdmin = await checkAdminStatus(request.user);

  if (!isAdmin) {
    return new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Admin access required for this operation',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return null;
}

/**
 * Check if user has admin privileges
 * Uses multiple sources: environment variable and database
 * @param {object} user - User object from token
 * @returns {Promise<boolean>} - True if user is admin
 */
async function checkAdminStatus(user) {
  if (!user?.address) {
    return false;
  }

  const userAddress = user.address.toLowerCase();

  // Option 1: Check environment variable (primary, fast)
  const adminAddresses = (process.env.ADMIN_ADDRESSES || '')
    .split(',')
    .map(a => a.trim().toLowerCase())
    .filter(Boolean);

  if (adminAddresses.includes(userAddress)) {
    logger.debug('Admin access granted via env config', { address: userAddress });
    return true;
  }

  // Option 2: Check database for admin role (secondary, allows dynamic updates)
  try {
    // Lazy import to avoid circular dependencies
    const sql = (await import('../utils/sql.js')).default;

    const result = await sql`
      SELECT is_admin FROM users
      WHERE LOWER(address) = ${userAddress}
      LIMIT 1
    `;

    if (result[0]?.is_admin === true) {
      logger.debug('Admin access granted via database', { address: userAddress });
      return true;
    }
  } catch (error) {
    // Database check failed, fall back to env-only check
    logger.warn('Admin database check failed', { error: error.message });
  }

  return false;
}

/**
 * Optional authentication middleware
 * Attaches user context if authenticated, but doesn't require it
 * @param {Request} request
 * @returns {Promise<null>} - Always returns null (no error response)
 */
export async function optionalAuth(request) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.AUTH_URL?.startsWith('https') || false,
    });

    if (token) {
      request.user = {
        id: token.sub,
        email: token.email,
        name: token.name,
        address: token.address || token.sub,
        image: token.picture,
      };
    }
  } catch (error) {
    // Silently fail for optional auth
    console.debug('Optional auth failed:', error.message);
  }

  return null; // Always proceed, even if no token
}

/**
 * Check if user owns the resource they're trying to access
 * @param {string} userId - User ID from token
 * @param {string} resourceUserId - User ID who owns the resource
 * @returns {boolean} - True if user owns resource
 */
export function checkOwnership(userId, resourceUserId) {
  return userId === resourceUserId;
}

/**
 * Middleware to check resource ownership
 * @param {Function} getResourceUserId - Function that extracts resource owner ID from request
 * @returns {Function} Middleware function
 */
export function requireOwnership(getResourceUserId) {
  return async (request) => {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    const resourceUserId = await getResourceUserId(request);

    if (!checkOwnership(request.user.id, resourceUserId)) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to access this resource',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return null;
  };
}

/**
 * Extract wallet address from request (used for wallet-based auth)
 * @param {Request} request
 * @returns {string|null} Wallet address if present
 */
export function getWalletFromRequest(request) {
  // Try to get from user context (set by authMiddleware)
  if (request.user?.address) {
    return request.user.address;
  }

  // Try to get from request body
  try {
    const url = new URL(request.url);
    return url.searchParams.get('wallet') || url.searchParams.get('address');
  } catch {
    return null;
  }
}

