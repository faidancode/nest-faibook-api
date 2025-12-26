import { createPool } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../infra/drizzle/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

function ensureEnvLoaded() {
  const cwd = process.cwd();
  loadEnv({ path: resolve(cwd, '.env.local') });
  loadEnv({ path: resolve(cwd, '.env') });
}

const badReviewTemplates = [
  {
    title: 'Not For Me',
    body: 'The pacing felt slow and I struggled to stay engaged.',
  },
  {
    title: 'Disappointing Experience',
    body: 'Expected more from the premise; the execution just fell flat.',
  },
  {
    title: 'Could Be Better',
    body: 'Some interesting ideas, but overall it did not resonate with me.',
  },
  {
    title: 'Needs Improvement',
    body: 'Characters felt underdeveloped and the plot was predictable.',
  },
  {
    title: 'Underwhelming Read',
    body: 'Difficult to get through; I expected a more polished narrative.',
  },
];

const goodReviewTemplates = [
  {
    title: 'Solid Read',
    body: 'Good storyline with memorable moments; worth the time.',
  },
  {
    title: 'Well Written',
    body: 'Engaging prose and a satisfying arc throughout.',
  },
  {
    title: 'Worth Recommending',
    body: 'Interesting ideas and relatable characters made this enjoyable.',
  },
  {
    title: 'Enjoyable Journey',
    body: 'Kept me invested and offered plenty of thoughtful moments.',
  },
  {
    title: 'Great Value',
    body: 'Informative and inspiring—learned so much from this book.',
  },
];

const excellentReviewTemplates = [
  {
    title: 'Fantastic Read',
    body: 'Loved the pacing and characters; definitely worth recommending.',
  },
  {
    title: 'Highly Recommended',
    body: 'The story kept me hooked from start to finish. A must-read!',
  },
  {
    title: 'Engaging Storyline',
    body: 'Plot twists were on point and the ending was satisfying.',
  },
  {
    title: 'Could Not Put It Down',
    body: 'The narrative was gripping and the characters felt very real.',
  },
  {
    title: 'Exceeded Expectations',
    body: 'Went far beyond what I anticipated; thoroughly impressed.',
  },
];

const pickTemplate = (rating: number, index: number) => {
  if (rating === 5) {
    return excellentReviewTemplates[index % excellentReviewTemplates.length];
  }
  if (rating === 4) {
    return goodReviewTemplates[index % goodReviewTemplates.length];
  }
  return badReviewTemplates[index % badReviewTemplates.length];
};

async function main() {
  ensureEnvLoaded();
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER as string;
  const password = process.env.DB_PASSWORD as string;
  const database = process.env.DB_NAME || 'bookstore';
  if (!user) throw new Error('DB_USER is required');

  const pool = await createPool({ host, user, password, database });
  const db = drizzle(pool, { schema, mode: 'default' });

  const books = await db
    .select({ id: schema.books.id })
    .from(schema.books)
    .where(sql`${schema.books.deletedAt} IS NULL`)
    .limit(8);

  if (books.length === 0) {
    console.log('No books found. Skipping review seeding.');
    await pool.end();
    return;
  }

  const bookIds = books.map((book) => book.id);

  try {
    const customers = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
      })
      .from(schema.users)
      .where(eq(schema.users.role, 'CUSTOMER'));

    if (customers.length === 0) {
      console.log('No customer users found. Skipping review seeding.');
      return;
    }

    const customerIds = customers.map((customer) => customer.id);

    const existingReviews =
      customerIds.length > 0
        ? await db
            .select({
              userId: schema.reviews.userId,
              bookId: schema.reviews.bookId,
            })
            .from(schema.reviews)
            .where(
              and(
                inArray(schema.reviews.userId, customerIds),
                inArray(schema.reviews.bookId, bookIds),
              ),
            )
        : [];

    const reviewsByUser = new Map<string, Set<string>>();
    for (const review of existingReviews) {
      const set = reviewsByUser.get(review.userId);
      if (set) {
        set.add(review.bookId);
      } else {
        reviewsByUser.set(review.userId, new Set([review.bookId]));
      }
    }

    let inserted = 0;

    for (const [userIndex, customer] of customers.entries()) {
      let existingSet = reviewsByUser.get(customer.id);
      if (!existingSet) {
        existingSet = new Set<string>();
        reviewsByUser.set(customer.id, existingSet);
      }

      for (const [bookIndex, bookId] of bookIds.entries()) {
        if (existingSet.has(bookId)) {
          continue;
        }

        const sequence = userIndex * bookIds.length + bookIndex;
        const rating = ((userIndex + bookIndex) % 5) + 1;
        const template = pickTemplate(rating, sequence);

        await db.insert(schema.reviews).values({
          id: randomUUID(),
          userId: customer.id,
          bookId,
          rating,
          title: template.title,
          body: template.body,
        });

        existingSet.add(bookId);
        inserted += 1;
      }
    }

    const ratingStats = await db
      .select({
        bookId: schema.reviews.bookId,
        total: sql<number>`COUNT(*)`,
        sum: sql<number>`COALESCE(SUM(${schema.reviews.rating}), 0)`,
      })
      .from(schema.reviews)
      .where(inArray(schema.reviews.bookId, bookIds))
      .groupBy(schema.reviews.bookId);

    const ratingMap = new Map(ratingStats.map((row) => [row.bookId, row]));

    await Promise.all(
      books.map((book) => {
        const stats = ratingMap.get(book.id);
        const total = Number(stats?.total ?? 0);
        const sum = Number(stats?.sum ?? 0);
        const averageRating = total ? Number((sum / total).toFixed(2)) : 0;

        return db
          .update(schema.books)
          .set({
            ratingAvg: averageRating.toFixed(2),
            ratingCount: total,
            updatedAt: new Date(),
          })
          .where(eq(schema.books.id, book.id));
      }),
    );

    console.log(
      `Reviews seeding done. Inserted: ${inserted}. Expected total: ${customers.length * bookIds.length}.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
