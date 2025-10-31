import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import Redis from 'ioredis';

// Initialize Redis client with fallback to memory store
let redis;
let useMemoryFallback = false;

// Skip Redis during Vercel build
if (process.env.VERCEL && !process.env.DATABASE_URL) {
  console.log('Skipping Redis during build phase');
  useMemoryFallback = true;
} else {
  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true, // Don't connect immediately
    });

    redis.on('error', (err) => {
      console.warn('Redis connection error, falling back to memory store:', err.message);
      useMemoryFallback = true;
    });
  } catch (error) {
    console.warn('Redis initialization failed, using memory store:', error.message);
    useMemoryFallback = true;
  }
}

// Create different limiters for different endpoint types
const createLimiter = (keyPrefix, points, duration) => {
  if (useMemoryFallback || !redis) {
    return new RateLimiterMemory({
      keyPrefix,
      points,
      duration,
    });
  }

  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration,
    blockDuration: 0, // Don't block permanently
  });
};

// Tiered rate limiters
export const limiters = {
  // General API calls: 100 requests per hour
  general: createLimiter('rl:general', 100, 3600),

  // Investment operations: 10 per hour (protect against rapid trading)
  investment: createLimiter('rl:invest', 10, 3600),

  // Withdrawal operations: 5 per hour (highest security)
  withdrawal: createLimiter('rl:withdraw', 5, 3600),

  // Agent scan operations: 20 per hour
  scan: createLimiter('rl:scan', 20, 3600),

  // Configuration updates: 30 per hour
  config: createLimiter('rl:config', 30, 3600),
};

/**
 * Rate limiting middleware
 * @param {Request} request - Incoming request
 * @param {string} type - Limiter type: 'general' | 'investment' | 'withdrawal' | 'scan' | 'config'
 * @returns {Response|null} - Error response if rate limit exceeded, null otherwise
 */
export async function rateLimitMiddleware(request, type = 'general') {
  try {
    // Build identifier from multiple sources for more robust limiting
    const identifier = getRequestIdentifier(request);

    // Consume a point from the rate limiter
    await limiters[type].consume(identifier);

    // No error - request is within limits
    return null;
  } catch (rejRes) {
    // Rate limit exceeded
    const retryAfterSeconds = Math.round(rejRes.msBeforeNext / 1000) || 60;

    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        message: `Rate limit exceeded for ${type} operations. Please try again in ${retryAfterSeconds} seconds.`,
        retryAfter: retryAfterSeconds,
        limit: limiters[type].points,
        type,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfterSeconds),
          'X-RateLimit-Limit': String(limiters[type].points),
          'X-RateLimit-Remaining': String(rejRes.remainingPoints || 0),
          'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + retryAfterSeconds),
        },
      }
    );
  }
}

/**
 * Get unique identifier for rate limiting
 * Combines IP address and user wallet for comprehensive limiting
 * @param {Request} request
 * @returns {string} Unique identifier
 */
function getRequestIdentifier(request) {
  const identifiers = [];

  // Get IP address from various headers
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown-ip';

  identifiers.push(ip);

  // Get user identifier if authenticated
  // Will be set by auth middleware in later tasks
  if (request.user?.id) {
    identifiers.push(request.user.id);
  }

  // Get wallet address if provided in request
  const url = new URL(request.url);
  const walletParam = url.searchParams.get('wallet') || url.searchParams.get('address');
  if (walletParam) {
    identifiers.push(walletParam.toLowerCase());
  }

  // Combine identifiers
  return identifiers.join(':');
}

/**
 * Helper to manually check remaining points
 * @param {string} identifier
 * @param {string} type
 * @returns {Promise<object>} Remaining points info
 */
export async function checkRateLimit(identifier, type = 'general') {
  try {
    const limiter = limiters[type];
    const res = await limiter.get(identifier);

    return {
      remaining: res?.remainingPoints ?? limiter.points,
      limit: limiter.points,
      resetTime: res?.msBeforeNext ? Date.now() + res.msBeforeNext : null,
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return {
      remaining: limiters[type].points,
      limit: limiters[type].points,
      resetTime: null,
    };
  }
}

/**
 * Utility to manually penalize (e.g., for detected abuse)
 * @param {string} identifier
 * @param {string} type
 * @param {number} points - Points to penalize
 */
export async function penalizeRateLimit(identifier, type = 'general', points = 10) {
  try {
    await limiters[type].penalty(identifier, points);
  } catch (error) {
    console.error('Error penalizing rate limit:', error);
  }
}

/**
 * Utility to manually reward (e.g., for premium users)
 * @param {string} identifier
 * @param {string} type
 * @param {number} points - Points to reward
 */
export async function rewardRateLimit(identifier, type = 'general', points = 10) {
  try {
    await limiters[type].reward(identifier, points);
  } catch (error) {
    console.error('Error rewarding rate limit:', error);
  }
}

/**
 * Reset rate limit for a specific identifier (admin use)
 * @param {string} identifier
 * @param {string} type
 */
export async function resetRateLimit(identifier, type = 'general') {
  try {
    await limiters[type].delete(identifier);
  } catch (error) {
    console.error('Error resetting rate limit:', error);
  }
}

