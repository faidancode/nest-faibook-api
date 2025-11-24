import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: jest.Mocked<DashboardService>;

  beforeEach(async () => {
    const serviceMock: Partial<Record<keyof DashboardService, jest.Mock>> = {
      getSummary: jest.fn(),
      getSalesTrend: jest.fn(),
      getTopBooks: jest.fn(),
      getRecentOrders: jest.fn(),
      getLowStock: jest.fn(),
      getRecentReviews: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(DashboardController);
    service = module.get(DashboardService) as jest.Mocked<DashboardService>;
  });

  it('parses summary query and forwards to service', async () => {
    service.getSummary.mockResolvedValue({ ok: true } as any);

    await controller.summary({ lowStockThreshold: '7' });

    expect(service.getSummary).toHaveBeenCalledWith({ lowStockThreshold: 7 });
  });

  it('parses sales trend range dates', async () => {
    const from = new Date('2025-01-01');
    const to = new Date('2025-01-31');
    service.getSalesTrend.mockResolvedValue([] as any);

    await controller.salesTrend({
      from: from.toISOString(),
      to: to.toISOString(),
    });

    expect(service.getSalesTrend).toHaveBeenCalledWith({
      from,
      to,
    });
  });

  it('parses top books query with limit', async () => {
    service.getTopBooks.mockResolvedValue([] as any);

    await controller.topBooks({ limit: '3' });

    expect(service.getTopBooks).toHaveBeenCalledWith({
      from: undefined,
      to: undefined,
      limit: 3,
    });
  });

  it('parses recent orders limit', async () => {
    service.getRecentOrders.mockResolvedValue([] as any);

    await controller.recentOrders({ limit: '8' });

    expect(service.getRecentOrders).toHaveBeenCalledWith({ limit: 8 });
  });

  it('parses low stock query with defaults', async () => {
    service.getLowStock.mockResolvedValue([] as any);

    await controller.lowStock({});

    expect(service.getLowStock).toHaveBeenCalledWith({
      threshold: 5,
      limit: 10,
    });
  });

  it('parses recent reviews limit', async () => {
    service.getRecentReviews.mockResolvedValue([] as any);

    await controller.recentReviews({ limit: '4' });

    expect(service.getRecentReviews).toHaveBeenCalledWith({ limit: 4 });
  });
});
