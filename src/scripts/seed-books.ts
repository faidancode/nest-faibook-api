import { createPool } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';
import * as schema from '../infra/drizzle/schema';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

function ensureEnvLoaded() {
  const cwd = process.cwd();
  loadEnv({ path: resolve(cwd, '.env.local') });
  loadEnv({ path: resolve(cwd, '.env') });
}

const ADJECTIVES = [
  'Hidden',
  'Enchanted',
  'Luminous',
  'Forgotten',
  'Shattered',
  'Infinite',
  'Silent',
  'Eternal',
  'Fierce',
  'Arcane',
  'Celestial',
];

const NOUNS = [
  'Horizons',
  'Legends',
  'Echoes',
  'Realms',
  'Chronicles',
  'Voyages',
  'Wonders',
  'Fables',
  'Gardens',
  'Symphonies',
  'Labyrinths',
];

const LANGUAGES = ['English', 'Spanish', 'German', 'French', 'Bilingual'];
const PUBLISHERS = [
  'Northwind Press',
  'Silver Oak Publishing',
  'Aurora House',
  'Harborlight Books',
  'Blue Horizon Media',
];

const DESCRIPTION_SNIPPETS = [
  'A sweeping tale with memorable characters and a cinematic pace.',
  'An emotional journey that blends family drama with historical intrigue.',
  'A motivating field guide for readers reinventing their routines.',
  'A thoughtful exploration of culture and identity told in modern prose.',
  'An adventurous roller coaster that mixes technology, myth, and mystery.',
];

const FEATURED_SERIES = [
  {
    title: "Harry Potter and the Sorcerer's Stone",
    authorSlug: 'jk-rowling',
    categorySlug: 'young-adult-fiction',
  },
  {
    title: 'Harry Potter and the Chamber of Secrets',
    authorSlug: 'jk-rowling',
    categorySlug: 'young-adult-fiction',
  },
  {
    title: 'A Game of Thrones',
    authorSlug: 'george-rr-martin',
    categorySlug: 'adult-fiction',
  },
  {
    title: 'A Clash of Kings',
    authorSlug: 'george-rr-martin',
    categorySlug: 'adult-fiction',
  },
  {
    title: 'Percy Jackson and the Lightning Thief',
    authorSlug: 'rick-riordan',
    categorySlug: 'children-fiction',
  },
  {
    title: 'The Lightning Tree',
    authorSlug: 'patrick-rothfuss',
    categorySlug: 'adult-fiction',
  },
  {
    title: 'The Final Empire',
    authorSlug: 'brandon-sanderson',
    categorySlug: 'adult-fiction',
  },
  {
    title: 'Good Omens',
    authorSlug: 'neil-gaiman',
    categorySlug: 'adult-fiction',
  },
  {
    title: 'Murder on the Orient Express',
    authorSlug: 'agatha-christie',
    categorySlug: 'adult-fiction',
  },
  {
    title: 'It Ends with Us',
    authorSlug: 'colleen-hoover',
    categorySlug: 'adult-fiction',
  },
];

const delay = (ms: number) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function randomDateWithinYears(years: number) {
  const now = Date.now();
  const pastMs = years * 365 * 24 * 60 * 60 * 1000;
  const rand = Math.random() * pastMs;
  return new Date(now - rand);
}

function randomIsbn() {
  let isbn = '';
  for (let i = 0; i < 13; i++) {
    isbn += Math.floor(Math.random() * 10);
  }
  return isbn;
}

