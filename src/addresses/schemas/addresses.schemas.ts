import { z } from 'zod';

export const AddressBaseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  label: z.string().min(1).max(60),
  recipientName: z.string().min(1).max(120),
  recipientPhone: z.string().min(5).max(30),
  street: z.string().min(1).max(255),
  subdistrict: z.string().max(120).nullable(),
  district: z.string().max(120).nullable(),
  city: z.string().max(120).nullable(),
  province: z.string().max(120).nullable(),
  postalCode: z.string().max(20).nullable(),
  isPrimary: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
});

export const ListAddressesQuerySchema = z.object({
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
  userId: z.uuid().optional(),
});

export const CreateAddressSchema = z.object({
  userId: z.uuid(),
  label: z.string().min(1).max(60),
  recipientName: z.string().min(1).max(120),
  recipientPhone: z.string().min(5).max(30),
  street: z.string().min(1).max(255),
  subdistrict: z.string().max(120).nullish(),
  district: z.string().max(120).nullish(),
  city: z.string().max(120).nullish(),
  province: z.string().max(120).nullish(),
  postalCode: z.string().max(20).nullish(),
  isPrimary: z.coerce.boolean().optional().default(false),
});

export const UpdateAddressSchema = z.object({
  userId: z.uuid().optional(),
  label: z.string().min(1).max(60).optional(),
  recipientName: z.string().min(1).max(120).optional(),
  recipientPhone: z.string().min(5).max(30).optional(),
  street: z.string().min(1).max(255).optional(),
  subdistrict: z.string().max(120).nullish(),
  district: z.string().max(120).nullish(),
  city: z.string().max(120).nullish(),
  province: z.string().max(120).nullish(),
  postalCode: z.string().max(20).nullish(),
  isPrimary: z.coerce.boolean().optional(),
});

export const AddressOwnerSchema = z.object({
  userId: z.uuid(),
});

export type AddressOutput = z.infer<typeof AddressBaseSchema>;
export type ListAddressesQuery = z.infer<typeof ListAddressesQuerySchema>;
export type CreateAddressInput = z.infer<typeof CreateAddressSchema>;
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>;
export type AddressOwnerInput = z.infer<typeof AddressOwnerSchema>;
