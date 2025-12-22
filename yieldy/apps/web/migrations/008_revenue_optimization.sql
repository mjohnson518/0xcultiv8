-- Revenue Optimization Migration
-- Migration 008: Optimize pricing, credits, and discounts for increased revenue
--
-- Changes:
--   - Agent Run: $0.50 → $1.00 (+100%)
--   - Agent Scan: $0.10 → $0.15 (+50%)
--   - Credits reduced ~50% across tiers
--   - Discounts restructured (Pro 10%, Institutional 20%, Enterprise 30%)
--   - Add credit packs table for prepaid bundles
--   - Add execution fees tracking

-- =============================================================================
-- 1. Update Tier Credit Allocations
-- =============================================================================

-- Community: 10→5 runs, 50→20 scans, 0% discount (unchanged)
UPDATE tier_credit_allocations SET
  agent_run_credits = 5,
  agent_scan_credits = 20,
  discount_percent = 0
WHERE tier = 'community';

-- Pro: 100→50 runs, 500→200 scans, 20%→10% discount
UPDATE tier_credit_allocations SET
  agent_run_credits = 50,
  agent_scan_credits = 200,
  discount_percent = 10
WHERE tier = 'pro';

-- Institutional: 500→200 runs, 2000→750 scans, 40%→20% discount
UPDATE tier_credit_allocations SET
  agent_run_credits = 200,
  agent_scan_credits = 750,
  discount_percent = 20
WHERE tier = 'institutional';

-- Enterprise: Unlimited (unchanged), 50%→30% discount
UPDATE tier_credit_allocations SET
  discount_percent = 30
WHERE tier = 'enterprise';

-- =============================================================================
-- 2. Update Endpoint Pricing
-- =============================================================================

-- Agent Run: $0.50 → $1.00
UPDATE x402_endpoint_pricing SET
  base_price_usd = 1.00,
  tier_discounts = '{"community": 0, "pro": 0.10, "institutional": 0.20, "enterprise": 0.30}',
  description = 'Full AI agent execution with LLM analysis and strategy generation',
  updated_at = NOW()
WHERE endpoint_pattern = '/api/agent/run';

-- Agent Scan: $0.10 → $0.15
UPDATE x402_endpoint_pricing SET
  base_price_usd = 0.15,
  tier_discounts = '{"community": 0, "pro": 0.10, "institutional": 0.20, "enterprise": 0.30}',
  description = 'DeFi opportunity scanning with risk analysis',
  updated_at = NOW()
WHERE endpoint_pattern = '/api/agent/scan';

-- =============================================================================
-- 3. Credit Packs Table (Prepaid Bundles)
-- =============================================================================

CREATE TABLE IF NOT EXISTS credit_packs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  credit_type VARCHAR(20) NOT NULL CHECK (credit_type IN ('agent_run', 'agent_scan', 'mixed')),
  agent_run_credits INTEGER NOT NULL DEFAULT 0,
  agent_scan_credits INTEGER NOT NULL DEFAULT 0,
  price_usd NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert credit pack options
INSERT INTO credit_packs (name, credit_type, agent_run_credits, agent_scan_credits, price_usd, discount_percent) VALUES
  ('Starter Pack', 'agent_run', 10, 0, 9.00, 10),
  ('Growth Pack', 'agent_run', 50, 0, 40.00, 20),
  ('Power Pack', 'agent_run', 100, 0, 70.00, 30),
  ('Scan Bundle', 'agent_scan', 0, 100, 13.50, 10),
  ('Explorer Pack', 'mixed', 25, 100, 35.00, 15)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE credit_packs IS 'Prepaid credit bundles with volume discounts';