async function main() {
  ensureEnvLoaded();
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER as string;
  const password = process.env.DB_PASSWORD as string;
  const database = process.env.DB_NAME as string;
  if (!user || !database) {
    throw new Error('DB_USER and DB_NAME are required');
  }

  const pool = createPool({
    host,
    user,
    password,
    database,
  });

  const db = drizzle(pool, { schema, mode: 'default' });

  try {
    const categories = await db
      .select({
        id: schema.categories.id,
        slug: schema.categories.slug,
        name: schema.categories.name,
      })
      .from(schema.categories)
      .where(sql`${schema.categories.deletedAt} IS NULL`);

    if (categories.length === 0) {
      throw new Error(
        'No categories found. Please seed categories before seeding books.',
      );
    }

    const authors = await db
      .select({
        id: schema.authors.id,
        slug: schema.authors.slug,
        name: schema.authors.name,
      })
      .from(schema.authors)
      .where(sql`${schema.authors.deletedAt} IS NULL`);

    if (authors.length === 0) {
      throw new Error(
        'No authors found. Please seed authors before seeding books.',
      );
    }

    const totalBooks = Number(process.env.SEED_BOOKS_TOTAL ?? 10000);
    type BookInsert = typeof schema.books.$inferInsert;
    const booksPayload: BookInsert[] = [];
    const categoriesBySlug = new Map(
      categories.map((category) => [category.slug, category]),
    );
    const authorsBySlug = new Map(
      authors.map((author) => [author.slug, author]),
    );

    for (let i = 0; i < totalBooks; i++) {
      const template = FEATURED_SERIES[i % FEATURED_SERIES.length];
      const chosenCategory =
        (template &&
          template.categorySlug &&
          categoriesBySlug.get(template.categorySlug)) ||
        randomFrom(categories);
      const chosenAuthor =
        (template &&
          template.authorSlug &&
          authorsBySlug.get(template.authorSlug)) ||
        randomFrom(authors);
      const baseTitle =
        template?.title ?? `${randomFrom(ADJECTIVES)} ${randomFrom(NOUNS)}`;
      const titleSuffix = randomInt(1, 99999);
      const title = `${baseTitle} #${titleSuffix}`;
      const slug = `${slugify(baseTitle)}-${titleSuffix}`;
      const price = randomInt(50000, 250000);
      const discount =
        Math.random() > 0.6
          ? price - randomInt(5000, Math.floor(price * 0.3))
          : null;

      booksPayload.push({
        id: randomUUID(),
        title,
        slug,
        categoryId: chosenCategory.id,
        authorId: chosenAuthor.id,
        isbn: randomIsbn(),
        priceCents: price,
        discountPriceCents:
          discount && discount > 0 && discount < price ? discount : null,
        stock: randomInt(5, 200),
        coverUrl: `https://picsum.photos/seed/${slug}/400/600`,
        description: `${randomFrom(DESCRIPTION_SNIPPETS)} Follow ${chosenAuthor.name} through "${title}" for a fresh take on modern storytelling.`,
        pages: randomInt(120, 620),
        language: randomFrom(LANGUAGES),
        publisher: randomFrom(PUBLISHERS),
        publishedAt: randomDateWithinYears(8),
        isActive: Math.random() > 0.05,
      });
    }

    const chunkSize = 50;
    const delayGroupSize = Number(
      process.env.SEED_BOOKS_DELAY_GROUP_SIZE ?? 10,
    );
    const delayMs = Number(process.env.SEED_BOOKS_DELAY_MS ?? 3000);
    let bufferedForDelay = 0;
    let inserted = 0;
    for (let i = 0; i < booksPayload.length; i += chunkSize) {
      const chunk = booksPayload.slice(i, i + chunkSize);
      await db.insert(schema.books).values(chunk);
      inserted += chunk.length;
      bufferedForDelay += chunk.length;
      // eslint-disable-next-line no-console
      console.log(`Inserted ${inserted}/${totalBooks} books...`);

      while (bufferedForDelay >= delayGroupSize) {
        // eslint-disable-next-line no-console
        console.log(
          `Waiting ${delayMs}ms before inserting the next ${delayGroupSize} books...`,
        );
        await delay(delayMs);
        bufferedForDelay -= delayGroupSize;
      }
    }

    console.log('Books seeding completed.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
