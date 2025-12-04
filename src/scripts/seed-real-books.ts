import { createPool } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../infra/drizzle/schema';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { eq, inArray } from 'drizzle-orm';

function ensureEnvLoaded() {
  const cwd = process.cwd();
  loadEnv({ path: resolve(cwd, '.env.local') });
  loadEnv({ path: resolve(cwd, '.env') });
}

type RealBookSeed = {
  title: string;
  slug: string;
  authorSlug: string;
  categorySlug: string;
  isbn: string;
  coverUrl: string;
  description: string;
  publisher: string;
  pages: number;
  language: string;
  priceCents: number;
  discountPriceCents?: number;
  stock: number;
  publishedAt: string;
};

const REAL_BOOKS: RealBookSeed[] = [
  {
    title: 'Harry Potter and the Sorcerer\'s Stone',
    slug: 'harry-potter-and-the-sorcerers-stone',
    authorSlug: 'jk-rowling',
    categorySlug: 'children-fiction',
    isbn: '9780439708180',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780439708180-L.jpg',
    description:
      'Harry discovers Hogwarts, lifelong friendships, and the mystery of a legendary stone in his first year.',
    publisher: 'Bloomsbury',
    pages: 320,
    language: 'English',
    priceCents: 185000,
    discountPriceCents: 155000,
    stock: 200,
    publishedAt: '1997-06-26',
  },
  {
    title: 'Harry Potter and the Chamber of Secrets',
    slug: 'harry-potter-and-the-chamber-of-secrets',
    authorSlug: 'jk-rowling',
    categorySlug: 'children-fiction',
    isbn: '9780439064873',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780439064873-L.jpg',
    description:
      'A hidden chamber is opened at Hogwarts and Harry must uncover its monster to protect his classmates.',
    publisher: 'Bloomsbury',
    pages: 352,
    language: 'English',
    priceCents: 189000,
    discountPriceCents: 160000,
    stock: 190,
    publishedAt: '1998-07-02',
  },
  {
    title: 'Harry Potter and the Prisoner of Azkaban',
    slug: 'harry-potter-and-the-prisoner-of-azkaban',
    authorSlug: 'jk-rowling',
    categorySlug: 'children-fiction',
    isbn: '9780439136365',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780439136365-L.jpg',
    description:
      'Sirius Black escapes Azkaban, forcing Harry to confront the ghosts of his family\'s past.',
    publisher: 'Bloomsbury',
    pages: 448,
    language: 'English',
    priceCents: 209000,
    discountPriceCents: 179000,
    stock: 185,
    publishedAt: '1999-07-08',
  },
  {
    title: 'Harry Potter and the Goblet of Fire',
    slug: 'harry-potter-and-the-goblet-of-fire',
    authorSlug: 'jk-rowling',
    categorySlug: 'children-fiction',
    isbn: '9780439139601',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780439139601-L.jpg',
    description:
      'The Triwizard Tournament arrives with deadly trials and Voldemort\'s rise looming in the shadows.',
    publisher: 'Bloomsbury',
    pages: 734,
    language: 'English',
    priceCents: 229000,
    stock: 170,
    publishedAt: '2000-07-08',
  },
  {
    title: 'Harry Potter and the Order of the Phoenix',
    slug: 'harry-potter-and-the-order-of-the-phoenix',
    authorSlug: 'jk-rowling',
    categorySlug: 'children-fiction',
    isbn: '9780439358071',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780439358071-L.jpg',
    description:
      'Harry leads Dumbledore\'s Army while the Order fights Voldemort\'s return and the Ministry\'s denial.',
    publisher: 'Bloomsbury',
    pages: 870,
    language: 'English',
    priceCents: 239000,
    discountPriceCents: 199000,
    stock: 165,
    publishedAt: '2003-06-21',
  },
  {
    title: 'Harry Potter and the Half-Blood Prince',
    slug: 'harry-potter-and-the-half-blood-prince',
    authorSlug: 'jk-rowling',
    categorySlug: 'children-fiction',
    isbn: '9780439784542',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780439784542-L.jpg',
    description:
      'Secrets of Voldemort\'s past surface while Harry follows the mysterious notes of the Half-Blood Prince.',
    publisher: 'Bloomsbury',
    pages: 652,
    language: 'English',
    priceCents: 229000,
    stock: 160,
    publishedAt: '2005-07-16',
  },
  {
    title: 'Harry Potter and the Deathly Hallows',
    slug: 'harry-potter-and-the-deathly-hallows',
    authorSlug: 'jk-rowling',
    categorySlug: 'children-fiction',
    isbn: '9780545139700',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780545139700-L.jpg',
    description:
      'The final battle for the wizarding world pits Harry against Voldemort in a race for the Deathly Hallows.',
    publisher: 'Bloomsbury',
    pages: 759,
    language: 'English',
    priceCents: 245000,
    stock: 175,
    publishedAt: '2007-07-21',
  },
  {
    title: 'A Game of Thrones',
    slug: 'a-game-of-thrones',
    authorSlug: 'george-rr-martin',
    categorySlug: 'adult-fiction',
    isbn: '9780553386790',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780553386790-L.jpg',
    description:
      'Noble houses vie for power across Westeros while winter and dark magic creep ever closer.',
    publisher: 'Bantam Spectra',
    pages: 835,
    language: 'English',
    priceCents: 219000,
    discountPriceCents: 189000,
    stock: 140,
    publishedAt: '1996-08-06',
  },
  {
    title: 'A Clash of Kings',
    slug: 'a-clash-of-kings',
    authorSlug: 'george-rr-martin',
    categorySlug: 'adult-fiction',
    isbn: '9780553381696',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780553381696-L.jpg',
    description:
      'Five kings battle for the Iron Throne as plots, prophecies, and wildfire ignite Westeros.',
    publisher: 'Bantam Spectra',
    pages: 969,
    language: 'English',
    priceCents: 229000,
    stock: 135,
    publishedAt: '1999-02-02',
  },
  {
    title: 'A Storm of Swords',
    slug: 'a-storm-of-swords',
    authorSlug: 'george-rr-martin',
    categorySlug: 'adult-fiction',
    isbn: '9780553381702',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780553381702-L.jpg',
    description:
      'Betrayal and war reach a boiling point in the blood-soaked third volume of A Song of Ice and Fire.',
    publisher: 'Bantam Spectra',
    pages: 1177,
    language: 'English',
    priceCents: 239000,
    stock: 130,
    publishedAt: '2000-10-31',
  },
  {
    title: 'The Shining',
    slug: 'the-shining',
    authorSlug: 'stephen-king',
    categorySlug: 'adult-fiction',
    isbn: '9780307743657',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780307743657-L.jpg',
    description:
      'Isolation and supernatural forces push a family to the edge inside the haunted Overlook Hotel.',
    publisher: 'Anchor',
    pages: 688,
    language: 'English',
    priceCents: 189000,
    stock: 145,
    publishedAt: '1977-01-28',
  },
  {
    title: 'IT',
    slug: 'it-stephen-king',
    authorSlug: 'stephen-king',
    categorySlug: 'adult-fiction',
    isbn: '9781501142970',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9781501142970-L.jpg',
    description:
      'Childhood fears manifest as Pennywise returns to haunt the Losers Club across decades.',
    publisher: 'Scribner',
    pages: 1184,
    language: 'English',
    priceCents: 219000,
    stock: 125,
    publishedAt: '1986-09-15',
  },
  {
    title: '11/22/63',
    slug: '11-22-63',
    authorSlug: 'stephen-king',
    categorySlug: 'adult-fiction',
    isbn: '9781451627299',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9781451627299-L.jpg',
    description:
      'A time traveler attempts to stop the JFK assassination, discovering the consequences of changing history.',
    publisher: 'Scribner',
    pages: 849,
    language: 'English',
    priceCents: 205000,
    stock: 120,
    publishedAt: '2011-11-08',
  },
  {
    title: 'American Gods',
    slug: 'american-gods',
    authorSlug: 'neil-gaiman',
    categorySlug: 'adult-fiction',
    isbn: '9780062572233',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780062572233-L.jpg',
    description:
      'Shadow embarks on a road trip with the mysterious Mr. Wednesday amid a war between old and new gods.',
    publisher: 'William Morrow',
    pages: 560,
    language: 'English',
    priceCents: 199000,
    stock: 110,
    publishedAt: '2001-06-19',
  },
  {
    title: 'Coraline',
    slug: 'coraline',
    authorSlug: 'neil-gaiman',
    categorySlug: 'children-fiction',
    isbn: '9780380807345',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780380807345-L.jpg',
    description:
      'Curious Coraline discovers a sinister other world that wants to keep her forever.',
    publisher: 'HarperCollins',
    pages: 176,
    language: 'English',
    priceCents: 129000,
    stock: 160,
    publishedAt: '2002-08-04',
  },
  {
    title: 'Murder on the Orient Express',
    slug: 'murder-on-the-orient-express',
    authorSlug: 'agatha-christie',
    categorySlug: 'adult-fiction',
    isbn: '9780062689665',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780062689665-L.jpg',
    description:
      'Hercule Poirot must solve a murder aboard a snowbound luxury train full of suspects.',
    publisher: 'HarperCollins',
    pages: 288,
    language: 'English',
    priceCents: 159000,
    stock: 150,
    publishedAt: '1934-01-01',
  },
  {
    title: 'And Then There Were None',
    slug: 'and-then-there-were-none',
    authorSlug: 'agatha-christie',
    categorySlug: 'adult-fiction',
    isbn: '9780062073488',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780062073488-L.jpg',
    description:
      'Ten strangers are stranded on an island and accused of their darkest crimes one by one.',
    publisher: 'HarperCollins',
    pages: 272,
    language: 'English',
    priceCents: 155000,
    stock: 145,
    publishedAt: '1939-11-06',
  },
  {
    title: 'The Way of Kings',
    slug: 'the-way-of-kings',
    authorSlug: 'brandon-sanderson',
    categorySlug: 'adult-fiction',
    isbn: '9780765326355',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780765326355-L.jpg',
    description:
      'Epic war, stormlight, and radiant knights collide in the opening of the Stormlight Archive.',
    publisher: 'Tor Books',
    pages: 1008,
    language: 'English',
    priceCents: 259000,
    stock: 115,
    publishedAt: '2010-08-31',
  },
  {
    title: 'Mistborn: The Final Empire',
    slug: 'mistborn-the-final-empire',
    authorSlug: 'brandon-sanderson',
    categorySlug: 'adult-fiction',
    isbn: '9780765350381',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780765350381-L.jpg',
    description:
      'A street thief joins rebels who plan to overthrow the immortal Lord Ruler using allomantic magic.',
    publisher: 'Tor Books',
    pages: 672,
    language: 'English',
    priceCents: 199000,
    discountPriceCents: 169000,
    stock: 130,
    publishedAt: '2006-07-17',
  },
  {
    title: 'Words of Radiance',
    slug: 'words-of-radiance',
    authorSlug: 'brandon-sanderson',
    categorySlug: 'adult-fiction',
    isbn: '9780765326362',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780765326362-L.jpg',
    description:
      'Shardbearers unite as ancient spren bonds deepen in the second Stormlight Archive novel.',
    publisher: 'Tor Books',
    pages: 1088,
    language: 'English',
    priceCents: 269000,
    stock: 110,
    publishedAt: '2014-03-04',
  },
  {
    title: 'Percy Jackson and the Lightning Thief',
    slug: 'percy-jackson-and-the-lightning-thief',
    authorSlug: 'rick-riordan',
    categorySlug: 'children-fiction',
    isbn: '9781423134947',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9781423134947-L.jpg',
    description:
      'Percy learns he is a demigod and must retrieve Zeus\'s stolen lightning bolt.',
    publisher: 'Disney Hyperion',
    pages: 400,
    language: 'English',
    priceCents: 149000,
    stock: 210,
    publishedAt: '2005-06-28',
  },
  {
    title: 'Percy Jackson and the Sea of Monsters',
    slug: 'percy-jackson-and-the-sea-of-monsters',
    authorSlug: 'rick-riordan',
    categorySlug: 'children-fiction',
    isbn: '9781423145509',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9781423145509-L.jpg',
    description:
      'Percy sails into the Sea of Monsters to find the Golden Fleece and save Camp Half-Blood.',
    publisher: 'Disney Hyperion',
    pages: 304,
    language: 'English',
    priceCents: 149000,
    stock: 205,
    publishedAt: '2006-04-01',
  },
  {
    title: 'Percy Jackson and the Titan\'s Curse',
    slug: 'percy-jackson-and-the-titans-curse',
    authorSlug: 'rick-riordan',
    categorySlug: 'children-fiction',
    isbn: '9781423140597',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9781423140597-L.jpg',
    description:
      'Percy and friends rescue the goddess Artemis while a new prophecy looms.',
    publisher: 'Disney Hyperion',
    pages: 336,
    language: 'English',
    priceCents: 155000,
    stock: 195,
    publishedAt: '2007-05-01',
  },
  {
    title: 'It Ends with Us',
    slug: 'it-ends-with-us',
    authorSlug: 'colleen-hoover',
    categorySlug: 'adult-fiction',
    isbn: '9781501110368',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9781501110368-L.jpg',
    description:
      'Lily Bloom confronts love, ambition, and difficult choices in a deeply emotional romance.',
    publisher: 'Atria Books',
    pages: 384,
    language: 'English',
    priceCents: 179000,
    discountPriceCents: 149000,
    stock: 190,
    publishedAt: '2016-08-02',
  },
  {
    title: 'Verity',
    slug: 'verity',
    authorSlug: 'colleen-hoover',
    categorySlug: 'adult-fiction',
    isbn: '9781791392796',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9781791392796-L.jpg',
    description:
      'A struggling writer uncovers a chilling autobiography that blurs truth and obsession.',
    publisher: 'Grand Central Publishing',
    pages: 336,
    language: 'English',
    priceCents: 165000,
    stock: 185,
    publishedAt: '2018-10-05',
  },
  {
    title: 'Ugly Love',
    slug: 'ugly-love',
    authorSlug: 'colleen-hoover',
    categorySlug: 'adult-fiction',
    isbn: '9781476753188',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9781476753188-L.jpg',
    description:
      'Tate Collins and pilot Miles Archer navigate a rules-only arrangement that becomes complicated.',
    publisher: 'Atria Books',
    pages: 336,
    language: 'English',
    priceCents: 165000,
    stock: 180,
    publishedAt: '2014-08-05',
  },
  {
    title: 'The Name of the Wind',
    slug: 'the-name-of-the-wind',
    authorSlug: 'patrick-rothfuss',
    categorySlug: 'adult-fiction',
    isbn: '9780756404741',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780756404741-L.jpg',
    description:
      'Kvothe recounts his journey from gifted child to legendary magician and musician.',
    publisher: 'DAW Books',
    pages: 662,
    language: 'English',
    priceCents: 209000,
    stock: 125,
    publishedAt: '2007-03-27',
  },
  {
    title: 'The Wise Man\'s Fear',
    slug: 'the-wise-mans-fear',
    authorSlug: 'patrick-rothfuss',
    categorySlug: 'adult-fiction',
    isbn: '9780756407124',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780756407124-L.jpg',
    description:
      'Kvothe travels the world, hones his abilities, and faces deadly rivals in the Kingkiller Chronicle.',
    publisher: 'DAW Books',
    pages: 994,
    language: 'English',
    priceCents: 229000,
    stock: 120,
    publishedAt: '2011-03-01',
  },
  {
    title: 'Sapiens: A Brief History of Humankind',
    slug: 'sapiens-a-brief-history-of-humankind',
    authorSlug: 'yuval-noah-harari',
    categorySlug: 'technology',
    isbn: '9780062316110',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780062316110-L.jpg',
    description:
      'A sweeping narrative of how Homo sapiens rose, cooperated, and reshaped the planet.',
    publisher: 'Harper',
    pages: 498,
    language: 'English',
    priceCents: 215000,
    stock: 150,
    publishedAt: '2011-09-04',
  },
  {
    title: 'Homo Deus: A Brief History of Tomorrow',
    slug: 'homo-deus-a-brief-history-of-tomorrow',
    authorSlug: 'yuval-noah-harari',
    categorySlug: 'technology',
    isbn: '9780062464316',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780062464316-L.jpg',
    description:
      'Harari explores humanity\'s technological ambitions and the ethical dilemmas ahead.',
    publisher: 'Harper',
    pages: 449,
    language: 'English',
    priceCents: 225000,
    stock: 145,
    publishedAt: '2015-09-08',
  },
  {
    title: '21 Lessons for the 21st Century',
    slug: '21-lessons-for-the-21st-century',
    authorSlug: 'yuval-noah-harari',
    categorySlug: 'business',
    isbn: '9780525512196',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780525512196-L.jpg',
    description:
      'Twenty-one concise essays examine work, technology, and truth in the present day.',
    publisher: 'Spiegel & Grau',
    pages: 400,
    language: 'English',
    priceCents: 205000,
    stock: 140,
    publishedAt: '2018-08-30',
  },
  {
    title: 'Pride and Prejudice',
    slug: 'pride-and-prejudice',
    authorSlug: 'jane-austen',
    categorySlug: 'adult-fiction',
    isbn: '9780143105428',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780143105428-L.jpg',
    description:
      'Elizabeth Bennet navigates society, wit, and the enigmatic Mr. Darcy in this classic romance.',
    publisher: 'Penguin Classics',
    pages: 480,
    language: 'English',
    priceCents: 149000,
    stock: 175,
    publishedAt: '1813-01-28',
  },
  {
    title: 'Sense and Sensibility',
    slug: 'sense-and-sensibility',
    authorSlug: 'jane-austen',
    categorySlug: 'adult-fiction',
    isbn: '9780141439662',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780141439662-L.jpg',
    description:
      'The Dashwood sisters balance reason and passion while pursuing love and stability.',
    publisher: 'Penguin Classics',
    pages: 416,
    language: 'English',
    priceCents: 145000,
    stock: 165,
    publishedAt: '1811-10-30',
  },
  {
    title: 'Emma',
    slug: 'emma-jane-austen',
    authorSlug: 'jane-austen',
    categorySlug: 'adult-fiction',
    isbn: '9780141439587',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780141439587-L.jpg',
    description:
      'Matchmaking misadventures teach Emma Woodhouse humility, empathy, and true affection.',
    publisher: 'Penguin Classics',
    pages: 512,
    language: 'English',
    priceCents: 149000,
    stock: 160,
    publishedAt: '1815-12-23',
  },
];

