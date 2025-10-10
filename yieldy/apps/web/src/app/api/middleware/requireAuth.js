import { authMiddleware, requireAdmin, optionalAuth } from './auth';

/**
 * Higher-order function to wrap route handlers with authentication
 * Usage: export const POST = requireAuth(async (request) => { ... });
 * 
 * @param {Function} handler - Route handler function
 * @returns {Function} Wrapped handler with authentication
 */
export function requireAuth(handler) {
  return async (request) => {
    const authError = await authMiddleware(request);
    if (authError) return authError;

    // Proceed to handler with authenticated request
    return handler(request);
  };
}

/**
 * Wrapper requiring admin privileges
 * Usage: export const POST = requireAdminAuth(async (request) => { ... });
 * 
 * @param {Function} handler - Route handler function
 * @returns {Function} Wrapped handler with admin authentication
 */
export function requireAdminAuth(handler) {
  return async (request) => {
    const adminError = await requireAdmin(request);
    if (adminError) return adminError;

    return handler(request);
  };
}

/**
 * Wrapper with optional authentication (non-blocking)
 * User context added if authenticated, but route proceeds regardless
 * Usage: export const GET = withOptionalAuth(async (request) => { ... });
 * 
 * @param {Function} handler - Route handler function
 * @returns {Function} Wrapped handler with optional authentication
 */
export function withOptionalAuth(handler) {
  return async (request) => {
    await optionalAuth(request);
    return handler(request);
  };
}

