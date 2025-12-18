import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { and, asc, desc, eq, isNull, like, sql } from 'drizzle-orm';
import * as schema from '../infra/drizzle/schema';
import type {
  CreateAdminInput,
  ListAdminQuery,
  UpdateAdminInput,
} from './admins.schemas';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

type Db = MySql2Database<typeof schema>;
type UserRow = typeof schema.users.$inferSelect;

export const userPublicColumns = {
  id: schema.users.id,
  name: schema.users.name,
  email: schema.users.email,
  phone: schema.users.phone,
  role: schema.users.role,
  isActive: schema.users.isActive,
  createdAt: schema.users.createdAt,
  updatedAt: schema.users.updatedAt,
  deletedAt: schema.users.deletedAt,
};

// Type helper
export type UserResponse = Omit<
  typeof schema.users.$inferSelect,
  'passwordHash'
>;

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
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          role: schema.users.role,
          createdAt: schema.users.createdAt,
          // passwordHash tidak disertakan di sini
        })
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

  async findOne(id: string): Promise<UserResponse> {
    const [row] = await this.db
      .select(userPublicColumns) // Membatasi kolom di tingkat DB
      .from(schema.users)
      .where(and(eq(schema.users.id, id), isNull(schema.users.deletedAt)))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Admin not found');
    }

    return row as UserResponse; // Casting untuk memastikan TS tidak komplain
  }

  async create(input: CreateAdminInput): Promise<UserResponse> {
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

      return this.findOne(existing.id); // findOne sudah aman (tanpa password)
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

    return this.findOne(id); // findOne sudah aman (tanpa password)
  }

  async update(id: string, input: UpdateAdminInput): Promise<UserResponse> {
    const [existing] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Admin not found');
    }

    const updateData: Partial<typeof schema.users.$inferInsert> = {
      name: input.name,
      phone: input.phone ?? null,
    };

    // ✅ hanya update password jika dikirim
    if (input.password) {
      updateData.passwordHash = await bcrypt.hash(input.password, 10);
    }

    await this.db
      .update(schema.users)
      .set(updateData)
      .where(eq(schema.users.id, id));

    return this.findOne(id); // tetap aman, tanpa password
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.db
      .update(schema.users)
      .set({ deletedAt: new Date() })
      .where(eq(schema.users.id, id));
  }
}
