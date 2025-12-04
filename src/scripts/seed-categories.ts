import { createPool } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../infra/drizzle/schema';
import { eq } from 'drizzle-orm';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

function ensureEnvLoaded() {
  const cwd = process.cwd();
  loadEnv({ path: resolve(cwd, '.env.local') });
  loadEnv({ path: resolve(cwd, '.env') });
}

type CategorySeed = { name: string; icon: string; slug: string; id?: string };

const categories: CategorySeed[] = [
  { name: 'Biographies', icon: 'User', slug: 'biographies' },
  { name: 'Business', icon: 'Briefcase', slug: 'business' },
  { name: 'Children Fiction', icon: 'BookOpen', slug: 'children-fiction' },
  { name: 'Young Adult Fiction', icon: 'BookOpen', slug: 'young-adult-fiction' },
  { name: 'Adult Fiction', icon: 'BookOpen', slug: 'adult-fiction' },
  { name: 'Technology', icon: 'Laptop', slug: 'technology' },
  { name: 'Graphic Novels', icon: 'BookOpen', slug: 'graphic-novels' },
  { name: 'Self Improvement', icon: 'User', slug: 'self-improvement' },
  { name: 'Psychology', icon: 'User', slug: 'psychology' },
  { name: 'Cookbooks', icon: 'ChefHat', slug: 'cookbooks' },
  { name: 'Travel', icon: 'MapPin', slug: 'travel' },
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
    let inserted = 0;
    for (const cat of categories) {
      const existing = await db.query.categories.findFirst({
        where: eq(schema.categories.slug, cat.slug),
      });
      if (existing) {
        continue;
      }
      await db.insert(schema.categories).values({
        id: cat.id ?? randomUUID(),
        name: cat.name,
        icon: cat.icon,
        slug: cat.slug,
      });
      inserted += 1;
    }
    console.log(`Categories seeding done. Inserted: ${inserted}.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
