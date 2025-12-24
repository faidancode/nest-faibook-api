import { createPool } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { and, eq, inArray } from 'drizzle-orm';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import * as schema from '../infra/drizzle/schema';

function ensureEnvLoaded() {
  const cwd = process.cwd();
  loadEnv({ path: resolve(cwd, '.env.local') });
  loadEnv({ path: resolve(cwd, '.env') });
}

const bookIds: string[] = [
  '714bf4fa-df35-43ec-bf2c-5ad03f3b2573',
  '592cab4a-78e4-4fc1-b452-20044287d15e',
  'dd2f4c73-7a0f-4583-990b-26bafcdc32b9',
  'a18c0f25-5abc-4475-859b-61853e41c360',
  '53fcde4a-70d5-425f-a07b-2f718b42295e',
  'b80725d6-ff78-4a5a-a138-a5f113e0e897',
  'd47f5ece-dcde-4391-a869-b29e87e63e7a',
  '24104144-66ab-476a-bfaa-b9a4721aebbd',
  'eb333c4c-e238-499f-b0b8-aa904df12b1c',
  'a03bf16b-7a7a-4415-bedb-5cc8255bb3a9',
];

const userId = '19dd58cb-56fb-4c0e-85bd-9765735d6159';
const ORDER_STATUS: 'DELIVERED' = 'DELIVERED';

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
    const [targetUser] = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId));

    if (!targetUser) {
      throw new Error(`User ${userId} not found`);
    }

    const existingSeedOrder = await db
      .select({ id: schema.orders.id })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.userId, userId),
          eq(schema.orders.note, 'seeded for review flow'),
        ),
      )
      .limit(1);

    if (existingSeedOrder.length) {
      console.log('Seed order already exists. Skipping.');
      return;
    }

    const books = await db
      .select({
        id: schema.books.id,
        title: schema.books.title,
        priceCents: schema.books.priceCents,
      })
      .from(schema.books)
      .where(inArray(schema.books.id, bookIds));

    const foundIds = new Set(books.map((b) => b.id));
    const missing = bookIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      console.warn('Some book IDs were not found and will be skipped:', missing);
    }

    const now = new Date();
    const orderId = randomUUID();
    const orderNumber = `SEED-${now.getTime()}`;
    const addressSnapshot = {
      id: randomUUID(),
      label: 'Home',
      recipientName: targetUser.name ?? 'Customer',
      recipientPhone: '081234567890',
      street: 'Seed Street 123',
      subdistrict: 'Subdistrict',
      district: 'District',
      city: 'City',
      province: 'Province',
      postalCode: '12345',
    };

    const orderItems = books.map((book) => {
      const quantity = 1;
      const unitPriceCents = book.priceCents ?? 0;
      return {
        id: randomUUID(),
        orderId,
        bookId: book.id,
        titleSnapshot: book.title,
        unitPriceCents,
        quantity,
        totalCents: unitPriceCents * quantity,
        createdAt: now,
        updatedAt: now,
      };
    });

    const subtotalCents = orderItems.reduce(
      (sum, item) => sum + item.totalCents,
      0,
    );

    await db.insert(schema.orders).values({
      id: orderId,
      orderNumber,
      userId,
      status: ORDER_STATUS,
      paymentMethod: 'VA',
      paymentStatus: 'PAID',
      addressSnapshot,
      subtotalCents,
      discountCents: 0,
      shippingCents: 0,
      totalCents: subtotalCents,
      note: 'seeded for review flow',
      placedAt: now,
      paidAt: now,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
      midtransOrderId: orderId
    });

    if (orderItems.length) {
      await db.insert(schema.orderItems).values(orderItems);
    }

    console.log(
      `Seed order created for user ${userId} with ${orderItems.length} items. Order ID: ${orderId}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
