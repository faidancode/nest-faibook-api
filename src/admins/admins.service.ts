import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { and, asc, desc, eq, like, sql } from 'drizzle-orm';
import * as schema from '../infra/drizzle/schema';
import type { CreateAdminInput, ListAdminQuery } from './admins.schemas';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

type Db = MySql2Database<typeof schema>;
type UserRow = typeof schema.users.$inferSelect;

@Injectable()
export class AdminsService {
  constructor(@Inject('DRIZZLE') private readonly db: Db) {}

  private buildWhere(q?: string, search?: string) {
    let where: any = sql`1 = 1`;

    where = and(where, sql`${schema.users.deletedAt} IS NULL`);
    where = and(where, sql`${schema.users.role} IN ('ADMIN', 'SUPERADMIN')`);

    const term = (search ?? q)?.trim();
    if (term) {
      where = and(where, like(schema.users.name, `%${term}%`));
    }

    return where;
  }

  async findAll(query: ListAdminQuery) {
    const { page, pageSize, q, search, sort } = query;

    const [sortField, sortDirRaw] = sort.split(':');
    const sortDir = sortDirRaw === 'desc' ? 'desc' : 'asc';

    const orderBy =
      sortField === 'createdAt'
        ? sortDir === 'desc'
          ? desc(schema.users.createdAt)
          : asc(schema.users.createdAt)
        : sortDir === 'desc'
          ? desc(schema.users.name)
          : asc(schema.users.name);

    const where = this.buildWhere(q, search);
    const offset = (page - 1) * pageSize;

    const [items, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(schema.users)
        .where(where)
        .orderBy(orderBy)
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.users)
        .where(where),
    ]);

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string): Promise<UserRow> {
    const [row] = await this.db
      .select()
      .from(schema.users)
      .where(
        and(eq(schema.users.id, id), sql`${schema.users.deletedAt} IS NULL`),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Admin not found');
    }

    return row;
  }

  async create(input: CreateAdminInput): Promise<UserRow> {
    const [existing] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, input.email))
      .limit(1);

    if (existing && !existing.deletedAt) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    // restore if soft-deleted
    if (existing && existing.deletedAt) {
      await this.db
        .update(schema.users)
        .set({
          name: input.name,
          passwordHash: passwordHash,
          phone: input.phone ?? null,
          role: 'ADMIN',
          isActive: true,
          deletedAt: null,
        })
        .where(eq(schema.users.id, existing.id));

      return this.findOne(existing.id);
    }

    const id = randomUUID();

    await this.db.insert(schema.users).values({
      id,
      name: input.name,
      email: input.email,
      passwordHash: passwordHash,
      phone: input.phone ?? null,
      role: 'ADMIN',
      isActive: true,
    });

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.db
      .update(schema.users)
      .set({ deletedAt: new Date() })
      .where(eq(schema.users.id, id));
  }

  
}
