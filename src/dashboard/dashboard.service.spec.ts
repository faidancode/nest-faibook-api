import { DashboardService } from './dashboard.service';

// 1. Definisikan tipe Builder yang mencakup semua method Drizzle yang digunakan di service
type SelectBuilder = {
  from: jest.Mock;
  where: jest.Mock;
  leftJoin: jest.Mock;
  innerJoin: jest.Mock;
  groupBy: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock; // Menggantikan pageSize
  then: (resolver: (rows: any) => any) => Promise<any>;
};

const VALID_UUID = '04ece12f-7361-4d11-95ab-3c9ea83e1c17';

const createSelectBuilder = (rows: any[]): SelectBuilder => {
  const builder = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(), // Kembalikan 'this' agar bisa di-await atau lanjut chain
    // Agar bisa langsung di-await (thenable)
    then: (resolver: (val: any) => any) => Promise.resolve(rows).then(resolver),
  };

  // Khusus untuk method terakhir dalam chain yang tidak memanggil .then secara eksplisit
  builder.limit.mockImplementation(() => ({
    then: (resolver: (val: any) => any) => Promise.resolve(rows).then(resolver),
  }));

  return builder as unknown as SelectBuilder;
};

describe('DashboardService', () => {
  let service: DashboardService;
  let db: { select: jest.Mock };

  beforeEach(() => {
    db = { select: jest.fn() };
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
    expect(result.lowStockCount).toBe(9);
    expect(result.orders.pending).toBe(1);
  });

  it('returns top books with quantity and revenue numbers', async () => {
    db.select.mockImplementationOnce(() =>
      createSelectBuilder([
        {
          bookId: VALID_UUID,
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
      pageSize: 5,
    });

    expect(result).toEqual([
      {
        bookId: VALID_UUID,
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

    const result = await service.getRecentOrders({ pageSize: 5 });

    expect(result[0].customer).toEqual({
      name: 'John',
      email: 'john@mail.com',
      phone: '123',
    });
  });

  it('returns low stock items', async () => {
    db.select.mockImplementationOnce(() =>
      createSelectBuilder([
        {
          id: VALID_UUID,
          title: 'Book 1',
          stock: 3,
          coverUrl: 'cover',
          categoryName: 'Fiction',
        },
      ]),
    );

    const result = await service.getLowStock({ threshold: 5, pageSize: 10 });

    expect(result[0]).toEqual({
      id: VALID_UUID,
      title: 'Book 1',
      stock: 3,
      coverUrl: 'cover',
      category: 'Fiction',
    });
  });
});
