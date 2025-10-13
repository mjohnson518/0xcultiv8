import { neon, neonConfig } from '@neondatabase/serverless';

// Configure connection pooling for better performance
neonConfig.fetchConnectionCache = true;

// Connection pool configuration
const poolConfig = {
  // Maximum number of connections in the pool
  // Neon serverless auto-scales, but we can hint preferred size
  poolSize: parseInt(process.env.DB_POOL_SIZE) || 20,
  
  // Connection timeout
  connectionTimeoutMillis: 5000,
  
  // Idle timeout
  idleTimeoutMillis: 30000,
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