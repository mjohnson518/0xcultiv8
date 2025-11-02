/**
 * Production Server Entry Point
 * Starts the Hono server
 */

import { serve } from '@hono/node-server';

// Import the built Hono app
const { default: app } = await import('./build/server/index.js');

const port = parseInt(process.env.PORT || '8080', 10);

console.log(`🚀 Starting Cultiv8 on port ${port}...`);

// Start the server
serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`✅ Cultiv8 live at http://localhost:${info.port}`);
});

