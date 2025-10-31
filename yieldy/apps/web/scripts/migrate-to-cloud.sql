-- Cultiv8 Cloud Database Migration Script
-- Runs all migrations in order for fresh cloud database

-- ============================================================================
-- MIGRATION 001: Add Indexes
-- ============================================================================
\echo 'Running migration 001: Add indexes...'
\i migrations/001_add_indexes.sql
\echo 'Migration 001 complete ✓'
\echo ''

-- ============================================================================
-- MIGRATION 002: Rename Tables
-- ============================================================================
\echo 'Running migration 002: Rename tables...'
\i migrations/002_rename_tables.sql
\echo 'Migration 002 complete ✓'
\echo ''

-- ============================================================================
-- MIGRATION 003: Agent Decisions
-- ============================================================================
\echo 'Running migration 003: Agent decisions...'
\i migrations/003_agent_decisions.sql
\echo 'Migration 003 complete ✓'
\echo ''

-- ============================================================================
-- MIGRATION 004: Fee Tiers
-- ============================================================================
\echo 'Running migration 004: Fee tiers and revenue tracking...'
\i migrations/004_add_fee_tiers.sql
\echo 'Migration 004 complete ✓'
\echo ''

-- ============================================================================
-- Verify Tables Created
-- ============================================================================
\echo 'Verifying tables...'

SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

\echo ''
\echo 'Verifying indexes...'

SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

\echo ''
\echo '════════════════════════════════════════════════════════════'
\echo 'ALL MIGRATIONS COMPLETE ✓'
\echo '════════════════════════════════════════════════════════════'
\echo ''
\echo 'Next steps:'
\echo '  1. Verify all tables exist'
\echo '  2. Check indexes are created'
\echo '  3. Insert initial agent config (if needed)'
\echo '  4. Test database connection from application'
\echo ''

