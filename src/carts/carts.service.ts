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

@Injectable()
export class CartsService {
  constructor(@Inject('DRIZZLE') private readonly db: Db) {}

  private buildCartOutput(cart: CartRow, items: CartItemRow[]): CartOutput {
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

  async create(input: CreateCartInput): Promise<CartOutput> {
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
          productId: item.productId,
          quantity: item.quantity,
          priceCentsAtAdd: item.priceCentsAtAdd,
        })),
      );
    }

    return this.findOne(id);
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
            productId: item.productId,
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

