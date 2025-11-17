import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { and, asc, desc, eq, like, sql } from 'drizzle-orm';
import * as schema from '../infra/drizzle/schema';
import type {
  CreateBookInput,
  ListBooksQuery,
  UpdateBookInput,
} from './books.schemas';
import { randomUUID } from 'crypto';

type Db = MySql2Database<typeof schema>;
type BookRow = typeof schema.books.$inferSelect;

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

  async findAll(query: ListBooksQuery) {
    const { page, pageSize, sort } = query;
    const [sortField, sortDirRaw] = sort.split(':');
    const sortDir = sortDirRaw?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    let orderBy;
    switch (sortField) {
      case 'createdAt':
        orderBy =
          sortDir === 'desc'
            ? desc(schema.books.createdAt)
            : asc(schema.books.createdAt);
        break;
      case 'priceCents':
        orderBy =
          sortDir === 'desc'
            ? desc(schema.books.priceCents)
            : asc(schema.books.priceCents);
        break;
      default:
        orderBy =
          sortDir === 'desc'
            ? desc(schema.books.title)
            : asc(schema.books.title);
        break;
    }

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
        .select()
        .from(schema.books)
        .where(where)
        .orderBy(orderBy)
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.books)
        .where(where),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: rows,
      meta: { page, pageSize, total, totalPages },
    };
  }

  async findOne(id: string): Promise<BookRow> {
    const [row] = await this.db
      .select()
      .from(schema.books)
      .where(
        and(eq(schema.books.id, id), sql`${schema.books.deletedAt} IS NULL`),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Book not found');
    }

    return row;
  }

  async findBySlug(slug: string): Promise<BookRow> {
    const [row] = await this.db
      .select()
      .from(schema.books)
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

    return row;
  }

  async create(input: CreateBookInput): Promise<BookRow> {
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
      coverUrl: input.coverUrl,
      description: input.description,
      pages: input.pages ?? null,
      language: input.language ?? null,
      publisher: input.publisher ?? null,
      publishedAt: input.publishedAt ?? null,
      isActive: input.active ?? true,
    });

    return this.findOne(id);
  }

  async update(id: string, input: UpdateBookInput): Promise<BookRow> {
    const existing = await this.findOne(id);
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
}
