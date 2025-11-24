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
  { name: 'John Doe', email: 'john.doe@example.com' },
  { name: 'Jane Smith', email: 'jane.smith@example.com' },
  { name: 'Michael Johnson', email: 'michael.johnson@example.com' },
  { name: 'Emily Davis', email: 'emily.davis@example.com' },
  { name: 'Christopher Brown', email: 'christopher.brown@example.com' },
  { name: 'Olivia Wilson', email: 'olivia.wilson@example.com' },
  { name: 'Daniel Martinez', email: 'daniel.martinez@example.com' },
  { name: 'Sophia Anderson', email: 'sophia.anderson@example.com' },
  { name: 'Matthew Thomas', email: 'matthew.thomas@example.com' },
  { name: 'Ava Taylor', email: 'ava.taylor@example.com' },
  { name: 'Ethan Moore', email: 'ethan.moore@example.com' },
  { name: 'Isabella Jackson', email: 'isabella.jackson@example.com' },
  { name: 'Alexander White', email: 'alexander.white@example.com' },
  { name: 'Mia Harris', email: 'mia.harris@example.com' },
  { name: 'Benjamin Martin', email: 'benjamin.martin@example.com' },
  { name: 'Charlotte Thompson', email: 'charlotte.thompson@example.com' },
  { name: 'William Garcia', email: 'william.garcia@example.com' },
  { name: 'Amelia Martinez', email: 'amelia.martinez@example.com' },
  { name: 'James Robinson', email: 'james.robinson@example.com' },
  { name: 'Harper Clark', email: 'harper.clark@example.com' },
  { name: 'Liam Turner', email: 'liam.turner@example.com' },
  { name: 'Ella Rodriguez', email: 'ella.rodriguez@example.com' },
  { name: 'Noah Lee', email: 'noah.lee@example.com' },
  { name: 'Abigail Perez', email: 'abigail.perez@example.com' },
  { name: 'Mason Young', email: 'mason.young@example.com' },
  { name: 'Evelyn Hall', email: 'evelyn.hall@example.com' },
  { name: 'Logan Allen', email: 'logan.allen@example.com' },
  { name: 'Lily Sanchez', email: 'lily.sanchez@example.com' },
  { name: 'Lucas Wright', email: 'lucas.wright@example.com' },
  { name: 'Grace King', email: 'grace.king@example.com' },
  { name: 'Henry Scott', email: 'henry.scott@example.com' },
  { name: 'Chloe Green', email: 'chloe.green@example.com' },
  { name: 'Jack Adams', email: 'jack.adams@example.com' },
  { name: 'Aria Baker', email: 'aria.baker@example.com' },
  { name: 'Samuel Nelson', email: 'samuel.nelson@example.com' },
  { name: 'Zoe Carter', email: 'zoe.carter@example.com' },
  { name: 'David Mitchell', email: 'david.mitchell@example.com' },
  { name: 'Nora Perez', email: 'nora.perez@example.com' },
  { name: 'Elijah Rivera', email: 'elijah.rivera@example.com' },
  { name: 'Victoria Cox', email: 'victoria.cox@example.com' },
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
    const passwordHash = await hash('asdasd123f', 10);
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
        role: 'CUSTOMER',
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
