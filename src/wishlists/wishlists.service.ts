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
type WishlistItemWithBook = WishlistItemRow & {
  bookTitle?: string | null;
  bookAuthor?: string | null;
  bookPrice?: number | null;
  bookDiscountedPrice?: number | null;
};
export type WishlistSortOption = 'newest' | 'lowest' | 'highest';

@Injectable()
export class WishlistsService {
  constructor(@Inject('DRIZZLE') private readonly db: Db) {}

  private buildWishlistOutput(
    wishlist: WishlistRow,
    items: WishlistItemWithBook[],
  ): WishlistOutput {
    return {
      id: wishlist.id,
      userId: wishlist.userId,
      createdAt: wishlist.createdAt,
      updatedAt: wishlist.updatedAt,
      items,
    };
  }

  private sortWishlistItems(
    items: WishlistItemWithBook[],
    sort: WishlistSortOption,
  ): WishlistItemWithBook[] {
    const sorted = [...items];
    const compareByDateDesc = (
      a: WishlistItemWithBook,
      b: WishlistItemWithBook,
    ) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    };

    const getPrice = (item: WishlistItemWithBook) =>
      item.bookDiscountedPrice ?? item.bookPrice ?? null;

    switch (sort) {
      case 'lowest':
        sorted.sort((a, b) => {
          const priceA = getPrice(a);
          const priceB = getPrice(b);
          if (priceA === null && priceB === null) {
            return compareByDateDesc(a, b);
          }
          if (priceA === null) {
            return 1;
          }
          if (priceB === null) {
            return -1;
          }

          const diff = priceA - priceB;
          return diff !== 0 ? diff : compareByDateDesc(a, b);
        });
        break;
      case 'highest':
        sorted.sort((a, b) => {
          const priceA = getPrice(a);
          const priceB = getPrice(b);
          if (priceA === null && priceB === null) {
            return compareByDateDesc(a, b);
          }
          if (priceA === null) {
            return 1;
          }
          if (priceB === null) {
            return -1;
          }

          const diff = priceB - priceA;
          return diff !== 0 ? diff : compareByDateDesc(a, b);
        });
        break;
      default:
        sorted.sort(compareByDateDesc);
    }

    return sorted;
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
      this.buildWishlistOutput(
        wishlist,
        itemsByWishlist.get(wishlist.id) ?? [],
      ),
    );
  }

  async getWishlistByUserId(
    userId: string,
    sort: WishlistSortOption = 'newest',
  ): Promise<WishlistOutput> {
    const [wishlist] = await this.db
      .select()
      .from(schema.wishlists)
      .where(eq(schema.wishlists.userId, userId))
      .limit(1);

    if (!wishlist) {
      return this.create({ userId, items: [] });
    }

    const items = await this.db
      .select({
        id: schema.wishlistItems.id,
        wishlistId: schema.wishlistItems.wishlistId,
        bookId: schema.wishlistItems.bookId,
        book: {
          title: schema.books.title,
          coverUrl: schema.books.coverUrl,
          slug: schema.books.slug,
          priceCents: schema.books.priceCents,
          discountPriceCents: schema.books.discountPriceCents,
          authorName: schema.authors.name,
        },
        createdAt: schema.wishlistItems.createdAt,
        updatedAt: schema.wishlistItems.updatedAt,
        bookPrice: schema.books.priceCents,
        bookDiscountedPrice: schema.books.discountPriceCents,
      })
      .from(schema.wishlistItems)
      .leftJoin(
        schema.books,
        eq(schema.wishlistItems.bookId, schema.books.id),
      )
      .leftJoin(
        schema.authors,
        eq(schema.books.authorId, schema.authors.id),
      )
      .where(eq(schema.wishlistItems.wishlistId, wishlist.id));

    const sortedItems = this.sortWishlistItems(items, sort);

    return this.buildWishlistOutput(wishlist, sortedItems);
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
    const [existingWishlist] = await this.db
      .select()
      .from(schema.wishlists)
      .where(eq(schema.wishlists.userId, input.userId))
      .limit(1);

    if (existingWishlist) {
      if (input.items.length > 0) {
        await this.db
          .delete(schema.wishlistItems)
          .where(eq(schema.wishlistItems.wishlistId, existingWishlist.id));

        await this.db.insert(schema.wishlistItems).values(
          input.items.map((item) => ({
            id: randomUUID(),
            wishlistId: existingWishlist.id,
            bookId: item.bookId,
          })),
        );
      }

      await this.db
        .update(schema.wishlists)
        .set({ updatedAt: new Date() })
        .where(eq(schema.wishlists.id, existingWishlist.id));

      return this.findOne(existingWishlist.id);
    }

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
          bookId: item.bookId,
        })),
      );
    }

    return this.findOne(id);
  }

  async update(
    id: string,
    input: UpdateWishlistInput,
  ): Promise<WishlistOutput> {
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
            bookId: item.bookId,
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
