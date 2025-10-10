import sql from '@/app/api/utils/sql';
import Redis from 'ioredis';
import { ethers } from 'ethers';

/**
 * Health Check Endpoint
 * GET /api/health
 * Returns detailed health status of all system components
 */
export async function GET(request) {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {},
  };

  // Check database
  checks.checks.database = await checkDatabase();

  // Check Redis
  checks.checks.redis = await checkRedis();

  // Check RPC endpoints
  checks.checks.ethereum_rpc = await checkRPC(process.env.ETHEREUM_RPC_URL, 'ethereum');
  checks.checks.base_rpc = await checkRPC(process.env.BASE_RPC_URL, 'base');

  // Overall status
  const allHealthy = Object.values(checks.checks).every(check => check.status === 'healthy');
  checks.status = allHealthy ? 'healthy' : 'degraded';

  const statusCode = allHealthy ? 200 : 503;

  return Response.json(checks, { status: statusCode });
}

async function checkDatabase() {
  try {
    const start = Date.now();
    await sql`SELECT 1 as health_check`;
    const duration = Date.now() - start;

    return {
      status: 'healthy',
      latency: `${duration}ms`,
      message: 'Database connection OK',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      message: 'Database connection failed',
    };
  }
}

async function checkRedis() {
  try {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });

    const start = Date.now();
    await redis.ping();
    const duration = Date.now() - start;

    redis.disconnect();

    return {
      status: 'healthy',
      latency: `${duration}ms`,
      message: 'Redis connection OK',
    };
  } catch (error) {
    return {
      status: 'degraded',
      error: error.message,
      message: 'Redis unavailable - using memory fallback',
    };
  }
}

async function checkRPC(rpcUrl, chain) {
  if (!rpcUrl) {
    return {
      status: 'unconfigured',
      message: `${chain} RPC URL not configured`,
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const start = Date.now();
    const blockNumber = await provider.getBlockNumber();
    const duration = Date.now() - start;

    return {
      status: 'healthy',
      latency: `${duration}ms`,
      blockNumber,
      message: `${chain} RPC OK`,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      message: `${chain} RPC connection failed`,
    };
  }
}

