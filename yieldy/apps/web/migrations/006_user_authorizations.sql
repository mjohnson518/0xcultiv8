-- User Authorizations Tracking
-- Mirrors on-chain authorization state for efficient querying

-- ============================================================================
-- 1. User Authorizations Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_authorizations (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT false,
  max_amount_per_tx NUMERIC(20,2) DEFAULT 0,
  daily_limit NUMERIC(20,2) DEFAULT 0,
  daily_spent NUMERIC(20,2) DEFAULT 0,
  last_reset_day DATE DEFAULT CURRENT_DATE,
  transaction_hash TEXT,
  action VARCHAR(20), -- 'authorize', 'revoke', 'update'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_address, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_user ON user_authorizations(user_address);
CREATE INDEX IF NOT EXISTS idx_auth_active ON user_authorizations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_auth_chain ON user_authorizations(chain_id);

COMMENT ON TABLE user_authorizations IS 'Mirrors on-chain agent authorization state';

-- ============================================================================
-- 2. Authorization History Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS authorization_history (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL, -- 'authorize', 'revoke', 'update', 'execute'
  max_amount_per_tx NUMERIC(20,2),
  daily_limit NUMERIC(20,2),
  transaction_hash TEXT,
  block_number BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_history_user ON authorization_history(user_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_history_action ON authorization_history(action);

COMMENT ON TABLE authorization_history IS 'Historical record of all authorization changes';

-- ============================================================================
-- 3. Agent Executions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_executions (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  protocol TEXT NOT NULL,
  action VARCHAR(20) NOT NULL, -- 'deposit', 'withdraw', 'swap'
  amount NUMERIC(20,6) NOT NULL,
  transaction_hash TEXT,
  block_number BIGINT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'success', 'failed'
  error_message TEXT,
  gas_used NUMERIC(20,0),
  gas_price NUMERIC(20,0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_executions_user ON agent_executions(user_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_status ON agent_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_protocol ON agent_executions(protocol);

COMMENT ON TABLE agent_executions IS 'Record of all agent strategy executions';

-- ============================================================================
-- 4. Daily Spending Tracking (for off-chain verification)
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_spending (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  spending_date DATE NOT NULL,
  total_spent NUMERIC(20,2) DEFAULT 0,
  execution_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_address, chain_id, spending_date)
);

CREATE INDEX IF NOT EXISTS idx_spending_user_date ON daily_spending(user_address, spending_date DESC);

COMMENT ON TABLE daily_spending IS 'Daily spending aggregation for limit enforcement';

-- ============================================================================
-- 5. Spending limit enforcement function
-- ============================================================================
CREATE OR REPLACE FUNCTION check_spending_limit(
  p_user_address TEXT,
  p_chain_id INTEGER,
  p_amount NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_auth RECORD;
  v_daily_spent NUMERIC;
BEGIN
  -- Get user authorization
  SELECT * INTO v_auth FROM user_authorizations
  WHERE user_address = p_user_address AND chain_id = p_chain_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check per-transaction limit
  IF p_amount > v_auth.max_amount_per_tx THEN
    RETURN false;
  END IF;

  -- Get today's spending
  SELECT COALESCE(total_spent, 0) INTO v_daily_spent FROM daily_spending
  WHERE user_address = p_user_address
    AND chain_id = p_chain_id
    AND spending_date = CURRENT_DATE;

  -- Check daily limit
  IF (COALESCE(v_daily_spent, 0) + p_amount) > v_auth.daily_limit THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_spending_limit IS 'Verify if execution amount is within user limits';

-- ============================================================================
-- 6. Record spending function
-- ============================================================================
CREATE OR REPLACE FUNCTION record_spending(
  p_user_address TEXT,
  p_chain_id INTEGER,
  p_amount NUMERIC
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO daily_spending (user_address, chain_id, spending_date, total_spent, execution_count)
  VALUES (p_user_address, p_chain_id, CURRENT_DATE, p_amount, 1)
  ON CONFLICT (user_address, chain_id, spending_date)
  DO UPDATE SET
    total_spent = daily_spending.total_spent + p_amount,
    execution_count = daily_spending.execution_count + 1,
    updated_at = NOW();

  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_spending IS 'Record execution spending for daily limit tracking';
