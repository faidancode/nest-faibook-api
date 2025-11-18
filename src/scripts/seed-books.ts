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

const COVER_URLS = [
  'https://image.gramedia.net/rs:fit:0:0/plain/https://cdn.gramedia.com/uploads/picture_meta/2023/10/30/debsfyx6tcwnvbwdteeakv.jpg',
  'https://image.gramedia.net/rs:fit:0:0/plain/https://cdn.gramedia.com/uploads/items/9786020366517_Cantik-Itu-Luka-Hard-Cover---Limited-Edition.jpg',
  'https://image.gramedia.net/rs:fit:0:0/plain/https://cdn.gramedia.com/uploads/items/9786022912828_animal_farm_new.jpg',
  'https://image.gramedia.net/rs:fit:0:0/plain/https://cdn.gramedia.com/uploads/picture_meta/2024/1/20/qvjtc65vbzmexfegzrgs7u.jpg',
  'https://image.gramedia.net/rs:fit:0:0/plain/https://cdn.gramedia.com/uploads/picture_meta/2024/1/22/bvsftgsrjjckhjupelyegg.jpg',
];

const ADJECTIVES = [
  'Rahasia',
  'Petualangan',
  'Misteri',
  'Legenda',
  'Chronicles',
  'Kisah',
  'Jejak',
  'Episode',
  'Saga',
  'Catatan',
  'Dongeng',
];

const NOUNS = [
  'Cahaya',
  'Bayangan',
  'Samudra',
  'Hutan',
  'Angkasa',
  'Bintang',
  'Pulau',
  'Samurai',
  'Awan',
  'Galaxy',
  'Simfoni',
];

const LANGUAGES = ['Indonesia', 'English', 'Bilingual'];
const PUBLISHERS = [
  'Gramedia Pustaka Utama',
  'Pustaka Abadi',
  'Cakrawala Press',
  'Nusantara Books',
  'Lentera Publishing',
];

const DESCRIPTION_SNIPPETS = [
  'Novel yang menggugah dengan karakter kuat dan alur penuh kejutan.',
  'Perjalanan emosional yang memadukan drama keluarga dengan misteri sejarah.',
  'Panduan inspiratif bagi pembaca yang mencari motivasi baru dalam hidup.',
  'Eksplorasi mendalam mengenai budaya nusantara dengan gaya bertutur modern.',
  'Kisah petualangan penuh aksi yang memadukan teknologi dan mitologi lokal.',
];

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
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(sql`${schema.categories.deletedAt} IS NULL`);

    if (categories.length === 0) {
      throw new Error(
        'No categories found. Please seed categories before seeding books.',
      );
    }

    const authors = await db
      .select({ id: schema.authors.id })
      .from(schema.authors)
      .where(sql`${schema.authors.deletedAt} IS NULL`);

    if (authors.length === 0) {
      throw new Error(
        'No authors found. Please seed authors before seeding books.',
      );
    }

    const totalBooks = 1000;
    type BookInsert = typeof schema.books.$inferInsert;
    const booksPayload: BookInsert[] = [];

    for (let i = 0; i < totalBooks; i++) {
      const title = `${randomFrom(ADJECTIVES)} ${randomFrom(NOUNS)} ${
        i + 1
      }`;
      const slug = `${slugify(title)}-${i + 1}`;
      const category = categories[i % categories.length];
      const price = randomInt(50000, 250000);
      const discount =
        Math.random() > 0.6
          ? price - randomInt(5000, Math.floor(price * 0.3))
          : null;

      const author = randomFrom(authors);

      booksPayload.push({
        id: randomUUID(),
        title,
        slug,
        categoryId: category.id,
        authorId: author.id,
        isbn: randomIsbn(),
        priceCents: price,
        discountPriceCents:
          discount && discount > 0 && discount < price ? discount : null,
        stock: randomInt(5, 200),
        coverUrl: randomFrom(COVER_URLS),
        description: `${randomFrom(DESCRIPTION_SNIPPETS)} Judul ini mengajak pembaca mengikuti ${title.toLowerCase()}.`,
        pages: randomInt(120, 620),
        language: randomFrom(LANGUAGES),
        publisher: randomFrom(PUBLISHERS),
        publishedAt: randomDateWithinYears(8),
        isActive: Math.random() > 0.05,
      });
    }

    const chunkSize = 100;
    let inserted = 0;
    for (let i = 0; i < booksPayload.length; i += chunkSize) {
      const chunk = booksPayload.slice(i, i + chunkSize);
      await db.insert(schema.books).values(chunk);
      inserted += chunk.length;
      // eslint-disable-next-line no-console
      console.log(`Inserted ${inserted}/${totalBooks} books...`);
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
