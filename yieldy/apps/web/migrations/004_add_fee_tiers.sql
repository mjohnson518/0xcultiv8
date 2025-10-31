-- Fee Tiers and Revenue Tracking System
-- Implements tiered performance + management fee structure

-- ============================================================================
-- 1. Add fee tier columns to agent_config
-- ============================================================================
ALTER TABLE agent_config 
ADD COLUMN IF NOT EXISTS user_tier VARCHAR(20) DEFAULT 'community' 
  CHECK (user_tier IN ('community', 'pro', 'institutional', 'enterprise')),
ADD COLUMN IF NOT EXISTS management_fee_percent NUMERIC(4,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS performance_fee_percent NUMERIC(4,2) DEFAULT 18.00,
ADD COLUMN IF NOT EXISTS total_aum NUMERIC(20,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tier_upgraded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_management_fee_collected_at TIMESTAMPTZ;

-- ============================================================================
-- 2. Management Fees Tracking Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS management_fees (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  collection_period VARCHAR(7) NOT NULL, -- YYYY-MM format
  aum_snapshot NUMERIC(20,2) NOT NULL,
  management_fee_percent NUMERIC(4,2) NOT NULL,
  fee_amount NUMERIC(20,2) NOT NULL,
  user_tier VARCHAR(20) NOT NULL,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'failed')),
  transaction_hash TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_mgmt_fees_user ON management_fees(user_address, collection_period DESC);
CREATE INDEX IF NOT EXISTS idx_mgmt_fees_period ON management_fees(collection_period DESC);
CREATE INDEX IF NOT EXISTS idx_mgmt_fees_status ON management_fees(status);

COMMENT ON TABLE management_fees IS 'Monthly management fee collection tracking (% of AUM)';
COMMENT ON COLUMN management_fees.collection_period IS 'Month/year of fee collection (YYYY-MM)';
COMMENT ON COLUMN management_fees.aum_snapshot IS 'Total AUM at time of collection';

-- ============================================================================
-- 3. Performance Fees Tracking Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS performance_fees (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  investment_id INTEGER, -- Reference to specific investment
  profit_amount NUMERIC(20,2) NOT NULL,
  performance_fee_percent NUMERIC(4,2) NOT NULL,
  fee_amount NUMERIC(20,2) NOT NULL,
  user_tier VARCHAR(20) NOT NULL,
  realized_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'failed')),
  transaction_hash TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_perf_fees_user ON performance_fees(user_address, realized_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_fees_investment ON performance_fees(investment_id);
CREATE INDEX IF NOT EXISTS idx_perf_fees_status ON performance_fees(status);
CREATE INDEX IF NOT EXISTS idx_perf_fees_realized ON performance_fees(realized_at DESC);

COMMENT ON TABLE performance_fees IS 'Performance fee collection on realized profits';
COMMENT ON COLUMN performance_fees.profit_amount IS 'Actual profit realized from the investment';
COMMENT ON COLUMN performance_fees.fee_amount IS 'Fee collected (profit_amount × fee_percent)';

-- ============================================================================
-- 4. Fee Collection History (Combined view)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fee_collection_history (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  fee_type VARCHAR(20) NOT NULL CHECK (fee_type IN ('management', 'performance')),
  fee_amount NUMERIC(20,2) NOT NULL,
  base_amount NUMERIC(20,2) NOT NULL, -- AUM for mgmt, profit for perf
  fee_percent NUMERIC(4,2) NOT NULL,
  user_tier VARCHAR(20) NOT NULL,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending',
  transaction_hash TEXT,
  reference_id INTEGER, -- Points to management_fees.id or performance_fees.id
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_fee_history_user ON fee_collection_history(user_address, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_fee_history_type ON fee_collection_history(fee_type);
CREATE INDEX IF NOT EXISTS idx_fee_history_status ON fee_collection_history(status);
CREATE INDEX IF NOT EXISTS idx_fee_history_date ON fee_collection_history(collected_at DESC);

COMMENT ON TABLE fee_collection_history IS 'Unified fee collection history for reporting';

-- ============================================================================
-- 5. Tier Upgrade History
-- ============================================================================
CREATE TABLE IF NOT EXISTS tier_upgrade_history (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  previous_tier VARCHAR(20),
  new_tier VARCHAR(20) NOT NULL,
  trigger_reason VARCHAR(50), -- 'aum_threshold', 'manual_upgrade', 'admin_override'
  aum_at_upgrade NUMERIC(20,2),
  upgraded_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_tier_upgrades_user ON tier_upgrade_history(user_address, upgraded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tier_upgrades_date ON tier_upgrade_history(upgraded_at DESC);

COMMENT ON TABLE tier_upgrade_history IS 'Tracks user tier upgrades over time';

-- ============================================================================
-- 6. Update existing agent_config rows with default tier structure
-- ============================================================================
UPDATE agent_config 
SET 
  user_tier = COALESCE(user_tier, 'community'),
  management_fee_percent = COALESCE(management_fee_percent, 1.00),
  performance_fee_percent = COALESCE(performance_fee_percent, 18.00),
  total_aum = COALESCE(total_aum, 0)
WHERE user_tier IS NULL OR management_fee_percent IS NULL;

-- ============================================================================
-- 7. Revenue Analytics Views
-- ============================================================================

-- Monthly revenue summary
CREATE OR REPLACE VIEW monthly_revenue AS
SELECT 
  DATE_TRUNC('month', collected_at) as month,
  fee_type,
  user_tier,
  COUNT(*) as fee_count,
  SUM(fee_amount) as total_revenue,
  AVG(fee_amount) as avg_fee,
  SUM(base_amount) as total_base_amount
FROM fee_collection_history
WHERE status = 'collected'
GROUP BY DATE_TRUNC('month', collected_at), fee_type, user_tier
ORDER BY month DESC, fee_type, user_tier;

-- User revenue contribution
CREATE OR REPLACE VIEW user_revenue AS
SELECT 
  user_address,
  user_tier,
  COUNT(*) as total_fees_collected,
  SUM(CASE WHEN fee_type = 'management' THEN fee_amount ELSE 0 END) as mgmt_revenue,
  SUM(CASE WHEN fee_type = 'performance' THEN fee_amount ELSE 0 END) as perf_revenue,
  SUM(fee_amount) as total_revenue,
  MAX(collected_at) as last_fee_collected
FROM fee_collection_history
WHERE status = 'collected'
GROUP BY user_address, user_tier
ORDER BY total_revenue DESC;

COMMENT ON VIEW monthly_revenue IS 'Monthly revenue breakdown by fee type and tier';
COMMENT ON VIEW user_revenue IS 'Per-user revenue contribution summary';

-- ============================================================================
-- 8. Grant permissions (if needed)
-- ============================================================================
-- GRANT SELECT, INSERT, UPDATE ON management_fees TO cultiv8_app;
-- GRANT SELECT, INSERT, UPDATE ON performance_fees TO cultiv8_app;
-- GRANT SELECT, INSERT, UPDATE ON fee_collection_history TO cultiv8_app;
-- GRANT SELECT, INSERT, UPDATE ON tier_upgrade_history TO cultiv8_app;
-- GRANT SELECT ON monthly_revenue TO cultiv8_app;
-- GRANT SELECT ON user_revenue TO cultiv8_app;


