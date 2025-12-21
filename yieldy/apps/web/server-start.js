/**
 * Production Server Entry Point
 *
 * The react-router-hono-server package automatically starts the server
 * when createHonoServer is called in production mode.
 * This file just imports the build output to trigger that.
 */

console.log('🚀 Starting Cultiv8...');
console.log(`Environment: NODE_ENV=${process.env.NODE_ENV}`);
console.log(`Port: ${process.env.PORT || 8080}`);
console.log(`Database configured: ${!!process.env.DATABASE_URL}`);

try {
  // Importing this module triggers createHonoServer which starts the server
  await import('./build/server/index.js');
  console.log('✅ Server module loaded successfully');
} catch (error) {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}

