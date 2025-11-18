import { Test, TestingModule } from '@nestjs/testing';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';

describe('CartsController', () => {
  let controller: CartsController;
  let service: jest.Mocked<CartsService>;

  beforeEach(async () => {
    const serviceMock: Partial<Record<keyof CartsService, jest.Mock>> = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartsController],
      providers: [
        {
          provide: CartsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<CartsController>(CartsController);
    service = module.get(CartsService) as jest.Mocked<CartsService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('validates payload when creating cart', async () => {
    service.create.mockResolvedValue({ id: 'cart-1' } as any);

    const body = {
      userId: '00000000-0000-0000-0000-000000000000',
      items: [
        {
          bookId: '11111111-1111-1111-8111-111111111111',
          quantity: '2',
          priceCentsAtAdd: '1200',
        },
      ],
    };

    const created = await controller.create(body);

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '00000000-0000-0000-0000-000000000000',
        items: [
          expect.objectContaining({
            bookId: '11111111-1111-1111-8111-111111111111',
            quantity: 2,
            priceCentsAtAdd: 1200,
          }),
        ],
      }),
    );
    expect(created).toEqual({ id: 'cart-1' });
  });

  it('removes cart and returns null payload', async () => {
    service.remove.mockResolvedValue(undefined);

    const result = await controller.remove('cart-1');

    expect(service.remove).toHaveBeenCalledWith('cart-1');
    expect(result).toBeNull();
  });
});
