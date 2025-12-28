import { createPool } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../infra/drizzle/schema';
import { eq } from 'drizzle-orm';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { hash } from 'bcrypt';

function ensureEnvLoaded() {
  const cwd = process.cwd();
  loadEnv({ path: resolve(cwd, '.env.local') });
  loadEnv({ path: resolve(cwd, '.env') });
}

type UserSeed = {
  name: string;
  email: string;
};

const userSeeds: UserSeed[] = [
  { name: 'Superadmin', email: 'supadmin@faibook.com' },
];

async function main() {
  ensureEnvLoaded();
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER as string;
  const password = process.env.DB_PASSWORD as string;
  const database = process.env.DB_NAME || 'bookstore';
  if (!user) throw new Error('DB_USER is required');

  const pool = await createPool({ host, user, password, database });
  const db = drizzle(pool, { schema, mode: 'default' });

  try {
    const passwordHash = await hash('sszxczxc##1', 10);
    let inserted = 0;

    for (const seed of userSeeds) {
      const existing = await db.query.users.findFirst({
        where: eq(schema.users.email, seed.email),
      });

      if (existing) {
        continue;
      }

      await db.insert(schema.users).values({
        id: randomUUID(),
        name: seed.name,
        email: seed.email,
        passwordHash,
        role: 'SUPERADMIN',
        emailConfirmed: true,
        isActive: true,
      });
      inserted += 1;
    }

    console.log(`Users seeding done. Inserted: ${inserted}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
