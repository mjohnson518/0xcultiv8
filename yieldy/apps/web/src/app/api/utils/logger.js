import winston from 'winston';

/**
 * Structured Logging Configuration
 * Winston-based logging with JSON format for production observability
 */

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Custom format for development (colorized, readable)
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, requestId, userId, ...meta } = info;
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    const prefix = requestId ? `[${requestId}]` : '';
    const userPrefix = userId ? `[user:${userId}]` : '';
    return `${timestamp} ${level} ${prefix}${userPrefix}: ${message} ${metaStr}`;
  })
);

// Production format (JSON)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// Create Winston logger
const logger = winston.createLogger({
  level: logLevel,
  levels,
  format: isProduction ? prodFormat : devFormat,
  defaultMeta: {
    service: 'cultiv8-api',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console output
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),

    // Error log file (production only)
    ...(isProduction ? [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 10485760,
        maxFiles: 10,
      }),
    ] : []),
  ],
});

/**
 * Log with request context
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 * @param {Request} request - Optional request object for context
 */
export function logWithContext(level, message, meta = {}, request = null) {
  const enrichedMeta = {
    ...meta,
    ...(request && {
      requestId: request.headers?.get('x-request-id'),
      userId: request.user?.id,
      ip: request.headers?.get('x-forwarded-for') || request.headers?.get('x-real-ip'),
      userAgent: request.headers?.get('user-agent'),
    }),
  };

  logger.log(level, message, enrichedMeta);
}

// Convenience methods
export const log = {
  error: (message, meta = {}, request = null) => logWithContext('error', message, meta, request),
  warn: (message, meta = {}, request = null) => logWithContext('warn', message, meta, request),
  info: (message, meta = {}, request = null) => logWithContext('info', message, meta, request),
  http: (message, meta = {}, request = null) => logWithContext('http', message, meta, request),
  debug: (message, meta = {}, request = null) => logWithContext('debug', message, meta, request),
};

/**
 * Log API request
 * @param {Request} request
 * @param {Response} response
 * @param {number} duration - Request duration in ms
 */
export function logRequest(request, response, duration) {
  const url = new URL(request.url);
  
  logger.http('API Request', {
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    status: response.status,
    duration: `${duration}ms`,
    requestId: request.headers?.get('x-request-id'),
    userId: request.user?.id,
    ip: request.headers?.get('x-forwarded-for'),
  });
}

/**
 * Log database query (for debugging slow queries)
 * @param {string} query - SQL query
 * @param {number} duration - Query duration in ms
 */
export function logQuery(query, duration) {
  if (duration > 100) {
    logger.warn('Slow query detected', {
      query: query.substring(0, 200),
      duration: `${duration}ms`,
    });
  } else {
    logger.debug('Query executed', {
      query: query.substring(0, 100),
      duration: `${duration}ms`,
    });
  }
}

/**
 * Log error with full context
 * @param {Error} error
 * @param {object} context
 * @param {Request} request
 */
export function logError(error, context = {}, request = null) {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
    ...(request && {
      requestId: request.headers?.get('x-request-id'),
      userId: request.user?.id,
      path: new URL(request.url).pathname,
    }),
  });
}

/**
 * Log security event
 * @param {string} eventType
 * @param {object} details
 * @param {Request} request
 */
export function logSecurityEvent(eventType, details = {}, request = null) {
  logger.warn(`Security: ${eventType}`, {
    securityEvent: eventType,
    ...details,
    ...(request && {
      requestId: request.headers?.get('x-request-id'),
      userId: request.user?.id,
      ip: request.headers?.get('x-forwarded-for'),
    }),
  });
}

/**
 * Log performance metric
 * @param {string} operation
 * @param {number} duration
 * @param {object} metadata
 */
export function logPerformance(operation, duration, metadata = {}) {
  const level = duration > 1000 ? 'warn' : duration > 500 ? 'info' : 'debug';
  
  logger.log(level, `Performance: ${operation}`, {
    operation,
    duration: `${duration}ms`,
    ...metadata,
  });
}

export default logger;

