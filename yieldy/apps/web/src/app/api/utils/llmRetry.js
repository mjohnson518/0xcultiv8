/**
 * LLM API Retry and Fallback Utilities
 *
 * Provides robust retry logic with exponential backoff for LLM API calls
 * and fallback mechanisms between different LLM providers.
 *
 * @module llmRetry
 */

import { log } from './logger.js';

/**
 * Retry configuration for LLM calls
 */
const LLM_RETRY_CONFIG = {
  maxRetries: parseInt(process.env.LLM_MAX_RETRIES) || 3,
  initialDelayMs: parseInt(process.env.LLM_INITIAL_DELAY_MS) || 1000,
  maxDelayMs: parseInt(process.env.LLM_MAX_DELAY_MS) || 30000,
  backoffMultiplier: 2,
  timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS) || 60000,
};

/**
 * Error types that should trigger a retry
 */
const RETRYABLE_ERROR_TYPES = [
  'rate_limit_error',
  'overloaded_error',
  'timeout',
  'service_unavailable',
  'internal_error',
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
];

/**
 * Error types that should NOT trigger a retry
 */
const NON_RETRYABLE_ERROR_TYPES = [
  'invalid_api_key',
  'invalid_request_error',
  'authentication_error',
  'permission_error',
  'not_found_error',
];

/**
 * Sleep helper for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean} - True if should retry
 */
function isRetryableError(error) {
  // Check for explicit non-retryable errors
  if (NON_RETRYABLE_ERROR_TYPES.some(type =>
    error.message?.toLowerCase().includes(type) ||
    error.type?.toLowerCase().includes(type) ||
    error.code?.toLowerCase().includes(type)
  )) {
    return false;
  }

  // Check for retryable error types
  if (RETRYABLE_ERROR_TYPES.some(type =>
    error.message?.toLowerCase().includes(type) ||
    error.type?.toLowerCase().includes(type) ||
    error.code?.toLowerCase().includes(type) ||
    error.code === type
  )) {
    return true;
  }

  // Check HTTP status codes
  const status = error.status || error.statusCode;
  if (status) {
    // 429 (rate limit), 500, 502, 503, 504 are retryable
    if ([429, 500, 502, 503, 504].includes(status)) {
      return true;
    }
    // 4xx errors (except 429) are not retryable
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  // Default: retry on unknown errors
  return true;
}

/**
 * Get delay for retry, checking for Retry-After header
 * @param {Error} error - Error that caused retry
 * @param {number} baseDelay - Base delay in ms
 * @returns {number} - Delay in ms
 */
function getRetryDelay(error, baseDelay) {
  // Check for rate limit retry-after
  if (error.headers?.['retry-after']) {
    const retryAfter = parseInt(error.headers['retry-after']);
    if (!isNaN(retryAfter)) {
      return retryAfter * 1000; // Convert seconds to ms
    }
  }

  // Check for Anthropic's specific rate limit headers
  if (error.headers?.['x-ratelimit-reset-tokens']) {
    const resetTime = parseInt(error.headers['x-ratelimit-reset-tokens']);
    if (!isNaN(resetTime)) {
      return Math.max(resetTime * 1000, baseDelay);
    }
  }

  return baseDelay;
}

/**
 * Execute an LLM call with retry and exponential backoff
 *
 * @param {Function} fn - Async function to execute
 * @param {object} options - Configuration options
 * @returns {Promise<any>} - Result of the function
 */
export async function withLLMRetry(fn, options = {}) {
  const {
    maxRetries = LLM_RETRY_CONFIG.maxRetries,
    initialDelayMs = LLM_RETRY_CONFIG.initialDelayMs,
    maxDelayMs = LLM_RETRY_CONFIG.maxDelayMs,
    backoffMultiplier = LLM_RETRY_CONFIG.backoffMultiplier,
    timeoutMs = LLM_RETRY_CONFIG.timeoutMs,
    onRetry = null,
    operationName = 'LLM call',
  } = options;

  let lastError;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add timeout wrapper
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('LLM call timeout')), timeoutMs)
        ),
      ]);

      // Log success on retry
      if (attempt > 0) {
        log.info(`${operationName} succeeded after ${attempt} retries`);
      }

      return result;
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error)) {
        log.error(`${operationName} failed with non-retryable error`, {
          error: error.message,
          type: error.type,
          attempt,
        });
        throw error;
      }

      if (attempt < maxRetries) {
        const actualDelay = getRetryDelay(error, delay);

        log.warn(`${operationName} failed, retrying`, {
          attempt: attempt + 1,
          maxRetries,
          error: error.message,
          delayMs: actualDelay,
        });

        if (onRetry) {
          onRetry(attempt + 1, error, actualDelay);
        }

        await sleep(actualDelay);
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
  }

  log.error(`${operationName} failed after ${maxRetries} retries`, {
    error: lastError.message,
  });

  throw lastError;
}

