import { z } from 'zod';

export const AuthorSortFieldEnum = z.enum(['name', 'createdAt']);
export type AuthorSortField = z.infer<typeof AuthorSortFieldEnum>;

export const ListAuthorsQuerySchema = z.object({
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

export type ListAuthorsQuery = z.infer<typeof ListAuthorsQuerySchema>;

export const CreateAuthorSchema = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(160).optional(),
  bio: z.string().max(5000).optional(),
});

export type CreateAuthorInput = z.infer<typeof CreateAuthorSchema>;

export const UpdateAuthorSchema = CreateAuthorSchema.partial();
export type UpdateAuthorInput = z.infer<typeof UpdateAuthorSchema>;
