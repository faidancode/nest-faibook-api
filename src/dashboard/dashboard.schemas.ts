import { z } from 'zod';

const dateCoerce = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : undefined));

export const SummaryQuerySchema = z.object({
  lowStockThreshold: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().positive().optional())
    .default(5),
});

export const RangeQuerySchema = z.object({
  from: dateCoerce,
  to: dateCoerce,
});

export const TopBooksQuerySchema = RangeQuerySchema.extend({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(1).max(50).optional())
    .default(5),
});

export const RecentOrdersQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(1).max(50).optional())
    .default(10),
});

export const LowStockQuerySchema = z.object({
  threshold: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().positive().optional())
    .default(5),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(1).max(100).optional())
    .default(10),
});

export const RecentReviewsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(1).max(50).optional())
    .default(5),
});

export type SummaryQuery = z.infer<typeof SummaryQuerySchema>;
export type RangeQuery = z.infer<typeof RangeQuerySchema>;
export type TopBooksQuery = z.infer<typeof TopBooksQuerySchema>;
export type RecentOrdersQuery = z.infer<typeof RecentOrdersQuerySchema>;
export type LowStockQuery = z.infer<typeof LowStockQuerySchema>;
export type RecentReviewsQuery = z.infer<typeof RecentReviewsQuerySchema>;
