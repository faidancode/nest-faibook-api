import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { ORDERS_PAYMENT } from './orders.payment';
import type { OrderOutput } from './schemas/orders.schemas';
import { MidtransService } from '../midtrans/midtrans.service';

type TxMock = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

const createTxMock = (): TxMock => ({
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const createSelectLimitBuilder = (rows: any[]) => ({
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(rows),
});

const createAdminListBuilder = (rows: any[]) => ({
  from: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockResolvedValue(rows),
});

const createAdminCountBuilder = (total: number) => ({
  from: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([{ total }]),
});

const baseDate = new Date();
const buildOrder = (overrides: Partial<OrderOutput> = {}): OrderOutput => {
  const defaultAddress = {
    id: 'addr-1',
    label: 'Home',
    recipientName: 'John Doe',
    recipientPhone: '123',
    street: 'Jl. Mawar',
    subdistrict: null,
    district: null,
    city: null,
    province: null,
    postalCode: null,
  };

  const defaultItems = [
    {
      id: 'oi-1',
      orderId: overrides.id ?? 'order-1',
      bookId: 'book-1',
      titleSnapshot: 'Sample Book',
      unitPriceCents: 1000,
      quantity: 1,
      totalCents: 1000,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
  ];

  return {
    id: 'order-1',
    orderNumber: 'ORD-UNIT',
    userId: 'user-1',
    status: 'PENDING',
    paymentMethod: 'VA',
    paymentStatus: 'UNPAID',
    addressSnapshot: defaultAddress,
    subtotalCents: 1000,
    discountCents: 0,
    shippingCents: 0,
    totalCents: 1000,
    note: null,
    placedAt: baseDate,
    paidAt: null,
    cancelledAt: null,
    completedAt: null,
    receiptNo: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    deletedAt: null,
    items: defaultItems,
    ...overrides,
    addressSnapshot: overrides.addressSnapshot ?? defaultAddress,
    items: overrides.items ?? defaultItems,
  };
};

describe('OrdersService', () => {
  let service: OrdersService;
  let db: { transaction: jest.Mock; update: jest.Mock; select: jest.Mock };
  let paymentIntegration: { handleAfterCheckout: jest.Mock };
  let midtransService: { createTransactionToken: jest.Mock };
  let loadProfileSpy: jest.SpyInstance;

  beforeEach(async () => {
    db = {
      transaction: jest.fn(),
      update: jest.fn(),
      select: jest.fn(),
    };

    paymentIntegration = {
      handleAfterCheckout: jest.fn().mockResolvedValue(undefined),
    };

    midtransService = {
      createTransactionToken: jest
        .fn()
        .mockResolvedValue({ snapToken: 'snap-token', redirectUrl: 'snap-url' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: 'DRIZZLE',
          useValue: db,
        },
        {
          provide: ORDERS_PAYMENT,
          useValue: paymentIntegration,
        },
        {
          provide: MidtransService,
          useValue: midtransService,
        },
      ],
    }).compile();

    service = module.get(OrdersService);
    loadProfileSpy = jest
      .spyOn(service as any, 'loadCustomerProfile')
      .mockResolvedValue({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '0812',
      });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockFetchCart = (items: Array<{
    id: string;
    bookId: string;
    quantity: number;
    priceCentsAtAdd: number;
    bookTitle: string;
    bookStock: number;
  }>) => {
    const svc: any = service;
    svc.fetchCartWithItems = jest.fn().mockResolvedValue({
      cartId: 'cart-1',
      items,
    });
    svc.generateOrderNumber = jest.fn().mockReturnValue('ORD-UNIT');
    return svc.fetchCartWithItems as jest.Mock;
  };

  const mockGetOrderDetails = (order: OrderOutput) =>
    jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order);

  it('checks out successfully and triggers payment integration', async () => {
    const cartItems = [
      {
        id: 'ci-1',
        bookId: 'book-1',
        quantity: 2,
        priceCentsAtAdd: 1000,
        bookTitle: 'First Book',
        bookStock: 5,
      },
      {
        id: 'ci-2',
        bookId: 'book-2',
        quantity: 1,
        priceCentsAtAdd: 2000,
        bookTitle: 'Second Book',
        bookStock: 3,
      },
    ];

    const fetchCartSpy = mockFetchCart(cartItems);
    const now = new Date();
    const finalOrder = buildOrder({
      orderNumber: 'ORD-UNIT',
      totalCents: 4300,
      addressSnapshot: {
        id: 'addr-1',
        label: 'Home',
        recipientName: 'John Doe',
        recipientPhone: '123',
        street: 'Jl. Mawar',
        subdistrict: null,
        district: null,
        city: null,
        province: null,
        postalCode: null,
      },
      items: [
        {
          id: 'oi-1',
          orderId: 'order-1',
          bookId: 'book-1',
          titleSnapshot: 'First Book',
          unitPriceCents: 2000,
          quantity: 2,
          totalCents: 4000,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    const orderDetailsSpy = mockGetOrderDetails(finalOrder);

    const tx = createTxMock();
    const addressRow = {
      id: 'addr-1',
      label: 'Rumah',
      recipientName: 'John',
      recipientPhone: '123',
      street: 'Jl. Mawar',
      subdistrict: null,
      district: null,
      city: null,
      province: null,
      postalCode: null,
      userId: 'user-1',
    };
    tx.select.mockReturnValueOnce(createSelectLimitBuilder([addressRow]));

    const insertOrderValues = jest.fn().mockResolvedValue(undefined);
    const insertItemsValues = jest.fn().mockResolvedValue(undefined);
    tx.insert
      .mockReturnValueOnce({ values: insertOrderValues })
      .mockReturnValueOnce({ values: insertItemsValues });

    const deleteCartItemsWhere = jest.fn().mockResolvedValue(undefined);
    tx.delete.mockReturnValueOnce({ where: deleteCartItemsWhere });

    const bookUpdateWhere1 = jest.fn().mockResolvedValue(undefined);
    const bookUpdateSet1 = jest.fn().mockReturnValue({
      where: bookUpdateWhere1,
    });
    const bookUpdateWhere2 = jest.fn().mockResolvedValue(undefined);
    const bookUpdateSet2 = jest.fn().mockReturnValue({
      where: bookUpdateWhere2,
    });
    const cartUpdateWhere = jest.fn().mockResolvedValue(undefined);
    const cartUpdateSet = jest.fn().mockReturnValue({
      where: cartUpdateWhere,
    });
    tx.update
      .mockReturnValueOnce({ set: bookUpdateSet1 })
      .mockReturnValueOnce({ set: bookUpdateSet2 })
      .mockReturnValueOnce({ set: cartUpdateSet });

    db.transaction.mockImplementation(async (callback) => {
      return callback(tx);
    });

    const input = {
      userId: 'user-1',
      addressId: 'addr-1',
      paymentMethod: 'VA',
      discountCents: 200,
      shippingCents: 500,
      note: 'Catatan',
    };

    const result = await service.checkout(input, {
      idempotencyKey: 'idem-123',
    });

    expect(result.order).toBe(finalOrder);
    expect(result.payment).toEqual({
      snapToken: 'snap-token',
      redirectUrl: 'snap-url',
    });
    expect(midtransService.createTransactionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: finalOrder.orderNumber ?? finalOrder.id,
        grossAmount: finalOrder.totalCents,
        customer: {
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          phone: '0812',
        },
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'book-1',
            price: 1000,
            quantity: 2,
            name: 'First Book',
          }),
          expect.objectContaining({
            id: 'book-2',
            price: 2000,
            quantity: 1,
            name: 'Second Book',
          }),
          expect.objectContaining({
            id: 'shipping-fee',
            price: 500,
            quantity: 1,
            name: 'Shipping Fee',
          }),
          expect.objectContaining({
            id: 'discount',
            price: -200,
            quantity: 1,
            name: 'Discount',
          }),
        ]),
      }),
    );
    expect(fetchCartSpy).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(insertOrderValues).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotalCents: 4000,
        discountCents: 200,
        shippingCents: 500,
        totalCents: 4300,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        orderNumber: 'ORD-UNIT',
      }),
    );
    expect(insertItemsValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          bookId: 'book-1',
          totalCents: 2000,
        }),
        expect.objectContaining({
          bookId: 'book-2',
          totalCents: 2000,
        }),
      ]),
    );
    expect(bookUpdateSet1).toHaveBeenCalledWith(
      expect.objectContaining({ stock: 3 }),
    );
    expect(bookUpdateSet2).toHaveBeenCalledWith(
      expect.objectContaining({ stock: 2 }),
    );
    expect(deleteCartItemsWhere).toHaveBeenCalledWith(expect.anything());
    expect(cartUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) }),
    );
    expect(paymentIntegration.handleAfterCheckout).toHaveBeenCalledWith(
      finalOrder,
      { idempotencyKey: 'idem-123' },
    );
    expect(orderDetailsSpy).toHaveBeenCalledWith(expect.any(String), 'user-1');
  });

  it('throws when cart is empty without performing inserts', async () => {
    const svc: any = service;
    svc.fetchCartWithItems = jest
      .fn()
      .mockRejectedValue(new BadRequestException('Cart is empty'));
    svc.generateOrderNumber = jest.fn().mockReturnValue('ORD-UNIT');

    const tx = createTxMock();
    db.transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      service.checkout({
        userId: 'user-1',
        addressId: 'addr-1',
        paymentMethod: 'VA',
      }),
    ).rejects.toThrow('Cart is empty');

    expect(tx.insert).not.toHaveBeenCalled();
    expect(paymentIntegration.handleAfterCheckout).not.toHaveBeenCalled();
  });

  it('throws when cart contains invalid product reference', async () => {
    const svc: any = service;
    svc.fetchCartWithItems = jest
      .fn()
      .mockRejectedValue(
        new BadRequestException('Cart contains invalid product'),
      );
    svc.generateOrderNumber = jest.fn().mockReturnValue('ORD-UNIT');

    const tx = createTxMock();
    db.transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      service.checkout({
        userId: 'user-1',
        addressId: 'addr-1',
        paymentMethod: 'VA',
      }),
    ).rejects.toThrow('invalid product');

    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('fails when stock is insufficient and rolls back updates', async () => {
    const svc: any = service;
    svc.fetchCartWithItems = jest.fn().mockResolvedValue({
      cartId: 'cart-1',
      items: [
        {
          id: 'ci-1',
          bookId: 'book-1',
          quantity: 5,
          priceCentsAtAdd: 1000,
          bookTitle: 'Only Book',
          bookStock: 2,
        },
      ],
    });
    svc.generateOrderNumber = jest.fn().mockReturnValue('ORD-UNIT');

    const tx = createTxMock();
    tx.select.mockReturnValueOnce(
      createSelectLimitBuilder([
        {
          id: 'addr-1',
          userId: 'user-1',
        },
      ]),
    );

    db.transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      service.checkout({
        userId: 'user-1',
        addressId: 'addr-1',
        paymentMethod: 'VA',
      }),
    ).rejects.toThrow(/Insufficient stock/);

    expect(tx.update).not.toHaveBeenCalled();
    expect(paymentIntegration.handleAfterCheckout).not.toHaveBeenCalled();
  });

  it('does not clear cart when midtrans token creation fails', async () => {
    const svc: any = service;
    svc.fetchCartWithItems = jest.fn().mockResolvedValue({
      cartId: 'cart-1',
      items: [
        {
          id: 'ci-1',
          bookId: 'book-1',
          quantity: 1,
          priceCentsAtAdd: 1000,
          bookTitle: 'Only Book',
          bookStock: 5,
        },
      ],
    });
    svc.generateOrderNumber = jest.fn().mockReturnValue('ORD-UNIT');

    const tx = createTxMock();
    tx.select.mockReturnValueOnce(
      createSelectLimitBuilder([{ id: 'addr-1', userId: 'user-1' }]),
    );

    midtransService.createTransactionToken.mockRejectedValue(
      new Error('snap-failed'),
    );

    db.transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      service.checkout({
        userId: 'user-1',
        addressId: 'addr-1',
        paymentMethod: 'VA',
      }),
    ).rejects.toThrow('snap-failed');

    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it('propagates errors inside transaction and avoids payment call', async () => {
    const cartItems = [
      {
        id: 'ci-1',
        bookId: 'book-1',
        quantity: 1,
        priceCentsAtAdd: 2000,
        bookTitle: 'Book',
        bookStock: 5,
      },
    ];
    mockFetchCart(cartItems);
    const tx = createTxMock();
    tx.select.mockReturnValueOnce(
      createSelectLimitBuilder([{ id: 'addr-1', userId: 'user-1' }]),
    );
    const insertOrderValues = jest.fn().mockResolvedValue(undefined);
    const insertItemsValues = jest
      .fn()
      .mockRejectedValue(new Error('insert-failed'));
    tx.insert
      .mockReturnValueOnce({ values: insertOrderValues })
      .mockReturnValueOnce({ values: insertItemsValues });

    const bookUpdateWhere = jest.fn().mockResolvedValue(undefined);
    const bookUpdateSet = jest.fn().mockReturnValue({
      where: bookUpdateWhere,
    });
    const cartUpdateSet = jest.fn();
    tx.update
      .mockReturnValueOnce({ set: bookUpdateSet })
      .mockReturnValueOnce({ set: cartUpdateSet });
    tx.delete.mockReturnValueOnce({ where: jest.fn() });

    db.transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      service.checkout({
        userId: 'user-1',
        addressId: 'addr-1',
        paymentMethod: 'VA',
      }),
    ).rejects.toThrow('insert-failed');

    expect(paymentIntegration.handleAfterCheckout).not.toHaveBeenCalled();
  });

  it('handles idempotent checkout requests and skips duplicate transaction', async () => {
    const cartItems = [
      {
        id: 'ci-1',
        bookId: 'book-1',
        quantity: 1,
        priceCentsAtAdd: 1000,
        bookTitle: 'Book',
        bookStock: 2,
      },
    ];

    const svc: any = service;
    const fetchCartSpy = jest
      .fn()
      .mockResolvedValue({ cartId: 'cart-1', items: cartItems });
    svc.fetchCartWithItems = fetchCartSpy;
    svc.generateOrderNumber = jest.fn().mockReturnValue('ORD-UNIT');

    const tx = createTxMock();
    tx.select.mockReturnValue(
      createSelectLimitBuilder([{ id: 'addr-1', userId: 'user-1' }]),
    );

    const insertOrderValues = jest.fn().mockResolvedValue(undefined);
    const insertItemsValues = jest.fn().mockResolvedValue(undefined);
    tx.insert
      .mockReturnValueOnce({ values: insertOrderValues })
      .mockReturnValueOnce({ values: insertItemsValues });
    tx.update
      .mockReturnValueOnce({
        set: jest.fn().mockReturnValue({ where: jest.fn() }),
      })
      .mockReturnValueOnce({
        set: jest.fn().mockReturnValue({ where: jest.fn() }),
      });
    tx.delete.mockReturnValueOnce({ where: jest.fn() });

    db.transaction.mockImplementation(async (callback) => callback(tx));

    const finalOrder = buildOrder();
    const orderDetailsSpy = jest
      .spyOn(service, 'getOrderDetails')
      .mockResolvedValue(finalOrder);

    await service.checkout(
      { userId: 'user-1', addressId: 'addr-1', paymentMethod: 'VA' },
      { idempotencyKey: 'KEY-1' },
    );

    db.transaction.mockClear();
    fetchCartSpy.mockClear();

    const secondResult = await service.checkout(
      { userId: 'user-1', addressId: 'addr-1', paymentMethod: 'VA' },
      { idempotencyKey: 'KEY-1' },
    );

    expect(secondResult.order).toBe(finalOrder);
    expect(secondResult.payment).toBeNull();
    expect(db.transaction).not.toHaveBeenCalled();
    expect(fetchCartSpy).not.toHaveBeenCalled();
    expect(orderDetailsSpy).toHaveBeenCalledTimes(2);
    expect(midtransService.createTransactionToken).toHaveBeenCalledTimes(1);
  });

  it('persists initial status overrides (PAID)', async () => {
    const cartItems = [
      {
        id: 'ci-1',
        bookId: 'book-1',
        quantity: 1,
        priceCentsAtAdd: 1000,
        bookTitle: 'Book',
        bookStock: 2,
      },
    ];
    mockFetchCart(cartItems);
    const finalOrder = buildOrder();
    const orderDetailsSpy = mockGetOrderDetails(finalOrder);

    const tx = createTxMock();
    tx.select.mockReturnValueOnce(
      createSelectLimitBuilder([{ id: 'addr-1', userId: 'user-1' }]),
    );

    const insertOrderValues = jest.fn().mockResolvedValue(undefined);
    const insertItemsValues = jest.fn().mockResolvedValue(undefined);
    tx.insert
      .mockReturnValueOnce({ values: insertOrderValues })
      .mockReturnValueOnce({ values: insertItemsValues });
    tx.update
      .mockReturnValueOnce({
        set: jest.fn().mockReturnValue({ where: jest.fn() }),
      })
      .mockReturnValueOnce({
        set: jest.fn().mockReturnValue({ where: jest.fn() }),
      });
    tx.delete.mockReturnValueOnce({ where: jest.fn() });

    db.transaction.mockImplementation(async (callback) => callback(tx));

    await service.checkout(
      {
        userId: 'user-1',
        addressId: 'addr-1',
        paymentMethod: 'VA',
        initialStatus: 'PAID',
      },
      {},
    );

    expect(insertOrderValues).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PAID',
        paymentStatus: 'PAID',
        paidAt: expect.any(Date),
      }),
    );
    expect(orderDetailsSpy).toHaveBeenCalled();
  });

  it('updates payment status from UNPAID to PAID', async () => {
    const findOrderSpy = jest
      .spyOn(service as any, 'findOrderRow')
      .mockResolvedValue({
        id: 'order-1',
        paymentStatus: 'UNPAID',
        status: 'PENDING',
        paidAt: null,
      });
    const updateWhere = jest.fn().mockResolvedValue(undefined);
    const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
    db.update.mockReturnValue({ set: updateSet });
    const detailsSpy = jest
      .spyOn(service, 'getOrderDetails')
      .mockResolvedValue({} as OrderOutput);

    await service.updatePaymentStatus('order-1', { paymentStatus: 'PAID' });

    expect(findOrderSpy).toHaveBeenCalledWith('order-1');
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus: 'PAID',
        status: 'PAID',
        paidAt: expect.any(Date),
      }),
    );
    expect(detailsSpy).toHaveBeenCalledWith('order-1');
  });

  it('rejects invalid payment status transition', async () => {
    jest.spyOn(service as any, 'findOrderRow').mockResolvedValue({
      id: 'order-1',
      paymentStatus: 'REFUNDED',
      status: 'CANCELLED',
    });

    await expect(
      service.updatePaymentStatus('order-1', { paymentStatus: 'PAID' }),
    ).rejects.toThrow('Cannot transition payment from REFUNDED to PAID');
    expect(db.update).not.toHaveBeenCalled();
  });

  it('returns lightweight admin list with pagination metadata', async () => {
    const rows = [
      {
        id: 'order-1',
        orderNumber: 'ORD-1',
        userId: 'user-1',
        userName: 'Alice',
        userEmail: 'a@example.com',
        status: 'PAID',
        paymentStatus: 'PAID',
        paymentMethod: 'VA',
        totalCents: 1000,
        placedAt: baseDate,
        paidAt: baseDate,
        receiptNo: 'R-1',
        itemsCount: 2,
      },
    ];

    db.select
      .mockReturnValueOnce(createAdminListBuilder(rows))
      .mockReturnValueOnce(createAdminCountBuilder(rows.length));

    const result = await service.getAdminOrdersList({
      page: 1,
      limit: 20,
      status: 'PAID',
      search: 'ORD',
    });

    expect(result).toEqual({
      items: rows,
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('aggregates admin order stats by status', async () => {
    db.select.mockReturnValueOnce({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockResolvedValue([
        { status: 'PAID', count: 3 },
        { status: 'SHIPPED', count: 2 },
        { status: 'DELIVERED', count: 4 },
        { status: 'CANCELLED', count: 1 },
        { status: 'PENDING', count: 2 },
      ]),
    });

    const stats = await service.getAdminOrdersStats();

    expect(stats).toEqual({
      total: 12,
      paid: 3,
      shipped: 2,
      completed: 4,
      cancelled: 1,
      pending: 2,
      processing: 0,
    });
  });
});
