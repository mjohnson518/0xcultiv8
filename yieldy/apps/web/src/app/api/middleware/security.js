/**
 * Security Middleware
 * Provides CSRF protection, security headers, and request validation
 *
 * @module security
 */

import crypto from 'crypto';
import { log as logger } from '../utils/logger.js';

// In-memory token store (would use Redis in production for multi-instance)
const csrfTokens = new Map();
const TOKEN_EXPIRY_MS = 3600000; // 1 hour

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now > data.expiresAt) {
      csrfTokens.delete(token);
    }
  }
}, 60000); // Clean every minute

/**
 * Generate a CSRF token for a session
 * @param {string} sessionId - Session or user identifier
 * @returns {string} - CSRF token
 */
export function generateCSRFToken(sessionId) {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(token, {
    sessionId,
    expiresAt: Date.now() + TOKEN_EXPIRY_MS,
    createdAt: Date.now(),
  });
  return token;
}

/**
 * Validate a CSRF token
 * @param {string} token - Token to validate
 * @param {string} sessionId - Expected session ID
 * @returns {boolean} - True if valid
 */
export function validateCSRFToken(token, sessionId) {
  if (!token || !sessionId) return false;

  const data = csrfTokens.get(token);
  if (!data) return false;

  if (Date.now() > data.expiresAt) {
    csrfTokens.delete(token);
    return false;
  }

  if (data.sessionId !== sessionId) return false;

  // Token is valid - optionally delete for one-time use
  // csrfTokens.delete(token);

  return true;
}

/**
 * CSRF Protection Middleware
 * Validates CSRF tokens on state-changing requests
 *
 * @param {Request} request - Incoming request
 * @param {object} options - Configuration options
 * @returns {Response|null} - Error response if invalid, null if valid
 */
