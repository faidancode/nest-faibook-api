import { z } from 'zod';

const WishlistItemBaseSchema = z.object({
  id: z.uuid(),
  wishlistId: z.uuid(),
  bookId: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const WishlistBaseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  items: z.array(WishlistItemBaseSchema).default([]),
});

const WishlistItemInputSchema = z.object({
  bookId: z.uuid(),
});

export const CreateWishlistSchema = z.object({
  userId: z.uuid(),
  items: z.array(WishlistItemInputSchema).optional().default([]),
});

export const UpdateWishlistSchema = z.object({
  userId: z.uuid().optional(),
  items: z.array(WishlistItemInputSchema).optional(),
});

export type WishlistOutput = z.infer<typeof WishlistBaseSchema>;
export type CreateWishlistInput = z.infer<typeof CreateWishlistSchema>;
export type UpdateWishlistInput = z.infer<typeof UpdateWishlistSchema>;
