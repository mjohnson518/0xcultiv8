-- x402 Payment Protocol Integration
-- Migration 007: Add tables for x402 payment tracking and user credits

-- =============================================================================
-- 1. x402 Payments Table (Inbound payment records)
-- =============================================================================
CREATE TABLE IF NOT EXISTS x402_payments (
  id SERIAL PRIMARY KEY,
  payment_hash TEXT UNIQUE NOT NULL,
  user_address TEXT,  -- NULL for anonymous paid access
  endpoint TEXT NOT NULL,
  amount_usd NUMERIC(10,4) NOT NULL,
  amount_usdc NUMERIC(20,6) NOT NULL,  -- USDC has 6 decimals
  network TEXT DEFAULT 'eip155:8453',
  facilitator_response JSONB,
  user_tier VARCHAR(20),
  status VARCHAR(20) DEFAULT 'verified' CHECK (status IN ('pending', 'verified', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_x402_payments_user ON x402_payments(user_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_x402_payments_endpoint ON x402_payments(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_x402_payments_status ON x402_payments(status);
CREATE INDEX IF NOT EXISTS idx_x402_payments_hash ON x402_payments(payment_hash);

COMMENT ON TABLE x402_payments IS 'Records of inbound x402 payments for API access';

-- =============================================================================
-- 2. x402 Endpoint Pricing Configuration
-- =============================================================================
CREATE TABLE IF NOT EXISTS x402_endpoint_pricing (
  id SERIAL PRIMARY KEY,
  endpoint_pattern TEXT NOT NULL UNIQUE,
  base_price_usd NUMERIC(10,4) NOT NULL,
  tier_discounts JSONB DEFAULT '{"community": 0, "pro": 0.2, "institutional": 0.4, "enterprise": 0.5}',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pricing for premium endpoints
INSERT INTO x402_endpoint_pricing (endpoint_pattern, base_price_usd, description) VALUES
  ('/api/agent/run', 0.50, 'Full agent execution with LLM analysis'),
  ('/api/agent/scan', 0.10, 'DeFi opportunity scanning')
ON CONFLICT (endpoint_pattern) DO NOTHING;

COMMENT ON TABLE x402_endpoint_pricing IS 'Dynamic pricing configuration for x402-enabled endpoints';

-- =============================================================================
-- 3. User Credits Table (Free tier allocations)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_credits (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL UNIQUE,
  tier VARCHAR(20) NOT NULL DEFAULT 'community',
  agent_run_credits INTEGER DEFAULT 0,
  agent_scan_credits INTEGER DEFAULT 0,
  credits_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_credits_address ON user_credits(user_address);
CREATE INDEX IF NOT EXISTS idx_user_credits_tier ON user_credits(tier);

COMMENT ON TABLE user_credits IS 'Free credit allocations per user tier';

-- =============================================================================
-- 4. Credit Usage History (Audit trail)
-- =============================================================================
CREATE TABLE IF NOT EXISTS credit_usage_history (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  credit_type VARCHAR(20) NOT NULL CHECK (credit_type IN ('agent_run', 'agent_scan')),
  credits_used INTEGER NOT NULL DEFAULT 1,
  credits_remaining INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_user ON credit_usage_history(user_address, created_at DESC);

COMMENT ON TABLE credit_usage_history IS 'Audit trail of credit usage';

-- =============================================================================
-- 5. Tier Credit Allocations (Reference table)
-- =============================================================================
CREATE TABLE IF NOT EXISTS tier_credit_allocations (
  tier VARCHAR(20) PRIMARY KEY,
  agent_run_credits INTEGER NOT NULL,
  agent_scan_credits INTEGER NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  reset_period_days INTEGER NOT NULL DEFAULT 30
);

-- Insert tier allocations
INSERT INTO tier_credit_allocations (tier, agent_run_credits, agent_scan_credits, discount_percent) VALUES
  ('community', 10, 50, 0),
  ('pro', 100, 500, 20),
  ('institutional', 500, 2000, 40),
  ('enterprise', -1, -1, 50)  -- -1 = unlimited
ON CONFLICT (tier) DO NOTHING;

COMMENT ON TABLE tier_credit_allocations IS 'Monthly credit allocations per tier (-1 = unlimited)';

-- =============================================================================
-- 6. Function to initialize/reset user credits
-- =============================================================================
CREATE OR REPLACE FUNCTION reset_user_credits(p_user_address TEXT, p_tier VARCHAR(20) DEFAULT NULL)
RETURNS user_credits AS $$
DECLARE
  v_tier VARCHAR(20);
  v_allocation tier_credit_allocations%ROWTYPE;
  v_result user_credits%ROWTYPE;
BEGIN
  -- Get current tier if not specified
  IF p_tier IS NULL THEN
    SELECT tier INTO v_tier FROM user_credits WHERE user_address = p_user_address;
    v_tier := COALESCE(v_tier, 'community');
  ELSE
    v_tier := p_tier;
  END IF;

  -- Get allocation for tier
  SELECT * INTO v_allocation FROM tier_credit_allocations WHERE tier = v_tier;

  -- Upsert user credits
  INSERT INTO user_credits (user_address, tier, agent_run_credits, agent_scan_credits, credits_reset_at, updated_at)
  VALUES (
    p_user_address,
    v_tier,
    v_allocation.agent_run_credits,
    v_allocation.agent_scan_credits,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_address) DO UPDATE SET
    tier = EXCLUDED.tier,
    agent_run_credits = EXCLUDED.agent_run_credits,
    agent_scan_credits = EXCLUDED.agent_scan_credits,
    credits_reset_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. Function to deduct credits
-- =============================================================================
CREATE OR REPLACE FUNCTION deduct_user_credit(
  p_user_address TEXT,
  p_credit_type VARCHAR(20),
  p_endpoint TEXT
)
RETURNS TABLE(success BOOLEAN, credits_remaining INTEGER, requires_payment BOOLEAN) AS $$
DECLARE
  v_credits user_credits%ROWTYPE;
  v_current_credits INTEGER;
  v_new_credits INTEGER;
BEGIN
  -- Get current credits
  SELECT * INTO v_credits FROM user_credits WHERE user_address = p_user_address FOR UPDATE;

  -- If no credits record, user needs to pay
  IF v_credits IS NULL THEN
    RETURN QUERY SELECT false, 0, true;
    RETURN;
  END IF;

  -- Get current credit count for the type
  IF p_credit_type = 'agent_run' THEN
    v_current_credits := v_credits.agent_run_credits;
  ELSIF p_credit_type = 'agent_scan' THEN
    v_current_credits := v_credits.agent_scan_credits;
  ELSE
    RETURN QUERY SELECT false, 0, true;
    RETURN;
  END IF;

  -- Unlimited credits (-1) always succeed
  IF v_current_credits = -1 THEN
    RETURN QUERY SELECT true, -1, false;
    RETURN;
  END IF;

  -- Check if credits available
  IF v_current_credits <= 0 THEN
    RETURN QUERY SELECT false, 0, true;
    RETURN;
  END IF;

  -- Deduct credit
  v_new_credits := v_current_credits - 1;

  IF p_credit_type = 'agent_run' THEN
    UPDATE user_credits SET agent_run_credits = v_new_credits, updated_at = NOW()
    WHERE user_address = p_user_address;
  ELSE
    UPDATE user_credits SET agent_scan_credits = v_new_credits, updated_at = NOW()
    WHERE user_address = p_user_address;
  END IF;

  -- Record usage
  INSERT INTO credit_usage_history (user_address, credit_type, credits_used, credits_remaining, endpoint)
  VALUES (p_user_address, p_credit_type, 1, v_new_credits, p_endpoint);

  RETURN QUERY SELECT true, v_new_credits, false;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. Analytics View
-- =============================================================================
CREATE OR REPLACE VIEW x402_daily_analytics AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  endpoint,
  COUNT(*) as payment_count,
  SUM(amount_usd) as total_usd,
  COUNT(DISTINCT user_address) as unique_payers,
  AVG(amount_usd) as avg_payment
FROM x402_payments
WHERE status = 'verified'
GROUP BY DATE_TRUNC('day', created_at), endpoint
ORDER BY date DESC, endpoint;

COMMENT ON VIEW x402_daily_analytics IS 'Daily x402 payment analytics by endpoint';
