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
      updateItemQuantityForUser: jest.fn(),
      removeItemForUser: jest.fn(),
      decrementItemForUser: jest.fn(),
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

    const created = await controller.create(
      { user: { sub: 'user-123' } } as any,
      body,
    );

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
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

  it('updates item quantity using authenticated user', async () => {
    service.updateItemQuantityForUser.mockResolvedValue({
      id: 'cart-1',
    } as any);

    const result = await controller.updateItemQuantity(
      'item-1',
      { user: { sub: 'user-123' } } as any,
      { quantity: '3' },
    );

    expect(service.updateItemQuantityForUser).toHaveBeenCalledWith(
      'item-1',
      'user-123',
      3,
    );
    expect(result).toEqual({ id: 'cart-1' });
  });

  it('removes item using authenticated user', async () => {
    service.removeItemForUser.mockResolvedValue({ id: 'cart-1' } as any);

    const result = await controller.removeItem(
      'item-1',
      { user: { sub: 'user-123' } } as any,
    );

    expect(service.removeItemForUser).toHaveBeenCalledWith(
      'item-1',
      'user-123',
    );
    expect(result).toEqual({ id: 'cart-1' });
  });

  it('decrements item using authenticated user', async () => {
    service.decrementItemForUser.mockResolvedValue({ id: 'cart-1' } as any);

    const result = await controller.decrementItem(
      'item-1',
      { user: { sub: 'user-123' } } as any,
    );

    expect(service.decrementItemForUser).toHaveBeenCalledWith(
      'item-1',
      'user-123',
    );
    expect(result).toEqual({ id: 'cart-1' });
  });
});
