import { z } from 'zod';
import { isAddress, getAddress } from 'ethers';

// Ethereum address validator
const EthereumAddress = z.string().refine(
  (val) => {
    try {
      return isAddress(val);
    } catch {
      return false;
    }
  },
  { message: "Invalid Ethereum address" }
).transform((val) => getAddress(val));

// Protocol types enum
const ProtocolType = z.enum([
  'lending',
  'liquidity_pool',
  'yield_aggregator',
  'staking',
  'liquid_staking',
  'options',
  'structured_product',
  'other'
], {
  errorMap: () => ({ message: "Invalid protocol type" })
});

// Opportunity creation schema
export const OpportunityCreateSchema = z.object({
  protocol_name: z.string()
    .min(1, { message: "Protocol name is required" })
    .max(100, { message: "Protocol name too long" }),
  
  blockchain: z.enum(['ethereum', 'base']),
  
  pool_address: EthereumAddress,
  
  token_symbol: z.string()
    .min(1)
    .max(10)
    .default('USDC'),
  
  apy: z.number()
    .min(0, { message: "APY cannot be negative" })
    .max(10000, { message: "APY exceeds maximum (10000%)" }),
  
  tvl: z.number()
    .min(0)
    .optional(),
  
  risk_score: z.number()
    .int()
    .min(1)
    .max(10)
    .default(5),
  
  protocol_type: ProtocolType.optional(),
  
  minimum_deposit: z.number()
    .min(0)
    .default(0),
  
  lock_period: z.number()
    .int()
    .min(0, { message: "Lock period cannot be negative" })
    .default(0),
  
  additional_info: z.record(z.unknown()).optional()
});

// Opportunity query/filter schema
export const OpportunityQuerySchema = z.object({
  blockchain: z.enum(['ethereum', 'base']).optional(),
  minApy: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  maxRisk: z.string().regex(/^\d+$/).optional(),
  protocolType: ProtocolType.optional(),
  isActive: z.enum(['true', 'false']).optional()
});

