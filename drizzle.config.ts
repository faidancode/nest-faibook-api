// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
import { config as loadEnv } from 'dotenv';

// Prefer .env.local for local dev, fallback to default .env if present
loadEnv({ path: '.env.local' });
loadEnv();

export default defineConfig({
  schema: './src/infra/drizzle/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.DB_HOST!,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  },
});
