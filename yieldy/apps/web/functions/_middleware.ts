/**
 * Cloudflare Pages Functions Middleware
 *
 * Proxies /api/* requests to the Railway backend since _redirects
 * files cannot proxy to external URLs in Cloudflare Pages.
 */

interface Env {
  BACKEND_URL?: string;
}

const BACKEND_URL = 'https://cultiv8-web-production.up.railway.app';

// Headers to forward from the original request
const FORWARDED_HEADERS = [
  'content-type',
  'authorization',
  'cookie',
  'x-request-id',
  'x-correlation-id',
  'accept',
  'accept-language',
  'user-agent',
];

// Headers to exclude from the proxied response
const EXCLUDED_RESPONSE_HEADERS = [
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
];

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  // Only proxy /api/* requests
  if (!url.pathname.startsWith('/api/')) {
    return context.next();
  }

  const backendBaseUrl = context.env.BACKEND_URL || BACKEND_URL;
  const backendUrl = `${backendBaseUrl}${url.pathname}${url.search}`;

  try {
    // Build headers to forward
    const headers = new Headers();

    for (const headerName of FORWARDED_HEADERS) {
      const value = context.request.headers.get(headerName);
      if (value) {
        headers.set(headerName, value);
      }
    }

    // Add forwarding headers
    headers.set('X-Forwarded-For', context.request.headers.get('cf-connecting-ip') || '');
    headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
    headers.set('X-Forwarded-Host', url.host);
    headers.set('X-Original-URL', context.request.url);

    // Make the proxied request
    const proxyRequest: RequestInit = {
      method: context.request.method,
      headers,
    };

    // Forward body for non-GET/HEAD requests
    if (!['GET', 'HEAD'].includes(context.request.method)) {
      proxyRequest.body = context.request.body;
      // @ts-ignore - duplex is valid but not in types
      proxyRequest.duplex = 'half';
    }

    const response = await fetch(backendUrl, proxyRequest);

    // Build response headers
    const responseHeaders = new Headers();

    response.headers.forEach((value, key) => {
      if (!EXCLUDED_RESPONSE_HEADERS.includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // Add CORS headers for the frontend origin
    const origin = context.request.headers.get('origin');
    if (origin) {
      responseHeaders.set('Access-Control-Allow-Origin', origin);
      responseHeaders.set('Access-Control-Allow-Credentials', 'true');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Correlation-ID');
      responseHeaders.set('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After');
    }

    // Handle preflight requests
    if (context.request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: responseHeaders,
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Proxy error:', error);

    return new Response(
      JSON.stringify({
        error: 'Proxy Error',
        message: 'Failed to connect to backend service',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
