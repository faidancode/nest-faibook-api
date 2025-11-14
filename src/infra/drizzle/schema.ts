import {
  mysqlTable,
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
import { sql } from 'drizzle-orm';
import { mysqlSchema } from 'drizzle-orm/mysql-core';
import { check } from 'drizzle-orm/mysql-core';

export const mySchema = mysqlSchema('my_schema');

// Shared UUID helper
const uuid = (name: string) => varchar(name, { length: 36 });

// Timestamp helper
const timestamps = {
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow().onUpdateNow(),
  deletedAt: timestamp('deletedAt'),
};

/* =======================================================
   USERS
======================================================= */

export const users = mySchema.table(
  'users',
  {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    email: varchar('email', { length: 160 }).notNull().unique(),
    phone: varchar('phone', { length: 30 }),
    passwordHash: varchar('passwordHash', { length: 255 }).notNull(),
    role: varchar('role', { length: 16 }).notNull().default('CUSTOMER'),

    ...timestamps,
  },
  (table) => [check('role_check', sql`${table.role} IN ('ADMIN','CUSTOMER')`)],
);

/* =======================================================
   ADDRESSES
======================================================= */
export const addresses = mySchema.table(
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
export const categories = mySchema.table(
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
export const authors = mySchema.table(
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
export const books = mySchema.table(
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
    publishedAt: datetime('publishedAt'),
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
export const reviews = mySchema.table(
  'reviews',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    productId: uuid('productId')
      .notNull()
      .references(() => books.id),
    rating: int('rating').notNull(),
    title: varchar('title', { length: 120 }),
    body: text('body'),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('uniq_reviews_user_product').on(table.userId, table.productId),
    index('idx_reviews_product_rating').on(table.productId, table.rating),
    check('rating_check', sql`CHECK (${table.rating} BETWEEN 1 AND 5)`),
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
export const cartItems = mySchema.table(
  'cart_items',
  {
    id: uuid('id').primaryKey(),
    cartId: uuid('cartId')
      .notNull()
      .references(() => carts.id),
    productId: uuid('productId')
      .notNull()
      .references(() => books.id),
    quantity: int('quantity').notNull(),
    priceCentsAtAdd: int('priceCentsAtAdd').notNull(),

    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex('uniq_cart_product').on(table.cartId, table.productId),
  ],
);

/* =======================================================
   ORDERS
======================================================= */
export const orders = mySchema.table(
  'orders',
  {
    id: uuid('id').primaryKey(),
    orderNumber: varchar('orderNumber', { length: 32 }).unique(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),

    status: varchar('status', { length: 16 }).notNull().default('PENDING'),
    paymentMethod: varchar('paymentMethod', { length: 16 })
      .notNull()
      .default('VA'),
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
    completedAt: datetime('completedAt'),

    ...timestamps,
  },
  (table) => [
    index('idx_orders_user_status').on(table.userId, table.status),
    index('idx_orders_placedAt').on(table.placedAt),
    check(
      'status_check',
      sql`CHECK (${table.status} IN ('PENDING','PAID','PACKED','SHIPPED','COMPLETED','CANCELLED','REFUNDED'))`,
    ),
  ],
);

/* =======================================================
   ORDER ITEMS
======================================================= */
export const orderItems = mySchema.table(
  'order_items',
  {
    id: uuid('id').primaryKey(),
    orderId: uuid('orderId')
      .notNull()
      .references(() => orders.id),
    productId: uuid('productId')
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
export const heroCarousel = mySchema.table(
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
