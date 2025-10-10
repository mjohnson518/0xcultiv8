import { logPerformance } from '../utils/logger';

/**
 * Metrics Collection Middleware
 * Tracks API performance metrics for monitoring
 */

// In-memory metrics storage (use Redis or Prometheus in production)
class MetricsCollector {
  constructor() {
    this.requests = new Map();
    this.responseTimes = [];
    this.errors = new Map();
    this.maxSamples = 1000; // Keep last 1000 requests
  }

  recordRequest(endpoint, duration, status) {
    // Track request count by endpoint
    const key = `${endpoint}:${status}`;
    this.requests.set(key, (this.requests.get(key) || 0) + 1);

    // Track response times
    this.responseTimes.push({ endpoint, duration, timestamp: Date.now() });
    
    // Keep only recent samples
    if (this.responseTimes.length > this.maxSamples) {
      this.responseTimes.shift();
    }

    // Track errors
    if (status >= 400) {
      this.errors.set(key, (this.errors.get(key) || 0) + 1);
    }
  }

  getMetrics() {
    return {
      totalRequests: Array.from(this.requests.values()).reduce((sum, count) => sum + count, 0),
      requestsByEndpoint: Object.fromEntries(this.requests),
      errorRate: this.calculateErrorRate(),
      responseTimes: this.calculatePercentiles(),
      errors: Object.fromEntries(this.errors),
    };
  }

  calculateErrorRate() {
    const total = Array.from(this.requests.values()).reduce((sum, count) => sum + count, 0);
    const errors = Array.from(this.errors.values()).reduce((sum, count) => sum + count, 0);
    return total > 0 ? (errors / total) * 100 : 0;
  }

  calculatePercentiles() {
    if (this.responseTimes.length === 0) return { p50: 0, p95: 0, p99: 0 };

    const sorted = [...this.responseTimes]
      .map(r => r.duration)
      .sort((a, b) => a - b);

    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { p50, p95, p99 };
  }

  reset() {
    this.requests.clear();
    this.responseTimes = [];
    this.errors.clear();
  }
}

export const metricsCollector = new MetricsCollector();

/**
 * Metrics middleware - wraps route handlers
 * @param {Function} handler - Route handler
 * @returns {Function} - Wrapped handler
 */
export function withMetrics(handler) {
  return async (request) => {
    const startTime = Date.now();
    const url = new URL(request.url);
    const endpoint = url.pathname;

    try {
      const response = await handler(request);
      const duration = Date.now() - startTime;

      // Record metrics
      metricsCollector.recordRequest(endpoint, duration, response.status);

      // Log slow requests
      if (duration > 1000) {
        logPerformance(endpoint, duration, {
          method: request.method,
          status: response.status,
        });
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      metricsCollector.recordRequest(endpoint, duration, 500);
      throw error;
    }
  };
}

