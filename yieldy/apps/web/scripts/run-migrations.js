#!/usr/bin/env node

/**
 * Database Migration Runner
 *
 * Runs SQL migrations in order against the configured database.
 * Tracks applied migrations to prevent re-running.
 *
 * Usage:
 *   node scripts/run-migrations.js [--dry-run] [--force]
 *
 * Options:
 *   --dry-run  Show what would be executed without running
 *   --force    Re-run all migrations (use with caution!)
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

// Database connection
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  ssl: DATABASE_URL.includes('neon.tech') ? 'require' : false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 30,
});

/**
 * Ensure migrations tracking table exists
 */
async function ensureMigrationsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW(),
      checksum VARCHAR(64)
    )
  `;
  console.log('✓ Migrations table ready');
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations() {
  const result = await sql`
    SELECT filename FROM schema_migrations ORDER BY filename
  `;
  return new Set(result.map(r => r.filename));
}

/**
 * Get list of pending migrations
 */
async function getPendingMigrations(appliedSet) {
  const files = await readdir(MIGRATIONS_DIR);
  const sqlFiles = files
    .filter(f => f.endsWith('.sql'))
    .sort();

  return sqlFiles.filter(f => !appliedSet.has(f));
}

/**
 * Calculate simple checksum for a file
 */
function calculateChecksum(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Run a single migration
 */
async function runMigration(filename) {
  const filepath = join(MIGRATIONS_DIR, filename);
  const content = await readFile(filepath, 'utf-8');
  const checksum = calculateChecksum(content);

  console.log(`\n→ Running: ${filename}`);

  if (DRY_RUN) {
    console.log('  [DRY RUN] Would execute:');
    console.log('  ' + content.slice(0, 200).replace(/\n/g, '\n  ') + '...');
    return;
  }

  try {
    // Run migration in a transaction
    await sql.begin(async (tx) => {
      // Execute the migration SQL
      await tx.unsafe(content);

      // Record the migration
      await tx`
        INSERT INTO schema_migrations (filename, checksum)
        VALUES (${filename}, ${checksum})
      `;
    });

    console.log(`  ✓ Success`);
  } catch (error) {
    console.error(`  ✗ Failed: ${error.message}`);
    throw error;
  }
}

/**
 * Main migration runner
 */
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  Cultiv8 Database Migration Runner');
  console.log('═══════════════════════════════════════════');
  console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`Force: ${FORCE ? 'YES' : 'NO'}`);
  console.log('');

  try {
    // Ensure migrations table exists
    await ensureMigrationsTable();

    // Get applied and pending migrations
    let appliedSet = await getAppliedMigrations();

    if (FORCE) {
      console.log('\n⚠️  FORCE mode: Clearing migration history...');
      if (!DRY_RUN) {
        await sql`TRUNCATE schema_migrations`;
      }
      appliedSet = new Set();
    }

    const pending = await getPendingMigrations(appliedSet);

    console.log(`\nApplied migrations: ${appliedSet.size}`);
    console.log(`Pending migrations: ${pending.length}`);

    if (pending.length === 0) {
      console.log('\n✓ Database is up to date!');
      return;
    }

    console.log('\nPending migrations:');
    pending.forEach(f => console.log(`  - ${f}`));

    // Run each pending migration
    for (const filename of pending) {
      await runMigration(filename);
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('  All migrations completed successfully!');
    console.log('═══════════════════════════════════════════');

  } catch (error) {
    console.error('\n═══════════════════════════════════════════');
    console.error('  Migration failed!');
    console.error('═══════════════════════════════════════════');
    console.error(error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run
main();
