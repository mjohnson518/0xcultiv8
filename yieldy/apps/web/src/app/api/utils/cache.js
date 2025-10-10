import Redis from 'ioredis';
import { log } from './logger';

/**
 * Redis Caching Layer
 * Provides high-performance caching for frequently accessed data
 */
class CacheManager {
  constructor() {
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Don't retry, fail fast
      });

      this.redis.on('error', (err) => {
        log.warn('Redis cache error', { error: err.message });
        this.enabled = false;
      });

      this.redis.on('connect', () => {
        this.enabled = true;
      });

      this.enabled = true;
    } catch (error) {
      log.warn('Redis cache unavailable, caching disabled', { error: error.message });
      this.redis = null;
      this.enabled = false;
    }

    // Cache TTLs in seconds
    this.TTL = {
      opportunities: 300,      // 5 minutes
      risk: 900,               // 15 minutes
      performance: 300,        // 5 minutes
      protocolData: 180,       // 3 minutes
      userPosition: 60,        // 1 minute
      config: 600,             // 10 minutes
    };
  }

  /**
   * Get cached value
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} - Cached value or null
   */
  async get(key) {
    if (!this.enabled || !this.redis) return null;

    try {
      const value = await this.redis.get(key);
      if (!value) return null;

      return JSON.parse(value);
    } catch (error) {
      log.debug('Cache get error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set cache value
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   */
  async set(key, value, ttl = 300) {
    if (!this.enabled || !this.redis) return;

    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      log.debug('Cache set error', { key, error: error.message });
    }
  }

  /**
   * Delete cached value(s)
   * @param {string|Array<string>} keys - Key(s) to delete
   */
  async del(keys) {
    if (!this.enabled || !this.redis) return;

    try {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      await this.redis.del(...keysArray);
    } catch (error) {
      log.debug('Cache delete error', { keys, error: error.message });
    }
  }

  /**
   * Invalidate cache by pattern
   * @param {string} pattern - Pattern to match (e.g., 'opportunities:*')
   */
  async invalidatePattern(pattern) {
    if (!this.enabled || !this.redis) return;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        log.info('Cache invalidated', { pattern, count: keys.length });
      }
    } catch (error) {
      log.debug('Cache invalidation error', { pattern, error: error.message });
    }
  }

  /**
   * Wrap async function with caching
   * @param {string} key - Cache key
   * @param {Function} fn - Function to cache
   * @param {number} ttl - TTL in seconds
   * @returns {Promise<any>} - Result (from cache or function)
   */
  async wrap(key, fn, ttl = 300) {
    // Try cache first
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - execute function
    const result = await fn();

    // Store in cache
    await this.set(key, result, ttl);

    return result;
  }

  /**
   * Warm cache with commonly accessed data
   * Called on server startup
   */
  async warmCache() {
    if (!this.enabled) return;

    log.info('Warming cache...');

    try {
      // Cache active opportunities for both chains
      const { fetchAllProtocolData } = await import('../protocols/adapters');
      
      for (const chain of ['ethereum', 'base']) {
        const data = await fetchAllProtocolData(chain);
        await this.set(`protocol_data:${chain}`, data, this.TTL.protocolData);
      }

      log.info('Cache warmed successfully');
    } catch (error) {
      log.warn('Cache warming failed', { error: error.message });
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<object>} - Cache stats
   */
  async getStats() {
    if (!this.enabled || !this.redis) {
      return { enabled: false };
    }

    try {
      const info = await this.redis.info('stats');
      const keyCount = await this.redis.dbsize();

      return {
        enabled: true,
        keys: keyCount,
        info,
      };
    } catch (error) {
      return { enabled: false, error: error.message };
    }
  }
}

// Singleton instance
export const cache = new CacheManager();

// Cache key builders (consistent naming)
export const cacheKeys = {
  opportunities: (blockchain) => `opportunities:${blockchain}`,
  risk: (opportunityId) => `risk:${opportunityId}`,
  performance: (days) => `performance:${days}d`,
  protocolData: (protocol, chain) => `protocol:${protocol}:${chain}`,
  userPosition: (address, protocol) => `position:${address}:${protocol}`,
  config: () => 'config:agent',
};

// Initialize cache warming (if enabled)
if (process.env.ENABLE_CACHE_WARMING === 'true') {
  cache.warmCache().catch(err => 
    log.warn('Initial cache warming failed', { error: err.message })
  );
}

export default cache;

