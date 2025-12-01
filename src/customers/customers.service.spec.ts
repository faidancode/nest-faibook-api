import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { OrdersService } from '../orders/orders.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

import { hash } from 'bcrypt';

describe('CustomersService', () => {
  let service: CustomersService;
  let db: any;
  let ordersService: jest.Mocked<OrdersService>;
  const mockedHash = hash as unknown as jest.MockedFunction<
    (data: string, saltOrRounds: number) => Promise<string>
  >;

  const createListBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue(rows),
  });

  const createCountBuilder = (total: number) => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([{ total }]),
  });

  const createDetailBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  });

  const createUpdateBuilder = (onWhere?: jest.Mock) => {
    const where = onWhere ?? jest.fn().mockResolvedValue(undefined);
    const set = jest.fn().mockReturnValue({ where });
    return { set, where };
  };

  beforeEach(async () => {
    db = { select: jest.fn(), update: jest.fn() };
    ordersService = {
      getOrdersByUserId: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: 'DRIZZLE',
          useValue: db,
        },
        {
          provide: OrdersService,
          useValue: ordersService,
        },
      ],
    }).compile();

    service = module.get(CustomersService);
    mockedHash.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lists customers with pagination metadata', async () => {
    const rows = [
      { id: 'cust-1', name: 'Alice', email: 'a@example.com', role: 'CUSTOMER', createdAt: new Date() },
    ];

    db.select
      .mockReturnValueOnce(createListBuilder(rows))
      .mockReturnValueOnce(createCountBuilder(rows.length));

    const result = await service.listCustomers({
      page: 1,
      pageSize: 10,
      q: undefined,
    });

    expect(result).toEqual({
      items: rows,
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('throws when customer not found on detail', async () => {
    db.select.mockReturnValueOnce(createDetailBuilder([]));

    await expect(service.getCustomerWithOrders('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns customer detail with orders', async () => {
    const customer = {
      id: 'cust-1',
      name: 'Alice',
      email: 'a@example.com',
      phone: '123',
      role: 'CUSTOMER',
      createdAt: new Date(),
    };
    const orders = {
      items: [{ id: 'order-1' }],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    };

    db.select.mockReturnValueOnce(createDetailBuilder([customer]));
    ordersService.getOrdersByUserId.mockResolvedValueOnce(orders as any);

    const result = await service.getCustomerWithOrders('cust-1');

    expect(ordersService.getOrdersByUserId).toHaveBeenCalledWith('cust-1');
    expect(result).toEqual({ customer, orders });
  });

  it('throws when updating profile for missing customer', async () => {
    db.select.mockReturnValueOnce(createDetailBuilder([]));

    await expect(
      service.updateProfile('missing', { name: 'John Doe' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates only the name when provided', async () => {
    const customer = {
      id: 'cust-1',
      name: 'Alice',
      email: 'a@example.com',
      role: 'CUSTOMER',
      createdAt: new Date(),
    };
    db.select.mockReturnValueOnce(createDetailBuilder([customer]));
    const updateBuilder = createUpdateBuilder();
    db.update.mockReturnValue(updateBuilder);

    const result = await service.updateProfile('cust-1', {
      name: 'New Name',
    });

    expect(updateBuilder.set).toHaveBeenCalledWith({
      name: 'New Name',
      updatedAt: expect.any(Date),
    });
    expect(updateBuilder.where).toHaveBeenCalled();
    expect(mockedHash).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'cust-1',
      name: 'New Name',
      email: 'a@example.com',
      role: 'CUSTOMER',
    });
  });

  it('hashes password when updating it', async () => {
    const customer = {
      id: 'cust-1',
      name: 'Alice',
      email: 'a@example.com',
      role: 'CUSTOMER',
      createdAt: new Date(),
    };
    db.select.mockReturnValueOnce(createDetailBuilder([customer]));
    const updateBuilder = createUpdateBuilder();
    db.update.mockReturnValue(updateBuilder);
    mockedHash.mockResolvedValueOnce('hashed-pass');

    const result = await service.updateProfile('cust-1', {
      password: 'new-secret',
    });

    expect(mockedHash).toHaveBeenCalledWith('new-secret', 10);
    expect(updateBuilder.set).toHaveBeenCalledWith({
      passwordHash: 'hashed-pass',
      updatedAt: expect.any(Date),
    });
    expect(updateBuilder.where).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'cust-1',
      name: 'Alice',
      email: 'a@example.com',
      role: 'CUSTOMER',
    });
  });
});
