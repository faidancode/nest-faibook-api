import { z } from 'zod';

export const ListAdminQuerySchema = z.object({
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
  search: z.string().optional(),
  sort: z
    .string()
    .optional()
    .transform((v) => v ?? 'name:asc'),
});

export type ListAdminQuery = z.infer<typeof ListAdminQuerySchema>;

export const CreateAdminSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.email().max(160),
  password: z.string().min(6).max(100),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || v.length >= 6, 'Minimal 6 karakter')
    .refine((v) => !v || v.length <= 30, 'Maksimal 30 karakter'),
});

export const UpdateAdminSchema = z.object({
  name: z.string().min(1).max(120),
  password: z.string().min(6).max(100).optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || v.length >= 6, 'Minimal 6 karakter')
    .refine((v) => !v || v.length <= 30, 'Maksimal 30 karakter'),
});

export type CreateAdminInput = z.infer<typeof CreateAdminSchema>;
export type UpdateAdminInput = z.infer<typeof UpdateAdminSchema>;
