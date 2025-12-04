// src/config/env.schema.ts
import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // HTTP
  PORT: z
    .string()
    .transform((v) => parseInt(v, 10))
    .default(3000),

  // Database
  DB_HOST: z.string().min(1),
  DB_PORT: z
    .string()
    .transform((v) => parseInt(v, 10))
    .default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'), // e.g. 15m, 1h
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // CORS Config
  CORS_ORIGINS: z.string().default('*'), // "http://localhost:3000,https://myapp.com"
  CORS_CREDENTIALS: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  // Rate limit
  RATE_GLOBAL_TTL: z
    .string()
    .transform((v) => parseInt(v, 10))
    .default(900), // 15m
  RATE_GLOBAL_LIMIT: z
    .string()
    .transform((v) => parseInt(v, 10))
    .default(100),
  RATE_LOGIN_TTL: z
    .string()
    .transform((v) => parseInt(v, 10))
    .default(600), // 10m
  RATE_LOGIN_LIMIT: z
    .string()
    .transform((v) => parseInt(v, 10))
    .default(10),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Midtrans
  MIDTRANS_IS_PRODUCTION: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  MIDTRANS_SERVER_KEY: z.string().min(1),
  MIDTRANS_CLIENT_KEY: z.string().min(1),

  // Swagger / OpenAPI
  ENABLE_SWAGGER: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  // Request ID header
  REQUEST_ID_HEADER: z.string().default('x-request-id'),
});

export type Env = z.infer<typeof EnvSchema>;

// Helper untuk ConfigModule.validate
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten());
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
}
