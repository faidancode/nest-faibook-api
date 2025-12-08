import { Test, TestingModule } from '@nestjs/testing';
import { OrdersAdminController } from './orders.admin.controller';
import { OrdersService } from './orders.service';
import { ZodError } from 'zod';

describe('OrdersAdminController', () => {
  let controller: OrdersAdminController;
  let service: jest.Mocked<OrdersService>;

  beforeEach(async () => {
    const serviceMock: Partial<Record<keyof OrdersService, jest.Mock>> = {
      getAdminOrdersList: jest.fn(),
      getAdminOrdersStats: jest.fn(),
      getOrderDetails: jest.fn(),
      updateAdminStatus: jest.fn(),
      updatePaymentStatus: jest.fn(),
      markShippedOrderAsDelivered: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersAdminController],
      providers: [
        {
          provide: OrdersService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(OrdersAdminController);
    service = module.get(OrdersService) as jest.Mocked<OrdersService>;
  });

  it('parses list query params before calling service', async () => {
    const payload = { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
    service.getAdminOrdersList.mockResolvedValue(payload as any);

    const result = await controller.list({
      page: '2',
      limit: '5',
      status: 'PAID',
      search: 'john',
    });

    expect(service.getAdminOrdersList).toHaveBeenCalledWith({
      page: 2,
      limit: 5,
      status: 'PAID',
      search: 'john',
    });
    expect(result).toBe(payload);
  });

  it('returns stats payload from service', async () => {
    const stats = { total: 5, paid: 2, shipped: 1, delivered: 0, completed: 1, cancelled: 1, pending: 0, processing: 0 };
    service.getAdminOrdersStats.mockResolvedValue(stats as any);

    const result = await controller.stats();

    expect(service.getAdminOrdersStats).toHaveBeenCalled();
    expect(result).toBe(stats);
  });

  it('returns order details for admin by id', async () => {
    const order = { id: 'order-1' };
    service.getOrderDetails.mockResolvedValue(order as any);

    const result = await controller.getById('order-1');

    expect(service.getOrderDetails).toHaveBeenCalledWith('order-1');
    expect(result).toBe(order);
  });

  it('validates admin status payload before calling service', async () => {
    const body = { nextStatus: 'PROCESSING' };
    await controller.updateStatus('order-1', body);

    expect(service.updateAdminStatus).toHaveBeenCalledWith('order-1', body);
  });

  it('rejects invalid admin status payload', async () => {
    await expect(
      controller.updateStatus('order-1', { nextStatus: 'INVALID' } as any),
    ).rejects.toThrow(ZodError);
  });

  it('updates payment status via admin endpoint', async () => {
    const body = { paymentStatus: 'PAID' };

    await controller.updatePaymentStatus('order-1', body);

    expect(service.updatePaymentStatus).toHaveBeenCalledWith('order-1', body);
  });

  it('exposes mark delivered operation', async () => {
    await controller.markDelivered('order-123');

    expect(service.markShippedOrderAsDelivered).toHaveBeenCalledWith('order-123');
  });
});
