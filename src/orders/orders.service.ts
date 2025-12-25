import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { MySql2Database, MySql2Transaction } from 'drizzle-orm/mysql2';
import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as schema from '../infra/drizzle/schema';
import type {
  AdminListOrdersQuery,
  AdminUpdateStatusInput,
  AddressSnapshot,
  CheckoutOrderInput,
  CustomerUpdateStatusInput,
  ListOrdersQuery,
  OrderOutput,
  OrderStatus,
  OrderItemOutput,
  PaymentStatus,
  UpdatePaymentStatusInput,
} from './schemas/orders.schemas';
import {
  ORDERS_PAYMENT,
  type OrdersPaymentIntegration,
} from './orders.payment';
import { MidtransService } from '../midtrans/midtrans.service';
import { addHours } from 'date-fns';

type Db = MySql2Database<typeof schema>;
type Tx = MySql2Transaction<typeof schema, any>;
type DbExecutor = Db | Tx;

type OrderRow = typeof schema.orders.$inferSelect;
type OrderItemRow = typeof schema.orderItems.$inferSelect;
type OrderItemWithBook = OrderItemRow & {
  bookTitle?: string | null;
  bookAuthor?: string | null;
  bookCoverUrl?: string | null;
  bookSlug?: string | null;
};
type AddressRow = typeof schema.addresses.$inferSelect;

type AdminOrderListItem = {
  id: string;
  orderNumber: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalCents: number;
  placedAt: Date;
  paidAt: Date | null;
  receiptNo: string | null;
  itemsCount: number;
};

type CartWithItems = {
  cartId: string;
  items: Array<{
    id: string;
    bookId: string;
    quantity: number;
    priceCentsAtAdd: number;
    bookTitle: string;
    bookStock: number;
    bookAuthor?: string | null;
  }>;
};

export type CheckoutPaymentPayload = {
  snapToken: string;
  redirectUrl?: string;
};

export function isExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= Date.now();
}

type CheckoutResult = {
  order: OrderOutput;
  payment: CheckoutPaymentPayload | null;
};

type CustomerProfile = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

const paymentStatusTransitions: Record<PaymentStatus, PaymentStatus[]> = {
  UNPAID: ['PAID', 'REFUNDED'],
  PAID: ['REFUNDED'],
  REFUNDED: [],
};

type CancelReason = 'PAYMENT_EXPIRED' | 'USER_CANCEL' | 'ADMIN_CANCEL';

@Injectable()
export class OrdersService {
  private readonly idempotencyCache = new Map<string, string>();

  constructor(
    @Inject('DRIZZLE') private readonly db: Db,
    @Optional() private readonly midtransService?: MidtransService,
    @Optional()
    @Inject(ORDERS_PAYMENT)
    private readonly paymentIntegration?: OrdersPaymentIntegration,
  ) {}

