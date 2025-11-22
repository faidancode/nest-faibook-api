import { createPool } from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { asc, sql } from 'drizzle-orm';
import * as schema from '../infra/drizzle/schema';

function ensureEnvLoaded() {
  const cwd = process.cwd();
  loadEnv({ path: resolve(cwd, '.env.local') });
  loadEnv({ path: resolve(cwd, '.env') });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sample<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.max(1, Math.min(count, copy.length)));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateInPastDays(days: number): Date {
  const now = Date.now();
  const pastMs = randomInt(1, days) * 24 * 60 * 60 * 1000;
  return new Date(now - pastMs);
}

async function fetchCustomers(db: MySql2Database<typeof schema>) {
  const customers = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      phone: schema.users.phone,
    })
    .from(schema.users)
    .where(
      sql`${schema.users.role} = 'CUSTOMER' AND ${schema.users.deletedAt} IS NULL`,
    )
    .orderBy(asc(schema.users.name));

  if (!customers.length) {
    throw new Error('No customers found. Seed users first.');
  }

  return customers;
}

async function fetchBooks(db: MySql2Database<typeof schema>, limit = 25) {
  const books = await db
    .select({
      id: schema.books.id,
      title: schema.books.title,
      priceCents: schema.books.priceCents,
    })
    .from(schema.books)
    .where(sql`${schema.books.deletedAt} IS NULL`)
    .limit(limit);

  if (!books.length) {
    throw new Error('No books found. Seed books first.');
  }

  return books;
}

type SeedStatus =
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

const STATUSES: SeedStatus[] = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

const ORDERS_PER_STATUS = 30;

function resolvePaymentStatus(status: SeedStatus): 'UNPAID' | 'PAID' | 'REFUNDED' {
  switch (status) {
    case 'PENDING':
      return 'UNPAID';
    case 'CANCELLED':
      return 'REFUNDED';
    default:
      return 'PAID';
  }
}

async function seedOrders(db: MySql2Database<typeof schema>) {
  const customers = await fetchCustomers(db);
  const books = await fetchBooks(db);

  const ordersPayload: typeof schema.orders.$inferInsert[] = [];
  const orderItemsPayload: typeof schema.orderItems.$inferInsert[] = [];

  for (const status of STATUSES) {
    for (let i = 0; i < ORDERS_PER_STATUS; i += 1) {
      const customer = pickRandom(customers);
      const now = randomDateInPastDays(90);
      const orderId = randomUUID();
      const orderNumber = `SEED-${status}-${now.getTime()}-${randomInt(1000, 9999)}`;

      const items = sample(books, randomInt(1, 3));
      let subtotalCents = 0;
      for (const book of items) {
        const quantity = randomInt(1, 3);
        const unitPriceCents = book.priceCents ?? 0;
        subtotalCents += unitPriceCents * quantity;
        orderItemsPayload.push({
          id: randomUUID(),
          orderId,
          bookId: book.id,
          titleSnapshot: book.title,
          unitPriceCents,
          quantity,
          totalCents: unitPriceCents * quantity,
          createdAt: now,
          updatedAt: now,
        });
      }

      const discountCents = 0;
      const shippingCents = randomInt(0, 1500);
      const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);

      const paymentStatus = resolvePaymentStatus(status);
      const paidAt =
        paymentStatus === 'PAID'
          ? new Date(now.getTime() + 60 * 60 * 1000)
          : null;
      const completedAt =
        status === 'DELIVERED'
          ? new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
          : null;
      const cancelledAt =
        status === 'CANCELLED'
          ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
          : null;

      ordersPayload.push({
        id: orderId,
        orderNumber,
        userId: customer.id,
        status,
        paymentMethod: 'VA',
        paymentStatus,
        addressSnapshot: {
          id: randomUUID(),
          label: 'Home',
          recipientName: customer.name ?? 'Customer',
          recipientPhone: customer.phone ?? '081234567890',
          street: 'Seed Street 123',
          subdistrict: 'Subdistrict',
          district: 'District',
          city: 'City',
          province: 'Province',
          postalCode: '12345',
        },
        subtotalCents,
        discountCents,
        shippingCents,
        totalCents,
        note: 'seeded admin orders',
        placedAt: now,
        paidAt,
        cancelledAt,
        completedAt,
        receiptNo: status === 'SHIPPED' || status === 'DELIVERED' ? `RCPT-${randomInt(10000, 99999)}` : null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  await db.insert(schema.orders).values(ordersPayload);
  await db.insert(schema.orderItems).values(orderItemsPayload);

  console.log(
    `Inserted ${ordersPayload.length} orders and ${orderItemsPayload.length} order items.`,
  );
}

async function main() {
  ensureEnvLoaded();
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER as string;
  const password = process.env.DB_PASSWORD as string;
  const database = process.env.DB_NAME || 'bookstore';

  if (!user) {
    throw new Error('DB_USER is required');
  }

  const pool = await createPool({
    host,
    user,
    password,
    database,
  });

  const db = drizzle(pool, { schema, mode: 'default' }) as MySql2Database<typeof schema>;

  try {
    await seedOrders(db);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
