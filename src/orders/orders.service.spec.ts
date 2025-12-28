import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { ORDERS_PAYMENT } from './orders.payment';
import type {
  OrderOutput,
  AddressSnapshot,
  OrderItemOutput,
} from './schemas/orders.schemas';
import { MidtransService } from '../midtrans/midtrans.service';
import * as schema from '../infra/drizzle/schema';
import { randomUUID } from 'crypto';

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

const VALID_ORDER_ID = '04ece12f-7361-4d11-95ab-3c9ea83e1c17';
const VALID_ORDER_ITEM_ID = '05ece12f-7361-4d11-95ab-3c9ea83e1c17';
const VALID_BOOK_1 = 'b0f80e0c-9b8e-4a8e-a2e1-73614d1195ab';
const VALID_ADDRESS_ID = 'b0l80e0c-9b8e-4a8e-a2e1-73614d1195ab';
const VALID_USER_ID = 'P0l80e0c-9b8e-4a8e-a2e1-73614d1195ab';
const VALID_CART_ID = 'P9l80e0c-9b8e-4a8e-a2e1-73614d1195ab';
const VALID_CART_ITEM_ID = 'T9l80e0c-9b8e-4a8e-a2e1-73614d1195ab';

const baseDate = new Date();
const buildOrder = (overrides: Partial<OrderOutput> = {}): OrderOutput => {
  const defaultAddress: AddressSnapshot = {
    id: VALID_ADDRESS_ID,
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

  const defaultItems: OrderItemOutput[] = [
    {
      id: VALID_ORDER_ITEM_ID,
      orderId: overrides.id ?? VALID_ORDER_ID,
      bookId: VALID_BOOK_1,
      titleSnapshot: 'Sample Book',
      bookTitle: 'Sample Book',
      bookAuthor: 'John Doe',
      bookCoverUrl: 'https://placehold.co/400',
      bookSlug: 'sample-book',
      unitPriceCents: 1000,
      quantity: 1,
      totalCents: 1000,
      createdAt: baseDate,
      updatedAt: baseDate,
    },
  ];

  return {
    id: VALID_ORDER_ID,
    midtransOrderId: VALID_ORDER_ID,
    orderNumber: 'ORD-UNIT',
    userId: VALID_USER_ID,
    status: 'PENDING',
    paymentMethod: 'VA',
    paymentStatus: 'UNPAID',
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
    ...overrides,
    addressSnapshot: overrides.addressSnapshot ?? defaultAddress,
    items: overrides.items ?? defaultItems,
    snapToken: 'TOKEN12345',
    snapRedirectUrl: 'https://google.com',
    snapTokenExpiredAt: null,
  };
};

describe('OrdersService', () => {
  let service: OrdersService;
  let db: {
    transaction: jest.Mock;
    set: jest.Mock;
    update: jest.Mock;
    select: jest.Mock;
  };
  let paymentIntegration: { handleAfterCheckout: jest.Mock };
  let midtransService: { createTransactionToken: jest.Mock };
  let loadProfileSpy: jest.SpyInstance;

  beforeEach(async () => {
    db = {
      transaction: jest.fn(),
      update: jest.fn(),
      select: jest.fn(),
      set: jest.fn(),
    };

    paymentIntegration = {
      handleAfterCheckout: jest.fn().mockResolvedValue(undefined),
    };

    midtransService = {
      createTransactionToken: jest.fn().mockResolvedValue({
        snapToken: 'snap-token',
        redirectUrl: 'snap-url',
      }),
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

  const mockFetchCart = (
    items: Array<{
      id: string;
      bookId: string;
      quantity: number;
      priceCentsAtAdd: number;
      bookTitle: string;
      bookStock: number;
    }>,
  ) => {
    const svc: any = service;
    svc.fetchCartWithItems = jest.fn().mockResolvedValue({
      cartId: VALID_CART_ID,
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
        id: VALID_CART_ITEM_ID,
        bookId: VALID_BOOK_1,
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
        id: VALID_ADDRESS_ID,
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
          id: VALID_ORDER_ITEM_ID,
          orderId: VALID_ORDER_ID,
          bookId: VALID_BOOK_1,
          titleSnapshot: 'First Book',
          bookTitle: 'First Book',
          bookAuthor: 'Author One',
          bookCoverUrl: 'https://placehold.co/400',
          bookSlug: 'first-book',
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
      id: VALID_ADDRESS_ID,
      label: 'Rumah',
      recipientName: 'John',
      recipientPhone: '123',
      street: 'Jl. Mawar',
      subdistrict: null,
      district: null,
      city: null,
      province: null,
      postalCode: null,
      userId: VALID_USER_ID,
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
      userId: VALID_USER_ID,
      addressId: VALID_ADDRESS_ID,
      paymentMethod: 'VA',
      discountCents: 200,
      shippingCents: 500,
      note: 'Catatan',
      initialStatus: 'PENDING' as const,
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
            id: VALID_BOOK_1,
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
    expect(fetchCartSpy).toHaveBeenCalledWith(expect.anything(), VALID_USER_ID);
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
          bookId: VALID_BOOK_1,
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
    expect(orderDetailsSpy).toHaveBeenCalledWith(
      expect.any(String),
      VALID_USER_ID,
    );
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
        userId: VALID_USER_ID,
        addressId: VALID_ADDRESS_ID,
        paymentMethod: 'VA',
        shippingCents: 0,
        discountCents: 0,
        initialStatus: 'PENDING',
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
        userId: VALID_USER_ID,
        addressId: VALID_ADDRESS_ID,
        paymentMethod: 'VA',
        shippingCents: 0,
        discountCents: 0,
        initialStatus: 'PENDING',
      }),
    ).rejects.toThrow('invalid product');

    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('fails when stock is insufficient and rolls back updates', async () => {
    const svc: any = service;
    svc.fetchCartWithItems = jest.fn().mockResolvedValue({
      cartId: VALID_CART_ID,
      items: [
        {
          id: VALID_CART_ITEM_ID,
          bookId: VALID_BOOK_1,
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
          id: VALID_ADDRESS_ID,
          userId: VALID_USER_ID,
        },
      ]),
    );

    db.transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      service.checkout({
        userId: VALID_USER_ID,
        addressId: VALID_ADDRESS_ID,
        paymentMethod: 'VA',
        shippingCents: 0,
        discountCents: 0,
        initialStatus: 'PENDING',
      }),
    ).rejects.toThrow(/Insufficient stock/);

    expect(tx.update).not.toHaveBeenCalled();
    expect(paymentIntegration.handleAfterCheckout).not.toHaveBeenCalled();
  });

  it('does not clear cart when midtrans token creation fails', async () => {
    const svc: any = service;
    svc.fetchCartWithItems = jest.fn().mockResolvedValue({
      cartId: VALID_CART_ID,
      items: [
        {
          id: VALID_CART_ITEM_ID,
          bookId: VALID_BOOK_1,
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
      createSelectLimitBuilder([
        { id: VALID_ADDRESS_ID, userId: VALID_USER_ID },
      ]),
    );

    midtransService.createTransactionToken.mockRejectedValue(
      new Error('snap-failed'),
    );

    db.transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      service.checkout({
        userId: VALID_USER_ID,
        addressId: VALID_ADDRESS_ID,
        paymentMethod: 'VA',
        shippingCents: 0,
        discountCents: 0,
        initialStatus: 'PENDING',
      }),
    ).rejects.toThrow('snap-failed');

    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it('propagates errors inside transaction and avoids payment call', async () => {
    const cartItems = [
      {
        id: VALID_CART_ITEM_ID,
        bookId: VALID_BOOK_1,
        quantity: 1,
        priceCentsAtAdd: 2000,
        bookTitle: 'Book',
        bookStock: 5,
      },
    ];
    mockFetchCart(cartItems);
    const tx = createTxMock();
    tx.select.mockReturnValueOnce(
      createSelectLimitBuilder([
        { id: VALID_ADDRESS_ID, userId: VALID_USER_ID },
      ]),
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
        userId: VALID_USER_ID,
        addressId: VALID_ADDRESS_ID,
        paymentMethod: 'VA',
        shippingCents: 0,
        discountCents: 0,
        initialStatus: 'PENDING',
      }),
    ).rejects.toThrow('insert-failed');

    expect(paymentIntegration.handleAfterCheckout).not.toHaveBeenCalled();
  });

  it('handles idempotent checkout requests and skips duplicate transaction', async () => {
    const cartItems = [
      {
        id: VALID_CART_ITEM_ID,
        bookId: VALID_BOOK_1,
        quantity: 1,
        priceCentsAtAdd: 1000,
        bookTitle: 'Book',
        bookStock: 2,
      },
    ];

    const svc: any = service;
    const fetchCartSpy = jest
      .fn()
      .mockResolvedValue({ cartId: VALID_CART_ID, items: cartItems });
    svc.fetchCartWithItems = fetchCartSpy;
    svc.generateOrderNumber = jest.fn().mockReturnValue('ORD-UNIT');

    const tx = createTxMock();
    tx.select.mockReturnValue(
      createSelectLimitBuilder([
        { id: VALID_ADDRESS_ID, userId: VALID_USER_ID },
      ]),
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
      {
        userId: VALID_USER_ID,
        addressId: VALID_ADDRESS_ID,
        paymentMethod: 'VA',
        shippingCents: 0,
        discountCents: 0,
        initialStatus: 'PENDING',
      },
      { idempotencyKey: 'KEY-1' },
    );

    db.transaction.mockClear();
    fetchCartSpy.mockClear();

    const secondResult = await service.checkout(
      {
        userId: VALID_USER_ID,
        addressId: VALID_ADDRESS_ID,
        paymentMethod: 'VA',
        shippingCents: 0,
        discountCents: 0,
        initialStatus: 'PENDING',
      },
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
        id: VALID_CART_ITEM_ID,
        bookId: VALID_BOOK_1,
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
      createSelectLimitBuilder([
        { id: VALID_ADDRESS_ID, userId: VALID_USER_ID },
      ]),
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
        userId: VALID_USER_ID,
        addressId: VALID_ADDRESS_ID,
        paymentMethod: 'VA',
        shippingCents: 0,
        discountCents: 0,
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
        id: VALID_ORDER_ID,
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

    await service.updatePaymentStatus(VALID_ORDER_ID, {
      paymentStatus: 'PAID',
    });

    expect(findOrderSpy).toHaveBeenCalledWith(VALID_ORDER_ID);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus: 'PAID',
        status: 'PAID',
        paidAt: expect.any(Date),
      }),
    );
    expect(detailsSpy).toHaveBeenCalledWith(VALID_ORDER_ID);
  });

  it('rejects invalid payment status transition', async () => {
    jest.spyOn(service as any, 'findOrderRow').mockResolvedValue({
      id: VALID_ORDER_ID,
      paymentStatus: 'REFUNDED',
      status: 'CANCELLED',
    });

    await expect(
      service.updatePaymentStatus(VALID_ORDER_ID, { paymentStatus: 'PAID' }),
    ).rejects.toThrow('Cannot transition payment from REFUNDED to PAID');
    expect(db.update).not.toHaveBeenCalled();
  });

  it('marks shipped orders as delivered', async () => {
    const findOrderSpy = jest
      .spyOn(service as any, 'findOrderRow')
      .mockResolvedValue({ id: VALID_ORDER_ID, status: 'SHIPPED' });
    const updateWhere = jest.fn().mockResolvedValue(undefined);
    const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
    db.update.mockReturnValue({ set: updateSet });
    const detailsSpy = jest
      .spyOn(service, 'getOrderDetails')
      .mockResolvedValue({} as OrderOutput);

    await service.markShippedOrderAsDelivered(VALID_ORDER_ID);

    expect(findOrderSpy).toHaveBeenCalledWith(VALID_ORDER_ID);
    expect(updateSet).toHaveBeenCalledWith({
      status: 'DELIVERED',
      updatedAt: expect.any(Date),
    });
    expect(detailsSpy).toHaveBeenCalledWith(VALID_ORDER_ID);
  });

  it('rejects mark delivered call when order is not shipped', async () => {
    jest.spyOn(service as any, 'findOrderRow').mockResolvedValue({
      id: 'order-2',
      status: 'PROCESSING',
    });

    await expect(
      service.markShippedOrderAsDelivered('order-2'),
    ).rejects.toThrow('Only shipped orders can be marked as delivered');
    expect(db.update).not.toHaveBeenCalled();
  });

  it('filters orders by status for user scoped listing', async () => {
    const orderRow = buildOrder({ id: 'order-filter', status: 'PAID' });
    const offset = jest.fn().mockResolvedValue([orderRow as any]);
    const limit = jest.fn().mockReturnValue({ offset });
    const orderBy = jest.fn().mockReturnValue({ limit });
    const where = jest.fn().mockReturnValue({ orderBy });
    const from = jest.fn().mockReturnValue({ where });

    const countWhere = jest.fn().mockResolvedValue([{ total: 1 }]);
    const countFrom = jest.fn().mockReturnValue({ where: countWhere });

    db.select
      .mockReturnValueOnce({ from })
      .mockReturnValueOnce({ from: countFrom });

    const itemsMapSpy = jest
      .spyOn(service as any, 'getOrderItemsMap')
      .mockResolvedValue(new Map([[orderRow.id, []]]));

    const result = await service.getOrdersByUserId(orderRow.userId, 'PAID');

    expect(where).toHaveBeenCalledWith(expect.anything());
    expect(orderBy).toHaveBeenCalled();
    expect(limit).toHaveBeenCalledWith(10);
    expect(offset).toHaveBeenCalledWith(0);
    expect(countWhere).toHaveBeenCalledWith(expect.anything());
    expect(result).toEqual({
      items: [expect.objectContaining({ id: orderRow.id, status: 'PAID' })],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    itemsMapSpy.mockRestore();
  });

  it('returns lightweight admin list with pagination metadata', async () => {
    const rows = [
      {
        id: VALID_ORDER_ID,
        orderNumber: 'ORD-1',
        userId: VALID_USER_ID,
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
      pageSize: 20,
      status: 'PAID',
      search: 'ORD',
      sort: 'createdAt:desc',
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
        { status: 'COMPLETED', count: 1 },
        { status: 'CANCELLED', count: 1 },
        { status: 'PENDING', count: 2 },
      ]),
    });

    const stats = await service.getAdminOrdersStats();

    expect(stats).toEqual({
      total: 13,
      paid: 3,
      shipped: 2,
      delivered: 4,
      completed: 1,
      cancelled: 1,
      pending: 2,
      processing: 0,
    });
  });

  describe('cancelOrderByCustomer', () => {
    it('should throw NotFoundException if order does not exist', async () => {
      // Mock findOrderRow (method internal)
      jest.spyOn(service as any, 'findOrderRow').mockResolvedValue(null);

      await expect(
        service.cancelOrderByCustomer(VALID_ORDER_ID, VALID_USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if order paymentStatus is PAID', async () => {
      jest.spyOn(service as any, 'findOrderRow').mockResolvedValue({
        id: VALID_ORDER_ID,
        paymentStatus: 'PAID',
        status: 'PENDING',
      });

      await expect(
        service.cancelOrderByCustomer(VALID_ORDER_ID, VALID_USER_ID),
      ).rejects.toThrow(BadRequestException);
      expect(db.update).not.toHaveBeenCalled();
    });

    it('should return order details immediately if already CANCELLED (idempotent)', async () => {
      jest.spyOn(service as any, 'findOrderRow').mockResolvedValue({
        id: VALID_ORDER_ID,
        status: 'CANCELLED',
      });
      const getDetailsSpy = jest
        .spyOn(service as any, 'getOrderDetails')
        .mockResolvedValue({ id: VALID_ORDER_ID, status: 'CANCELLED' });

      const result = await service.cancelOrderByCustomer(
        VALID_ORDER_ID,
        VALID_USER_ID,
      );

      expect(result.status).toBe('CANCELLED');
      expect(db.update).not.toHaveBeenCalled(); // Tidak ada update DB jika sudah cancel
      expect(getDetailsSpy).toHaveBeenCalled();
    });

    it('should successfully update status to CANCELLED and set reason', async () => {
      const VALID_ORDER_ID = randomUUID();

      jest.spyOn(service as any, 'findOrderRow').mockResolvedValue({
        id: VALID_ORDER_ID,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
      });

      jest.spyOn(service as any, 'getOrderDetails').mockResolvedValue({
        id: VALID_ORDER_ID,
        status: 'CANCELLED',
      });

      const updateWhere = jest.fn().mockResolvedValue(undefined);
      const updateSet = jest.fn().mockReturnValue({
        where: updateWhere,
      });

      db.update.mockReturnValue({
        set: updateSet,
      });

      await service.cancelOrderByCustomer(VALID_ORDER_ID, randomUUID());

      expect(db.update).toHaveBeenCalled();

      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'CANCELLED',
          cancelReason: 'USER_CANCEL',
        }),
      );
    });
  });
});
