import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { and, asc, desc, eq, like, sql } from 'drizzle-orm';
import * as schema from '../infra/drizzle/schema';
import { REVIEW_RATING_VALUES } from './books.schemas';
import type {
  CreateBookInput,
  CreateReviewInput,
  ListBookReviewsQuery,
  ListBooksQuery,
  ReviewRatingValue,
  UpdateBookInput,
} from './books.schemas';
import { randomUUID } from 'crypto';

type Db = MySql2Database<typeof schema>;
type BookRow = typeof schema.books.$inferSelect;
type UserRow = typeof schema.users.$inferSelect;
type ReviewRow = typeof schema.reviews.$inferSelect;
type BookWithAuthorName = BookRow & {
  authorName: string | null;
  category: string | null;
  isWishlisted?: boolean;
  reviews?: ReviewWithUser[];
  averageRating?: number;
  totalReviews?: number;
};
type ReviewWithUser = ReviewRow & {
  userName: string | null;
};
type ReviewWithBook = ReviewRow & {
  bookTitle: string | null;
  bookSlug: string | null;
  bookCoverUrl: string | null;
  bookAuthorName: string | null;
};

type RatingAggregationRow = {
  rating: number;
  count: number;
};
type RatingCounts = Record<ReviewRatingValue, number>;
type ReviewEligibilityReason =
  | 'UNAUTHENTICATED'
  | 'ALREADY_REVIEWED'
  | 'NOT_PURCHASED'
  | 'ELIGIBLE';

const bookWithAuthorSelection = {
  id: schema.books.id,
  title: schema.books.title,
  slug: schema.books.slug,
  categoryId: schema.books.categoryId,
  category: schema.categories.name,
  authorId: schema.books.authorId,
  isbn: schema.books.isbn,
  priceCents: schema.books.priceCents,
  discountPriceCents: schema.books.discountPriceCents,
  stock: schema.books.stock,
  coverUrl: schema.books.coverUrl,
  description: schema.books.description,
  pages: schema.books.pages,
  language: schema.books.language,
  publisher: schema.books.publisher,
  publishedAt: schema.books.publishedAt,
  ratingAvg: schema.books.ratingAvg,
  ratingCount: schema.books.ratingCount,
  isActive: schema.books.isActive,
  createdAt: schema.books.createdAt,
  updatedAt: schema.books.updatedAt,
  deletedAt: schema.books.deletedAt,
  authorName: schema.authors.name,
};

@Injectable()
export class BooksService {
  constructor(@Inject('DRIZZLE') private readonly db: Db) {}

