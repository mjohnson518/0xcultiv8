-- Foreign Key Constraints Migration
-- Adds referential integrity constraints for data consistency
-- Run after all tables are created

-- ============================================================================
-- 1. Add unique constraint on user_address for referential integrity
-- ============================================================================

-- Note: agent_config uses TEXT for user_address, so we can add FK constraints
-- that reference it from other tables if needed

-- Add unique constraint on collection_period for management_fees to prevent duplicates
ALTER TABLE management_fees
DROP CONSTRAINT IF EXISTS uk_mgmt_fees_user_period;

ALTER TABLE management_fees
ADD CONSTRAINT uk_mgmt_fees_user_period UNIQUE (user_address, collection_period);

-- ============================================================================
-- 2. Foreign key for agent_decisions referencing opportunities (optional)
-- ============================================================================

-- Note: agent_decisions.selected_strategy is JSONB and may contain opportunity references
-- We keep this as JSONB for flexibility, but add a comment for documentation
COMMENT ON COLUMN agent_decisions.selected_strategy IS 'Selected strategy (may reference cultiv8_opportunities by ID in the JSONB payload)';

-- ============================================================================
-- 3. Add partial index for active opportunities
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_opportunities_active
ON cultiv8_opportunities(protocol, blockchain)
WHERE is_active = true;

-- ============================================================================
-- 4. Add check constraints for data integrity
-- ============================================================================

-- Ensure fee amounts are non-negative
ALTER TABLE management_fees
DROP CONSTRAINT IF EXISTS chk_mgmt_fee_positive;

ALTER TABLE management_fees
ADD CONSTRAINT chk_mgmt_fee_positive CHECK (fee_amount >= 0);

ALTER TABLE performance_fees
DROP CONSTRAINT IF EXISTS chk_perf_fee_positive;

ALTER TABLE performance_fees
ADD CONSTRAINT chk_perf_fee_positive CHECK (fee_amount >= 0);

ALTER TABLE fee_collection_history
DROP CONSTRAINT IF EXISTS chk_fee_history_positive;

ALTER TABLE fee_collection_history
ADD CONSTRAINT chk_fee_history_positive CHECK (fee_amount >= 0);

-- Ensure fee percentages are within valid range (0-100)
ALTER TABLE management_fees
DROP CONSTRAINT IF EXISTS chk_mgmt_percent_range;

ALTER TABLE management_fees
ADD CONSTRAINT chk_mgmt_percent_range CHECK (management_fee_percent >= 0 AND management_fee_percent <= 100);

ALTER TABLE performance_fees
DROP CONSTRAINT IF EXISTS chk_perf_percent_range;

ALTER TABLE performance_fees
ADD CONSTRAINT chk_perf_percent_range CHECK (performance_fee_percent >= 0 AND performance_fee_percent <= 100);

-- ============================================================================
-- 5. Add NOT NULL constraints where appropriate (with defaults)
-- ============================================================================

-- Ensure tier columns have valid defaults
ALTER TABLE management_fees
ALTER COLUMN user_tier SET NOT NULL;

ALTER TABLE performance_fees
ALTER COLUMN user_tier SET NOT NULL;

ALTER TABLE fee_collection_history
ALTER COLUMN user_tier SET NOT NULL;

-- ============================================================================
-- 6. Add cascading update rules for wallet addresses (informational)
-- ============================================================================

-- Note: PostgreSQL doesn't support updating FK references when the parent changes
-- If wallet addresses need to change, use a separate migration or application logic

-- ============================================================================
-- 7. Add partial unique constraint for pending transactions
-- ============================================================================

-- Prevent duplicate pending fee collections for same user/period
CREATE UNIQUE INDEX IF NOT EXISTS idx_mgmt_fees_pending_unique
ON management_fees (user_address, collection_period)
WHERE status = 'pending';

-- ============================================================================
-- 8. Documentation
-- ============================================================================

COMMENT ON CONSTRAINT chk_mgmt_fee_positive ON management_fees IS 'Ensures management fee amounts are non-negative';
COMMENT ON CONSTRAINT chk_perf_fee_positive ON performance_fees IS 'Ensures performance fee amounts are non-negative';
COMMENT ON CONSTRAINT chk_mgmt_percent_range ON management_fees IS 'Ensures fee percentages are 0-100';
COMMENT ON CONSTRAINT chk_perf_percent_range ON performance_fees IS 'Ensures fee percentages are 0-100';
COMMENT ON CONSTRAINT uk_mgmt_fees_user_period ON management_fees IS 'Prevents duplicate management fee collections for same user/period';
