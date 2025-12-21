/**
 * Production Server Entry Point
 *
 * We bypass react-router-hono-server (which hangs in Docker) and serve the Hono app directly.
 * This provides the API endpoints. The frontend is served separately.
 */

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

const port = parseInt(process.env.PORT || '8080', 10);

console.log('🚀 Starting Cultiv8 API Server...');
console.log(`Environment: NODE_ENV=${process.env.NODE_ENV}`);
console.log(`Port: ${port}`);
console.log(`Database configured: ${!!process.env.DATABASE_URL}`);

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('Importing Hono app...');

try {
  // Import the Hono app (now exports directly without createHonoServer wrapper)
  const module = await import('./build/server/index.js');
  const app = module.default;

  console.log('✅ App imported successfully');
  console.log(`App type: ${typeof app}`);
  console.log(`App has fetch: ${typeof app?.fetch === 'function'}`);

  if (app && typeof app.fetch === 'function') {
    // Add static file serving for client assets
    app.use('/assets/*', serveStatic({ root: './build/client' }));
    app.use('/*', serveStatic({ root: './build/client' }));

    console.log('Starting server...');

    const server = serve({
      fetch: app.fetch,
      port,
      hostname: '0.0.0.0',
    }, (info) => {
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log(`✅ Cultiv8 API Server is LIVE!`);
      console.log(`🌍 http://0.0.0.0:${info.port}`);
      console.log('═══════════════════════════════════════');
      console.log('');
    });

    server.on('error', (err) => {
      console.error('Server error:', err);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down...');
      server.close(() => process.exit(0));
    });
  } else {
    console.error('❌ App does not have fetch method');
    console.log('App:', app);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Failed to start:', error);
  process.exit(1);
}

