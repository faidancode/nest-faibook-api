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
    bio: 'Penulis seri Harry Potter yang fenomenal dan menginspirasi generasi pembaca.',
  },
  {
    name: 'Haruki Murakami',
    slug: 'haruki-murakami',
    bio: 'Penulis Jepang dengan gaya surealis penuh simbol dan tema kesepian.',
  },
  {
    name: 'Andrea Hirata',
    slug: 'andrea-hirata',
    bio: 'Penulis Indonesia yang dikenal lewat tetralogi Laskar Pelangi.',
  },
  {
    name: 'Tere Liye',
    slug: 'tere-liye',
    bio: 'Penulis populer dengan karya fiksi dan motivasi yang dekat dengan kehidupan sehari-hari.',
  },
  {
    name: 'Paulo Coelho',
    slug: 'paulo-coelho',
    bio: 'Penulis asal Brasil dengan novel spiritual inspiratif seperti The Alchemist.',
  },
  {
    name: 'George R.R. Martin',
    slug: 'george-rr-martin',
    bio: 'Penulis saga fantasi epik A Song of Ice and Fire.',
  },
  {
    name: 'Stephen King',
    slug: 'stephen-king',
    bio: 'Raja novel horor modern dengan puluhan karya laris dunia.',
  },
  {
    name: 'Neil Gaiman',
    slug: 'neil-gaiman',
    bio: 'Penulis lintas genre yang kaya imajinasi dengan karya seperti American Gods.',
  },
  {
    name: 'Agatha Christie',
    slug: 'agatha-christie',
    bio: 'Ratu misteri yang menciptakan tokoh Hercule Poirot dan Miss Marple.',
  },
  {
    name: 'Dee Lestari',
    slug: 'dee-lestari',
    bio: 'Penulis Indonesia dengan karya puitis dan futuristik seperti seri Supernova.',
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
