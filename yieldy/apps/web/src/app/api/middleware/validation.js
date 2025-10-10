import { ZodError } from 'zod';

/**
 * Validation middleware factory
 * Creates middleware that validates request body against a Zod schema
 * @param {ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Middleware function that validates and adds validated data to request
 */
export function validateRequest(schema) {
  return async (request) => {
    try {
      // Parse request body
      let body;
      try {
        body = await request.json();
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Invalid JSON',
            message: 'Request body must be valid JSON',
            details: error.message
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Validate against schema
      const validated = schema.parse(body);

      // Attach validated data to request for use in route handler
      request.validated = validated;

      return null; // No error, proceed
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod validation errors into user-friendly messages
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return new Response(
          JSON.stringify({
            error: 'Validation failed',
            message: 'Request data does not meet requirements',
            details: formattedErrors
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Unknown error
      console.error('Validation middleware error:', error);
      return new Response(
        JSON.stringify({
          error: 'Validation error',
          message: 'An unexpected error occurred during validation'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}

/**
 * Validation middleware for query parameters
 * @param {ZodSchema} schema - Zod schema for query params
 * @returns {Function} Middleware function
 */
export function validateQuery(schema) {
  return async (request) => {
    try {
      const { searchParams } = new URL(request.url);

      // Convert URLSearchParams to object
      const queryObject = {};
      for (const [key, value] of searchParams.entries()) {
        queryObject[key] = value;
      }

      // Validate
      const validated = schema.parse(queryObject);
      request.validatedQuery = validated;

      return null;
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          parameter: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return new Response(
          JSON.stringify({
            error: 'Invalid query parameters',
            message: 'Query parameters do not meet requirements',
            details: formattedErrors
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      console.error('Query validation error:', error);
      return new Response(
        JSON.stringify({
          error: 'Validation error',
          message: 'An unexpected error occurred during query validation'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}

/**
 * Sanitize SQL inputs to prevent injection
 * Note: We're using tagged template literals which are safe,
 * but this provides extra protection for dynamic queries
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
export function sanitizeSQLInput(input) {
  if (typeof input !== 'string') return input;

  // Remove potentially dangerous SQL characters and keywords
  return input
    .replace(/['";]/g, '') // Remove quotes and semicolons
    .replace(/(-{2}|\/\*|\*\/)/g, '') // Remove comment markers
    .replace(/\b(DROP|DELETE|TRUNCATE|ALTER|EXEC|EXECUTE)\b/gi, '') // Remove dangerous keywords
    .trim();
}

/**
 * Validate and sanitize numeric input
 * @param {any} value - Value to validate
 * @param {object} options - Validation options
 * @returns {number} Validated number
 * @throws {Error} If validation fails
 */
export function validateNumber(value, options = {}) {
  const {
    min = -Infinity,
    max = Infinity,
    integer = false,
    positive = false
  } = options;

  const num = Number(value);

  if (!Number.isFinite(num)) {
    throw new Error('Value must be a valid number');
  }

  if (positive && num <= 0) {
    throw new Error('Value must be positive');
  }

  if (num < min) {
    throw new Error(`Value must be at least ${min}`);
  }

  if (num > max) {
    throw new Error(`Value must be at most ${max}`);
  }

  if (integer && !Number.isInteger(num)) {
    throw new Error('Value must be an integer');
  }

  return num;
}

/**
 * Validate blockchain parameter
 * @param {string} blockchain
 * @returns {string} Validated blockchain
 * @throws {Error} If invalid
 */
export function validateBlockchain(blockchain) {
  const valid = ['ethereum', 'base'];
  
  if (!valid.includes(blockchain?.toLowerCase())) {
    throw new Error(`Invalid blockchain. Must be one of: ${valid.join(', ')}`);
  }

  return blockchain.toLowerCase();
}

