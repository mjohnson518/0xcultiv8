import { logRequest, logError } from '../utils/logger';

/**
 * Request Logging Middleware
 * Logs all API requests with timing and context
 */
export async function requestLoggerMiddleware(request, handler) {
  const startTime = Date.now();
  const url = new URL(request.url);

  try {
    // Execute the handler
    const response = await handler(request);
    
    // Calculate duration
    const duration = Date.now() - startTime;

    // Log the request
    logRequest(request, response, duration);

    // Add performance headers
    response.headers.set('X-Response-Time', `${duration}ms`);

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log error
    logError(error, {
      method: request.method,
      path: url.pathname,
      duration: `${duration}ms`,
    }, request);

    // Re-throw for error boundary handling
    throw error;
  }
}

/**
 * Wrapper to apply logging middleware to route handlers
 * @param {Function} handler - Route handler
 * @returns {Function} - Wrapped handler with logging
 */
export function withRequestLogging(handler) {
  return async (request) => {
    return requestLoggerMiddleware(request, handler);
  };
}