async function main() {
  ensureEnvLoaded();
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER as string;
  const password = process.env.DB_PASSWORD as string;
  const database = process.env.DB_NAME || 'bookstore';

  if (!user || !database) {
    throw new Error('DB_USER and DB_NAME are required');
  }

  if (REAL_BOOKS.length === 0) {
    console.warn('No real books configured. Nothing to seed.');
    return;
  }

  const pool = await createPool({ host, user, password, database });
  const db = drizzle(pool, { schema, mode: 'default' });

  try {
    const categorySlugs = Array.from(new Set(REAL_BOOKS.map((book) => book.categorySlug)));
    const authorSlugs = Array.from(new Set(REAL_BOOKS.map((book) => book.authorSlug)));

    const categories = await db
      .select({
        id: schema.categories.id,
        slug: schema.categories.slug,
      })
      .from(schema.categories)
      .where(inArray(schema.categories.slug, categorySlugs));

    const authors = await db
      .select({
        id: schema.authors.id,
        slug: schema.authors.slug,
      })
      .from(schema.authors)
      .where(inArray(schema.authors.slug, authorSlugs));

    const categoriesBySlug = new Map(categories.map((cat) => [cat.slug, cat]));
    const authorsBySlug = new Map(authors.map((author) => [author.slug, author]));

    const missingCategories = categorySlugs.filter((slug) => !categoriesBySlug.has(slug));
    if (missingCategories.length) {
      throw new Error(`Missing categories for slugs: ${missingCategories.join(', ')}`);
    }

    const missingAuthors = authorSlugs.filter((slug) => !authorsBySlug.has(slug));
    if (missingAuthors.length) {
      throw new Error(`Missing authors for slugs: ${missingAuthors.join(', ')}`);
    }

    let inserted = 0;
    for (const book of REAL_BOOKS) {
      const existing = await db.query.books.findFirst({
        where: eq(schema.books.slug, book.slug),
      });

      if (existing) {
        continue;
      }

      const category = categoriesBySlug.get(book.categorySlug)!;
      const author = authorsBySlug.get(book.authorSlug)!;

      await db.insert(schema.books).values({
        id: randomUUID(),
        title: book.title,
        slug: book.slug,
        categoryId: category.id,
        authorId: author.id,
        isbn: book.isbn,
        priceCents: book.priceCents,
        discountPriceCents: book.discountPriceCents ?? null,
        stock: book.stock,
        coverUrl: book.coverUrl,
        description: book.description,
        pages: book.pages,
        language: book.language,
        publisher: book.publisher,
        publishedAt: new Date(book.publishedAt),
        isActive: true,
      });

      inserted += 1;
    }

    console.log(`Real books seeding completed. Inserted ${inserted} new books.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
