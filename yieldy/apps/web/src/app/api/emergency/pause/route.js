import { circuitBreaker } from '@/app/api/utils/circuitBreaker';
import { requireAdmin } from '@/app/api/middleware/auth';
import { rateLimitMiddleware } from '@/app/api/middleware/rateLimit';

/**
 * Emergency pause endpoint
 * POST /api/emergency/pause
 * Admin only - immediately halts all agent operations
 */
export async function POST(request) {
  // Admin authentication required
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;

  // Rate limiting
  const rateLimitError = await rateLimitMiddleware(request, 'config');
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json().catch(() => ({}));
    const { reason = 'Manual emergency pause by admin' } = body;

    // Trip the circuit breaker
    await circuitBreaker.trip(reason, {
      triggeredBy: request.user?.id || 'admin',
      manual: true,
    });

    return Response.json({
      success: true,
      message: 'Emergency pause activated',
      pausedAt: new Date().toISOString(),
      reason,
    });
  } catch (error) {
    console.error('Error triggering emergency pause:', error);
    return Response.json(
      {
        success: false,
        error: 'Failed to activate emergency pause',
      },
      { status: 500 }
    );
  }
}

/**
 * Get current emergency pause status
 * GET /api/emergency/pause
 */
export async function GET(request) {
  // Admin authentication required
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;

  try {
    const status = await circuitBreaker.isTripped();
    const stats = circuitBreaker.getStats();

    return Response.json({
      success: true,
      status,
      failureStats: stats,
    });
  } catch (error) {
    console.error('Error checking emergency status:', error);
    return Response.json(
      {
        success: false,
        error: 'Failed to check emergency status',
      },
      { status: 500 }
    );
  }
}

