import { z } from 'zod';
import { isAddress, getAddress } from 'ethers';

// Custom Ethereum address validator with checksum
const EthereumAddress = z.string().refine(
  (val) => {
    try {
      return isAddress(val);
    } catch {
      return false;
    }
  },
  { message: "Invalid Ethereum address format" }
).transform((val) => {
  try {
    return getAddress(val); // Returns checksummed address
  } catch {
    return val;
  }
});

// Investment creation schema
export const InvestmentSchema = z.object({
  opportunity_id: z.number().int().positive({
    message: "Opportunity ID must be a positive integer"
  }),
  amount: z.number()
    .positive({ message: "Amount must be positive" })
    .max(1000000, { message: "Amount exceeds maximum limit of $1,000,000" })
    .refine(
      (val) => Number.isFinite(val) && val > 0,
      { message: "Amount must be a valid positive number" }
    ),
  blockchain: z.enum(['ethereum', 'base'], {
    errorMap: () => ({ message: "Blockchain must be 'ethereum' or 'base'" })
  }),
  transaction_hash: EthereumAddress.optional(),
  expected_apy: z.number()
    .min(0, { message: "APY cannot be negative" })
    .max(1000, { message: "APY exceeds reasonable maximum of 1000%" })
    .optional()
});

// Withdrawal schema
export const WithdrawSchema = z.object({
  investment_id: z.number().int().positive({
    message: "Investment ID must be a positive integer"
  }),
  amount: z.number()
    .positive({ message: "Withdrawal amount must be positive" })
    .optional(), // If omitted, withdraw all
  reason: z.string().max(500).optional()
});

// Batch investment schema
export const BatchInvestmentSchema = z.object({
  investments: z.array(InvestmentSchema)
    .min(1, { message: "Must provide at least one investment" })
    .max(10, { message: "Cannot batch more than 10 investments at once" })
});

