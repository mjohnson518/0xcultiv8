import { metricsCollector } from '../middleware/metrics';
import { requireAdmin } from '../middleware/auth';

/**
 * Metrics Export Endpoint
 * GET /api/metrics
 * Returns performance metrics (admin only, Prometheus-compatible)
 */
export async function GET(request) {
  // Admin only for metrics access
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;

  try {
    const format = new URL(request.url).searchParams.get('format') || 'json';

    const metrics = metricsCollector.getMetrics();

    if (format === 'prometheus') {
      // Prometheus text format
      const prometheus = formatPrometheus(metrics);
      return new Response(prometheus, {
        headers: { 'Content-Type': 'text/plain; version=0.0.4' },
      });
    }

    // JSON format (default)
    return Response.json({
      success: true,
      metrics,
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

function formatPrometheus(metrics) {
  const lines = [];

  // Total requests
  lines.push('# HELP cultiv8_api_requests_total Total API requests');
  lines.push('# TYPE cultiv8_api_requests_total counter');
  lines.push(`cultiv8_api_requests_total ${metrics.totalRequests}`);

  // Error rate
  lines.push('# HELP cultiv8_api_error_rate API error rate percentage');
  lines.push('# TYPE cultiv8_api_error_rate gauge');
  lines.push(`cultiv8_api_error_rate ${metrics.errorRate.toFixed(2)}`);

  // Response time percentiles
  lines.push('# HELP cultiv8_api_response_time_seconds API response time');
  lines.push('# TYPE cultiv8_api_response_time_seconds summary');
  lines.push(`cultiv8_api_response_time_seconds{quantile="0.5"} ${(metrics.responseTimes.p50 / 1000).toFixed(3)}`);
  lines.push(`cultiv8_api_response_time_seconds{quantile="0.95"} ${(metrics.responseTimes.p95 / 1000).toFixed(3)}`);
  lines.push(`cultiv8_api_response_time_seconds{quantile="0.99"} ${(metrics.responseTimes.p99 / 1000).toFixed(3)}`);

  return lines.join('\n');
}

