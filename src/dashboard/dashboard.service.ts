import { Inject, Injectable } from '@nestjs/common';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import * as schema from '../infra/drizzle/schema';
import type {
  LowStockQuery,
  RangeQuery,
  RecentOrdersQuery,
  RecentReviewsQuery,
  SummaryQuery,
  TopBooksQuery,
} from './dashboard.schemas';

type Db = MySql2Database<typeof schema>;

@Injectable()
export class DashboardService {
  constructor(@Inject('DRIZZLE') private readonly db: Db) {}

  private startOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private startOfWeek(date: Date) {
    // Monday as start of week
    const d = this.startOfDay(date);
    const day = d.getDay(); // 0 (Sun) - 6 (Sat)
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    return d;
  }

  private startOfMonth(date: Date) {
    const d = this.startOfDay(date);
    d.setDate(1);
    return d;
  }

  private resolveRange(range: RangeQuery) {
    const to = this.endOfDay(range.to ?? new Date());
    const fromCandidate =
      range.from ?? new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
    const from = this.startOfDay(fromCandidate);
    return { from, to };
  }

  async getSummary(query: SummaryQuery) {
    const now = new Date();
    const today = this.startOfDay(now);
    const week = this.startOfWeek(now);
    const month = this.startOfMonth(now);

    const [ordersAgg] = await this.db
      .select({
        revenueToday: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.paymentStatus} = 'PAID' AND ${schema.orders.paidAt} >= ${today} THEN ${schema.orders.totalCents} ELSE 0 END), 0)`,
        revenueWTD: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.paymentStatus} = 'PAID' AND ${schema.orders.paidAt} >= ${week} THEN ${schema.orders.totalCents} ELSE 0 END), 0)`,
        revenueMTD: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.paymentStatus} = 'PAID' AND ${schema.orders.paidAt} >= ${month} THEN ${schema.orders.totalCents} ELSE 0 END), 0)`,
        pending: sql<number>`SUM(CASE WHEN ${schema.orders.status} = 'PENDING' THEN 1 ELSE 0 END)`,
        paid: sql<number>`SUM(CASE WHEN ${schema.orders.status} = 'PAID' THEN 1 ELSE 0 END)`,
        processing: sql<number>`SUM(CASE WHEN ${schema.orders.status} = 'PROCESSING' THEN 1 ELSE 0 END)`,
        shipped: sql<number>`SUM(CASE WHEN ${schema.orders.status} = 'SHIPPED' THEN 1 ELSE 0 END)`,
        delivered: sql<number>`SUM(CASE WHEN ${schema.orders.status} = 'DELIVERED' THEN 1 ELSE 0 END)`,
        cancelled: sql<number>`SUM(CASE WHEN ${schema.orders.status} = 'CANCELLED' THEN 1 ELSE 0 END)`,
        unpaidCount: sql<number>`SUM(CASE WHEN ${schema.orders.paymentStatus} = 'UNPAID' THEN 1 ELSE 0 END)`,
      })
      .from(schema.orders)
      .where(sql`${schema.orders.deletedAt} IS NULL`);

    const [{ newCustomersWeek = 0 } = { newCustomersWeek: 0 }] =
      await this.db
        .select({
          newCustomersWeek: sql<number>`COUNT(*)`,
        })
        .from(schema.users)
        .where(
          and(
            sql`${schema.users.deletedAt} IS NULL`,
            gte(schema.users.createdAt, week),
          ),
        );

    const [{ lowStockCount = 0 } = { lowStockCount: 0 }] = await this.db
      .select({
        lowStockCount: sql<number>`COUNT(*)`,
      })
      .from(schema.books)
      .where(
        and(
          sql`${schema.books.deletedAt} IS NULL`,
          eq(schema.books.isActive, true),
          lte(schema.books.stock, query.lowStockThreshold),
        ),
      );

    return {
      revenueToday: Number(ordersAgg?.revenueToday ?? 0),
      revenueWTD: Number(ordersAgg?.revenueWTD ?? 0),
      revenueMTD: Number(ordersAgg?.revenueMTD ?? 0),
      orders: {
        pending: Number(ordersAgg?.pending ?? 0),
        paid: Number(ordersAgg?.paid ?? 0),
        processing: Number(ordersAgg?.processing ?? 0),
        shipped: Number(ordersAgg?.shipped ?? 0),
        delivered: Number(ordersAgg?.delivered ?? 0),
        cancelled: Number(ordersAgg?.cancelled ?? 0),
      },
      unpaidCount: Number(ordersAgg?.unpaidCount ?? 0),
      newCustomersWeek: Number(newCustomersWeek ?? 0),
      lowStockCount: Number(lowStockCount ?? 0),
    };
  }

  async getSalesTrend(range: RangeQuery) {
    const { from, to } = this.resolveRange(range);
    const rows = await this.db
      .select({
        date: sql<string>`DATE(${schema.orders.placedAt})`,
        revenue: sql<number>`COALESCE(SUM(CASE WHEN ${schema.orders.paymentStatus} = 'PAID' THEN ${schema.orders.totalCents} ELSE 0 END), 0)`,
        orders: sql<number>`COUNT(*)`,
      })
      .from(schema.orders)
      .where(
        and(
          sql`${schema.orders.deletedAt} IS NULL`,
          gte(schema.orders.placedAt, from),
          lte(schema.orders.placedAt, to),
        ),
      )
      .groupBy(sql`DATE(${schema.orders.placedAt})`)
      .orderBy(sql`DATE(${schema.orders.placedAt})`);

    return rows.map((row) => ({
      date: row.date,
      revenue: Number(row.revenue ?? 0),
      orders: Number(row.orders ?? 0),
    }));
  }

  async getTopBooks(query: TopBooksQuery) {
    const { from, to } = this.resolveRange(query);
    const rows = await this.db
      .select({
        bookId: schema.books.id,
        title: schema.books.title,
        coverUrl: schema.books.coverUrl,
        quantity: sql<number>`COALESCE(SUM(${schema.orderItems.quantity}), 0)`,
        revenue: sql<number>`COALESCE(SUM(${schema.orderItems.totalCents}), 0)`,
      })
      .from(schema.orderItems)
      .innerJoin(
        schema.orders,
        eq(schema.orderItems.orderId, schema.orders.id),
      )
      .innerJoin(schema.books, eq(schema.orderItems.bookId, schema.books.id))
      .where(
        and(
          sql`${schema.orders.deletedAt} IS NULL`,
          sql`${schema.books.deletedAt} IS NULL`,
          eq(schema.orders.paymentStatus, 'PAID'),
          gte(schema.orders.placedAt, from),
          lte(schema.orders.placedAt, to),
        ),
      )
      .groupBy(schema.books.id, schema.books.title, schema.books.coverUrl)
      .orderBy(desc(sql`SUM(${schema.orderItems.quantity})`))
      .limit(query.pageSize);

    return rows.map((row) => ({
      bookId: row.bookId,
      title: row.title,
      coverUrl: row.coverUrl,
      quantity: Number(row.quantity ?? 0),
      revenue: Number(row.revenue ?? 0),
    }));
  }

  async getRecentOrders(query: RecentOrdersQuery) {
    const rows = await this.db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        totalCents: schema.orders.totalCents,
        status: schema.orders.status,
        paymentStatus: schema.orders.paymentStatus,
        placedAt: schema.orders.placedAt,
        userName: schema.users.name,
        userEmail: schema.users.email,
        userPhone: schema.users.phone,
      })
      .from(schema.orders)
      .leftJoin(schema.users, eq(schema.orders.userId, schema.users.id))
      .where(sql`${schema.orders.deletedAt} IS NULL`)
      .orderBy(desc(schema.orders.placedAt))
      .limit(query.pageSize);

    return rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      totalCents: row.totalCents,
      status: row.status,
      paymentStatus: row.paymentStatus,
      placedAt: row.placedAt,
      customer: {
        name: row.userName ?? null,
        email: row.userEmail ?? null,
        phone: row.userPhone ?? null,
      },
    }));
  }

  async getLowStock(query: LowStockQuery) {
    const rows = await this.db
      .select({
        id: schema.books.id,
        title: schema.books.title,
        stock: schema.books.stock,
        coverUrl: schema.books.coverUrl,
        categoryId: schema.books.categoryId,
        categoryName: schema.categories.name,
      })
      .from(schema.books)
      .leftJoin(
        schema.categories,
        eq(schema.books.categoryId, schema.categories.id),
      )
      .where(
        and(
          sql`${schema.books.deletedAt} IS NULL`,
          eq(schema.books.isActive, true),
          lte(schema.books.stock, query.threshold),
        ),
      )
      .orderBy(schema.books.stock)
      .limit(query.pageSize);

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      stock: row.stock,
      coverUrl: row.coverUrl,
      category: row.categoryName ?? null,
    }));
  }

  async getRecentReviews(query: RecentReviewsQuery) {
    const rows = await this.db
      .select({
        id: schema.reviews.id,
        rating: schema.reviews.rating,
        bodySnippet: sql<string>`LEFT(${schema.reviews.body}, 200)`,
        createdAt: schema.reviews.createdAt,
        bookId: schema.books.id,
        bookTitle: schema.books.title,
        customerId: schema.reviews.userId,
        customerName: schema.users.name
      })
      .from(schema.reviews)
      .leftJoin(schema.books, eq(schema.reviews.bookId, schema.books.id))
      .leftJoin(schema.users, eq(schema.reviews.userId, schema.users.id))
      .where(
        and(
          sql`${schema.reviews.deletedAt} IS NULL`,
          sql`${schema.books.deletedAt} IS NULL`,
        ),
      )
      .orderBy(desc(schema.reviews.createdAt))
      .limit(query.pageSize);

    return rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      bodySnippet: row.bodySnippet ?? null,
      createdAt: row.createdAt,
      book: {
        id: row.bookId,
        title: row.bookTitle ?? null,
      },
      customer: {
        id: row.customerId,
        name: row.customerName ?? null,
      },
    }));
  }
}
