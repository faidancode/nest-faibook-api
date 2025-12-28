import { Test, TestingModule } from '@nestjs/testing';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

describe('CustomersController', () => {
  let controller: CustomersController;
  let service: jest.Mocked<CustomersService>;

  beforeEach(async () => {
    const serviceMock: Partial<Record<keyof CustomersService, jest.Mock>> = {
      findAll: jest.fn(),
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
    service.findAll.mockResolvedValue(payload as any);

    const result = await controller.list({
      page: '2',
      pageSize: '5',
      q: 'john',
      search: undefined,
    });

    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 5,
        q: 'john',
      }),
    );
    expect(result).toBe(payload);
  });

  it('passes search query to service', async () => {
    service.findAll.mockResolvedValue({ items: [], meta: {} } as any);

    await controller.list({
      page: '1',
      pageSize: '10',
      q: undefined,
      search: 'alice',
    });

    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'alice' }),
    );
  });

  it('returns detail payload with orders', async () => {
    const payload = { customer: { id: 'cust-1' }, orders: [] };
    service.getCustomerWithOrders.mockResolvedValue(payload as any);

    const result = await controller.detail('cust-1');

    expect(service.getCustomerWithOrders).toHaveBeenCalledWith('cust-1');
    expect(result).toBe(payload);
  });
});
