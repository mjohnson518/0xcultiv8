import { z } from 'zod';

// Agent configuration schema
export const AgentConfigSchema = z.object({
  max_investment_per_opportunity: z.number()
    .positive({ message: "Max investment per opportunity must be positive" })
    .max(100000, { message: "Max per opportunity cannot exceed $100,000" })
    .optional(),
  
  max_total_investment: z.number()
    .positive({ message: "Max total investment must be positive" })
    .max(1000000, { message: "Max total investment cannot exceed $1,000,000" })
    .optional(),
  
  min_apy_threshold: z.number()
    .min(0, { message: "Minimum APY threshold cannot be negative" })
    .max(100, { message: "Minimum APY threshold too high (max 100%)" })
    .optional(),
  
  max_risk_score: z.number()
    .int({ message: "Risk score must be an integer" })
    .min(1, { message: "Risk score must be at least 1" })
    .max(10, { message: "Risk score must be at most 10" })
    .optional(),
  
  auto_invest_enabled: z.boolean().optional(),
  
  scan_interval_minutes: z.number()
    .int({ message: "Scan interval must be an integer" })
    .min(60, { message: "Minimum scan interval is 60 minutes" })
    .max(10080, { message: "Maximum scan interval is 7 days (10080 minutes)" })
    .optional(),
  
  preferred_protocols: z.array(z.string()).optional(),
  
  blacklisted_protocols: z.array(z.string()).optional(),
  
  emergency_pause: z.boolean().optional(),
  
  pause_reason: z.string().max(500).optional()
}).refine(
  (data) => {
    // Ensure max_total >= max_per_opportunity
    if (data.max_total_investment && data.max_investment_per_opportunity) {
      return data.max_total_investment >= data.max_investment_per_opportunity;
    }
    return true;
  },
  {
    message: "Max total investment must be greater than or equal to max per opportunity"
  }
);

// Partial update schema (all fields optional)
export const AgentConfigUpdateSchema = AgentConfigSchema.partial();

