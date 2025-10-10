-- Performance Indexes for Cultiv8 Database
-- Created: Phase 3, Task 3.3
-- Purpose: Optimize query performance for high-traffic production environment

-- Investments table indexes
CREATE INDEX IF NOT EXISTS idx_investments_status_withdrawn 
  ON investments(status, withdrawn_at) 
  WHERE withdrawn_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_investments_blockchain_date 
  ON investments(blockchain, invested_at DESC);

CREATE INDEX IF NOT EXISTS idx_investments_opportunity 
  ON investments(opportunity_id, status);

CREATE INDEX IF NOT EXISTS idx_investments_user_date 
  ON investments(blockchain, invested_at DESC);

-- Cultiv8 opportunities indexes
CREATE INDEX IF NOT EXISTS idx_opportunities_active_apy 
  ON cultiv8_opportunities(blockchain, is_active, apy DESC) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_opportunities_risk 
  ON cultiv8_opportunities(risk_score, apy DESC);

CREATE INDEX IF NOT EXISTS idx_opportunities_blockchain_active 
  ON cultiv8_opportunities(blockchain, is_active);

CREATE INDEX IF NOT EXISTS idx_opportunities_protocol 
  ON cultiv8_opportunities(protocol_name, blockchain);

-- Agent configuration (small table, indexes less critical)
CREATE INDEX IF NOT EXISTS idx_agent_config_updated 
  ON agent_config(updated_at DESC);

-- Fund transactions indexes
CREATE INDEX IF NOT EXISTS idx_fund_transactions_type_date 
  ON agent_fund_transactions(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fund_transactions_date 
  ON agent_fund_transactions(created_at DESC);

-- Scan logs indexes
CREATE INDEX IF NOT EXISTS idx_scan_logs_blockchain_date 
  ON scan_logs(blockchain, scan_completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_scan_logs_status 
  ON scan_logs(status, scan_completed_at DESC);

-- Performance fees indexes (if table exists)
CREATE INDEX IF NOT EXISTS idx_performance_fees_investment 
  ON performance_fees(investment_id, created_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_investments_status_blockchain_date 
  ON investments(status, blockchain, invested_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunities_active_blockchain_risk_apy 
  ON cultiv8_opportunities(is_active, blockchain, risk_score, apy DESC) 
  WHERE is_active = true;

-- Analyze tables for query planner
ANALYZE investments;
ANALYZE cultiv8_opportunities;
ANALYZE agent_config;
ANALYZE agent_fund_transactions;
ANALYZE scan_logs;

