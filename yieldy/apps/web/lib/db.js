/**
 * Database Connection Wrapper for Vercel Serverless
 * Handles connection pooling and serverless edge cases
 */

import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// Configure for serverless
neonConfig.fetchConnectionCache = true;

// Connection pool for traditional queries
let pool;
let httpClient;

/**
 * Get or create connection pool
 * Uses connection pooling for serverless functions
 */
export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10, // Vercel serverless limit
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
      pool = null; // Reset pool on error
    });
  }

  return pool;
}

/**
 * Get or create HTTP client for edge runtime
 * Neon's HTTP client works in edge functions
 */
export function getHttpClient() {
  if (!httpClient) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    httpClient = neon(process.env.DATABASE_URL);
  }

  return httpClient;
}

/**
 * Execute SQL query with automatic retry
 * @param {string} query - SQL query (use template literals)
 * @param {array} params - Query parameters
 * @param {object} options - Execution options
 * @returns {Promise<any>} Query results
 */
export async function executeQuery(query, params = [], options = {}) {
  const { retry = 3, useHttp = false } = options;
  let lastError;

  for (let attempt = 1; attempt <= retry; attempt++) {
    try {
      if (useHttp) {
        // Use HTTP client for edge runtime
        const sql = getHttpClient();
        return await sql(query, params);
      } else {
        // Use connection pool for Node.js runtime
        const pool = getPool();
        const result = await pool.query(query, params);
        return result.rows;
      }
    } catch (error) {
      lastError = error;
      
      // Log attempt
      console.error(`Query attempt ${attempt}/${retry} failed:`, error.message);

      // Don't retry on certain errors
      if (
        error.code === '23505' || // Unique violation
        error.code === '23503' || // Foreign key violation
        error.code === '42P01'    // Undefined table
      ) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      if (attempt < retry) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }

  throw lastError;
}

/**
 * Transaction wrapper for serverless
 * @param {Function} callback - Async function to execute in transaction
 * @returns {Promise<any>} Transaction result
 */
export async function transaction(callback) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Health check for database connection
 * @returns {Promise<boolean>} True if connected
 */
export async function healthCheck() {
  try {
    const sql = getHttpClient();
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Close all connections (for cleanup)
 * Call this in graceful shutdown
 */
export async function closeConnections() {
  if (pool) {
    await pool.end();
    pool = null;
  }
  httpClient = null;
}

/**
 * Drizzle ORM instance (if using Drizzle)
 * Lazy initialization
 */
let drizzleDb;
export function getDrizzle() {
  if (!drizzleDb) {
    const sql = getHttpClient();
    drizzleDb = drizzle(sql);
  }
  return drizzleDb;
}

/**
 * Template tag for SQL queries (for use with neon client)
 * Similar to the one in utils/sql.js but with error handling
 */
export function sql(strings, ...values) {
  const client = getHttpClient();
  return client(strings, ...values);
}

// Default export for backward compatibility
export default sql;

