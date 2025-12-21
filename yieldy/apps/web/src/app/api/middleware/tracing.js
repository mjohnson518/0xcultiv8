/**
 * 0xCultiv8 Request Tracing Middleware
 *
 * Provides distributed tracing for all API requests including:
 * - Request/response timing
 * - Correlation ID propagation
 * - Error tracking
 * - Performance metrics
 */

import { apm } from '../utils/apm.js';
import { randomUUID } from 'crypto';

// ============================================================================
// Correlation ID Management
// ============================================================================

const CORRELATION_ID_HEADER = 'x-correlation-id';
const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Generate or extract correlation ID from request
 */
export function getCorrelationId(request) {
  return (
    request.headers.get(CORRELATION_ID_HEADER) ||
    request.headers.get(REQUEST_ID_HEADER) ||
    randomUUID()
  );
}

/**
 * Add correlation headers to response
 */
export function addCorrelationHeaders(response, correlationId, requestId) {
  const headers = new Headers(response.headers);
  headers.set(CORRELATION_ID_HEADER, correlationId);
  headers.set(REQUEST_ID_HEADER, requestId);
  headers.set('x-response-time', `${Date.now()}ms`);
  return headers;
}

// ============================================================================
// Request Context
// ============================================================================

/**
 * Extract request context for tracing
 */
export function extractRequestContext(request) {
  const url = new URL(request.url);

  return {
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    userAgent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    referer: request.headers.get('referer'),
    contentType: request.headers.get('content-type'),
    contentLength: request.headers.get('content-length'),
  };
}

// ============================================================================
// Tracing Middleware
// ============================================================================

/**
 * Create tracing middleware for API routes
 */
export function createTracingMiddleware(options = {}) {
  const {
    excludePaths = ['/api/health', '/api/metrics'],
    slowThresholdMs = 1000,
    logLevel = 'info',
  } = options;

  return async function tracingMiddleware(request, handler) {
    const url = new URL(request.url);

    // Skip tracing for excluded paths
    if (excludePaths.some(path => url.pathname.startsWith(path))) {
      return handler(request);
    }

    const correlationId = getCorrelationId(request);
    const requestId = randomUUID();
    const startTime = performance.now();
    const context = extractRequestContext(request);

    // Start APM span
    const span = apm.startSpan(`HTTP ${request.method} ${url.pathname}`, {
      op: 'http.server',
      tags: {
        'http.method': request.method,
        'http.url': url.pathname,
        'correlation.id': correlationId,
        'request.id': requestId,
      },
    });

    // Track request start
    apm.incrementCounter('http.requests.started', 1, {
      method: request.method,
      path: normalizePathForMetrics(url.pathname),
    });

    let response;
    let error;

    try {
      // Execute the handler
      response = await handler(request);

      // Add correlation headers
      const headers = addCorrelationHeaders(response, correlationId, requestId);
      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });

      // Set success tags
      span.setTag('http.status_code', response.status);
      span.setTag('status', response.status < 400 ? 'success' : 'error');

      return response;
    } catch (err) {
      error = err;
      span.setTag('status', 'error');
      span.setTag('error.message', err.message);
      span.setTag('error.type', err.name);

      // Capture error in APM
      apm.captureError(err, {
        correlationId,
        requestId,
        ...context,
      });

      throw err;
    } finally {
      const duration = performance.now() - startTime;
      span.end();

      // Record metrics
      const statusCode = response?.status || 500;
      const statusCategory = `${Math.floor(statusCode / 100)}xx`;
      const normalizedPath = normalizePathForMetrics(url.pathname);

      apm.recordHistogram('http.request.duration', duration, {
        method: request.method,
        path: normalizedPath,
        status: statusCategory,
      });

      apm.incrementCounter('http.requests.completed', 1, {
        method: request.method,
        path: normalizedPath,
        status: statusCategory,
      });

      // Log slow requests
      if (duration > slowThresholdMs) {
        apm.captureMessage(`Slow request: ${request.method} ${url.pathname}`, 'warning', {
          duration,
          correlationId,
          threshold: slowThresholdMs,
          ...context,
        });

        apm.incrementCounter('http.requests.slow', 1, {
          path: normalizedPath,
        });
      }

      // Log request completion
      if (logLevel !== 'none') {
        logRequest({
          correlationId,
          requestId,
          method: request.method,
          path: url.pathname,
          statusCode,
          duration,
          error: error?.message,
        });
      }
    }
  };
}

// ============================================================================
// Path Normalization
// ============================================================================

/**
 * Normalize path for metrics (replace dynamic segments)
 */
