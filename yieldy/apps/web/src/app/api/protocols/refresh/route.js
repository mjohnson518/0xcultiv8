import { fetchAllProtocolData } from '../adapters';
import { rateLimitMiddleware } from '@/app/api/middleware/rateLimit';
import { authMiddleware } from '@/app/api/middleware/auth';

/**
 * Refresh protocol data from on-chain sources
 * GET /api/protocols/refresh?chain=ethereum
 */
export async function GET(request) {
  // Authentication required
  const authError = await authMiddleware(request);
  if (authError) return authError;

  // Rate limiting
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain') || 'ethereum';

    if (!['ethereum', 'base'].includes(chain)) {
      return Response.json(
        { error: 'Invalid chain. Must be ethereum or base' },
        { status: 400 }
      );
    }

    const data = await fetchAllProtocolData(chain);

    return Response.json({
      success: true,
      chain,
      protocols: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error refreshing protocol data:', error);
    return Response.json(
      { error: 'Failed to refresh protocol data' },
      { status: 500 }
    );
  }
}

