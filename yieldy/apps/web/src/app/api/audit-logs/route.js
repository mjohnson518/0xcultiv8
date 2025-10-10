import { queryAuditLogs, getUserAuditStats } from '@/app/api/utils/auditLogger';
import { requireAdmin } from '@/app/api/middleware/auth';
import { rateLimitMiddleware } from '@/app/api/middleware/rateLimit';

/**
 * Query audit logs
 * GET /api/audit-logs?user_id=...&action=...&limit=100
 * Admin only endpoint
 */
export async function GET(request) {
  // Admin authentication required
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;

  // Rate limiting
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      user_id: searchParams.get('user_id'),
      action: searchParams.get('action'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      success: searchParams.get('success') === 'true' ? true : 
               searchParams.get('success') === 'false' ? false : undefined,
      limit: parseInt(searchParams.get('limit') || '100'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const logs = await queryAuditLogs(filters);

    // If querying for specific user, include stats
    let stats = null;
    if (filters.user_id) {
      stats = await getUserAuditStats(filters.user_id);
    }

    return Response.json({
      success: true,
      logs,
      stats,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        hasMore: logs.length === filters.limit,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return Response.json(
      {
        success: false,
        error: 'Failed to fetch audit logs',
      },
      { status: 500 }
    );
  }
}

