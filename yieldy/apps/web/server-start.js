/**
 * Production Server Entry Point
 * Starts the Hono server directly
 */

// Import the built server module
const serverModule = await import('./build/server/index.js');

// The server is already created and listening
// This file just ensures the process stays alive
console.log('✅ Cultiv8 server module loaded');

// Keep process alive
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

