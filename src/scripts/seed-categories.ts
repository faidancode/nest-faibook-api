import { createPool } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../infra/drizzle/schema';
import { eq } from 'drizzle-orm';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

function ensureEnvLoaded() {
  const cwd = process.cwd();
  loadEnv({ path: resolve(cwd, '.env.local') });
  loadEnv({ path: resolve(cwd, '.env') });
}

type CategorySeed = { id: string; name: string; icon: string; slug: string };

const categories: CategorySeed[] = [
  { id: '1', name: 'Religion & Spirituality', icon: 'BookOpen', slug: 'religion' },
  { id: '2', name: 'Architecture & Design', icon: 'Shapes', slug: 'architecture' },
  { id: '3', name: 'Languages & Linguistics', icon: 'PenTool', slug: 'languages' },
  { id: '4', name: 'Biographies & Memoirs', icon: 'User', slug: 'biographies' },
  { id: '5', name: 'Business & Management', icon: 'Briefcase', slug: 'business' },
  { id: '6', name: 'Children Fiction', icon: 'BookOpen', slug: 'children-fiction' },
  { id: '7', name: 'Young Adult Fiction', icon: 'BookOpen', slug: 'young-adult-fiction' },
  { id: '8', name: 'Adult Fiction', icon: 'BookOpen', slug: 'adult-fiction' },
  { id: '9', name: 'Law & Government', icon: 'Library', slug: 'law' },
  { id: '10', name: 'Health & Wellness', icon: 'Heart', slug: 'health-wellness' },
  { id: '11', name: 'Computers & Technology', icon: 'Laptop', slug: 'computers-technology' },
  { id: '12', name: 'Comics & Graphic Novels', icon: 'BookOpen', slug: 'comics-graphic-novels' },
  { id: '13', name: 'Medical Reference', icon: 'Heart', slug: 'medical-reference' },
  { id: '14', name: 'Music & Performing Arts', icon: 'Music', slug: 'music-performing-arts' },
  { id: '15', name: 'Self Improvement', icon: 'User', slug: 'self-improvement' },
  { id: '16', name: 'Psychology', icon: 'User', slug: 'psychology' },
  { id: '17', name: 'Cookbooks & Food', icon: 'ChefHat', slug: 'cookbooks-food' },
  { id: '18', name: 'Travel & Adventure', icon: 'MapPin', slug: 'travel-adventure' },
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
        where: eq(schema.categories.id, cat.id),
      });
      const existingByName = existing
        ? existing
        : await db.query.categories.findFirst({
            where: eq(schema.categories.name, cat.name),
          });
      if (existingByName) {
        continue;
      }
      await db.insert(schema.categories).values({
        id: cat.id,
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
