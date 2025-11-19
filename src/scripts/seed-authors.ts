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

type AuthorSeed = { name: string; slug: string; bio: string };

const POPULAR_AUTHORS: AuthorSeed[] = [
  {
    name: 'J.K. Rowling',
    slug: 'jk-rowling',
    bio: 'British author behind the Harry Potter series that inspired readers worldwide.',
  },
  {
    name: 'George R.R. Martin',
    slug: 'george-rr-martin',
    bio: 'Creator of the epic fantasy saga A Song of Ice and Fire and the world of Westeros.',
  },
  {
    name: 'Stephen King',
    slug: 'stephen-king',
    bio: 'Prolific master of horror, suspense, and supernatural thrillers.',
  },
  {
    name: 'Neil Gaiman',
    slug: 'neil-gaiman',
    bio: 'Genre-bending storyteller known for American Gods, Coraline, and Sandman.',
  },
  {
    name: 'Agatha Christie',
    slug: 'agatha-christie',
    bio: 'The queen of mystery and creator of Hercule Poirot and Miss Marple.',
  },
  {
    name: 'Brandon Sanderson',
    slug: 'brandon-sanderson',
    bio: 'Fantasy writer famous for the Cosmere universe and intricate magic systems.',
  },
  {
    name: 'Rick Riordan',
    slug: 'rick-riordan',
    bio: 'Author of Percy Jackson and other middle-grade adventures inspired by mythology.',
  },
  {
    name: 'Colleen Hoover',
    slug: 'colleen-hoover',
    bio: 'Contemporary romance and new adult writer with emotionally driven bestsellers.',
  },
  {
    name: 'Patrick Rothfuss',
    slug: 'patrick-rothfuss',
    bio: 'Fantasy author known for The Kingkiller Chronicle and lyrical prose.',
  },
  {
    name: 'Yuval Noah Harari',
    slug: 'yuval-noah-harari',
    bio: 'Historian and philosopher known for Sapiens, Homo Deus, and accessible non-fiction.',
  },
  {
    name: 'Jane Austen',
    slug: 'jane-austen',
    bio: 'Classic English novelist chronicling society, manners, and relationships.',
  },
];

async function main() {
  ensureEnvLoaded();
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER as string;
  const password = process.env.DB_PASSWORD as string;
  const database = process.env.DB_NAME as string;

  if (!user || !database) {
    throw new Error('DB_USER and DB_NAME are required');
  }

  const pool = createPool({ host, user, password, database });
  const db = drizzle(pool, { schema, mode: 'default' });

  try {
    let inserted = 0;
    for (const author of POPULAR_AUTHORS) {
      const existing = await db.query.authors.findFirst({
        where: eq(schema.authors.slug, author.slug),
      });

      if (existing) {
        continue;
      }

      await db.insert(schema.authors).values({
        id: randomUUID(),
        name: author.name,
        slug: author.slug,
        bio: author.bio,
      });

      inserted += 1;
    }

    console.log(`Authors seeding completed. Inserted ${inserted} new authors.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
