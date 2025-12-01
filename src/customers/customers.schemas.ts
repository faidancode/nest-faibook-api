import { z } from 'zod';

export const ListCustomersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10))
    .pipe(z.number().int().min(1).max(100)),
  q: z.string().optional(),
});

export type ListCustomersQuery = z.infer<typeof ListCustomersQuerySchema>;

export const UpdateCustomerProfileSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    password: z.string().min(6).max(100).optional(),
  })
  .refine((data) => data.name !== undefined || data.password !== undefined, {
    message: 'At least one field must be provided',
  });

export type UpdateCustomerProfileInput = z.infer<
  typeof UpdateCustomerProfileSchema
>;
