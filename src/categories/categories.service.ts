import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { and, asc, desc, eq, like, sql } from 'drizzle-orm';
import * as schema from '../infra/drizzle/schema';
import type {
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from './categories.schemas';
import type { ListBooksQuery } from '../books/books.schemas';
import { randomUUID } from 'crypto';

type Db = MySql2Database<typeof schema>;
type CategoryRow = typeof schema.categories.$inferSelect;
type BookRow = typeof schema.books.$inferSelect;

@Injectable()
export class CategoriesService {
  constructor(@Inject('DRIZZLE') private readonly db: Db) {}

  private buildWhere(q?: string, search?: string) {
    let where: any = sql`1 = 1`;

    // soft delete filter
    where = and(where, sql`${schema.categories.deletedAt} IS NULL`);

    const term = (search ?? q)?.trim();
    if (term && term.length > 0) {
      where = and(where, like(schema.categories.name, `%${term}%`));
    }

    return where;
  }

  private resolveBookSort(sort: string) {
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

  async findAll(query: ListCategoriesQuery) {
    const { page, pageSize, q, sort, search } = query;

    const [sortField, sortDirRaw] = sort.split(':');
    const sortDir = sortDirRaw?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    const allowedSortFields = {
      createdAt: schema.categories.createdAt,
      name: schema.categories.name,
      icon: schema.categories.icon,
    } as const;

    const column =
      allowedSortFields[sortField as keyof typeof allowedSortFields] ??
      schema.categories.createdAt;

    const orderBy = sortDir === 'desc' ? desc(column) : asc(column);

    const where = this.buildWhere(q, search);
    const offset = (page - 1) * pageSize;
    console.log({ where });

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(schema.categories)
        .where(where)
        .orderBy(orderBy)
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.categories)
        .where(where),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: rows,
      meta: { page, pageSize, total, totalPages },
    };
  }

  async findOne(id: string): Promise<CategoryRow> {
    const [row] = await this.db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.id, id),
          sql`${schema.categories.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Category not found');
    }

    return row;
  }

  async create(input: CreateCategoryInput): Promise<CategoryRow> {
    const slug =
      input.slug ??
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

    const [existing] = await this.db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.slug, slug))
      .limit(1);

    if (existing && !existing.deletedAt) {
      throw new ConflictException('Category slug already exists');
    }

    // If slug exists but the record was soft-deleted, restore it instead of failing unique constraint
    if (existing && existing.deletedAt) {
      await this.db
        .update(schema.categories)
        .set({
          name: input.name,
          slug,
          icon: input.icon ?? null,
          description: input.description ?? null,
          sortOrder: existing.sortOrder ?? 0,
          isActive: input.active ?? true,
          deletedAt: null,
        })
        .where(eq(schema.categories.id, existing.id));

      return this.findOne(existing.id);
    }

    const id = randomUUID();

    await this.db.insert(schema.categories).values({
      id,
      name: input.name,
      slug,
      icon: input.icon ?? null,
      description: input.description ?? null,
      sortOrder: 0,
      isActive: input.active ?? true,
    });

    return this.findOne(id);
  }

  async update(id: string, input: UpdateCategoryInput): Promise<CategoryRow> {
    const existing = await this.findOne(id);

    const slug =
      input.slug ??
      existing.slug ??
      existing.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

    await this.db
      .update(schema.categories)
      .set({
        name: input.name ?? existing.name,
        slug,
        icon: input.icon ?? existing.icon,
        description: input.description ?? existing.description,
        isActive:
          typeof input.active === 'boolean' ? input.active : existing.isActive,
      })
      .where(eq(schema.categories.id, id));

    return this.findOne(id);
  }

  async findBooksBySlug(
    slug: string,
    query: ListBooksQuery,
  ): Promise<{
    category: CategoryRow;
    items: BookRow[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const [category] = await this.db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.slug, slug),
          sql`${schema.categories.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    let where: any = sql`1 = 1`;
    where = and(where, sql`${schema.books.deletedAt} IS NULL`);
    where = and(where, eq(schema.books.categoryId, category.id));

    if (query.q?.trim()) {
      where = and(where, like(schema.books.title, `%${query.q.trim()}%`));
    }

    if (query.authorId) {
      where = and(where, eq(schema.books.authorId, query.authorId));
    }

    if (typeof query.active === 'boolean') {
      where = and(where, eq(schema.books.isActive, query.active));
    }

    const orderBy = this.resolveBookSort(query.sort);
    const offset = (query.page - 1) * query.pageSize;

    const [items, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(schema.books)
        .where(where)
        .orderBy(...orderBy)
        .limit(query.pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.books)
        .where(where),
    ]);

    const totalPages = Math.ceil(total / query.pageSize);

    return {
      category,
      items,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
    };
  }

  async remove(id: string): Promise<void> {
    // soft delete
    await this.findOne(id); // ensure exists
    await this.db
      .update(schema.categories)
      .set({ deletedAt: new Date() })
      .where(eq(schema.categories.id, id));
  }
}
