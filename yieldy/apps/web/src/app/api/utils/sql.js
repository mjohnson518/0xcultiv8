import { neon, neonConfig } from '@neondatabase/serverless';

// Configure connection pooling for better performance
neonConfig.fetchConnectionCache = true;

// Connection pool configuration
const poolConfig = {
  // Maximum number of connections in the pool
  // Neon serverless auto-scales, but we can hint preferred size
  poolSize: parseInt(process.env.DB_POOL_SIZE) || 20,

  // Connection timeout - how long to wait for a connection
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,

  // Idle timeout - how long a connection can be idle before being closed
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,

  // Query timeout - maximum time a query can run (prevents hanging queries)
  // This is critical for production stability
  queryTimeoutMillis: parseInt(process.env.DB_QUERY_TIMEOUT) || 15000,
};

const NullishQueryFunction = () => {
  throw new Error(
    'No database connection string was provided to `neon()`. Perhaps process.env.DATABASE_URL has not been set'
  );
};
NullishQueryFunction.transaction = () => {
  throw new Error(
    'No database connection string was provided to `neon()`. Perhaps process.env.DATABASE_URL has not been set'
  );
};

// Initialize Neon with pooling
const sql = process.env.DATABASE_URL 
  ? neon(process.env.DATABASE_URL, poolConfig) 
  : NullishQueryFunction;

export default sql;