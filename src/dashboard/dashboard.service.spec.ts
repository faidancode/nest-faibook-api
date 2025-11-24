import { DashboardService } from './dashboard.service';

type SelectBuilder = {
  from: jest.Mock;
  where: jest.Mock;
  leftJoin: jest.Mock;
  innerJoin: jest.Mock;
  groupBy: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
  then: (resolver: (rows: any) => any) => Promise<any>;
};

const createSelectBuilder = (rows: any[]): SelectBuilder => ({
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(rows),
  then: (resolver: (val: any) => any) => Promise.resolve(rows).then(resolver),
});

describe('DashboardService', () => {
  let service: DashboardService;
  let db: { select: jest.Mock };

  beforeEach(() => {
    db = {
      select: jest.fn(),
    };
    service = new DashboardService(db as any);
  });

  it('builds summary with revenue, order counts, unpaid, new customers, and low stock', async () => {
    db.select
      .mockImplementationOnce(() =>
        createSelectBuilder([
          {
            revenueToday: 100,
            revenueWTD: 200,
            revenueMTD: 300,
            pending: 1,
            paid: 2,
            processing: 3,
            shipped: 4,
            delivered: 5,
            cancelled: 6,
            unpaidCount: 7,
          },
        ]),
      )
      .mockImplementationOnce(() =>
        createSelectBuilder([{ newCustomersWeek: 2 }]),
      )
      .mockImplementationOnce(() =>
        createSelectBuilder([{ lowStockCount: 9 }]),
      );

    const result = await service.getSummary({ lowStockThreshold: 5 });

    expect(db.select).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      revenueToday: 100,
      revenueWTD: 200,
      revenueMTD: 300,
      orders: {
        pending: 1,
        paid: 2,
        processing: 3,
        shipped: 4,
        delivered: 5,
        cancelled: 6,
      },
      unpaidCount: 7,
      newCustomersWeek: 2,
      lowStockCount: 9,
    });
  });

  it('returns sales trend mapped to numbers', async () => {
    db.select.mockImplementationOnce(() =>
      createSelectBuilder([
        { date: '2025-01-01', revenue: '150', orders: '3' },
      ]),
    );

    const result = await service.getSalesTrend({
      from: new Date('2024-12-31'),
      to: new Date('2025-01-15'),
    });

    expect(db.select).toHaveBeenCalled();
    expect(result).toEqual([
      { date: '2025-01-01', revenue: 150, orders: 3 },
    ]);
  });

  it('returns top books with quantity and revenue numbers', async () => {
    db.select.mockImplementationOnce(() =>
      createSelectBuilder([
        {
          bookId: 'b1',
          title: 'Book 1',
          coverUrl: 'cover',
          quantity: '4',
          revenue: '800',
        },
      ]),
    );

    const result = await service.getTopBooks({
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
      limit: 5,
    });

    expect(result).toEqual([
      {
        bookId: 'b1',
        title: 'Book 1',
        coverUrl: 'cover',
        quantity: 4,
        revenue: 800,
      },
    ]);
  });

  it('returns recent orders with customer info', async () => {
    db.select.mockImplementationOnce(() =>
      createSelectBuilder([
        {
          id: 'o1',
          orderNumber: 'ORD-1',
          totalCents: 1000,
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          placedAt: new Date('2025-01-01'),
          userName: 'John',
          userEmail: 'john@mail.com',
          userPhone: '123',
        },
      ]),
    );

    const result = await service.getRecentOrders({ limit: 5 });

    expect(result).toEqual([
      {
        id: 'o1',
        orderNumber: 'ORD-1',
        totalCents: 1000,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        placedAt: new Date('2025-01-01'),
        customer: {
          name: 'John',
          email: 'john@mail.com',
          phone: '123',
        },
      },
    ]);
  });

  it('returns low stock items', async () => {
    db.select.mockImplementationOnce(() =>
      createSelectBuilder([
        {
          id: 'b1',
          title: 'Book 1',
          stock: 3,
          coverUrl: 'cover',
          category: 'Fiction',
          categoryName: 'Fiction',
        },
      ]),
    );

    const result = await service.getLowStock({ threshold: 5, limit: 10 });

    expect(result).toEqual([
      {
        id: 'b1',
        title: 'Book 1',
        stock: 3,
        coverUrl: 'cover',
        category: 'Fiction',
      },
    ]);
  });

  it('returns recent reviews mapped with snippet and book info', async () => {
    db.select.mockImplementationOnce(() =>
      createSelectBuilder([
        {
          id: 'r1',
          rating: 5,
          bodySnippet: 'Great',
          createdAt: new Date('2025-01-01'),
          bookId: 'b1',
          bookTitle: 'Book 1',
        },
      ]),
    );

    const result = await service.getRecentReviews({ limit: 5 });

    expect(result).toEqual([
      {
        id: 'r1',
        rating: 5,
        bodySnippet: 'Great',
        createdAt: new Date('2025-01-01'),
        book: {
          id: 'b1',
          title: 'Book 1',
        },
      },
    ]);
  });
});
