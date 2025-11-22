import { Test, TestingModule } from '@nestjs/testing';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

describe('CustomersController', () => {
  let controller: CustomersController;
  let service: jest.Mocked<CustomersService>;

  beforeEach(async () => {
    const serviceMock: Partial<Record<keyof CustomersService, jest.Mock>> = {
      listCustomers: jest.fn(),
      getCustomerWithOrders: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        {
          provide: CustomersService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<CustomersController>(CustomersController);
    service = module.get(CustomersService) as jest.Mocked<CustomersService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('parses list query params before delegating to service', async () => {
    const payload = {
      items: [],
      meta: { page: 2, pageSize: 5, total: 0, totalPages: 0 },
    };
    service.listCustomers.mockResolvedValue(payload as any);

    const result = await controller.list({
      page: '2',
      pageSize: '5',
      q: 'john',
    });

    expect(service.listCustomers).toHaveBeenCalledWith({
      page: 2,
      pageSize: 5,
      q: 'john',
    });
    expect(result).toBe(payload);
  });

  it('returns detail payload with orders', async () => {
    const payload = { customer: { id: 'cust-1' }, orders: [] };
    service.getCustomerWithOrders.mockResolvedValue(payload as any);

    const result = await controller.detail('cust-1');

    expect(service.getCustomerWithOrders).toHaveBeenCalledWith('cust-1');
    expect(result).toBe(payload);
  });
});
