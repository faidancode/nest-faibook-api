import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import * as schema from '../infra/drizzle/schema';
import type {
  ListCustomersQuery,
  UpdateCustomerProfileInput,
} from './customers.schemas';
import { OrdersService } from '../orders/orders.service';
import * as bcrypt from 'bcrypt';

type Db = MySql2Database<typeof schema>;

type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt: Date;
};

@Injectable()
export class CustomersService {
  constructor(
    @Inject('DRIZZLE') private readonly db: Db,
    private readonly ordersService: OrdersService,
  ) {}

  private buildWhere(q?: string, search?: string) {
    let where: any = and(
      eq(schema.users.role, 'CUSTOMER'),
      sql`${schema.users.deletedAt} IS NULL`,
    );

    const termRaw = search ?? q;
    if (termRaw?.trim()) {
      const term = `%${termRaw.trim()}%`;
      where = and(
        where,
        or(
          like(schema.users.name, term),
          like(schema.users.email, term),
          like(schema.users.phone, term),
        ),
      );
    }

    return where;
  }

  async findAll(query: ListCustomersQuery) {
    const { page, pageSize, q, search, sort } = query;
    const [sortField, sortDirRaw] = sort.split(':');
    const sortDir = sortDirRaw?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    const allowedSortFields = {
      createdAt: schema.users.createdAt,
      name: schema.users.name,
      email: schema.users.email,
    } as const;

    const column =
      allowedSortFields[sortField as keyof typeof allowedSortFields] ??
      schema.users.createdAt;

    const orderBy = sortDir === 'desc' ? desc(column) : asc(column);
    console.log({ orderBy });
    const where = this.buildWhere(q, search);
    const offset = (page - 1) * pageSize;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          phone: schema.users.phone,
          role: schema.users.role,
          createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .where(where)
        .orderBy(orderBy)
        .limit(query.pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.users)
        .where(where),
    ]);

    return {
      items: rows as CustomerRow[],
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getCustomerWithOrders(customerId: string): Promise<{
    customer: CustomerRow;
    orders: Awaited<ReturnType<OrdersService['getOrdersByUserId']>>;
  }> {
    const [customer] = await this.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        phone: schema.users.phone,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, customerId),
          eq(schema.users.role, 'CUSTOMER'),
          sql`${schema.users.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const orders = await this.ordersService.getOrdersByUserId(customerId);

    return {
      customer: customer as CustomerRow,
      orders,
    };
  }

  async updateProfile(
    userId: string,
    input: UpdateCustomerProfileInput,
  ): Promise<{ id: string; name: string; email: string; role: string }> {
    const [user] = await this.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, userId),
          eq(schema.users.role, 'CUSTOMER'),
          sql`${schema.users.deletedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (!user) {
      throw new NotFoundException('Customer not found');
    }

    const updates: Partial<typeof schema.users.$inferInsert> = {};

    if (input.name !== undefined) {
      updates.name = input.name;
    }

    if (input.password !== undefined) {
      updates.passwordHash = await bcrypt.hash(input.password, 10);
    }

    if (Object.keys(updates).length > 0) {
      await this.db
        .update(schema.users)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, userId));
    }

    return {
      id: user.id,
      name: input.name ?? user.name,
      email: user.email,
      role: user.role,
    };
  }
}
