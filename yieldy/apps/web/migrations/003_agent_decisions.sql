-- Agent Decisions Table for Memory & Learning System
-- Phase 6: LangGraph AI Agent

CREATE TABLE IF NOT EXISTS agent_decisions (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  decision_type VARCHAR(50),
  reasoning_chain JSONB NOT NULL,
  selected_strategy JSONB,
  outcome VARCHAR(20) DEFAULT 'pending' CHECK (outcome IN ('pending', 'success', 'failed', 'cancelled')),
  actual_return NUMERIC(10,2),
  lessons_learned JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_decisions_user ON agent_decisions(user_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_outcome ON agent_decisions(outcome);
CREATE INDEX IF NOT EXISTS idx_decisions_type ON agent_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_decisions_created ON agent_decisions(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE agent_decisions IS 'Stores AI agent decisions for memory, learning, and performance tracking';
COMMENT ON COLUMN agent_decisions.reasoning_chain IS 'Complete reasoning steps from LangGraph execution';
COMMENT ON COLUMN agent_decisions.selected_strategy IS 'The strategy selected by the agent';
COMMENT ON COLUMN agent_decisions.outcome IS 'Final outcome: pending, success, failed, or cancelled';
COMMENT ON COLUMN agent_decisions.lessons_learned IS 'Patterns and insights extracted from this decision';

-- Grant permissions (if using role-based access)
-- GRANT SELECT, INSERT, UPDATE ON agent_decisions TO cultiv8_app;
-- GRANT USAGE, SELECT ON SEQUENCE agent_decisions_id_seq TO cultiv8_app;