export async function csrfMiddleware(request, options = {}) {
  const {
    skipMethods = ['GET', 'HEAD', 'OPTIONS'],
    tokenHeader = 'x-csrf-token',
    tokenCookie = 'csrf-token',
    allowApiKey = true, // Allow API key auth to bypass CSRF
  } = options;

  // Skip for safe methods
  if (skipMethods.includes(request.method)) {
    return null;
  }

  // Skip if request has API key authentication (machine-to-machine)
  if (allowApiKey && request.headers.get('x-api-key')) {
    const apiKey = request.headers.get('x-api-key');
    if (apiKey === process.env.ADMIN_API_KEY && process.env.ADMIN_API_KEY) {
      logger.debug('CSRF check skipped - API key authentication');
      return null;
    }
  }

  // Skip for non-browser clients (check for fetch/axios)
  const contentType = request.headers.get('content-type') || '';
  const isAPIRequest = contentType.includes('application/json');
  const hasOrigin = request.headers.get('origin');

  // For API requests, validate origin instead of CSRF token
  if (isAPIRequest && hasOrigin) {
    const originValidation = validateOrigin(request);
    if (originValidation) {
      return originValidation;
    }
    return null;
  }

  // Get session identifier
  const sessionId = request.user?.id ||
    request.headers.get('x-session-id') ||
    getCookieValue(request, 'session-id');

  if (!sessionId) {
    // No session - can't validate CSRF, but allow if it's a login request
    const url = new URL(request.url);
    if (url.pathname.includes('/auth/')) {
      return null;
    }
  }

  // Get CSRF token from header or body
  let token = request.headers.get(tokenHeader);

  if (!token && request.body) {
    try {
      const body = await request.clone().json();
      token = body._csrf || body.csrfToken;
    } catch {
      // Body is not JSON, continue
    }
  }

  // Validate token
  if (!validateCSRFToken(token, sessionId)) {
    logger.warn('CSRF validation failed', {
      hasToken: !!token,
      hasSession: !!sessionId,
      path: new URL(request.url).pathname,
    });

    return new Response(
      JSON.stringify({
        error: 'CSRF validation failed',
        message: 'Invalid or missing CSRF token. Please refresh the page and try again.',
        code: 'CSRF_INVALID',
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
 * Validate request origin against allowed origins
 * @param {Request} request - Incoming request
 * @returns {Response|null} - Error if invalid origin
 */
export function validateOrigin(request) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (!origin && !referer) {
    // No origin header - could be same-origin or non-browser
    return null;
  }

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  // Add default allowed origins
  if (process.env.AUTH_URL) {
    allowedOrigins.push(new URL(process.env.AUTH_URL).origin);
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    allowedOrigins.push(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
  }

  // In development, allow localhost
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:4000', 'http://localhost:3000', 'http://127.0.0.1:4000');
  }

  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
    logger.warn('Origin validation failed', {
      origin: requestOrigin,
      allowed: allowedOrigins,
    });

    return new Response(
      JSON.stringify({
        error: 'Origin not allowed',
        message: 'Request origin is not in the allowed list',
        code: 'ORIGIN_NOT_ALLOWED',
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
 * Security Headers Middleware
 * Adds security headers to all responses
 *
 * @param {Response} response - Outgoing response
 * @param {object} options - Configuration options
 * @returns {Response} - Response with security headers
 */
export function addSecurityHeaders(response, options = {}) {
  const headers = new Headers(response.headers);

  // Prevent clickjacking
  headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter (legacy but still useful)
  headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (formerly Feature-Policy)
  headers.set('Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');

  // HSTS - only in production with HTTPS
  if (process.env.NODE_ENV === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for React
    "style-src 'self' 'unsafe-inline'", // Needed for styled-jsx and Tailwind
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://eth-mainnet.g.alchemy.com https://base-mainnet.g.alchemy.com https://*.upstash.io wss://*",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ];

  // In development, allow more sources
  if (process.env.NODE_ENV !== 'production') {
    cspDirectives.push("connect-src 'self' http://localhost:* ws://localhost:*");
  }

  headers.set('Content-Security-Policy', cspDirectives.join('; '));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Create a wrapper that adds security headers to response
 * @param {Function} handler - Route handler
 * @returns {Function} - Wrapped handler with security headers
 */
export function withSecurityHeaders(handler) {
  return async (request, ...args) => {
    const response = await handler(request, ...args);
    return addSecurityHeaders(response);
  };
}

/**
 * Request sanitization middleware
 * Validates and sanitizes incoming requests
 *
 * @param {Request} request - Incoming request
 * @returns {Response|null} - Error response if invalid
 */
export async function sanitizeRequest(request) {
  // Check for oversized requests
  const contentLength = parseInt(request.headers.get('content-length') || '0');
  const maxSize = parseInt(process.env.MAX_REQUEST_SIZE || '10485760'); // 10MB default

  if (contentLength > maxSize) {
    return new Response(
      JSON.stringify({
        error: 'Request too large',
        message: `Request body exceeds maximum size of ${maxSize} bytes`,
        code: 'REQUEST_TOO_LARGE',
      }),
      {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Check for suspicious headers
  const suspiciousHeaders = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];
  for (const header of suspiciousHeaders) {
    if (request.headers.get(header)) {
      logger.warn('Suspicious header detected', { header });
    }
  }

  return null;
}

/**
 * Get cookie value from request
 * @param {Request} request - Incoming request
 * @param {string} name - Cookie name
 * @returns {string|null} - Cookie value
 */
function getCookieValue(request, name) {
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

/**
 * Combined security middleware
 * Runs all security checks in sequence
 *
 * @param {Request} request - Incoming request
 * @param {object} options - Configuration options
 * @returns {Response|null} - Error response if any check fails
 */
export async function securityMiddleware(request, options = {}) {
  const {
    enableCSRF = true,
    enableOriginCheck = true,
    enableSanitization = true,
  } = options;

  // Request sanitization
  if (enableSanitization) {
    const sanitizeError = await sanitizeRequest(request);
    if (sanitizeError) return sanitizeError;
  }

  // Origin validation for API requests
  if (enableOriginCheck) {
    const originError = validateOrigin(request);
    if (originError) return originError;
  }

  // CSRF protection
  if (enableCSRF) {
    const csrfError = await csrfMiddleware(request, options);
    if (csrfError) return csrfError;
  }

  return null;
}

export default {
  csrfMiddleware,
  securityMiddleware,
  addSecurityHeaders,
  withSecurityHeaders,
  generateCSRFToken,
  validateCSRFToken,
  validateOrigin,
  sanitizeRequest,
};
