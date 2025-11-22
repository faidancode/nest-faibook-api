import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZodError } from 'zod';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: {
    checkout: jest.Mock;
    getOrdersByUserId: jest.Mock;
    getOrderDetails: jest.Mock;
    updateCustomerStatus: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      checkout: jest.fn(),
      getOrdersByUserId: jest.fn(),
      getOrderDetails: jest.fn(),
      updateCustomerStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get(OrdersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createRequest = (userId: string, role: 'ADMIN' | 'CUSTOMER') =>
    ({
      user: {
        sub: userId,
        role,
      },
    } as any);

  const userId = '11111111-1111-4111-8111-111111111111';
  const addressId = '22222222-2222-4222-8222-222222222222';
  const adminId = '33333333-3333-4333-8333-333333333333';
  const otherUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  it('passes validated checkout payload and headers to service', async () => {
    const req = createRequest(userId, 'CUSTOMER');
    const checkoutResult = { id: 'order-1' };
    service.checkout.mockResolvedValue(checkoutResult);

    const body = {
      userId,
      addressId,
      paymentMethod: 'VA',
    };

    const result = await controller.checkout('KEY-1', body, req);

    expect(result).toBe(checkoutResult);
    expect(service.checkout).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        addressId,
        paymentMethod: 'VA',
      }),
      {
        idempotencyKey: 'KEY-1',
      },
    );
  });

  it('throws forbidden when user tries to access other account orders', async () => {
    const req = createRequest(userId, 'CUSTOMER');
    await expect(controller.getByUser(otherUserId, req)).rejects.toThrow(
      ForbiddenException,
    );
    expect(service.getOrdersByUserId).not.toHaveBeenCalled();
  });

  it('allows admin to fetch another user orders', async () => {
    const req = createRequest(adminId, 'ADMIN');
    service.getOrdersByUserId.mockResolvedValue([]);

    await controller.getByUser(otherUserId, req);

    expect(service.getOrdersByUserId).toHaveBeenCalledWith(otherUserId);
  });

  it('scopes detail retrieval for customers but not admins', async () => {
    const reqCustomer = createRequest(userId, 'CUSTOMER');
    await controller.getDetails('order-1', reqCustomer);
    expect(service.getOrderDetails).toHaveBeenCalledWith('order-1', userId);

    service.getOrderDetails.mockClear();
    const reqAdmin = createRequest(adminId, 'ADMIN');
    await controller.getDetails('order-2', reqAdmin);
    expect(service.getOrderDetails).toHaveBeenCalledWith('order-2', undefined);
  });

  it('forwards update status for customer with user id from token', async () => {
    const req = createRequest(userId, 'CUSTOMER');
    const body = { nextStatus: 'DELIVERED' };
    await controller.updateCustomerStatus('order-1', body, req);
    expect(service.updateCustomerStatus).toHaveBeenCalledWith(
      'order-1',
      userId,
      body,
    );
  });

  it('propagates service errors for checkout so filters can map them', async () => {
    const req = createRequest(userId, 'CUSTOMER');
    service.checkout.mockRejectedValue(new BadRequestException('fail'));
    await expect(
      controller.checkout('KEY-1', { userId, addressId }, req),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ZodError for invalid payloads', async () => {
    const req = createRequest(userId, 'CUSTOMER');
    await expect(
      controller.checkout('KEY-1', { addressId } as any, req),
    ).rejects.toThrow(ZodError);
  });

  it('exposes guards metadata for protected routes', () => {
    const checkoutGuards = Reflect.getMetadata(
      '__guards__',
      OrdersController.prototype.checkout,
    );
    expect(
      checkoutGuards?.some((guard: any) => guard === JwtAuthGuard),
    ).toBe(true);

    const customerStatusGuards = Reflect.getMetadata(
      '__guards__',
      OrdersController.prototype.updateCustomerStatus,
    );
    expect(
      customerStatusGuards?.some((guard: any) => guard === JwtAuthGuard),
    ).toBe(true);
  });
});
