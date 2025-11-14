import { z } from "zod";

export const CategorySortFieldEnum = z.enum(["name", "createdAt"]);
export type CategorySortField = z.infer<typeof CategorySortFieldEnum>;

export const ListCategoriesQuerySchema = z.object({
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
  sort: z
    .string()
    .optional()
    .transform((v) => v ?? "name:asc"),
});

export type ListCategoriesQuery = z.infer<typeof ListCategoriesQuerySchema>;

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(160).optional(),
  icon: z.string().max(80).optional(),
  description: z.string().max(255).optional(),
  active: z.boolean().optional().default(true),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = CreateCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
