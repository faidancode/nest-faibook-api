import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import * as schema from "../infra/drizzle/schema";
import type {
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from "./categories.schemas";
import { randomUUID } from "crypto";

type Db = MySql2Database<typeof schema>;
type CategoryRow = typeof schema.categories.$inferSelect;

@Injectable()
export class CategoriesService {
  constructor(@Inject("DRIZZLE") private readonly db: Db) {}

  private buildWhere(q?: string) {
    let where: any = sql`1 = 1`;

    // soft delete filter
    where = and(where, sql`${schema.categories.deletedAt} IS NULL`);

    if (q && q.trim().length > 0) {
      where = and(
        where,
        like(schema.categories.name, `%${q.trim()}%`),
      );
    }

    return where;
  }

  async findAll(query: ListCategoriesQuery) {
    const { page, pageSize, q, sort } = query;

    const [sortField, sortDirRaw] = sort.split(":");
    const sortDir = sortDirRaw?.toLowerCase() === "desc" ? "desc" : "asc";

    const orderBy =
      sortField === "createdAt"
        ? sortDir === "desc"
          ? desc(schema.categories.createdAt)
          : asc(schema.categories.createdAt)
        : sortDir === "desc"
        ? desc(schema.categories.name)
        : asc(schema.categories.name);

    const where = this.buildWhere(q);
    const offset = (page - 1) * pageSize;

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
      throw new NotFoundException("Category not found");
    }

    return row;
  }

  async create(input: CreateCategoryInput): Promise<CategoryRow> {
    const id = randomUUID();
    const slug =
      input.slug ??
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

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
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

    await this.db
      .update(schema.categories)
      .set({
        name: input.name ?? existing.name,
        slug,
        icon: input.icon ?? existing.icon,
        description: input.description ?? existing.description,
        isActive:
          typeof input.active === "boolean"
            ? input.active
            : existing.isActive,
      })
      .where(eq(schema.categories.id, id));

    return this.findOne(id);
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
