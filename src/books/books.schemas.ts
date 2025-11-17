import { z } from 'zod';

export const BookSortFieldEnum = z.enum(['title', 'createdAt', 'priceCents']);
export type BookSortField = z.infer<typeof BookSortFieldEnum>;

export const ListBooksQuerySchema = z
  .object({
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
    categoryId: z.string().uuid().optional(),
    authorId: z.string().uuid().optional(),
    active: z
      .string()
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined;
        if (v === 'true') return true;
        if (v === 'false') return false;
        return undefined;
      }),
    sort: z
      .string()
      .optional()
      .transform((v) => v ?? 'title:asc'),
  })
  .transform(({ search, ...rest }) => ({
    ...rest,
    q: rest.q ?? search,
  }));

export type ListBooksQuery = z.infer<typeof ListBooksQuerySchema>;

export const CreateBookSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(),
  categoryId: z.string().uuid(),
  authorId: z.string().uuid().optional(),
  isbn: z.string().max(32).optional(),
  priceCents: z.coerce.number().int().min(0),
  discountPriceCents: z.coerce.number().int().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional().default(0),
  coverUrl: z.string().url().max(255),
  description: z.string().min(1),
  pages: z.coerce.number().int().min(1).optional(),
  language: z.string().max(40).optional(),
  publisher: z.string().max(160).optional(),
  publishedAt: z.coerce.date().optional(),
  active: z.boolean().optional().default(true),
});

export type CreateBookInput = z.infer<typeof CreateBookSchema>;

export const UpdateBookSchema = CreateBookSchema.partial();
export type UpdateBookInput = z.infer<typeof UpdateBookSchema>;
