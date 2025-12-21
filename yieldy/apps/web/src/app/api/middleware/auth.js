import { getToken } from '@auth/core/jwt';
import { log as logger } from '../utils/logger.js';

/**
 * Check if we're in a safe development environment
 * Multiple conditions must be true for demo mode to be allowed
 */
function isDemoModeAllowed() {
  // Must explicitly enable demo mode
  if (process.env.BYPASS_AUTH !== 'true' && process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
    return false;
  }

  // NEVER allow in production
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Demo mode attempted in production - BLOCKED');
    return false;
  }

  // NEVER allow if real RPC URLs are configured (indicates production-like env)
  if (process.env.ETHEREUM_RPC_URL?.includes('mainnet') ||
      process.env.BASE_RPC_URL?.includes('mainnet')) {
    logger.warn('Demo mode blocked - mainnet RPC detected');
    return false;
  }

  // NEVER allow if real database is configured
  if (process.env.DATABASE_URL?.includes('neon.tech') &&
      !process.env.DATABASE_URL?.includes('staging')) {
    logger.warn('Demo mode blocked - production database detected');
    return false;
  }

  return true;
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user context to request
 * @param {Request} request - Incoming request
 * @returns {Response|null} - Error response if unauthorized, null if authorized
 */
export async function authMiddleware(request) {
  // Demo mode bypass - ONLY in development with strict checks
  if (isDemoModeAllowed()) {
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
      secureCookie: process.env.AUTH_URL?.startsWith('https') || false,
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

