import { metricsCollector } from '../middleware/metrics';
import { requireAdmin } from '../middleware/auth';
import { apm } from '../utils/apm.js';
import { circuitBreaker } from '../utils/circuitBreaker.js';
import { getRpcHealthStatus } from '../protocols/adapters.js';

/**
 * Metrics Export Endpoint
 * GET /api/metrics
 * Returns comprehensive performance metrics (Prometheus-compatible)
 *
 * Query params:
 * - format: 'json' (default) or 'prometheus'
 * - token: Optional auth token (alternative to bearer token)
 *
 * Metrics exposed:
 * - HTTP request metrics (count, duration, error rate)
 * - RPC provider health status
 * - Circuit breaker state
 * - Job queue statistics
 * - APM aggregated metrics
 * - System metrics (memory, uptime)
 */
export async function GET(request) {
  // Support both admin auth and token-based auth for scraping
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get('token');
  const metricsToken = process.env.METRICS_AUTH_TOKEN;

  // If token is configured, allow token-based auth
  if (metricsToken && tokenParam === metricsToken) {
    // Token auth passed
  } else {
    // Fall back to admin auth
    const adminError = await requireAdmin(request);
    if (adminError) return adminError;
  }

  try {
    const format = url.searchParams.get('format') || 'json';

    const metrics = metricsCollector.getMetrics();

    // Gather additional metrics
    const additionalMetrics = await gatherAdditionalMetrics();

    if (format === 'prometheus') {
      // Prometheus text format
      const prometheus = await formatPrometheus(metrics, additionalMetrics);
      return new Response(prometheus, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // JSON format (default)
    return Response.json({
      success: true,
      metrics: {
        ...metrics,
        ...additionalMetrics,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return Response.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

/**
 * Gather additional metrics from various sources
 */
async function gatherAdditionalMetrics() {
  const additional = {
    system: {
      uptimeSeconds: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
    },
    rpcHealth: null,
    circuitBreaker: null,
    apmMetrics: null,
  };

  // RPC Health
  try {
    additional.rpcHealth = getRpcHealthStatus();
  } catch (e) {
    // Not available
  }

  // Circuit Breaker
  try {
    additional.circuitBreaker = {
      status: await circuitBreaker.isTripped(),
      stats: await circuitBreaker.getStats(),
    };
  } catch (e) {
    // Not available
  }

  // APM Metrics
  try {
    additional.apmMetrics = await apm.getMetrics();
  } catch (e) {
    // Not available
  }

  return additional;
}

async function formatPrometheus(metrics, additionalMetrics) {
  const lines = [];

  // ==========================================================================
  // Application Info
  // ==========================================================================
  lines.push('# HELP cultiv8_info Application information');
  lines.push('# TYPE cultiv8_info gauge');
  lines.push(`cultiv8_info{version="${process.env.VERSION || 'unknown'}",environment="${process.env.NODE_ENV || 'development'}"} 1`);
  lines.push('');

  // ==========================================================================
  // System Metrics
  // ==========================================================================
  lines.push('# HELP process_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${additionalMetrics.system.uptimeSeconds.toFixed(2)}`);

  lines.push('# HELP process_memory_heap_used_bytes Heap memory used');
  lines.push('# TYPE process_memory_heap_used_bytes gauge');
  lines.push(`process_memory_heap_used_bytes ${additionalMetrics.system.memoryUsage.heapUsed}`);

  lines.push('# HELP process_memory_heap_total_bytes Total heap memory');
  lines.push('# TYPE process_memory_heap_total_bytes gauge');
  lines.push(`process_memory_heap_total_bytes ${additionalMetrics.system.memoryUsage.heapTotal}`);

  lines.push('# HELP process_memory_rss_bytes Resident set size');
  lines.push('# TYPE process_memory_rss_bytes gauge');
  lines.push(`process_memory_rss_bytes ${additionalMetrics.system.memoryUsage.rss}`);
  lines.push('');

  // ==========================================================================
  // HTTP Metrics
  // ==========================================================================
  lines.push('# HELP cultiv8_api_requests_total Total API requests');
  lines.push('# TYPE cultiv8_api_requests_total counter');
  lines.push(`cultiv8_api_requests_total ${metrics.totalRequests}`);

  lines.push('# HELP cultiv8_api_error_rate API error rate percentage');
  lines.push('# TYPE cultiv8_api_error_rate gauge');
  lines.push(`cultiv8_api_error_rate ${metrics.errorRate.toFixed(2)}`);

  lines.push('# HELP cultiv8_api_response_time_seconds API response time');
  lines.push('# TYPE cultiv8_api_response_time_seconds summary');
  lines.push(`cultiv8_api_response_time_seconds{quantile="0.5"} ${(metrics.responseTimes.p50 / 1000).toFixed(3)}`);
  lines.push(`cultiv8_api_response_time_seconds{quantile="0.95"} ${(metrics.responseTimes.p95 / 1000).toFixed(3)}`);
  lines.push(`cultiv8_api_response_time_seconds{quantile="0.99"} ${(metrics.responseTimes.p99 / 1000).toFixed(3)}`);
  lines.push('');

  // ==========================================================================
  // RPC Health Metrics
  // ==========================================================================
  if (additionalMetrics.rpcHealth) {
    lines.push('# HELP cultiv8_rpc_provider_healthy RPC provider health (1=healthy, 0=unhealthy)');
    lines.push('# TYPE cultiv8_rpc_provider_healthy gauge');
    lines.push('# HELP cultiv8_rpc_using_fallback Using fallback RPC (1=yes, 0=no)');
    lines.push('# TYPE cultiv8_rpc_using_fallback gauge');

    for (const [chain, status] of Object.entries(additionalMetrics.rpcHealth)) {
      lines.push(`cultiv8_rpc_provider_healthy{chain="${chain}",type="primary"} ${status.primary.healthy ? 1 : 0}`);
      if (status.fallback.configured) {
        lines.push(`cultiv8_rpc_provider_healthy{chain="${chain}",type="fallback"} ${status.fallback.healthy ? 1 : 0}`);
      }
      lines.push(`cultiv8_rpc_using_fallback{chain="${chain}"} ${status.usingFallback ? 1 : 0}`);
    }
    lines.push('');
  }

  // ==========================================================================
  // Circuit Breaker Metrics
  // ==========================================================================
  if (additionalMetrics.circuitBreaker) {
    lines.push('# HELP cultiv8_circuit_breaker_tripped Circuit breaker status (1=tripped, 0=ok)');
    lines.push('# TYPE cultiv8_circuit_breaker_tripped gauge');
    lines.push(`cultiv8_circuit_breaker_tripped ${additionalMetrics.circuitBreaker.status.isPaused ? 1 : 0}`);

    if (additionalMetrics.circuitBreaker.stats) {
      lines.push('# HELP cultiv8_circuit_breaker_failures Failure count by operation');
      lines.push('# TYPE cultiv8_circuit_breaker_failures gauge');
      for (const [operation, stats] of Object.entries(additionalMetrics.circuitBreaker.stats)) {
        lines.push(`cultiv8_circuit_breaker_failures{operation="${operation}"} ${stats.failures}`);
      }
    }
    lines.push('');
  }

  // ==========================================================================
  // APM Aggregated Metrics
  // ==========================================================================
  if (additionalMetrics.apmMetrics) {
    for (const [name, data] of Object.entries(additionalMetrics.apmMetrics)) {
      const prometheusName = `cultiv8_${name.replace(/\./g, '_').replace(/-/g, '_')}`;
      lines.push(`# HELP ${prometheusName} APM metric: ${name}`);
      lines.push(`# TYPE ${prometheusName} ${data.type === 'counter' ? 'counter' : 'gauge'}`);

      for (const item of data.values || []) {
        const labels = Object.entries(item.tags || {})
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        lines.push(labels ? `${prometheusName}{${labels}} ${item.value}` : `${prometheusName} ${item.value}`);
      }
    }
  }

  return lines.join('\n');
}