/**
 * LLM Provider Fallback Configuration
 */
const LLM_FALLBACK_ORDER = [
  { name: 'claude', envKey: 'ANTHROPIC_API_KEY' },
  { name: 'openai', envKey: 'OPENAI_API_KEY' },
];

/**
 * Execute an LLM call with provider fallback
 * Tries primary provider, falls back to secondary on failure
 *
 * @param {object} providers - Map of provider name to call function
 * @param {object} options - Configuration options
 * @returns {Promise<any>} - Result from first successful provider
 */
export async function withLLMFallback(providers, options = {}) {
  const {
    preferredProvider = null,
    operationName = 'LLM call',
    ...retryOptions
  } = options;

  // Determine provider order
  let providerOrder = [...LLM_FALLBACK_ORDER];

  // Move preferred provider to front if specified
  if (preferredProvider) {
    const preferred = providerOrder.find(p => p.name === preferredProvider);
    if (preferred) {
      providerOrder = [preferred, ...providerOrder.filter(p => p.name !== preferredProvider)];
    }
  }

  // Filter to only available providers
  providerOrder = providerOrder.filter(p =>
    process.env[p.envKey] && providers[p.name]
  );

  if (providerOrder.length === 0) {
    throw new Error('No LLM providers configured');
  }

  let lastError;

  for (const provider of providerOrder) {
    try {
      log.debug(`Attempting ${operationName} with ${provider.name}`);

      const result = await withLLMRetry(
        () => providers[provider.name](),
        {
          ...retryOptions,
          operationName: `${operationName} (${provider.name})`,
        }
      );

      return { result, provider: provider.name };
    } catch (error) {
      lastError = error;
      log.warn(`${provider.name} failed for ${operationName}`, {
        error: error.message,
      });

      // Continue to next provider
    }
  }

  log.error(`All providers failed for ${operationName}`);
  throw lastError;
}

/**
 * Create a Claude client call with retry
 * @param {object} client - Anthropic client
 * @param {object} params - Call parameters
 * @param {object} options - Retry options
 * @returns {Promise<any>} - API response
 */
export async function callClaudeWithRetry(client, params, options = {}) {
  return withLLMRetry(
    () => client.messages.create(params),
    {
      operationName: 'Claude API call',
      ...options,
    }
  );
}

/**
 * Create an OpenAI client call with retry
 * @param {object} client - OpenAI client
 * @param {object} params - Call parameters
 * @param {object} options - Retry options
 * @returns {Promise<any>} - API response
 */
export async function callOpenAIWithRetry(client, params, options = {}) {
  return withLLMRetry(
    () => client.chat.completions.create(params),
    {
      operationName: 'OpenAI API call',
      ...options,
    }
  );
}

/**
 * Wrap a LangChain model invoke with retry
 * @param {object} model - LangChain model instance
 * @param {any} input - Model input
 * @param {object} options - Retry options
 * @returns {Promise<any>} - Model response
 */
export async function invokeLangChainWithRetry(model, input, options = {}) {
  return withLLMRetry(
    () => model.invoke(input),
    {
      operationName: 'LangChain model invoke',
      ...options,
    }
  );
}

export default {
  withLLMRetry,
  withLLMFallback,
  callClaudeWithRetry,
  callOpenAIWithRetry,
  invokeLangChainWithRetry,
  isRetryableError,
};
