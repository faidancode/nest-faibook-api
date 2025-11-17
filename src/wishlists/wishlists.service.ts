import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { desc, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from '../infra/drizzle/schema';
import type {
  CreateWishlistInput,
  UpdateWishlistInput,
  WishlistOutput,
} from './schemas/wishlists.schemas';

type Db = MySql2Database<typeof schema>;
type WishlistRow = typeof schema.wishlists.$inferSelect;
type WishlistItemRow = typeof schema.wishlistItems.$inferSelect;

@Injectable()
export class WishlistsService {
  constructor(@Inject('DRIZZLE') private readonly db: Db) {}

  private buildWishlistOutput(
    wishlist: WishlistRow,
    items: WishlistItemRow[],
  ): WishlistOutput {
    return {
      id: wishlist.id,
      userId: wishlist.userId,
      createdAt: wishlist.createdAt,
      updatedAt: wishlist.updatedAt,
      items,
    };
  }

  async findAll(): Promise<WishlistOutput[]> {
    const wishlists = await this.db
      .select()
      .from(schema.wishlists)
      .orderBy(desc(schema.wishlists.createdAt));

    if (wishlists.length === 0) {
      return [];
    }

    const wishlistIds = wishlists.map((wishlist) => wishlist.id);
    const items = wishlistIds.length
      ? await this.db
          .select()
          .from(schema.wishlistItems)
          .where(inArray(schema.wishlistItems.wishlistId, wishlistIds))
      : [];

    const itemsByWishlist = new Map<string, WishlistItemRow[]>();
    for (const item of items) {
      const bucket = itemsByWishlist.get(item.wishlistId);
      if (bucket) {
        bucket.push(item);
      } else {
        itemsByWishlist.set(item.wishlistId, [item]);
      }
    }

    return wishlists.map((wishlist) =>
      this.buildWishlistOutput(wishlist, itemsByWishlist.get(wishlist.id) ?? []),
    );
  }

  async findOne(id: string): Promise<WishlistOutput> {
    const [wishlist] = await this.db
      .select()
      .from(schema.wishlists)
      .where(eq(schema.wishlists.id, id))
      .limit(1);

    if (!wishlist) {
      throw new NotFoundException('Wishlist not found');
    }

    const items = await this.db
      .select()
      .from(schema.wishlistItems)
      .where(eq(schema.wishlistItems.wishlistId, id));

    return this.buildWishlistOutput(wishlist, items);
  }

  async create(input: CreateWishlistInput): Promise<WishlistOutput> {
    const id = randomUUID();

    await this.db.insert(schema.wishlists).values({
      id,
      userId: input.userId,
    });

    if (input.items.length > 0) {
      await this.db.insert(schema.wishlistItems).values(
        input.items.map((item) => ({
          id: randomUUID(),
          wishlistId: id,
          productId: item.productId,
        })),
      );
    }

    return this.findOne(id);
  }

  async update(id: string, input: UpdateWishlistInput): Promise<WishlistOutput> {
    const existing = await this.findOne(id);

    await this.db
      .update(schema.wishlists)
      .set({
        userId: input.userId ?? existing.userId,
        updatedAt: new Date(),
      })
      .where(eq(schema.wishlists.id, id));

    if (input.items) {
      await this.db
        .delete(schema.wishlistItems)
        .where(eq(schema.wishlistItems.wishlistId, id));

      if (input.items.length > 0) {
        await this.db.insert(schema.wishlistItems).values(
          input.items.map((item) => ({
            id: randomUUID(),
            wishlistId: id,
            productId: item.productId,
          })),
        );
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.db
      .delete(schema.wishlistItems)
      .where(eq(schema.wishlistItems.wishlistId, id));

    await this.db.delete(schema.wishlists).where(eq(schema.wishlists.id, id));
  }
}
