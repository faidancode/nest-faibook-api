import { Test, TestingModule } from '@nestjs/testing';
import { WishlistsController } from './wishlists.controller';
import { WishlistsService } from './wishlists.service';

describe('WishlistsController', () => {
  let controller: WishlistsController;
  let service: jest.Mocked<WishlistsService>;

  beforeEach(async () => {
    const serviceMock: Partial<Record<keyof WishlistsService, jest.Mock>> = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WishlistsController],
      providers: [
        {
          provide: WishlistsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<WishlistsController>(WishlistsController);
    service = module.get(WishlistsService) as jest.Mocked<WishlistsService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns all wishlists via service', async () => {
    const payload = [{ id: 'wishlist-1' }];
    service.findAll.mockResolvedValue(payload as any);

    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
    expect(result).toBe(payload);
  });

  it('returns a single wishlist', async () => {
    service.findOne.mockResolvedValue({ id: 'wishlist-1' } as any);

    const result = await controller.findOne('wishlist-1');

    expect(service.findOne).toHaveBeenCalledWith('wishlist-1');
    expect(result).toEqual({ id: 'wishlist-1' });
  });

  it('validates payload when creating wishlist', async () => {
    service.create.mockResolvedValue({ id: 'wishlist-1' } as any);

    const body = {
      userId: '00000000-0000-0000-0000-000000000000',
      items: [{ bookId: '22222222-2222-2222-8222-222222222222' }],
    };

    const result = await controller.create(body);

    expect(service.create).toHaveBeenCalledWith({
      userId: '00000000-0000-0000-0000-000000000000',
      items: [{ bookId: '22222222-2222-2222-8222-222222222222' }],
    });
    expect(result).toEqual({ id: 'wishlist-1' });
  });

  it('updates wishlist via service', async () => {
    service.update.mockResolvedValue({ id: 'wishlist-1' } as any);

    const body = {
      userId: '11111111-1111-1111-8111-111111111111',
    };

    const result = await controller.update('wishlist-1', body);

    expect(service.update).toHaveBeenCalledWith(
      'wishlist-1',
      expect.objectContaining({
        userId: '11111111-1111-1111-8111-111111111111',
      }),
    );
    expect(result).toEqual({ id: 'wishlist-1' });
  });

  it('removes wishlist and returns null', async () => {
    service.remove.mockResolvedValue(undefined);

    const result = await controller.remove('wishlist-1');

    expect(service.remove).toHaveBeenCalledWith('wishlist-1');
    expect(result).toBeNull();
  });
});