-- =============================================================================
-- 4. Credit Pack Purchases Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS credit_pack_purchases (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  pack_id INTEGER NOT NULL REFERENCES credit_packs(id),
  payment_hash TEXT,
  amount_usd NUMERIC(10,2) NOT NULL,
  agent_run_credits_added INTEGER NOT NULL DEFAULT 0,
  agent_scan_credits_added INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_pack_purchases_user ON credit_pack_purchases(user_address, created_at DESC);

COMMENT ON TABLE credit_pack_purchases IS 'Record of credit pack purchases';

-- =============================================================================
-- 5. Execution Fees Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS execution_fees (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  transaction_hash TEXT,
  transaction_value_usd NUMERIC(20,4),
  fee_percent NUMERIC(5,4) DEFAULT 0.0010,  -- 0.10%
  fee_usd NUMERIC(10,4) NOT NULL,
  fee_cap_usd NUMERIC(10,2) DEFAULT 25.00,
  protocol TEXT,
  action TEXT,  -- 'deposit', 'withdraw', 'rebalance'
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'waived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  collected_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_execution_fees_user ON execution_fees(user_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_fees_status ON execution_fees(status);

COMMENT ON TABLE execution_fees IS 'Execution fees on DeFi transactions (0.10% capped at $25)';

-- =============================================================================
-- 6. Function to Calculate Execution Fee
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_execution_fee(
  p_transaction_value_usd NUMERIC,
  p_fee_percent NUMERIC DEFAULT 0.0010,
  p_fee_cap_usd NUMERIC DEFAULT 25.00
)
RETURNS NUMERIC AS $$
BEGIN
  RETURN LEAST(p_transaction_value_usd * p_fee_percent, p_fee_cap_usd);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_execution_fee IS 'Calculate execution fee with cap';

-- =============================================================================
-- 7. Function to Purchase Credit Pack
-- =============================================================================

CREATE OR REPLACE FUNCTION purchase_credit_pack(
  p_user_address TEXT,
  p_pack_id INTEGER,
  p_payment_hash TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  run_credits_added INTEGER,
  scan_credits_added INTEGER,
  total_run_credits INTEGER,
  total_scan_credits INTEGER
) AS $$
DECLARE
  v_pack credit_packs%ROWTYPE;
  v_user user_credits%ROWTYPE;
BEGIN
  -- Get pack details
  SELECT * INTO v_pack FROM credit_packs WHERE id = p_pack_id AND is_active = true;

  IF v_pack IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 0, 0;
    RETURN;
  END IF;

  -- Initialize user credits if not exists
  INSERT INTO user_credits (user_address, tier)
  VALUES (p_user_address, 'community')
  ON CONFLICT (user_address) DO NOTHING;

  -- Add credits to user
  UPDATE user_credits SET
    agent_run_credits = CASE
      WHEN agent_run_credits = -1 THEN -1  -- Keep unlimited
      ELSE agent_run_credits + v_pack.agent_run_credits
    END,
    agent_scan_credits = CASE
      WHEN agent_scan_credits = -1 THEN -1  -- Keep unlimited
      ELSE agent_scan_credits + v_pack.agent_scan_credits
    END,
    updated_at = NOW()
  WHERE user_address = p_user_address
  RETURNING * INTO v_user;

  -- Record purchase
  INSERT INTO credit_pack_purchases (
    user_address, pack_id, payment_hash, amount_usd,
    agent_run_credits_added, agent_scan_credits_added
  ) VALUES (
    p_user_address, p_pack_id, p_payment_hash, v_pack.price_usd,
    v_pack.agent_run_credits, v_pack.agent_scan_credits
  );

  RETURN QUERY SELECT
    true,
    v_pack.agent_run_credits,
    v_pack.agent_scan_credits,
    v_user.agent_run_credits,
    v_user.agent_scan_credits;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. Revenue Analytics View
-- =============================================================================

CREATE OR REPLACE VIEW revenue_analytics AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  'x402_payment' as revenue_type,
  COUNT(*) as transaction_count,
  SUM(amount_usd) as total_usd
FROM x402_payments
WHERE status = 'verified'
GROUP BY DATE_TRUNC('day', created_at)

UNION ALL

SELECT
  DATE_TRUNC('day', created_at) as date,
  'credit_pack' as revenue_type,
  COUNT(*) as transaction_count,
  SUM(amount_usd) as total_usd
FROM credit_pack_purchases
WHERE status = 'completed'
GROUP BY DATE_TRUNC('day', created_at)

UNION ALL

SELECT
  DATE_TRUNC('day', created_at) as date,
  'execution_fee' as revenue_type,
  COUNT(*) as transaction_count,
  SUM(fee_usd) as total_usd
FROM execution_fees
WHERE status = 'collected'
GROUP BY DATE_TRUNC('day', created_at)

ORDER BY date DESC, revenue_type;

COMMENT ON VIEW revenue_analytics IS 'Daily revenue breakdown by type';

-- =============================================================================
-- 9. Pricing History (for rollback if needed)
-- =============================================================================

CREATE TABLE IF NOT EXISTS pricing_history (
  id SERIAL PRIMARY KEY,
  change_type VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  changed_by TEXT DEFAULT 'migration',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Record this pricing change
INSERT INTO pricing_history (change_type, old_values, new_values, reason) VALUES
(
  'revenue_optimization_v1',
  '{
    "agent_run_price": 0.50,
    "agent_scan_price": 0.10,
    "community_credits": {"run": 10, "scan": 50},
    "pro_credits": {"run": 100, "scan": 500},
    "institutional_credits": {"run": 500, "scan": 2000},
    "discounts": {"pro": 0.20, "institutional": 0.40, "enterprise": 0.50}
  }',
  '{
    "agent_run_price": 1.00,
    "agent_scan_price": 0.15,
    "community_credits": {"run": 5, "scan": 20},
    "pro_credits": {"run": 50, "scan": 200},
    "institutional_credits": {"run": 200, "scan": 750},
    "discounts": {"pro": 0.10, "institutional": 0.20, "enterprise": 0.30}
  }',
  'Revenue optimization - increase prices, reduce credits, restructure discounts'
);

COMMENT ON TABLE pricing_history IS 'Audit trail of pricing changes';
