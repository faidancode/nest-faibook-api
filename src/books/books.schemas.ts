import { z } from 'zod';

export const REVIEW_RATING_VALUES = [1, 2, 3, 4, 5] as const;
export type ReviewRatingValue = (typeof REVIEW_RATING_VALUES)[number];

export const BookSortFieldEnum = z.enum(['title', 'createdAt', 'priceCents']);
export type BookSortField = z.infer<typeof BookSortFieldEnum>;

const priceFilterSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'number') {
      if (Number.isNaN(value)) {
        return undefined;
      }
      return Math.max(0, Math.floor(value));
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed)) {
      return undefined;
    }

    return Math.max(0, parsed);
  });

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
    category: z
      .string()
      .optional()
      .transform((value) => {
        const trimmed = value?.trim();
        return trimmed ? trimmed : undefined;
      }),
    categoryId: z.uuid().optional(),
    authorId: z.uuid().optional(),
    minPrice: priceFilterSchema,
    maxPrice: priceFilterSchema,
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

const ratingFilterSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    const parsed =
      typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.isFinite(value)
        ? Math.trunc(value)
        : NaN;

    if (Number.isNaN(parsed)) {
      return undefined;
    }

    if (!REVIEW_RATING_VALUES.includes(parsed as ReviewRatingValue)) {
      return undefined;
    }

    return parsed as ReviewRatingValue;
  });

export const ReviewSortEnum = z.enum(['newest', 'oldest', 'highest', 'lowest']);

const pageSizeInputSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    const parsed =
      typeof value === 'number'
        ? value
        : Number.parseInt(value.trim(), 10);

    if (!Number.isFinite(parsed)) {
      return undefined;
    }

    return parsed;
  })
  .pipe(z.number().int().min(1).max(100).optional());

export const ListBookReviewsQuerySchema = z
  .object({
    page: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => {
        const parsed =
          typeof v === 'number'
            ? v
            : v
            ? Number.parseInt(v.trim(), 10)
            : 1;

        return Number.isFinite(parsed) ? parsed : 1;
      })
      .pipe(z.number().int().min(1)),
    pageSize: pageSizeInputSchema,
    limit: pageSizeInputSchema,
    sort: ReviewSortEnum.optional().default('newest'),
    rating: ratingFilterSchema,
  })
  .transform(({ limit, pageSize, ...rest }) => ({
    ...rest,
    pageSize: pageSize ?? limit ?? 10,
  }));

export type ListBookReviewsQuery = z.infer<typeof ListBookReviewsQuerySchema>;

export const CreateReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().min(1),
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

export const CreateBookSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(),
  categoryId: z.uuid(),
  authorId: z.uuid().optional(),
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
