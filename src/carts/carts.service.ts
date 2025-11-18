import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { desc, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from '../infra/drizzle/schema';
import type {
  CartOutput,
  CreateCartInput,
  UpdateCartInput,
} from './schemas/carts.schemas';

type Db = MySql2Database<typeof schema>;
type CartRow = typeof schema.carts.$inferSelect;
type CartItemRow = typeof schema.cartItems.$inferSelect;
type CartItemWithProduct = CartItemRow & {
  bookTitle?: string | null;
  bookCoverUrl?: string | null;
};

@Injectable()
export class CartsService {
  constructor(@Inject('DRIZZLE') private readonly db: Db) {}

  private buildCartOutput(
    cart: CartRow,
    items: CartItemWithProduct[],
  ): CartOutput {
    return {
      id: cart.id,
      userId: cart.userId,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      items,
    };
  }

  async findAll(): Promise<CartOutput[]> {
    const carts = await this.db
      .select()
      .from(schema.carts)
      .orderBy(desc(schema.carts.createdAt));

    if (carts.length === 0) {
      return [];
    }

    const cartIds = carts.map((cart) => cart.id);
    const items = cartIds.length
      ? await this.db
          .select()
          .from(schema.cartItems)
          .where(inArray(schema.cartItems.cartId, cartIds))
      : [];

    const itemsByCart = new Map<string, CartItemRow[]>();
    for (const item of items) {
      const bucket = itemsByCart.get(item.cartId);
      if (bucket) {
        bucket.push(item);
      } else {
        itemsByCart.set(item.cartId, [item]);
      }
    }

    return carts.map((cart) =>
      this.buildCartOutput(cart, itemsByCart.get(cart.id) ?? []),
    );
  }

  async findOne(id: string): Promise<CartOutput> {
    const [cart] = await this.db
      .select()
      .from(schema.carts)
      .where(eq(schema.carts.id, id))
      .limit(1);

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const items = await this.db
      .select()
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartId, id));

    return this.buildCartOutput(cart, items);
  }

  async getCartByUserId(userId: string): Promise<CartOutput | null> {
    const [cart] = await this.db
      .select()
      .from(schema.carts)
      .where(eq(schema.carts.userId, userId))
      .limit(1);

    if (!cart) {
      return null;
    }

    const items = await this.db
      .select({
        id: schema.cartItems.id,
        cartId: schema.cartItems.cartId,
        bookId: schema.cartItems.bookId,
        quantity: schema.cartItems.quantity,
        priceCentsAtAdd: schema.cartItems.priceCentsAtAdd,
        createdAt: schema.cartItems.createdAt,
        updatedAt: schema.cartItems.updatedAt,
        bookTitle: schema.books.title,
        bookAuthor: schema.authors.name,
        bookCoverUrl: schema.books.coverUrl,
        categoryId: schema.books.categoryId,
      })
      .from(schema.cartItems)
      .leftJoin(
        schema.books,
        eq(schema.cartItems.bookId, schema.books.id),
      )
      .leftJoin(
        schema.authors,
        eq(schema.books.authorId, schema.authors.id),
      )
      .where(eq(schema.cartItems.cartId, cart.id));

    return this.buildCartOutput(cart, items);
  }

  async create(input: CreateCartInput): Promise<CartOutput> {
    const [existingCart] = await this.db
      .select()
      .from(schema.carts)
      .where(eq(schema.carts.userId, input.userId))
      .limit(1);

    if (!existingCart) {
      const id = randomUUID();

      await this.db.insert(schema.carts).values({
        id,
        userId: input.userId,
      });

      if (input.items.length > 0) {
        await this.db.insert(schema.cartItems).values(
          input.items.map((item) => ({
            id: randomUUID(),
            cartId: id,
            bookId: item.bookId,
            quantity: item.quantity,
            priceCentsAtAdd: item.priceCentsAtAdd,
          })),
        );
      }

      return this.findOne(id);
    }

    if (input.items.length === 0) {
      return this.findOne(existingCart.id);
    }

    const existingItems = await this.db
      .select()
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartId, existingCart.id));

    const itemsBybookId = new Map(
      existingItems.map((item) => [item.bookId, item]),
    );

    const newItemsPayload: typeof schema.cartItems.$inferInsert[] = [];
    for (const item of input.items) {
      const found = itemsBybookId.get(item.bookId);
      if (found) {
        await this.db
          .update(schema.cartItems)
          .set({
            quantity: item.quantity,
            priceCentsAtAdd: item.priceCentsAtAdd,
            updatedAt: new Date(),
          })
          .where(eq(schema.cartItems.id, found.id));
      } else {
        newItemsPayload.push({
          id: randomUUID(),
          cartId: existingCart.id,
          bookId: item.bookId,
          quantity: item.quantity,
          priceCentsAtAdd: item.priceCentsAtAdd,
        });
      }
    }

    if (newItemsPayload.length > 0) {
      await this.db.insert(schema.cartItems).values(newItemsPayload);
    }

    await this.db
      .update(schema.carts)
      .set({ updatedAt: new Date() })
      .where(eq(schema.carts.id, existingCart.id));

    return this.findOne(existingCart.id);
  }

  async update(id: string, input: UpdateCartInput): Promise<CartOutput> {
    const existing = await this.findOne(id);

    await this.db
      .update(schema.carts)
      .set({
        userId: input.userId ?? existing.userId,
        updatedAt: new Date(),
      })
      .where(eq(schema.carts.id, id));

    if (input.items) {
      await this.db
        .delete(schema.cartItems)
        .where(eq(schema.cartItems.cartId, id));

      if (input.items.length > 0) {
        await this.db.insert(schema.cartItems).values(
          input.items.map((item) => ({
            id: randomUUID(),
            cartId: id,
            bookId: item.bookId,
            quantity: item.quantity,
            priceCentsAtAdd: item.priceCentsAtAdd,
          })),
        );
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.db
      .delete(schema.cartItems)
      .where(eq(schema.cartItems.cartId, id));

    await this.db.delete(schema.carts).where(eq(schema.carts.id, id));
  }
}

