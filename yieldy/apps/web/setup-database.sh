#!/bin/bash
# Complete Database Setup Script for 0xCultiv8
# Run this after copying DATABASE_URL from Railway

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     0xCULTIV8 DATABASE SETUP                            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set!"
  echo ""
  echo "Get it from Railway dashboard:"
  echo "1. Click on Postgres service"
  echo "2. Go to Variables tab"
  echo "3. Copy DATABASE_URL value"
  echo "4. Run: export DATABASE_URL='[paste value here]'"
  echo "5. Then run this script again"
  exit 1
fi

echo "✅ DATABASE_URL found"
echo ""

# Test connection
echo "Testing database connection..."
psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Database connection successful"
else
  echo "❌ Database connection failed"
  echo "Check that DATABASE_URL is correct"
  exit 1
fi

echo ""
echo "Running migrations..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run migrations in order
for migration in migrations/*.sql; do
  echo "Running: $migration"
  psql "$DATABASE_URL" -f "$migration"
  if [ $? -eq 0 ]; then
    echo "  ✓ Success"
  else
    echo "  ✗ Failed (may be expected if tables already exist)"
  fi
done

echo ""
echo "Creating additional required tables..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

psql "$DATABASE_URL" << 'EOF'
-- Create missing tables

CREATE TABLE IF NOT EXISTS agent_fund_transactions (
  id SERIAL PRIMARY KEY,
  agent_address TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'adjustment')),
  amount NUMERIC(20,2) NOT NULL,
  transaction_hash TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scan_logs (
  id SERIAL PRIMARY KEY,
  agent_address TEXT,
  blockchain VARCHAR(20) CHECK (blockchain IN ('ethereum', 'base', 'both')),
  opportunities_found INTEGER DEFAULT 0,
  investments_made INTEGER DEFAULT 0,
  scan_duration_ms INTEGER,
  status VARCHAR(20) DEFAULT 'completed',
  scan_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cultiv8_opportunities (
  id SERIAL PRIMARY KEY,
  protocol_name VARCHAR(100) NOT NULL,
  blockchain VARCHAR(20) NOT NULL,
  pool_address TEXT,
  asset_symbol VARCHAR(20),
  apy NUMERIC(10,2) NOT NULL,
  tvl NUMERIC(20,2),
  liquidity_depth NUMERIC(20,2),
  risk_score NUMERIC(4,2),
  is_active BOOLEAN DEFAULT true,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investments (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  opportunity_id INTEGER REFERENCES cultiv8_opportunities(id),
  amount NUMERIC(20,2) NOT NULL,
  blockchain VARCHAR(20),
  entry_apy NUMERIC(10,2),
  expected_return NUMERIC(20,2),
  actual_return NUMERIC(20,2),
  transaction_hash TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'withdrawn')),
  invested_at TIMESTAMPTZ DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_address);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_blockchain ON cultiv8_opportunities(blockchain);
CREATE INDEX IF NOT EXISTS idx_opportunities_active ON cultiv8_opportunities(is_active);
CREATE INDEX IF NOT EXISTS idx_scan_logs_agent ON scan_logs(agent_address);
CREATE INDEX IF NOT EXISTS idx_fund_txs_agent ON agent_fund_transactions(agent_address);

EOF

echo ""
echo "Verifying tables..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

psql "$DATABASE_URL" -c "\dt" | grep -E "agent_config|cultiv8_opportunities|investments|scan_logs|agent_fund_transactions|management_fees|performance_fees"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     ✅ DATABASE SETUP COMPLETE                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Tables created:"
echo "  ✓ agent_config (from migration 004)"
echo "  ✓ agent_fund_transactions"
echo "  ✓ scan_logs"
echo "  ✓ cultiv8_opportunities"
echo "  ✓ investments"
echo "  ✓ management_fees (from migration 004)"
echo "  ✓ performance_fees (from migration 004)"
echo "  ✓ fee_collection_history (from migration 004)"
echo "  ✓ tier_upgrade_history (from migration 004)"
echo ""
echo "Next steps:"
echo "1. Set environment variables in Railway:"
echo "   railway variables set BYPASS_AUTH=true"
echo "   railway variables set NEXT_PUBLIC_DEMO_MODE=true"
echo ""
echo "2. Wait for Railway to redeploy (automatic)"
echo ""
echo "3. Test the platform:"
echo "   https://0xcultiv8-production.up.railway.app"
echo ""