  private generateOrderNumber() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    return `ORD-${yyyy}${mm}${dd}-${suffix}`;
  }

  private buildAddressSnapshot(address: AddressRow): AddressSnapshot {
    return {
      id: address.id,
      label: address.label,
      recipientName: address.recipientName,
      recipientPhone: address.recipientPhone,
      street: address.street,
      subdistrict: address.subdistrict ?? null,
      district: address.district ?? null,
      city: address.city ?? null,
      province: address.province ?? null,
      postalCode: address.postalCode ?? null,
    };
  }

  private mapOrder(
    row: OrderRow,
    items: OrderItemWithBook[],
    customer?: { email: string | null; phone: string | null },
  ): OrderOutput {
    return {
      id: row.id,
      orderNumber: row.orderNumber ?? '',
      userId: row.userId,
      status: row.status as OrderStatus,
      paymentMethod: row.paymentMethod ?? null,
      paymentStatus: row.paymentStatus as OrderOutput['paymentStatus'],
      addressSnapshot: row.addressSnapshot as AddressSnapshot,
      subtotalCents: row.subtotalCents,
      discountCents: row.discountCents,
      shippingCents: row.shippingCents,
      totalCents: row.totalCents,
      note: row.note ?? null,
      placedAt: row.placedAt,
      paidAt: row.paidAt ?? null,
      cancelledAt: row.cancelledAt ?? null,
      completedAt: row.completedAt ?? null,
      receiptNo: row.receiptNo ?? null,
      midtransOrderId: row.midtransOrderId ?? null,
      snapToken: row.snapToken ?? null,
      snapRedirectUrl: row.snapRedirectUrl ?? null,
      snapTokenExpiredAt: row.snapTokenExpiredAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? null,
      deletedAt: row.deletedAt ?? null,
      items: items.map<OrderItemOutput>((item) => ({
        id: item.id,
        orderId: item.orderId,
        bookId: item.bookId,
        titleSnapshot: item.titleSnapshot,
        bookTitle: item.bookTitle ?? item.titleSnapshot,
        bookAuthor: item.bookAuthor ?? null,
        bookCoverUrl: item.bookCoverUrl ?? null,
        bookSlug: item.bookSlug ?? null,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        totalCents: item.totalCents,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      customer,
    };
  }

  private splitFullName(name?: string | null): {
    firstName?: string;
    lastName?: string;
  } {
    if (!name) return {};
    const trimmed = name.trim();
    if (!trimmed) return {};
    const parts = trimmed.split(/\s+/);
    const firstName = parts.shift();
    const lastName = parts.length > 0 ? parts.join(' ') : undefined;
    return { firstName: firstName ?? undefined, lastName };
  }

  private async loadCustomerProfile(userId: string): Promise<CustomerProfile> {
    const [user] = await this.db
      .select({
        name: schema.users.name,
        email: schema.users.email,
        phone: schema.users.phone,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      return {};
    }

    const { firstName, lastName } = this.splitFullName(user.name);
    return {
      firstName,
      lastName,
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
    };
  }

  private async fetchCartWithItems(
    tx: Tx,
    userId: string,
  ): Promise<CartWithItems> {
    const [cart] = await tx
      .select()
      .from(schema.carts)
      .where(eq(schema.carts.userId, userId))
      .limit(1);

    if (!cart) {
      throw new BadRequestException('Cart not found for user');
    }

    const items = await tx
      .select({
        id: schema.cartItems.id,
        cartId: schema.cartItems.cartId,
        bookId: schema.cartItems.bookId,
        quantity: schema.cartItems.quantity,
        priceCentsAtAdd: schema.cartItems.priceCentsAtAdd,
        bookTitle: schema.books.title,
        bookStock: schema.books.stock,
        bookAuthor: schema.authors.name,
      })
      .from(schema.cartItems)
      .innerJoin(schema.books, eq(schema.cartItems.bookId, schema.books.id))
      .leftJoin(schema.authors, eq(schema.books.authorId, schema.authors.id))
      .where(eq(schema.cartItems.cartId, cart.id));

    if (items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    return {
      cartId: cart.id,
      items,
    };
  }

  private async getOrderItemsMap(
    executor: DbExecutor,
    orderIds: string[],
  ): Promise<Map<string, OrderItemWithBook[]>> {
    const map = new Map<string, OrderItemWithBook[]>();
    if (orderIds.length === 0) {
      return map;
    }

    const rows = await executor
      .select()
      .from(schema.orderItems)
      .where(inArray(schema.orderItems.orderId, orderIds));

    for (const row of rows) {
      const bucket = map.get(row.orderId);
      if (bucket) {
        bucket.push(row);
      } else {
        map.set(row.orderId, [row]);
      }
    }

    return map;
  }

  private buildListWhere(query: ListOrdersQuery) {
    let where: any = sql`${schema.orders.deletedAt} IS NULL`;

    if (query.status) {
      where = and(where, eq(schema.orders.status, query.status));
    }

    if (query.userId) {
      where = and(where, eq(schema.orders.userId, query.userId));
    }

    if (query.paymentStatus) {
      where = and(where, eq(schema.orders.paymentStatus, query.paymentStatus));
    }

    return where;
  }

  private buildAdminListWhere(query: AdminListOrdersQuery) {
    let where: any = sql`${schema.orders.deletedAt} IS NULL`;

    if (query.status) {
      where = and(where, eq(schema.orders.status, query.status));
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      where = and(
        where,
        or(
          like(schema.orders.orderNumber, term),
          like(schema.users.name, term),
          like(schema.users.email, term),
        ),
      );
    }

    return where;
  }

  private async findOrderRow(
    orderId: string,
    userId?: string,
  ): Promise<OrderRow> {
    const where = and(
      eq(schema.orders.id, orderId),
      sql`${schema.orders.deletedAt} IS NULL`,
      userId ? eq(schema.orders.userId, userId) : sql`1 = 1`,
    );

    const [row] = await this.db
      .select()
      .from(schema.orders)
      .where(where)
      .limit(1);

    if (!row) {
      throw new NotFoundException('Order not found');
    }

    return row;
  }

  private async findOrderRowByOrderNumber(
    orderNumber: string,
  ): Promise<OrderRow> {
    const where = and(
      eq(schema.orders.orderNumber, orderNumber),
      sql`${schema.orders.deletedAt} IS NULL`,
    );

    const [row] = await this.db
      .select()
      .from(schema.orders)
      .where(where)
      .limit(1);

    if (!row) {
      throw new NotFoundException('Order not found');
    }

    return row;
  }

  private ensureStatus(
    current: OrderStatus,
    expected: OrderStatus,
    message: string,
  ) {
    if (current !== expected) {
      throw new BadRequestException(message);
    }
  }

  async checkout(
    input: CheckoutOrderInput,
    options?: { idempotencyKey?: string },
  ): Promise<CheckoutResult> {
    const trimmedKey = options?.idempotencyKey?.trim();
    console.log(trimmedKey);
    const cacheKey =
      trimmedKey && trimmedKey.length > 0
        ? `${input.userId}:${trimmedKey}`
        : null;

    if (cacheKey) {
      const existing = this.idempotencyCache.get(cacheKey);
      if (existing) {
        return {
          order: await this.getOrderDetails(existing, input.userId),
          payment: null,
        };
      }

      // ⛔ LOCK sebelum transaction
      this.idempotencyCache.set(cacheKey, 'LOCKED');
    }

    const now = new Date();
    const orderId = randomUUID();
    const orderNumber = this.generateOrderNumber();

    const customerProfile = await this.loadCustomerProfile(input.userId);
    let paymentPayload: CheckoutPaymentPayload | null = null;

    await this.db.transaction(async (tx) => {
      const cart = await this.fetchCartWithItems(tx, input.userId);
      console.log('CART');
      console.log({ cart });
      const [address] = await tx
        .select()
        .from(schema.addresses)
        .where(
          and(
            eq(schema.addresses.id, input.addressId),
            eq(schema.addresses.userId, input.userId),
            sql`${schema.addresses.deletedAt} IS NULL`,
          ),
        )
        .limit(1);

      if (!address) {
        throw new BadRequestException('Address not found for user');
      }

      const addressSnapshot = this.buildAddressSnapshot(address);
      let subtotalCents = 0;

      const stockAdjustments: Array<{
        bookId: string;
        nextStock: number;
      }> = [];
      const orderItemsPayload: (typeof schema.orderItems.$inferInsert)[] = [];

      for (const item of cart.items) {
        if (item.bookStock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${item.bookTitle}`,
          );
        }

        const totalItemCents = item.priceCentsAtAdd * item.quantity;
        subtotalCents += totalItemCents;

        stockAdjustments.push({
          bookId: item.bookId,
          nextStock: item.bookStock - item.quantity,
        });

        orderItemsPayload.push({
          id: randomUUID(),
          orderId,
          bookId: item.bookId,
          titleSnapshot: item.bookTitle,
          unitPriceCents: item.priceCentsAtAdd,
          quantity: item.quantity,
          totalCents: totalItemCents,
        });
      }

      const discountCents = Math.max(0, input.discountCents ?? 0);
      const shippingCents = Math.max(0, input.shippingCents ?? 0);
      const totalCents = Math.max(
        0,
        subtotalCents - discountCents + shippingCents,
      );
      const midtransItems = orderItemsPayload.map((item) => ({
        id: item.bookId,
        price: item.unitPriceCents,
        quantity: item.quantity,
        name: item.titleSnapshot.slice(0, 50),
      }));
      if (shippingCents > 0) {
        midtransItems.push({
          id: 'shipping-fee',
          price: shippingCents,
          quantity: 1,
          name: 'Shipping Fee',
        });
      }
      if (discountCents > 0) {
        midtransItems.push({
          id: 'discount',
          price: -discountCents,
          quantity: 1,
          name: 'Discount',
        });
      }

      const initialStatus: OrderStatus =
        (input.initialStatus as OrderStatus) ?? 'PENDING';
      const paymentStatus =
        initialStatus === 'PAID'
          ? ('PAID' as OrderOutput['paymentStatus'])
          : ('UNPAID' as OrderOutput['paymentStatus']);

      if (this.midtransService) {
        const addressName = this.splitFullName(addressSnapshot.recipientName);
        paymentPayload = await this.midtransService.createTransactionToken({
          orderId: orderNumber,
          grossAmount: totalCents,
          customer: {
            firstName:
              customerProfile.firstName ?? addressName.firstName ?? undefined,
            lastName:
              customerProfile.lastName ?? addressName.lastName ?? undefined,
            email: customerProfile.email ?? undefined,
            phone:
              customerProfile.phone ??
              addressSnapshot.recipientPhone ??
              undefined,
          },
          items: midtransItems,
        });
      }
      console.log({ paymentPayload });

      await tx.insert(schema.orders).values({
        id: orderId,
        orderNumber,
        userId: input.userId,
        status: initialStatus,
        paymentMethod: input.paymentMethod,
        paymentStatus,
        addressSnapshot,
        subtotalCents,
        discountCents,
        shippingCents,
        totalCents,
        note: input.note ?? null,
        placedAt: now,
        paidAt: initialStatus === 'PAID' ? now : null,
        midtransOrderId: orderId,
        snapToken: paymentPayload?.snapToken ?? null,
        snapRedirectUrl: paymentPayload?.redirectUrl ?? null,
        snapTokenExpiredAt: paymentPayload ? addHours(now, 24) : null,
      });

      await tx.insert(schema.orderItems).values(orderItemsPayload);
      for (const adj of stockAdjustments) {
        await tx
          .update(schema.books)
          .set({
            stock: adj.nextStock,
            updatedAt: new Date(),
          })
          .where(eq(schema.books.id, adj.bookId));
      }

      await tx
        .delete(schema.cartItems)
        .where(eq(schema.cartItems.cartId, cart.cartId));
      await tx
        .update(schema.carts)
        .set({ updatedAt: new Date() })
        .where(eq(schema.carts.id, cart.cartId));
    });

    const order = await this.getOrderDetails(orderId, input.userId);
    if (cacheKey) {
      this.idempotencyCache.set(cacheKey, order.id);
    }

    if (this.paymentIntegration) {
      await this.paymentIntegration.handleAfterCheckout(order, {
        idempotencyKey: trimmedKey ?? undefined,
      });
    }

    return { order, payment: paymentPayload };
  }

  async getOrdersByUserId(
    userId: string,
    status?: OrderStatus,
    options?: { page?: number; pageSize?: number },
  ): Promise<{
    items: OrderOutput[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 10;
    const offset = (page - 1) * pageSize;

    let where = and(
      eq(schema.orders.userId, userId),
      sql`${schema.orders.deletedAt} IS NULL`,
    );

    if (status) {
      where = and(where, eq(schema.orders.status, status));
    }

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(schema.orders)
        .where(where)
        .orderBy(desc(schema.orders.placedAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.orders)
        .where(where),
    ]);

    const itemsByOrder = await this.getOrderItemsMap(
      this.db,
      rows.map((row) => row.id),
    );

    const items = rows.map((row) =>
      this.mapOrder(row, itemsByOrder.get(row.id) ?? []),
    );

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

  async getOrderDetails(
    orderId: string,
    userId?: string,
  ): Promise<OrderOutput> {
    const order = await this.findOrderRow(orderId, userId);
    const items = await this.db
      .select({
        id: schema.orderItems.id,
        orderId: schema.orderItems.orderId,
        bookId: schema.orderItems.bookId,
        titleSnapshot: schema.orderItems.titleSnapshot,
        unitPriceCents: schema.orderItems.unitPriceCents,
        quantity: schema.orderItems.quantity,
        totalCents: schema.orderItems.totalCents,
        createdAt: schema.orderItems.createdAt,
        updatedAt: schema.orderItems.updatedAt,
        bookTitle: schema.books.title,
        bookAuthor: schema.authors.name,
        bookCoverUrl: schema.books.coverUrl,
        bookSlug: schema.books.slug,
      })
      .from(schema.orderItems)
      .leftJoin(schema.books, eq(schema.orderItems.bookId, schema.books.id))
      .leftJoin(schema.authors, eq(schema.books.authorId, schema.authors.id))
      .where(eq(schema.orderItems.orderId, orderId));

    const [customer] = await this.db
      .select({
        email: schema.users.email,
        phone: schema.users.phone,
      })
      .from(schema.users)
      .where(eq(schema.users.id, order.userId))
      .limit(1);

    return this.mapOrder(order, items, {
      email: customer?.email ?? null,
      phone: customer?.phone ?? null,
    });
  }

  private buildMidtransItems(order: OrderOutput) {
    const items = order.items.map((item) => ({
      id: item.bookId,
      price: item.unitPriceCents,
      quantity: item.quantity,
      name: item.bookTitle.slice(0, 50),
    }));

    if (order.shippingCents > 0) {
      items.push({
        id: 'shipping-fee',
        price: order.shippingCents,
        quantity: 1,
        name: 'Shipping Fee',
      });
    }

    if (order.discountCents > 0) {
      items.push({
        id: 'discount',
        price: -order.discountCents,
        quantity: 1,
        name: 'Discount',
      });
    }

    return items;
  }

  async createMidtransTransactionToken(
    orderId: string,
    userId?: string,
  ): Promise<CheckoutPaymentPayload> {
    if (!this.midtransService) {
      throw new BadRequestException('Midtrans integration is not configured');
    }

    const order = await this.getOrderDetails(orderId, userId);
    if (order.paymentStatus !== 'UNPAID') {
      throw new BadRequestException(
        'Order payment cannot be retried unless it is still unpaid',
      );
    }

    const customerProfile = await this.loadCustomerProfile(order.userId);
    const addressName = this.splitFullName(order.addressSnapshot.recipientName);

    const customerDetails = {
      firstName:
        customerProfile.firstName ?? addressName.firstName ?? undefined,
      lastName: customerProfile.lastName ?? addressName.lastName ?? undefined,
      email: order.customer?.email ?? undefined,
      phone: order.customer?.phone ?? undefined,
    };

    const payload = {
      orderId: `${order.orderNumber}_${Date.now()}`,
      grossAmount: order.totalCents,
      customer:
        customerDetails.firstName ||
        customerDetails.lastName ||
        customerDetails.email ||
        customerDetails.phone
          ? customerDetails
          : undefined,
      items: this.buildMidtransItems(order),
    };

    if (
      order.snapToken &&
      order.snapRedirectUrl &&
      !isExpired(order.snapTokenExpiredAt)
    ) {
      return {
        snapToken: order.snapToken,
        redirectUrl: order.snapRedirectUrl,
      };
    }

    // create baru
    const tx = await this.midtransService.createTransactionToken(payload);

    // SIMPAN DI ORDER
    await this.db
      .update(schema.orders)
      .set({
        snapToken: tx.snapToken,
        snapRedirectUrl: tx.redirectUrl,
        snapTokenExpiredAt: addHours(new Date(), 24),
      })
      .where(eq(schema.orders.id, order.id));

    return tx;
  }

  async getOrderSummaryByOrderNumber(orderNumber: string): Promise<{
    orderId: string;
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    totalCents: number;
    paymentStatus: PaymentStatus;
  }> {
    const row = await this.findOrderRowByOrderNumber(orderNumber);
    return {
      orderId: row.id,
      subtotalCents: row.subtotalCents,
      discountCents: row.discountCents,
      shippingCents: row.shippingCents,
      totalCents: row.totalCents,
      paymentStatus: row.paymentStatus as PaymentStatus,
    };
  }

  async getAllOrders(query: ListOrdersQuery): Promise<{
    items: OrderOutput[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const where = this.buildListWhere(query);
    const offset = (query.page - 1) * query.pageSize;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(schema.orders)
        .where(where)
        .orderBy(desc(schema.orders.placedAt))
        .limit(query.pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.orders)
        .where(where),
    ]);

    const itemsByOrder = await this.getOrderItemsMap(
      this.db,
      rows.map((row) => row.id),
    );

    const orders = rows.map((row) =>
      this.mapOrder(row, itemsByOrder.get(row.id) ?? []),
    );

    return {
      items: orders,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getAdminOrdersList(query: AdminListOrdersQuery): Promise<{
    items: AdminOrderListItem[];
    meta: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page, pageSize, q, search, sort } = query;
    const [sortField, sortDirRaw] = sort.split(':');
    const sortDir = sortDirRaw?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    const allowedSortFields = {
      orderNumber: schema.orders.orderNumber,
      createdAt: schema.orders.createdAt,
      placedAt: schema.orders.placedAt,
      totalCents: schema.orders.totalCents,
    } as const;

    const column =
      allowedSortFields[sortField as keyof typeof allowedSortFields] ??
      schema.orders.placedAt;

    const orderBy = sortDir === 'desc' ? desc(column) : asc(column);
    const where = this.buildAdminListWhere(query);
    const offset = (page - 1) * pageSize;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: schema.orders.id,
          orderNumber: schema.orders.orderNumber,
          userId: schema.orders.userId,
          userName: schema.users.name,
          userEmail: schema.users.email,
          userPhone: schema.users.phone,
          status: schema.orders.status,
          paymentStatus: schema.orders.paymentStatus,
          paymentMethod: schema.orders.paymentMethod,
          totalCents: schema.orders.totalCents,
          placedAt: schema.orders.placedAt,
          createdAt: schema.orders.createdAt,
          paidAt: schema.orders.paidAt,
          receiptNo: schema.orders.receiptNo,
          itemsCount: sql<number>`COUNT(${schema.orderItems.id})`,
        })
        .from(schema.orders)
        .leftJoin(schema.users, eq(schema.orders.userId, schema.users.id))
        .leftJoin(
          schema.orderItems,
          eq(schema.orders.id, schema.orderItems.orderId),
        )
        .where(where)
        .groupBy(
          schema.orders.id,
          schema.orders.orderNumber,
          schema.orders.userId,
          schema.users.name,
          schema.users.email,
          schema.orders.status,
          schema.orders.paymentStatus,
          schema.orders.paymentMethod,
          schema.orders.totalCents,
          schema.orders.placedAt,
          schema.orders.paidAt,
          schema.orders.receiptNo,
        )
        .orderBy(orderBy)
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(schema.orders)
        .leftJoin(schema.users, eq(schema.orders.userId, schema.users.id))
        .where(where),
    ]);

    return {
      items: rows as AdminOrderListItem[],
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getAdminOrdersStats(): Promise<{
    total: number;
    paid: number;
    shipped: number;
    completed: number;
    delivered: number;
    cancelled: number;
    pending: number;
    processing: number;
  }> {
    const rows = await this.db
      .select({
        status: schema.orders.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.orders)
      .where(sql`${schema.orders.deletedAt} IS NULL`)
      .groupBy(schema.orders.status);

    const stats = {
      total: 0,
      paid: 0,
      shipped: 0,
      completed: 0,
      delivered: 0,
      cancelled: 0,
      pending: 0,
      processing: 0,
    };

    for (const row of rows) {
      const status = row.status as OrderStatus;
      const count = Number(row.count ?? 0);
      stats.total += count;
      if (status === 'PAID') stats.paid += count;
      if (status === 'SHIPPED') stats.shipped += count;
      if (status === 'DELIVERED') stats.delivered += count;
      if (status === 'COMPLETED') stats.completed += count;
      if (status === 'CANCELLED') stats.cancelled += count;
      if (status === 'PENDING') stats.pending += count;
      if (status === 'PROCESSING') stats.processing += count;
    }

    return stats;
  }

  async updateCustomerStatus(
    orderId: string,
    userId: string,
    input: CustomerUpdateStatusInput,
  ): Promise<OrderOutput> {
    const order = await this.findOrderRow(orderId, userId);
    this.ensureStatus(
      order.status as OrderStatus,
      'DELIVERED',
      'Only delivered orders can be marked as completed',
    );

    if (input.nextStatus !== 'COMPLETED') {
      throw new BadRequestException('Invalid target status');
    }

    await this.db
      .update(schema.orders)
      .set({
        status: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId));

    return this.getOrderDetails(orderId, userId);
  }

  async updateAdminStatus(
    orderId: string,
    input: AdminUpdateStatusInput,
  ): Promise<OrderOutput> {
    const order = await this.findOrderRow(orderId);
    const currentStatus = order.status as OrderStatus;
    console.log({ currentStatus });

    if (input.nextStatus === 'PROCESSING') {
      this.ensureStatus(
        currentStatus,
        'PAID',
        'Order must be in PAID status before processing',
      );

      await this.db
        .update(schema.orders)
        .set({
          status: 'PROCESSING',
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, orderId));
    } else if (input.nextStatus === 'SHIPPED') {
      this.ensureStatus(
        currentStatus,
        'PROCESSING',
        'Order must be PROCESSING before shipping',
      );

      await this.db
        .update(schema.orders)
        .set({
          status: 'SHIPPED',
          receiptNo: input.receiptNo ?? order.receiptNo ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, orderId));
    } else {
      throw new BadRequestException('Unsupported status transition');
    }

    return this.getOrderDetails(orderId);
  }

  async markShippedOrderAsDelivered(orderId: string): Promise<OrderOutput> {
    const order = await this.findOrderRow(orderId);
    if (order.status !== 'SHIPPED') {
      throw new BadRequestException(
        'Only shipped orders can be marked as delivered',
      );
    }

    await this.db
      .update(schema.orders)
      .set({
        status: 'DELIVERED',
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId));

    return this.getOrderDetails(orderId);
  }

  private async applyPaymentStatusTransition(
    order: OrderRow,
    input: UpdatePaymentStatusInput,
  ): Promise<OrderOutput> {
    const currentStatus = order.paymentStatus as PaymentStatus;
    const nextStatus = input.paymentStatus;

    if (currentStatus === nextStatus) {
      return this.getOrderDetails(order.id);
    }

    const allowed = paymentStatusTransitions[currentStatus] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot transition payment from ${currentStatus} to ${nextStatus}`,
      );
    }

    const now = new Date();
    const payload: Partial<typeof schema.orders.$inferInsert> = {
      paymentStatus: nextStatus,
      paymentMethod: input.paymentMethod,
      updatedAt: now,
    };

    if (nextStatus === 'PAID') {
      payload.paidAt = input.paidAt ?? order.paidAt ?? now;
      if (order.status === 'PENDING') {
        payload.status = 'PAID';
      }
    } else if (nextStatus === 'REFUNDED') {
      payload.cancelledAt = input.cancelledAt ?? order.cancelledAt ?? now;
      if (order.status === 'PENDING' || order.status === 'PAID') {
        payload.status = 'CANCELLED';
      }
    } else if (nextStatus === 'UNPAID') {
      payload.paidAt = null;
      if (order.status === 'PAID') {
        payload.status = 'PENDING';
      }
    }

    if (typeof input.note === 'string') {
      payload.note = input.note;
    }

    await this.db
      .update(schema.orders)
      .set(payload)
      .where(eq(schema.orders.id, order.id));

    return this.getOrderDetails(order.id);
  }

  async updatePaymentStatus(
    orderId: string,
    input: UpdatePaymentStatusInput,
  ): Promise<OrderOutput> {
    const order = await this.findOrderRow(orderId);
    return this.applyPaymentStatusTransition(order, input);
  }

  async updatePaymentStatusByOrderNumber(
    orderNumber: string,
    input: UpdatePaymentStatusInput,
  ): Promise<OrderOutput> {
    const order = await this.findOrderRowByOrderNumber(orderNumber);
    return this.applyPaymentStatusTransition(order, input);
  }

  async cancelOrderById(
    orderId: string,
    reason: CancelReason = 'ADMIN_CANCEL',
  ) {
    const order = await this.findOrderRow(orderId);

    return this.cancelOrderInternal(order, reason);
  }

  async cancelOrderByOrderNumber(
    orderNumber: string,
    reason: CancelReason = 'PAYMENT_EXPIRED',
  ) {
    const order = await this.findOrderRowByOrderNumber(orderNumber);

    return this.cancelOrderInternal(order, reason);
  }

  async cancelOrderByCustomer(orderId: string, userId: string) {
    const order = await this.findOrderRow(orderId, userId);

    return this.cancelOrderInternal(order, 'USER_CANCEL');
  }

  async cancelOrderByAdmin(orderId: string) {
    const order = await this.findOrderRow(orderId);

    return this.cancelOrderInternal(order, 'ADMIN_CANCEL');
  }

  async cancelOrderBySystem(orderNumber: string) {
    const order = await this.findOrderRowByOrderNumber(orderNumber);

    return this.cancelOrderInternal(order, 'PAYMENT_EXPIRED');
  }

  private async cancelOrderInternal(
    order: OrderRow | null,
    reason: CancelReason,
  ): Promise<OrderOutput> {
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // idempotent
    if (order.status === 'CANCELLED') {
      return this.getOrderDetails(order.id, undefined);
    }

    // prevent cancelling paid order
    if (order.paymentStatus === 'PAID') {
      throw new BadRequestException('Paid order cannot be cancelled');
    }

    await this.db
      .update(schema.orders)
      .set({
        status: 'CANCELLED',
        paymentStatus:
          reason === 'PAYMENT_EXPIRED' ? 'EXPIRED' : order.paymentStatus,
        cancelledAt: new Date(),
        cancelReason: reason,
      })
      .where(eq(schema.orders.id, order.id));

    return this.getOrderDetails(order.id, undefined);
  }
}