  private slugify(input: string) {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  private buildWhere(query: ListBooksQuery) {
    let where: any = sql`1 = 1`;
    where = and(where, sql`${schema.books.deletedAt} IS NULL`);

    const searchTerm = query.q?.trim();

    if (searchTerm) {
      where = and(where, like(schema.books.title, `%${searchTerm}%`));
    }

    if (query.categoryId) {
      where = and(where, eq(schema.books.categoryId, query.categoryId));
    }

    if (query.authorId) {
      where = and(where, eq(schema.books.authorId, query.authorId));
    }

    if (typeof query.active === 'boolean') {
      where = and(where, eq(schema.books.isActive, query.active));
    }

    if (typeof query.minPrice === 'number') {
      where = and(where, sql`${schema.books.priceCents} >= ${query.minPrice}`);
    }

    if (typeof query.maxPrice === 'number') {
      where = and(where, sql`${schema.books.priceCents} <= ${query.maxPrice}`);
    }

    return where;
  }

  private async fetchBookBySlug(slug: string): Promise<BookWithAuthorName> {
    const [row] = await this.db
      .select(bookWithAuthorSelection)
      .from(schema.books)
      .leftJoin(schema.authors, eq(schema.books.authorId, schema.authors.id))
      .leftJoin(
        schema.categories,
        eq(schema.books.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.books.slug, slug),
          sql`${schema.books.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Book not found');
    }

    return row as BookWithAuthorName;
  }

  private async fetchBookById(id: string): Promise<BookWithAuthorName> {
    const [row] = await this.db
      .select(bookWithAuthorSelection)
      .from(schema.books)
      .leftJoin(schema.authors, eq(schema.books.authorId, schema.authors.id))
      .leftJoin(
        schema.categories,
        eq(schema.books.categoryId, schema.categories.id),
      )
      .where(
        and(eq(schema.books.id, id), sql`${schema.books.deletedAt} IS NULL`),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Book not found');
    }

    return row as BookWithAuthorName;
  }

  private async hasExistingReview(bookId: string, userId: string) {
    const [row] = await this.db
      .select({ id: schema.reviews.id })
      .from(schema.reviews)
      .where(
        and(
          eq(schema.reviews.bookId, bookId),
          eq(schema.reviews.userId, userId),
          sql`${schema.reviews.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    return Boolean(row);
  }

  private async hasCompletedPurchase(bookId: string, userId: string) {
    const [row] = await this.db
      .select({ id: schema.orders.id })
      .from(schema.orders)
      .innerJoin(
        schema.orderItems,
        eq(schema.orders.id, schema.orderItems.orderId),
      )
      .where(
        and(
          eq(schema.orders.userId, userId),
          eq(schema.orderItems.bookId, bookId),
          eq(schema.orders.status, 'COMPLETED'),
          sql`${schema.orders.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    return Boolean(row);
  }

  private async evaluateReviewEligibility(
    bookId: string,
    userId: string | null,
  ) {
    if (!userId) {
      return {
        eligible: false,
        reason: 'UNAUTHENTICATED' as ReviewEligibilityReason,
      };
    }

    const alreadyReviewed = await this.hasExistingReview(bookId, userId);
    if (alreadyReviewed) {
      return {
        eligible: false,
        reason: 'ALREADY_REVIEWED' as ReviewEligibilityReason,
      };
    }

    const hasPurchased = await this.hasCompletedPurchase(bookId, userId);
    if (!hasPurchased) {
      return {
        eligible: false,
        reason: 'NOT_PURCHASED' as ReviewEligibilityReason,
      };
    }

    return { eligible: true, reason: 'ELIGIBLE' as ReviewEligibilityReason };
  }

  async checkReviewEligibility(slug: string, userId: string | null) {
    const book = await this.fetchBookBySlug(slug);
    return this.evaluateReviewEligibility(book.id, userId);
  }

  private async refreshBookRating(bookId: string) {
    const [row] = await this.db
      .select({
        total: sql<number>`COUNT(*)`,
        sum: sql<number>`COALESCE(SUM(${schema.reviews.rating}), 0)`,
      })
      .from(schema.reviews)
      .where(
        and(
          eq(schema.reviews.bookId, bookId),
          sql`${schema.reviews.deletedAt} IS NULL`,
        ),
      );

    const total = Number(row?.total ?? 0);
    const ratingSum = Number((row?.sum ?? 0) as number);
    const averageRating = total ? Number((ratingSum / total).toFixed(2)) : 0;

    await this.db
      .update(schema.books)
      .set({
        ratingAvg: averageRating.toFixed(2),
        ratingCount: total,
        updatedAt: new Date(),
      })
      .where(eq(schema.books.id, bookId));

    return { averageRating, totalReviews: total };
  }

  async findAll(query: ListBooksQuery) {
    const { page, pageSize, sort } = query;
    const orderBy = this.buildBookOrder(sort);

    const categorySlug = query.category?.trim();
    let resolvedCategoryId = query.categoryId;

    if (!resolvedCategoryId && categorySlug) {
      const [category] = await this.db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.slug, categorySlug),
            sql`${schema.categories.deletedAt} IS NULL`,
          ),
        )
        .limit(1);

      if (!category) {
        return {
          items: [],
          meta: { page, pageSize, total: 0, totalPages: 0 },
        };
      }

      resolvedCategoryId = category.id;
    }

    let minPrice = query.minPrice;
    let maxPrice = query.maxPrice;

    if (
      typeof minPrice === 'number' &&
      typeof maxPrice === 'number' &&
      minPrice > maxPrice
    ) {
      [minPrice, maxPrice] = [maxPrice, minPrice];
    }

    const where = this.buildWhere({
      ...query,
      categoryId: resolvedCategoryId,
      minPrice,
      maxPrice,
    });
    const offset = (page - 1) * pageSize;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(bookWithAuthorSelection)
        .from(schema.books)
        .leftJoin(schema.authors, eq(schema.books.authorId, schema.authors.id))
        .leftJoin(
          schema.categories,
          eq(schema.books.categoryId, schema.categories.id),
        )
        .where(where)
        .orderBy(...orderBy)
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.books)
        .where(where),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: rows as BookWithAuthorName[],
      meta: { page, pageSize, total, totalPages },
    };
  }

  async findOne(
    id: string,
    options?: { userId?: string },
  ): Promise<BookWithAuthorName> {
    const [row] = await this.db
      .select(bookWithAuthorSelection)
      .from(schema.books)
      .leftJoin(
        schema.categories,
        eq(schema.books.categoryId, schema.categories.id),
      )
      .leftJoin(schema.authors, eq(schema.books.authorId, schema.authors.id))
      .leftJoin(schema.reviews, eq(schema.books.id, schema.reviews.bookId))
      .where(
        and(eq(schema.books.id, id), sql`${schema.books.deletedAt} IS NULL`),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Book not found');
    }

    let isWishlisted = false;

    if (options?.userId) {
      const [wishlistItem] = await this.db
        .select({ id: schema.wishlistItems.id })
        .from(schema.wishlists)
        .innerJoin(
          schema.wishlistItems,
          eq(schema.wishlists.id, schema.wishlistItems.wishlistId),
        )
        .where(
          and(
            eq(schema.wishlists.userId, options.userId),
            eq(schema.wishlistItems.bookId, id),
          ),
        )
        .limit(1);

      isWishlisted = Boolean(wishlistItem);
    }

    const reviews = await this.fetchBookReviews(id);
    const averageRating = this.calculateAverageRating(reviews);
    const totalReviews = reviews.length;

    return {
      ...(row as BookWithAuthorName),
      isWishlisted,
      reviews,
      averageRating,
      totalReviews,
    };
  }

  async findBySlug(slug: string): Promise<BookWithAuthorName> {
    const book = await this.fetchBookBySlug(slug);
    const reviews = await this.fetchBookReviews(book.id, 5);
    const averageRating = this.calculateAverageRating(reviews);
    const totalReviews = reviews.length;

    return { ...book, reviews, averageRating, totalReviews };
  }

  async createReview(
    slug: string,
    input: CreateReviewInput,
    userId: string,
  ): Promise<{
    data: {
      review: ReviewWithUser;
      rating: { averageRating: number; totalReviews: number };
    };
    meta: Record<string, never>;
    error: Record<string, never>;
    ok: true;
  }> {
    const book = await this.fetchBookBySlug(slug);
    const eligibility = await this.evaluateReviewEligibility(book.id, userId);

    if (!eligibility.eligible) {
      const message =
        eligibility.reason === 'UNAUTHENTICATED'
          ? 'Authentication required'
          : eligibility.reason === 'NOT_PURCHASED'
            ? 'You must complete a purchase of this book before reviewing'
            : 'You have already reviewed this book';
      throw new BadRequestException(message);
    }

    const id = randomUUID();
    const now = new Date();

    await this.db.insert(schema.reviews).values({
      id,
      userId,
      bookId: book.id,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await this.db
      .select({
        id: schema.reviews.id,
        userId: schema.reviews.userId,
        bookId: schema.reviews.bookId,
        rating: schema.reviews.rating,
        title: schema.reviews.title,
        body: schema.reviews.body,
        createdAt: schema.reviews.createdAt,
        updatedAt: schema.reviews.updatedAt,
        deletedAt: schema.reviews.deletedAt,
        userName: schema.users.name,
      })
      .from(schema.reviews)
      .leftJoin(schema.users, eq(schema.reviews.userId, schema.users.id))
      .where(eq(schema.reviews.id, id))
      .limit(1)
      .offset(0);

    const rating = await this.refreshBookRating(book.id);

    return {
      data: {
        review: created as ReviewWithUser,
        rating,
      },
      meta: {},
      error: {},
      ok: true,
    };
  }

  async getReviewsByBookId(
    bookId: string,
    query: ListBookReviewsQuery,
  ): Promise<{
    data: {
      book: {
        id: string;
        title: string;
        coverUrl: string;
        authorName: string | null;
        averageRating: number;
        totalReviews: number;
      };
      reviews: ReviewWithUser[];
      ratingCounts: RatingCounts;
    };
    meta: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    error: Record<string, never>;
    ok: true;
  }> {
    const book = await this.fetchBookById(bookId);
    const baseFilter = and(
      eq(schema.reviews.bookId, book.id),
      sql`${schema.reviews.deletedAt} IS NULL`,
    );

    const ratingGroups = await this.db
      .select({
        rating: schema.reviews.rating,
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.reviews)
      .where(baseFilter)
      .groupBy(schema.reviews.rating);

    const {
      counts: ratingCounts,
      averageRating,
      totalReviews,
    } = this.summarizeRatingCounts(ratingGroups);

    let reviewFilter = baseFilter;
    if (typeof query.rating === 'number') {
      reviewFilter = and(reviewFilter, eq(schema.reviews.rating, query.rating));
    }

    const offset = (query.page - 1) * query.pageSize;

    const [reviews, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: schema.reviews.id,
          userId: schema.reviews.userId,
          bookId: schema.reviews.bookId,
          rating: schema.reviews.rating,
          title: schema.reviews.title,
          body: schema.reviews.body,
          createdAt: schema.reviews.createdAt,
          updatedAt: schema.reviews.updatedAt,
          deletedAt: schema.reviews.deletedAt,
          userName: schema.users.name,
        })
        .from(schema.reviews)
        .leftJoin(schema.users, eq(schema.reviews.userId, schema.users.id))
        .where(reviewFilter)
        .orderBy(this.buildReviewOrder(query.sort ?? 'newest'))
        .limit(query.pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.reviews)
        .where(reviewFilter),
    ]);

    const totalPages = Math.ceil(total / query.pageSize);

    return {
      data: {
        book: {
          id: book.id,
          title: book.title,
          coverUrl: book.coverUrl,
          authorName: book.authorName,
          averageRating,
          totalReviews,
        },
        reviews: reviews as ReviewWithUser[],
        ratingCounts,
      },
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
      error: {},
      ok: true,
    };
  }

  async getReviewsBySlug(
    slug: string,
    query: ListBookReviewsQuery,
  ): Promise<{
    data: {
      book: {
        id: string;
        title: string;
        coverUrl: string;
        authorName: string | null;
        averageRating: number;
        totalReviews: number;
      };
      reviews: ReviewWithUser[];
      ratingCounts: RatingCounts;
    };
    meta: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    error: Record<string, never>;
    ok: true;
  }> {
    const book = await this.fetchBookBySlug(slug);
    const baseFilter = and(
      eq(schema.reviews.bookId, book.id),
      sql`${schema.reviews.deletedAt} IS NULL`,
    );

    const ratingGroups = await this.db
      .select({
        rating: schema.reviews.rating,
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.reviews)
      .where(baseFilter)
      .groupBy(schema.reviews.rating);

    const {
      counts: ratingCounts,
      averageRating,
      totalReviews,
    } = this.summarizeRatingCounts(ratingGroups);

    let reviewFilter = baseFilter;
    if (typeof query.rating === 'number') {
      reviewFilter = and(reviewFilter, eq(schema.reviews.rating, query.rating));
    }

    const offset = (query.page - 1) * query.pageSize;

    const [reviews, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: schema.reviews.id,
          userId: schema.reviews.userId,
          bookId: schema.reviews.bookId,
          rating: schema.reviews.rating,
          title: schema.reviews.title,
          body: schema.reviews.body,
          createdAt: schema.reviews.createdAt,
          updatedAt: schema.reviews.updatedAt,
          deletedAt: schema.reviews.deletedAt,
          userName: schema.users.name,
        })
        .from(schema.reviews)
        .leftJoin(schema.users, eq(schema.reviews.userId, schema.users.id))
        .where(reviewFilter)
        .orderBy(this.buildReviewOrder(query.sort ?? 'newest'))
        .limit(query.pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.reviews)
        .where(reviewFilter),
    ]);

    const totalPages = Math.ceil(total / query.pageSize);

    return {
      data: {
        book: {
          id: book.id,
          title: book.title,
          coverUrl: book.coverUrl,
          authorName: book.authorName,
          averageRating,
          totalReviews,
        },
        reviews: reviews as ReviewWithUser[],
        ratingCounts,
      },
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
      error: {},
      ok: true,
    };
  }

  private async fetchUserById(id: string): Promise<UserRow> {
    const [row] = await this.db
      .select()
      .from(schema.users)
      .where(
        and(eq(schema.users.id, id), sql`${schema.users.deletedAt} IS NULL`),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('User not found');
    }

    return row;
  }

  async getReviewsByUserId(
    userId: string,
    query: ListBookReviewsQuery,
  ): Promise<{
    data: {
      user: {
        id: string;
        name: string | null;
        email: string | null;
        averageRating: number;
        totalReviews: number;
      };
      reviews: ReviewWithBook[];
      ratingCounts: RatingCounts;
    };
    meta: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    error: Record<string, never>;
    ok: true;
  }> {
    const user = await this.fetchUserById(userId);
    const baseFilter = and(
      eq(schema.reviews.userId, user.id),
      sql`${schema.reviews.deletedAt} IS NULL`,
    );

    const ratingGroups = await this.db
      .select({
        rating: schema.reviews.rating,
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.reviews)
      .where(baseFilter)
      .groupBy(schema.reviews.rating);

    const {
      counts: ratingCounts,
      averageRating,
      totalReviews,
    } = this.summarizeRatingCounts(ratingGroups);

    let reviewFilter = baseFilter;
    if (typeof query.rating === 'number') {
      reviewFilter = and(reviewFilter, eq(schema.reviews.rating, query.rating));
    }

    const offset = (query.page - 1) * query.pageSize;

    const [reviews, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: schema.reviews.id,
          userId: schema.reviews.userId,
          bookId: schema.reviews.bookId,
          rating: schema.reviews.rating,
          title: schema.reviews.title,
          body: schema.reviews.body,
          createdAt: schema.reviews.createdAt,
          updatedAt: schema.reviews.updatedAt,
          deletedAt: schema.reviews.deletedAt,
          bookTitle: schema.books.title,
          bookSlug: schema.books.slug,
          bookCoverUrl: schema.books.coverUrl,
          bookAuthorName: schema.authors.name,
        })
        .from(schema.reviews)
        .leftJoin(schema.books, eq(schema.reviews.bookId, schema.books.id))
        .leftJoin(schema.authors, eq(schema.books.authorId, schema.authors.id))
        .where(reviewFilter)
        .orderBy(this.buildReviewOrder(query.sort ?? 'newest'))
        .limit(query.pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.reviews)
        .where(reviewFilter),
    ]);

    const totalPages = Math.ceil(total / query.pageSize);

    return {
      data: {
        user: {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
          averageRating,
          totalReviews,
        },
        reviews: reviews as ReviewWithBook[],
        ratingCounts,
      },
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
      error: {},
      ok: true,
    };
  }

  async create(
    input: Omit<CreateBookInput, 'coverUrl'> & { coverUrl?: string },
  ): Promise<BookWithAuthorName> {
    const coverUrl = input.coverUrl?.trim();
    if (!coverUrl) {
      throw new BadRequestException('Cover image is required');
    }

    const id = randomUUID();
    const slug = input.slug ?? this.slugify(input.title);

    await this.db.insert(schema.books).values({
      id,
      title: input.title,
      slug,
      categoryId: input.categoryId,
      authorId: input.authorId ?? null,
      isbn: input.isbn ?? null,
      priceCents: input.priceCents,
      discountPriceCents: input.discountPriceCents ?? null,
      stock: input.stock ?? 0,
      coverUrl,
      description: input.description,
      pages: input.pages ?? null,
      language: input.language ?? null,
      publisher: input.publisher ?? null,
      publishedAt: input.publishedAt ?? null,
      isActive: input.active ?? true,
    });

    return this.findOne(id);
  }

  private buildBookOrder(sort: string) {
    switch (sort) {
      case 'newest':
        return [desc(schema.books.createdAt)];
      case 'highest':
        return [desc(schema.books.priceCents)];
      case 'lowest':
        return [asc(schema.books.priceCents)];
      case 'popular':
        return [
          desc(schema.books.ratingCount),
          desc(schema.books.ratingAvg),
          desc(schema.books.createdAt),
        ];
      default: {
        const [sortField, sortDirRaw] = sort.split(':');
        const sortDir = sortDirRaw?.toLowerCase() === 'desc' ? 'desc' : 'asc';

        switch (sortField) {
          case 'createdAt':
            return [
              sortDir === 'desc'
                ? desc(schema.books.createdAt)
                : asc(schema.books.createdAt),
            ];
          case 'priceCents':
            return [
              sortDir === 'desc'
                ? desc(schema.books.priceCents)
                : asc(schema.books.priceCents),
            ];
          default:
            return [
              sortDir === 'desc'
                ? desc(schema.books.title)
                : asc(schema.books.title),
            ];
        }
      }
    }
  }

  private buildAdminBookOrder(sort?: string) {
    const allowed = {
      title: schema.books.title,
      createdAt: schema.books.createdAt,
      priceCents: schema.books.priceCents,
    } as const;

    const [field, dirRaw] = (sort ?? 'createdAt:desc').split(':');
    const column =
      allowed[field as keyof typeof allowed] ?? schema.books.createdAt;

    return [dirRaw === 'desc' ? desc(column) : asc(column)];
  }

  private buildReviewOrder(sort: ListBookReviewsQuery['sort']) {
    switch (sort) {
      case 'oldest':
        return asc(schema.reviews.createdAt);
      case 'highest':
        return desc(schema.reviews.rating);
      case 'lowest':
        return asc(schema.reviews.rating);
      default:
        return desc(schema.reviews.createdAt);
    }
  }

  private summarizeRatingCounts(rows: RatingAggregationRow[]) {
    const counts = REVIEW_RATING_VALUES.reduce((acc, rating) => {
      acc[rating] = 0;
      return acc;
    }, {} as RatingCounts);

    for (const row of rows) {
      const ratingValue = row.rating as ReviewRatingValue;
      if (!REVIEW_RATING_VALUES.includes(ratingValue)) {
        continue;
      }

      counts[ratingValue] = Number(row.count);
    }

    const totalReviews = Object.values(counts).reduce(
      (sum, value) => sum + value,
      0,
    );
    const ratingSum = REVIEW_RATING_VALUES.reduce(
      (sum, rating) => sum + rating * counts[rating],
      0,
    );

    const averageRating = totalReviews
      ? Number((ratingSum / totalReviews).toFixed(2))
      : 0;

    return { counts, totalReviews, averageRating };
  }

  private async fetchBookReviews(
    bookId: string,
    limit?: number,
  ): Promise<ReviewWithUser[]> {
    const baseQuery = this.db
      .select({
        id: schema.reviews.id,
        userId: schema.reviews.userId,
        bookId: schema.reviews.bookId,
        rating: schema.reviews.rating,
        title: schema.reviews.title,
        body: schema.reviews.body,
        createdAt: schema.reviews.createdAt,
        updatedAt: schema.reviews.updatedAt,
        deletedAt: schema.reviews.deletedAt,
        userName: schema.users.name,
      })
      .from(schema.reviews)
      .leftJoin(schema.users, eq(schema.reviews.userId, schema.users.id))
      .where(eq(schema.reviews.bookId, bookId))
      .orderBy(desc(schema.reviews.createdAt));

    const reviews = await (typeof limit === 'number'
      ? baseQuery.limit(limit)
      : baseQuery);

    return reviews as ReviewWithUser[];
  }

  private calculateAverageRating(reviews: ReviewWithUser[]): number {
    if (!reviews.length) {
      return 0;
    }

    const total = reviews.reduce(
      (sum, review) => sum + (review.rating ?? 0),
      0,
    );
    return Number((total / reviews.length).toFixed(2));
  }

  async update(
    id: string,
    input: UpdateBookInput,
  ): Promise<BookWithAuthorName> {
    const existing = await this.findOne(id);
    console.log({ existing });
    console.log({ input });
    const nextSlug =
      input.slug ??
      existing.slug ??
      (input.title ? this.slugify(input.title) : this.slugify(existing.title));

    await this.db
      .update(schema.books)
      .set({
        title: input.title ?? existing.title,
        slug: nextSlug,
        categoryId: input.categoryId ?? existing.categoryId,
        authorId: input.authorId ?? existing.authorId,
        isbn: input.isbn ?? existing.isbn,
        priceCents: input.priceCents ?? existing.priceCents,
        discountPriceCents:
          input.discountPriceCents ?? existing.discountPriceCents,
        stock: input.stock ?? existing.stock,
        coverUrl: input.coverUrl ?? existing.coverUrl,
        description: input.description ?? existing.description,
        pages: input.pages ?? existing.pages,
        language: input.language ?? existing.language,
        publisher: input.publisher ?? existing.publisher,
        publishedAt: input.publishedAt ?? existing.publishedAt,
        isActive:
          typeof input.active === 'boolean' ? input.active : existing.isActive,
      })
      .where(eq(schema.books.id, id));

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.db
      .update(schema.books)
      .set({ deletedAt: new Date() })
      .where(eq(schema.books.id, id));
  }

  async findAllAdmin(query: ListBooksQuery) {
    const { page, pageSize, sort } = query;

    const where = this.buildWhere(query);
    const offset = (page - 1) * pageSize;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(bookWithAuthorSelection)
        .from(schema.books)
        .leftJoin(schema.authors, eq(schema.books.authorId, schema.authors.id))
        .leftJoin(
          schema.categories,
          eq(schema.books.categoryId, schema.categories.id),
        )
        .where(where)
        .orderBy(...this.buildAdminBookOrder(sort))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.books)
        .where(where),
    ]);

    return {
      items: rows as BookWithAuthorName[],
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOneAdmin(
    id: string,
    options?: { userId?: string },
  ): Promise<BookWithAuthorName> {
    const [row] = await this.db
      .select(bookWithAuthorSelection)
      .from(schema.books)
      .leftJoin(
        schema.categories,
        eq(schema.books.categoryId, schema.categories.id),
      )
      .leftJoin(schema.authors, eq(schema.books.authorId, schema.authors.id))
      .leftJoin(schema.reviews, eq(schema.books.id, schema.reviews.bookId))
      .where(
        and(eq(schema.books.id, id), sql`${schema.books.deletedAt} IS NULL`),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Book not found');
    }

    const reviews = await this.fetchBookReviews(id);
    const averageRating = this.calculateAverageRating(reviews);
    const totalReviews = reviews.length;

    return {
      ...(row as BookWithAuthorName),
      reviews,
      averageRating,
      totalReviews,
    };
  }
}
