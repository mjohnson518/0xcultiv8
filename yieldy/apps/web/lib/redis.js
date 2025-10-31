/**
 * Redis Client Wrapper for Upstash (Serverless)
 * Replaces local Redis with Upstash REST API for Vercel deployment
 */

import { Redis } from '@upstash/redis';

// Singleton instance
let redisClient = null;

/**
 * Get or create Upstash Redis client
 * @returns {Redis} Upstash Redis client
 */
export function getRedisClient() {
  if (!redisClient) {
    // Validate environment variables
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      console.warn('Upstash Redis not configured, using in-memory fallback');
      return null; // Graceful degradation
    }

    try {
      redisClient = new Redis({
        url,
        token,
        retry: {
          retries: 3,
          backoff: (retryCount) => Math.pow(2, retryCount) * 50,
        },
      });
    } catch (error) {
      console.error('Failed to initialize Upstash Redis:', error);
      return null;
    }
  }

  return redisClient;
}

/**
 * In-memory fallback for when Redis is unavailable
 * Used for local development or graceful degradation
 */
class MemoryStore {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
  }

  async get(key) {
    // Check if expired
    const ttl = this.ttls.get(key);
    if (ttl && Date.now() > ttl) {
      this.store.delete(key);
      this.ttls.delete(key);
      return null;
    }
    return this.store.get(key) || null;
  }

  async set(key, value, options = {}) {
    this.store.set(key, value);
    
    if (options.ex) {
      // ex = seconds
      this.ttls.set(key, Date.now() + (options.ex * 1000));
    } else if (options.px) {
      // px = milliseconds
      this.ttls.set(key, Date.now() + options.px);
    }

    return 'OK';
  }

  async del(...keys) {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) deleted++;
      this.ttls.delete(key);
    }
    return deleted;
  }

  async incr(key) {
    const current = (await this.get(key)) || 0;
    const newValue = Number(current) + 1;
    await this.set(key, newValue);
    return newValue;
  }

  async expire(key, seconds) {
    if (!this.store.has(key)) return 0;
    this.ttls.set(key, Date.now() + (seconds * 1000));
    return 1;
  }

  async ttl(key) {
    const expiry = this.ttls.get(key);
    if (!expiry) return -1; // No expiry set
    const remaining = Math.floor((expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2; // -2 means expired
  }

  async exists(key) {
    return this.store.has(key) ? 1 : 0;
  }

  async keys(pattern) {
    // Simple pattern matching (only supports * wildcard)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }

  async flushall() {
    this.store.clear();
    this.ttls.clear();
    return 'OK';
  }
}

// In-memory store instance
let memoryStore = null;

/**
 * Get Redis client with fallback to memory store
 * @returns {Redis | MemoryStore} Redis client or memory fallback
 */
export function getRedis() {
  const client = getRedisClient();
  
  if (client) {
    return client;
  }

  // Fallback to memory store
  if (!memoryStore) {
    memoryStore = new MemoryStore();
    console.warn('Using in-memory store as Redis fallback');
  }

  return memoryStore;
}

/**
 * Cache wrapper with automatic serialization
 * @param {string} key - Cache key
 * @param {Function} fetcher - Async function to get data if not cached
 * @param {number} ttl - Time to live in seconds (default: 300)
 * @returns {Promise<any>} Cached or fetched data
 */
export async function cache(key, fetcher, ttl = 300) {
  const redis = getRedis();
  
  try {
    // Try to get from cache
    const cached = await redis.get(key);
    
    if (cached !== null) {
      // Parse if it's a JSON string
      try {
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      } catch {
        return cached;
      }
    }

    // Cache miss - fetch data
    const data = await fetcher();

    // Store in cache
    const serialized = typeof data === 'object' ? JSON.stringify(data) : data;
    await redis.set(key, serialized, { ex: ttl });

    return data;
  } catch (error) {
    console.error('Cache error:', error);
    // On cache error, just fetch the data
    return await fetcher();
  }
}

/**
 * Invalidate cache by key or pattern
 * @param {string} keyOrPattern - Cache key or pattern (e.g., "user:*")
 * @returns {Promise<number>} Number of keys deleted
 */
export async function invalidateCache(keyOrPattern) {
  const redis = getRedis();

  try {
    if (keyOrPattern.includes('*')) {
      // Pattern - find and delete matching keys
      const keys = await redis.keys(keyOrPattern);
      if (keys.length > 0) {
        return await redis.del(...keys);
      }
      return 0;
    } else {
      // Single key
      return await redis.del(keyOrPattern);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
    return 0;
  }
}

/**
 * Rate limiting using Redis
 * @param {string} identifier - Unique identifier (e.g., IP address)
 * @param {number} limit - Maximum number of requests
 * @param {number} window - Time window in seconds
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
 */
export async function rateLimit(identifier, limit, window) {
  const redis = getRedis();
  const key = `ratelimit:${identifier}`;

  try {
    // Increment counter
    const count = await redis.incr(key);

    // Set expiry on first request
    if (count === 1) {
      await redis.expire(key, window);
    }

    // Check if limit exceeded
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    // Get TTL for reset time
    const ttl = await redis.ttl(key);
    const resetAt = Date.now() + (ttl * 1000);

    return {
      allowed,
      remaining,
      resetAt,
      limit,
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    // On error, allow the request (fail open)
    return {
      allowed: true,
      remaining: limit,
      resetAt: Date.now() + (window * 1000),
      limit,
    };
  }
}

/**
 * Health check for Redis connection
 * @returns {Promise<boolean>} True if connected
 */
export async function healthCheck() {
  const redis = getRedisClient();
  
  if (!redis) {
    return false; // Using memory store
  }

  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

/**
 * Get cache statistics
 * @returns {Promise<object>} Cache stats
 */
export async function getCacheStats() {
  const redis = getRedisClient();

  if (!redis) {
    return {
      type: 'memory',
      keys: memoryStore ? memoryStore.store.size : 0,
    };
  }

  try {
    const keys = await redis.keys('*');
    return {
      type: 'upstash',
      keys: keys.length,
      connected: true,
    };
  } catch (error) {
    return {
      type: 'upstash',
      connected: false,
      error: error.message,
    };
  }
}

// Export both named and default
export default {
  getRedis,
  cache,
  invalidateCache,
  rateLimit,
  healthCheck,
  getCacheStats,
};

