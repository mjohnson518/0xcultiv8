import { z } from 'zod';

// Fund transaction types
const FundTransactionType = z.enum(['deposit', 'withdrawal', 'adjustment'], {
  errorMap: () => ({ message: "Type must be 'deposit', 'withdrawal', or 'adjustment'" })
});

// Fund operation schema
export const FundOperationSchema = z.object({
  amount: z.number()
    .positive({ message: "Amount must be positive" })
    .refine(
      (val) => {
        // Check for reasonable precision (max 2 decimal places for USD)
        const rounded = Math.round(val * 100) / 100;
        return Number.isFinite(val) && rounded === val;
      },
      { message: "Amount can have at most 2 decimal places" }
    )
    .refine(
      (val) => val <= 10000000, // Max $10M per transaction
      { message: "Amount exceeds maximum of $10,000,000 per transaction" }
    ),
  
  type: FundTransactionType,
  
  note: z.string()
    .max(1000, { message: "Note cannot exceed 1000 characters" })
    .optional()
}).refine(
  (data) => {
    // For withdrawals over $100k, require a note
    if (data.type === 'withdrawal' && data.amount > 100000) {
      return !!data.note && data.note.length > 10;
    }
    return true;
  },
  {
    message: "Withdrawals over $100,000 require a detailed note (min 10 characters)",
    path: ['note']
  }
).refine(
  (data) => {
    // Adjustments must have a note
    if (data.type === 'adjustment') {
      return !!data.note;
    }
    return true;
  },
  {
    message: "Adjustment transactions require a note explaining the reason",
    path: ['note']
  }
);

// Batch fund operations (for admin reconciliation)
export const BatchFundOperationSchema = z.object({
  operations: z.array(FundOperationSchema)
    .min(1, { message: "Must provide at least one operation" })
    .max(50, { message: "Cannot batch more than 50 operations at once" })
});

// Fund query parameters schema
export const FundQuerySchema = z.object({
  type: FundTransactionType.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0)
});
