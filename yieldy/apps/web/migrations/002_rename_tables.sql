-- Rename legacy yield_opportunities table to cultiv8_opportunities
-- This migration handles the rebrand from "yieldy" to "cultiv8"

-- Check if old table exists and new one doesn't
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'yield_opportunities') 
     AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'cultiv8_opportunities') THEN
    
    -- Rename the table
    ALTER TABLE yield_opportunities RENAME TO cultiv8_opportunities;
    
    -- Update any foreign key references
    -- (investments table references cultiv8_opportunities)
    
    RAISE NOTICE 'Renamed yield_opportunities to cultiv8_opportunities';
  ELSE
    RAISE NOTICE 'Table already renamed or does not exist';
  END IF;
END
$$;

-- Ensure cultiv8_opportunities table exists with correct schema
CREATE TABLE IF NOT EXISTS cultiv8_opportunities (
  id SERIAL PRIMARY KEY,
  protocol_name VARCHAR(100) NOT NULL,
  blockchain VARCHAR(20) NOT NULL CHECK (blockchain IN ('ethereum', 'base')),
  pool_address TEXT NOT NULL,
  token_symbol VARCHAR(10) DEFAULT 'USDC',
  apy NUMERIC(10,4) NOT NULL,
  tvl NUMERIC(20,2),
  risk_score INTEGER DEFAULT 5 CHECK (risk_score >= 1 AND risk_score <= 10),
  risk_breakdown JSONB,
  protocol_type VARCHAR(50),
  minimum_deposit NUMERIC(20,2) DEFAULT 0,
  lock_period INTEGER DEFAULT 0,
  additional_info JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint on pool_address + blockchain
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_unique_pool 
  ON cultiv8_opportunities(pool_address, blockchain);

-- Add helpful comments
COMMENT ON TABLE cultiv8_opportunities IS 'DeFi yield farming opportunities discovered by the Cultiv8 agent';
COMMENT ON COLUMN cultiv8_opportunities.risk_score IS 'Composite risk score from 1 (lowest risk) to 10 (highest risk)';
COMMENT ON COLUMN cultiv8_opportunities.risk_breakdown IS 'Detailed breakdown of protocol, financial, technical, and market risk components';

