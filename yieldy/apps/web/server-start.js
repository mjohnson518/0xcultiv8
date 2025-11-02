/**
 * Production Server Entry Point
 * Starts the Hono server directly without react-router-serve CLI
 */

import { serve } from '@hono/node-server';

// Import the built server
const { default: app } = await import('./build/server/index.js');

const port = parseInt(process.env.PORT || '8080', 10);

console.log(`🚀 Starting Cultiv8 server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`✅ Server running at http://localhost:${info.port}`);
});

