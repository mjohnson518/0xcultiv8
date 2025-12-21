/**
 * Robust Fetch Utility with Timeout and Retry Logic
 *
 * Features:
 * - Request timeout using AbortController
 * - Exponential backoff retry for transient failures
 * - Configurable retry conditions
 * - Request/response logging hooks
 */

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000, // 1 second initial delay
  retryBackoffMultiplier: 2,
  retryMaxDelay: 30000, // 30 seconds max delay
  retryStatusCodes: [408, 429, 500, 502, 503, 504], // Retryable HTTP status codes
  onRetry: null, // Callback: (attempt, error, delay) => void
};

/**
 * Custom error class for timeout errors
 */
export class TimeoutError extends Error {
  constructor(timeout) {
    super(`Request timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

/**
 * Custom error class for max retries exceeded
 */
export class MaxRetriesError extends Error {
  constructor(attempts, lastError) {
    super(`Max retries (${attempts}) exceeded`);
    this.name = 'MaxRetriesError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * Fetch with timeout using AbortController
 * @param {string} url - Request URL
 * @param {RequestInit} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_CONFIG.timeout) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new TimeoutError(timeout);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Calculate delay for exponential backoff
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} multiplier - Backoff multiplier
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {number} - Delay in milliseconds
 */
function calculateBackoffDelay(attempt, baseDelay, multiplier, maxDelay) {
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 + 0.85; // 0.85 - 1.15
  const delay = Math.min(baseDelay * Math.pow(multiplier, attempt) * jitter, maxDelay);
  return Math.round(delay);
}

/**
 * Check if error is retryable
 * @param {Error} error - The error to check
 * @param {Response} response - The response (if available)
 * @param {number[]} retryStatusCodes - Status codes to retry
 * @returns {boolean}
 */
function isRetryableError(error, response, retryStatusCodes) {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Timeout errors are retryable
  if (error instanceof TimeoutError) {
    return true;
  }

  // Check response status code
  if (response && retryStatusCodes.includes(response.status)) {
    return true;
  }

  return false;
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry and exponential backoff
 * @param {string} url - Request URL
 * @param {RequestInit & { retryConfig?: Partial<typeof DEFAULT_CONFIG> }} options - Fetch options with optional retry config
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}) {
  const {
    retryConfig = {},
    ...fetchOptions
  } = options;

  const config = { ...DEFAULT_CONFIG, ...retryConfig };
  const {
    timeout,
    retries,
    retryDelay,
    retryBackoffMultiplier,
    retryMaxDelay,
    retryStatusCodes,
    onRetry,
  } = config;

  let lastError = null;
  let lastResponse = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions, timeout);
      lastResponse = response;

      // Check if response indicates a retryable error
      if (!response.ok && isRetryableError(null, response, retryStatusCodes)) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        lastError = error;

        if (attempt < retries) {
          const delay = calculateBackoffDelay(attempt, retryDelay, retryBackoffMultiplier, retryMaxDelay);

          if (onRetry) {
            onRetry(attempt + 1, error, delay);
          }

          await sleep(delay);
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt < retries && isRetryableError(error, lastResponse, retryStatusCodes)) {
        const delay = calculateBackoffDelay(attempt, retryDelay, retryBackoffMultiplier, retryMaxDelay);

        if (onRetry) {
          onRetry(attempt + 1, error, delay);
        }

        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  // Should not reach here, but handle edge case
  throw new MaxRetriesError(retries, lastError);
}

/**
 * Convenience wrapper for JSON POST requests with retry
 * @param {string} url - Request URL
 * @param {object} data - JSON body
 * @param {object} options - Additional options
 * @returns {Promise<{ response: Response, data: any }>}
 */
export async function postJsonWithRetry(url, data, options = {}) {
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
    ...options,
  });

  const responseData = await response.json();
  return { response, data: responseData };
}

/**
 * Convenience wrapper for GET requests with retry
 * @param {string} url - Request URL
 * @param {object} options - Additional options
 * @returns {Promise<{ response: Response, data: any }>}
 */
export async function getJsonWithRetry(url, options = {}) {
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const responseData = await response.json();
  return { response, data: responseData };
}
