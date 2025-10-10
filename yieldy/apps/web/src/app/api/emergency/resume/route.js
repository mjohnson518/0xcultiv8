import { circuitBreaker } from '@/app/api/utils/circuitBreaker';
import { requireAdmin } from '@/app/api/middleware/auth';
import { rateLimitMiddleware } from '@/app/api/middleware/rateLimit';

/**
 * Resume operations endpoint
 * POST /api/emergency/resume
 * Admin only - resumes agent operations after emergency pause
 */
export async function POST(request) {
  // Admin authentication required
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;

  // Rate limiting
  const rateLimitError = await rateLimitMiddleware(request, 'config');
  if (rateLimitError) return rateLimitError;

  try {
    // Check if currently paused
    const status = await circuitBreaker.isTripped();

    if (!status.isPaused) {
      return Response.json({
        success: false,
        message: 'Agent is not currently paused',
      }, { status: 400 });
    }

    // Reset the circuit breaker
    await circuitBreaker.reset(request.user?.id || 'admin');

    return Response.json({
      success: true,
      message: 'Agent operations resumed',
      resumedAt: new Date().toISOString(),
      previousReason: status.reason,
    });
  } catch (error) {
    console.error('Error resuming operations:', error);
    return Response.json(
      {
        success: false,
        error: 'Failed to resume operations',
      },
      { status: 500 }
    );
  }
}

