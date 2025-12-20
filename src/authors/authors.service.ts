import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { and, asc, desc, eq, like, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from '../infra/drizzle/schema';
import type {
  CreateAuthorInput,
  ListAuthorsQuery,
  UpdateAuthorInput,
} from './authors.schemas';
import type { ListBooksQuery } from '../books/books.schemas';

type Db = MySql2Database<typeof schema>;
type AuthorRow = typeof schema.authors.$inferSelect;
type BookRow = typeof schema.books.$inferSelect;

@Injectable()
export class AuthorsService {
  constructor(@Inject('DRIZZLE') private readonly db: Db) {}

  private slugify(input: string) {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  private buildWhere(q?: string, search?: string) {
    let where: any = sql`1 = 1`;
    where = and(where, sql`${schema.authors.deletedAt} IS NULL`);

    const term = (search ?? q)?.trim();
    if (term && term.length > 0) {
      where = and(where, like(schema.authors.name, `%${term}%`));
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

  async findAll(query: ListAuthorsQuery) {
    const { page, pageSize, q, search, sort } = query;

    const [sortField, sortDirRaw] = sort.split(':');
    const sortDir = sortDirRaw?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    const allowedSortFields = {
      createdAt: schema.authors.createdAt,
      name: schema.authors.name,
    } as const;

    const column =
      allowedSortFields[sortField as keyof typeof allowedSortFields] ??
      schema.authors.createdAt;

    const orderBy = sortDir === 'desc' ? desc(column) : asc(column);

    const where = this.buildWhere(q, search);
    const offset = (page - 1) * pageSize;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(schema.authors)
        .where(where)
        .orderBy(orderBy)
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.authors)
        .where(where),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: rows,
      meta: { page, pageSize, total, totalPages },
    };
  }

  async findOne(id: string): Promise<AuthorRow> {
    const [row] = await this.db
      .select()
      .from(schema.authors)
      .where(
        and(
          eq(schema.authors.id, id),
          sql`${schema.authors.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Author not found');
    }

    return row;
  }

  async create(input: CreateAuthorInput): Promise<AuthorRow> {
    const slug = input.slug ?? this.slugify(input.name);

    const [existing] = await this.db
      .select()
      .from(schema.authors)
      .where(eq(schema.authors.slug, slug))
      .limit(1);

    if (existing && !existing.deletedAt) {
      throw new ConflictException('Author slug already exists');
    }

    if (existing && existing.deletedAt) {
      await this.db
        .update(schema.authors)
        .set({
          name: input.name,
          slug,
          bio: input.bio ?? null,
          deletedAt: null,
        })
        .where(eq(schema.authors.id, existing.id));

      return this.findOne(existing.id);
    }

    const id = randomUUID();

    await this.db.insert(schema.authors).values({
      id,
      name: input.name,
      slug,
      bio: input.bio ?? null,
    });

    return this.findOne(id);
  }

  async update(id: string, input: UpdateAuthorInput): Promise<AuthorRow> {
    const existing = await this.findOne(id);

    const slug =
      input.slug ?? existing.slug ?? this.slugify(input.name ?? existing.name);

    await this.db
      .update(schema.authors)
      .set({
        name: input.name ?? existing.name,
        slug,
        bio: input.bio ?? existing.bio,
      })
      .where(eq(schema.authors.id, id));

    return this.findOne(id);
  }

  async findBooksBySlug(
    slug: string,
    query: ListBooksQuery,
  ): Promise<{
    author: AuthorRow;
    items: BookRow[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const [author] = await this.db
      .select()
      .from(schema.authors)
      .where(
        and(
          eq(schema.authors.slug, slug),
          sql`${schema.authors.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (!author) {
      throw new NotFoundException('Author not found');
    }

    let where: any = sql`1 = 1`;
    where = and(where, sql`${schema.books.deletedAt} IS NULL`);
    where = and(where, eq(schema.books.authorId, author.id));

    if (query.q?.trim()) {
      where = and(where, like(schema.books.title, `%${query.q.trim()}%`));
    }

    if (query.categoryId) {
      where = and(where, eq(schema.books.categoryId, query.categoryId));
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
      author,
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
    await this.findOne(id);
    await this.db
      .update(schema.authors)
      .set({ deletedAt: new Date() })
      .where(eq(schema.authors.id, id));
  }
}
