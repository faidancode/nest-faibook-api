import { z } from 'zod';

const CartItemBaseSchema = z.object({
  id: z.string().uuid(),
  cartId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  priceCentsAtAdd: z.coerce.number().int().min(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CartBaseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  items: z.array(CartItemBaseSchema).default([]),
});

const CartItemInputSchema = CartItemBaseSchema.pick({
  productId: true,
  quantity: true,
  priceCentsAtAdd: true,
});

export const CreateCartSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(CartItemInputSchema).optional().default([]),
});

export const UpdateCartSchema = z.object({
  userId: z.string().uuid().optional(),
  items: z.array(CartItemInputSchema).optional(),
});

export type CreateCartInput = z.infer<typeof CreateCartSchema>;
export type UpdateCartInput = z.infer<typeof UpdateCartSchema>;
export type CartOutput = z.infer<typeof CartBaseSchema>;