function normalizePathForMetrics(path) {
  return path
    // Replace UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Replace Ethereum addresses
    .replace(/0x[a-fA-F0-9]{40}/g, ':address')
    // Replace transaction hashes
    .replace(/0x[a-fA-F0-9]{64}/g, ':txHash')
    // Replace numeric IDs
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

// ============================================================================
// Logging
// ============================================================================

/**
 * Log request with structured format
 */
function logRequest(data) {
  const {
    correlationId,
    requestId,
    method,
    path,
    statusCode,
    duration,
    error,
  } = data;

  const logData = {
    timestamp: new Date().toISOString(),
    level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
    type: 'request',
    correlationId,
    requestId,
    method,
    path,
    statusCode,
    durationMs: Math.round(duration * 100) / 100,
  };

  if (error) {
    logData.error = error;
  }

  // Use JSON format for structured logging
  console.log(JSON.stringify(logData));
}

// ============================================================================
// Route Wrapper
// ============================================================================

/**
 * Wrap an API route handler with tracing
 */
export function withTracing(handler, options = {}) {
  const middleware = createTracingMiddleware(options);

  return async function tracedHandler(request, ...args) {
    return middleware(request, (req) => handler(req, ...args));
  };
}

/**
 * Create a traced API route
 */
export function createTracedRoute(methods) {
  const traced = {};

  for (const [method, handler] of Object.entries(methods)) {
    traced[method] = withTracing(handler);
  }

  return traced;
}

// ============================================================================
// Database Query Tracing
// ============================================================================

/**
 * Trace a database query
 */
export async function traceQuery(name, queryFn, options = {}) {
  const span = apm.startSpan(`db.query.${name}`, {
    op: 'db.query',
    tags: {
      'db.type': options.dbType || 'postgresql',
      'db.operation': name,
    },
  });

  const startTime = performance.now();

  try {
    const result = await queryFn();

    span.setTag('status', 'success');
    span.setTag('db.rows_affected', result?.rowCount || 0);

    return result;
  } catch (error) {
    span.setTag('status', 'error');
    span.setTag('error.message', error.message);

    apm.captureError(error, {
      query: name,
      dbType: options.dbType || 'postgresql',
    });

    throw error;
  } finally {
    const duration = performance.now() - startTime;
    span.end();

    apm.recordHistogram('db.query.duration', duration, {
      operation: name,
    });

    // Warn on slow queries
    if (duration > (options.slowThresholdMs || 500)) {
      apm.captureMessage(`Slow database query: ${name}`, 'warning', {
        duration,
        threshold: options.slowThresholdMs || 500,
      });
    }
  }
}

// ============================================================================
// External API Call Tracing
// ============================================================================

/**
 * Trace an external API call
 */
export async function traceExternalCall(name, callFn, options = {}) {
  const span = apm.startSpan(`external.${name}`, {
    op: 'http.client',
    tags: {
      'external.service': options.service || name,
      'external.url': options.url,
    },
  });

  const startTime = performance.now();

  try {
    const result = await callFn();

    span.setTag('status', 'success');

    return result;
  } catch (error) {
    span.setTag('status', 'error');
    span.setTag('error.message', error.message);

    apm.captureError(error, {
      service: name,
      url: options.url,
    });

    throw error;
  } finally {
    const duration = performance.now() - startTime;
    span.end();

    apm.recordHistogram('external.call.duration', duration, {
      service: name,
    });
  }
}

// ============================================================================
// LLM Call Tracing
// ============================================================================

/**
 * Trace an LLM API call
 */
export async function traceLLMCall(provider, callFn, options = {}) {
  const span = apm.startSpan(`llm.${provider}`, {
    op: 'ai.inference',
    tags: {
      'llm.provider': provider,
      'llm.model': options.model,
    },
  });

  const startTime = performance.now();

  try {
    const result = await callFn();

    span.setTag('status', 'success');

    // Track token usage if available
    if (result?.usage) {
      span.setTag('llm.tokens.prompt', result.usage.prompt_tokens);
      span.setTag('llm.tokens.completion', result.usage.completion_tokens);

      apm.recordHistogram('llm.tokens.total', result.usage.total_tokens, {
        provider,
        model: options.model,
      });
    }

    return result;
  } catch (error) {
    span.setTag('status', 'error');
    span.setTag('error.message', error.message);

    apm.captureError(error, {
      provider,
      model: options.model,
    });

    throw error;
  } finally {
    const duration = performance.now() - startTime;
    span.end();

    apm.recordHistogram('llm.call.duration', duration, {
      provider,
      model: options.model,
    });

    apm.incrementCounter('llm.calls.total', 1, {
      provider,
      model: options.model,
    });
  }
}
