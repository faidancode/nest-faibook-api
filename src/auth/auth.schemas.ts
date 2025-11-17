import { z } from 'zod';

export const RoleEnum = z.enum(['ADMIN', 'CUSTOMER']);
export type Role = z.infer<typeof RoleEnum>;

export const LoginSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(6).max(100),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(160),
  password: z.string().min(6).max(100),
  phone: z.string().min(6).max(30).optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const RefreshMobileSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshMobileInput = z.infer<typeof RefreshMobileSchema>;

export const JwtPayloadSchema = z.object({
  sub: z.string().min(1), // userId (uuid)
  email: z.string().email(),
  role: RoleEnum,
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;
