import { sql } from 'drizzle-orm';
import { date } from 'drizzle-orm/mysql-core';
import { mysqlEnum } from 'drizzle-orm/mysql-core';
import {
  varchar,
  int,
  boolean,
  datetime,
  text,
  decimal,
  json,
  uniqueIndex,
  index,
  timestamp,
} from 'drizzle-orm/mysql-core';
import { mysqlSchema } from 'drizzle-orm/mysql-core';
import { mysqlTable } from 'drizzle-orm/mysql-core';

const schemaName = process.env.DB_SCHEMA ?? process.env.DB_NAME ?? 'my_schema';
export const mySchema = mysqlSchema(schemaName);

// Shared UUID helper
const uuid = (name: string) => varchar(name, { length: 36 });

// Timestamp helper
const timestamps = {
  createdAt: datetime('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
  deletedAt: datetime('deletedAt'),
};

/* =======================================================
   USERS
======================================================= */

export const users = mysqlTable('users', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 160 }).notNull().unique(),
  phone: varchar('phone', { length: 30 }),
  passwordHash: varchar('passwordHash', { length: 255 }).notNull(),
  isActive: boolean('isActive').notNull().default(true),
  emailConfirmed: boolean('emailConfirmed').notNull().default(false),
  role: mysqlEnum('role', ['SUPERADMIN', 'ADMIN', 'GUESTADMIN', 'CUSTOMER']).notNull(),

  ...timestamps,
});

/* =======================================================
   ADDRESSES
======================================================= */
export const addresses = mysqlTable(
  'addresses',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    label: varchar('label', { length: 60 }).notNull(),
    recipientName: varchar('recipientName', { length: 120 }).notNull(),
    recipientPhone: varchar('recipientPhone', { length: 30 }).notNull(),
    street: varchar('street', { length: 255 }).notNull(),
    subdistrict: varchar('subdistrict', { length: 120 }),
    district: varchar('district', { length: 120 }),
    city: varchar('city', { length: 120 }),
    province: varchar('province', { length: 120 }),
    postalCode: varchar('postalCode', { length: 20 }),
    isPrimary: boolean('isPrimary').notNull().default(false),

    ...timestamps,
  },
  (table) => [
    index('idx_addresses_user_primary').on(table.userId, table.isPrimary),
  ],
);

/* =======================================================
   CATEGORIES
======================================================= */
export const categories = mysqlTable(
  'categories',
  {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 160 }).notNull().unique(),
    icon: varchar('icon', { length: 80 }),
    description: varchar('description', { length: 255 }),
    sortOrder: int('sortOrder').notNull().default(0),
    isActive: boolean('isActive').notNull().default(true),

    ...timestamps,
  },
  (table) => [index('idx_categories_name').on(table.name)],
);

/* =======================================================
   AUTHORS
======================================================= */
export const authors = mysqlTable(
  'authors',
  {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 160 }).notNull().unique(),
    bio: text('bio'),

    ...timestamps,
  },
  (table) => [index('idx_authors_name').on(table.name)],
);

/* =======================================================
   BOOKS
======================================================= */
export const books = mysqlTable(
  'books',
  {
    id: uuid('id').primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull().unique(),
    categoryId: uuid('categoryId')
      .notNull()
      .references(() => categories.id),
    authorId: uuid('authorId').references(() => authors.id),
    isbn: varchar('isbn', { length: 32 }),
    priceCents: int('priceCents').notNull(),
    discountPriceCents: int('discountPriceCents'),
    stock: int('stock').notNull().default(0),
    coverUrl: varchar('coverUrl', { length: 255 }).notNull(),
    description: text('description').notNull(),
    pages: int('pages'),
    language: varchar('language', { length: 40 }),
    publisher: varchar('publisher', { length: 160 }),
    publishedAt: date('publishedAt'),
    ratingAvg: decimal('ratingAvg', { precision: 3, scale: 2 })
      .notNull()
      .default('0.00'),
    ratingCount: int('ratingCount').notNull().default(0),
    isActive: boolean('isActive').notNull().default(true),

    ...timestamps,
  },
  (table) => [
    index('idx_books_category_active').on(table.categoryId, table.isActive),
    index('idx_books_title').on(table.title),
    index('idx_books_isbn').on(table.isbn),
  ],
);

/* =======================================================
   REVIEWS
======================================================= */
export const reviews = mysqlTable(
  'reviews',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    bookId: uuid('bookId')
      .notNull()
      .references(() => books.id),
    rating: int('rating').notNull(),
    title: varchar('title', { length: 120 }),
    body: text('body'),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('uniq_reviews_user_book').on(table.userId, table.bookId),
    index('idx_reviews_book_rating').on(table.bookId, table.rating),
  ],
);

/* =======================================================
   CARTS
======================================================= */
export const carts = mysqlTable('carts', {
  id: uuid('id').primaryKey(),
  userId: uuid('userId')
    .notNull()
    .unique()
    .references(() => users.id),

  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow().onUpdateNow(),
});

