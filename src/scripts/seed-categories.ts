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
  { id: '1', name: 'Agama', icon: 'BookOpen', slug: 'agama' },
  { id: '2', name: 'Arsitektur', icon: 'Shapes', slug: 'arsitektur' },
  { id: '3', name: 'Bahasa', icon: 'PenTool', slug: 'bahasa' },
  { id: '4', name: 'Biografi', icon: 'User', slug: 'biografi' },
  { id: '5', name: 'Bisnis', icon: 'Briefcase', slug: 'bisnis' },
  { id: '6', name: 'Fiksi Anak', icon: 'BookOpen', slug: 'fiksi-anak' },
  { id: '7', name: 'Fiksi Remaja', icon: 'BookOpen', slug: 'fiksi-remaja' },
  { id: '8', name: 'Fiksi Dewasa', icon: 'BookOpen', slug: 'fiksi-dewasa' },
  { id: '9', name: 'Hukum', icon: 'Library', slug: 'hukum' },
  { id: '10', name: 'Kesehatan', icon: 'Heart', slug: 'kesehatan' },
  { id: '11', name: 'Komputer', icon: 'Laptop', slug: 'komputer' },
  { id: '12', name: 'Komik', icon: 'BookOpen', slug: 'komik' },
  { id: '13', name: 'Medis', icon: 'Heart', slug: 'medis' },
  { id: '14', name: 'Musik', icon: 'Music', slug: 'musik' },
  { id: '15', name: 'Pengembangan Diri', icon: 'User', slug: 'pengembangan-diri' },
  { id: '16', name: 'Psikologi', icon: 'User', slug: 'psikologi' },
  { id: '17', name: 'Resep Makanan', icon: 'ChefHat', slug: 'resep-makanan' },
  { id: '18', name: 'Travel', icon: 'MapPin', slug: 'travel' },
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