/* =======================================================
   CART ITEMS
======================================================= */
export const cartItems = mysqlTable(
  'cart_items',
  {
    id: uuid('id').primaryKey(),
    cartId: uuid('cartId')
      .notNull()
      .references(() => carts.id),
    bookId: uuid('bookId')
      .notNull()
      .references(() => books.id),
    quantity: int('quantity').notNull(),
    priceCentsAtAdd: int('priceCentsAtAdd').notNull(),

    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [uniqueIndex('uniq_cart_book').on(table.cartId, table.bookId)],
);

/* =======================================================
   WISHLISTS
======================================================= */
export const wishlists = mysqlTable('wishlists', {
  id: uuid('id').primaryKey(),
  userId: uuid('userId')
    .notNull()
    .unique()
    .references(() => users.id),

  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow().onUpdateNow(),
});

/* =======================================================
   WISHLIST ITEMS
======================================================= */
export const wishlistItems = mysqlTable(
  'wishlist_items',
  {
    id: uuid('id').primaryKey(),
    wishlistId: uuid('wishlistId')
      .notNull()
      .references(() => wishlists.id),
    bookId: uuid('bookId')
      .notNull()
      .references(() => books.id),

    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex('uniq_wishlist_book').on(table.wishlistId, table.bookId),
  ],
);

/* =======================================================
   ORDERS
======================================================= */
export const orders = mysqlTable(
  'orders',
  {
    id: uuid('id').primaryKey(),
    orderNumber: varchar('orderNumber', { length: 32 }).unique(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),

    status: varchar('status', { length: 16 }).notNull().default('PENDING'),
    paymentMethod: varchar('paymentMethod', { length: 32 }),
    paymentStatus: varchar('paymentStatus', { length: 16 })
      .notNull()
      .default('UNPAID'),

    addressSnapshot: json('addressSnapshot').notNull(),
    subtotalCents: int('subtotalCents').notNull(),
    discountCents: int('discountCents').notNull().default(0),
    shippingCents: int('shippingCents').notNull().default(0),
    totalCents: int('totalCents').notNull(),
    note: varchar('note', { length: 255 }),
    placedAt: datetime('placedAt').notNull(),
    paidAt: datetime('paidAt'),
    cancelledAt: datetime('cancelledAt'),
    cancelReason: varchar('cancelReason', { length: 100 }),
    completedAt: datetime('completedAt'),
    receiptNo: varchar('receipt_no', { length: 50 }).unique(),
    /* =========================
     MIDTRANS
  ========================= */
    midtransOrderId: varchar('midtransOrderId', { length: 50 }).notNull(),
    snapToken: varchar('snapToken', { length: 255 }),
    snapRedirectUrl: varchar('snapRedirectUrl', { length: 255 }),
    snapTokenExpiredAt: datetime('snapTokenExpiredAt', {
      mode: 'date',
    }),

    ...timestamps,
  },
  (table) => [
    index('idx_orders_user_status').on(table.userId, table.status),
    index('idx_orders_placedAt').on(table.placedAt),
  ],
);

/* =======================================================
   ORDER ITEMS
======================================================= */
export const orderItems = mysqlTable(
  'order_items',
  {
    id: uuid('id').primaryKey(),
    orderId: uuid('orderId')
      .notNull()
      .references(() => orders.id),
    bookId: uuid('bookId')
      .notNull()
      .references(() => books.id),

    titleSnapshot: varchar('titleSnapshot', { length: 200 }).notNull(),
    unitPriceCents: int('unitPriceCents').notNull(),
    quantity: int('quantity').notNull(),
    totalCents: int('totalCents').notNull(),

    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index('idx_order_items_order').on(table.orderId)],
);

/* =======================================================
   HERO CAROUSEL
======================================================= */
export const heroCarousel = mysqlTable(
  'hero_carousel',
  {
    id: uuid('id').primaryKey(),
    imageUrl: varchar('imageUrl', { length: 255 }).notNull(),
    caption: varchar('caption', { length: 255 }),
    linkUrl: varchar('linkUrl', { length: 255 }),
    sortOrder: int('sortOrder').notNull().default(0),
    isActive: boolean('isActive').notNull().default(true),

    ...timestamps,
  },
  (table) => [
    index('idx_hero_active_sort').on(table.isActive, table.sortOrder),
  ],
);

export const passwordResetTokens = mysqlTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
    }).notNull(),

    createdAt: timestamp('created_at', {
      mode: 'date',
    })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('token_idx').on(table.token),
    index('user_id_idx').on(table.userId),
  ],
);

export const emailConfirmationTokens = mysqlTable(
  'email_confirmation_tokens',
  {
    id: uuid('id').primaryKey(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    pin: varchar('pin', { length: 6 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', {
      mode: 'date',
    }).notNull(),

    createdAt: timestamp('created_at', {
      mode: 'date',
    })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('token_idx').on(table.token),
    index('pin_idx').on(table.pin),
    index('user_id_idx').on(table.userId),
  ],
);
