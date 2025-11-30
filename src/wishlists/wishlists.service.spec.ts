import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WishlistsService } from './wishlists.service';

describe('WishlistsService', () => {
  let service: WishlistsService;
  let db: any;

  const createOrderSelectBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockResolvedValue(rows),
  });

  const createWhereSelectBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(rows),
  });

  const createFindOneBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  });

  const createJoinSelectBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  });

  const wrap = (data: any) => ({
    ok: true,
    data,
    meta: {},
    error: {},
  });

  beforeEach(async () => {
    db = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistsService,
        {
          provide: 'DRIZZLE',
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<WishlistsService>(WishlistsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns empty list when no wishlists exist', async () => {
    db.select.mockReturnValueOnce(createOrderSelectBuilder([]));

    const result = await service.findAll();

    expect(result).toEqual(wrap([]));
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('returns wishlists with aggregated items', async () => {
    const wishlist = {
      id: 'wishlist-1',
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const item = {
      id: 'item-1',
      wishlistId: 'wishlist-1',
      bookId: 'book-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      bookTitle: 'Book Title',
      bookAuthor: 'Author Name',
      bookPrice: 1000,
      bookDiscountedPrice: 900,
    };

    db.select
      .mockReturnValueOnce(createOrderSelectBuilder([wishlist]))
      .mockReturnValueOnce(createWhereSelectBuilder([item]));

    const result = await service.findAll();

    expect(result).toEqual(
      wrap([
        {
          ...wishlist,
          items: [item],
        },
      ]),
    );
  });

  it('throws when wishlist is missing', async () => {
    db.select.mockReturnValueOnce(createFindOneBuilder([]));

    await expect(service.findOne('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns wishlist with items', async () => {
    const wishlist = {
      id: 'wishlist-1',
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const item = {
      id: 'item-1',
      wishlistId: 'wishlist-1',
      bookId: 'book-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    db.select
      .mockReturnValueOnce(createFindOneBuilder([wishlist]))
      .mockReturnValueOnce(createWhereSelectBuilder([item]));

    const result = await service.findOne('wishlist-1');

    expect(result).toEqual(
      wrap({
        ...wishlist,
        items: [item],
      }),
    );
  });

  it('creates wishlist along with items', async () => {
    db.select.mockReturnValueOnce(createFindOneBuilder([]));

    const insertWishlistValues = jest.fn().mockResolvedValue(undefined);
    const insertItemsValues = jest.fn().mockResolvedValue(undefined);

    db.insert
      .mockReturnValueOnce({ values: insertWishlistValues })
      .mockReturnValueOnce({ values: insertItemsValues });

    (service as any).fetchWishlistByIdOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 'wishlist-1' });

    const result = await service.create({
      userId: 'user-1',
      items: [{ bookId: 'book-1' }],
    });

    expect(insertWishlistValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    );
    expect(insertItemsValues).toHaveBeenCalledWith([
      expect.objectContaining({ bookId: 'book-1' }),
    ]);
    expect(result).toEqual(
      wrap({
        id: 'wishlist-1',
      }),
    );
  });

  it('reuses existing wishlist when user already has one', async () => {
    const existing = {
      id: 'wishlist-1',
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const existingItem = { bookId: 'book-1' };
    db.select
      .mockReturnValueOnce(createFindOneBuilder([existing]))
      .mockReturnValueOnce(createWhereSelectBuilder([existingItem]));

    const insertItemsValues = jest.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValueOnce({ values: insertItemsValues });

    const updateWhereMock = jest.fn().mockResolvedValue(undefined);
    const setMock = jest.fn().mockReturnValue({ where: updateWhereMock });
    db.update.mockReturnValue({ set: setMock });

    const updatedResult = { ...existing, items: [] };
    (service as any).fetchWishlistByIdOrThrow = jest
      .fn()
      .mockResolvedValue(updatedResult);

    const result = await service.create({
      userId: existing.userId,
      items: [{ bookId: 'book-1' }, { bookId: 'book-2' }],
    });

    expect(insertItemsValues).toHaveBeenCalledWith([
      expect.objectContaining({ wishlistId: existing.id, bookId: 'book-2' }),
    ]);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) }),
    );
    expect(result).toEqual(wrap(updatedResult));
  });

  it('updates wishlist and replaces items', async () => {
    const existing = {
      id: 'wishlist-1',
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    };
    const updated = { ...existing, userId: 'user-2' };

    (service as any).fetchWishlistByIdOrThrow = jest
      .fn()
      .mockResolvedValue(existing);
    jest.spyOn(service, 'findOne').mockResolvedValueOnce(wrap(updated) as any);

    const whereMock = jest.fn().mockResolvedValue(undefined);
    const setMock = jest.fn().mockReturnValue({ where: whereMock });
    db.update.mockReturnValue({ set: setMock });

    const deleteWhereMock = jest.fn().mockResolvedValue(undefined);
    db.delete.mockReturnValueOnce({ where: deleteWhereMock });

    const insertItemsValues = jest.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValue({ values: insertItemsValues });

    const result = await service.update('wishlist-1', {
      userId: 'user-2',
      items: [{ bookId: 'book-2' }],
    });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-2' }),
    );
    expect(deleteWhereMock).toHaveBeenCalled();
    expect(insertItemsValues).toHaveBeenCalledWith([
      expect.objectContaining({ bookId: 'book-2' }),
    ]);
    expect(result).toEqual(wrap(updated));
  });

  it('removes wishlist and its items', async () => {
    (service as any).fetchWishlistByIdOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 'wishlist-1' });

    const deleteItemsWhere = jest.fn().mockResolvedValue(undefined);
    const deleteWishlistWhere = jest.fn().mockResolvedValue(undefined);

    db.delete
      .mockReturnValueOnce({ where: deleteItemsWhere })
      .mockReturnValueOnce({ where: deleteWishlistWhere });

    const result = await service.remove('wishlist-1');

    expect(deleteItemsWhere).toHaveBeenCalled();
    expect(deleteWishlistWhere).toHaveBeenCalled();
    expect(result).toEqual(wrap(null));
  });

  it('removes a wishlist item for the user', async () => {
    db.select.mockReturnValueOnce(
      createJoinSelectBuilder([
        { wishlistId: 'wishlist-1', wishlistUserId: 'user-1' },
      ]),
    );

    const deleteWhereMock = jest.fn().mockResolvedValue(undefined);
    db.delete.mockReturnValueOnce({ where: deleteWhereMock });

    const updateWhereMock = jest.fn().mockResolvedValue(undefined);
    const setMock = jest.fn().mockReturnValue({ where: updateWhereMock });
    db.update.mockReturnValueOnce({ set: setMock });

    jest
      .spyOn(service, 'getWishlistByUserId')
      .mockResolvedValue(wrap({ id: 'wishlist-1' }) as any);

    const result = await service.removeItemForUser('item-1', 'user-1');

    expect(deleteWhereMock).toHaveBeenCalled();
    expect(updateWhereMock).toHaveBeenCalled();
    expect(service.getWishlistByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(wrap({ id: 'wishlist-1' }));
  });

  it('creates wishlist when user has none', async () => {
    db.select.mockReturnValueOnce(createFindOneBuilder([]));
    const created = {
      id: 'wishlist-1',
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    };
    (service as any).createWishlistRecord = jest
      .fn()
      .mockResolvedValue(created);

    const result = await service.getWishlistByUserId('user-1');

    expect((service as any).createWishlistRecord).toHaveBeenCalledWith({
      userId: 'user-1',
      items: [],
    });
    expect(result).toEqual(wrap(created));
  });

  it('returns wishlist with items for user', async () => {
    const wishlist = {
      id: 'wishlist-1',
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const item = {
      id: 'item-1',
      wishlistId: 'wishlist-1',
      bookId: 'book-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    db.select
      .mockReturnValueOnce(createFindOneBuilder([wishlist]))
      .mockReturnValueOnce(createWhereSelectBuilder([item]));

    const result = await service.getWishlistByUserId('user-1');

    expect(result).toEqual(
      wrap({
        ...wishlist,
        items: [item],
      }),
    );
  });

  it('sorts wishlist items by newest by default', async () => {
    const wishlist = {
      id: 'wishlist-1',
      userId: 'user-1',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };
    const older = {
      id: 'item-older',
      wishlistId: 'wishlist-1',
      bookId: 'book-1',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };
    const newer = {
      id: 'item-newer',
      wishlistId: 'wishlist-1',
      bookId: 'book-2',
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01'),
    };

    db.select
      .mockReturnValueOnce(createFindOneBuilder([wishlist]))
      .mockReturnValueOnce(createWhereSelectBuilder([older, newer]));

    const result = await service.getWishlistByUserId('user-1');

    expect(result.data.items.map((item: any) => item.id)).toEqual([
      'item-newer',
      'item-older',
    ]);
  });

  it('sorts wishlist items by lowest price', async () => {
    const wishlist = {
      id: 'wishlist-1',
      userId: 'user-1',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };
    const expensive = {
      id: 'item-expensive',
      wishlistId: 'wishlist-1',
      bookId: 'book-1',
      bookPrice: 2000,
      bookDiscountedPrice: null,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    };
    const cheap = {
      id: 'item-cheap',
      wishlistId: 'wishlist-1',
      bookId: 'book-2',
      bookPrice: 1000,
      bookDiscountedPrice: null,
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-03'),
    };

    db.select
      .mockReturnValueOnce(createFindOneBuilder([wishlist]))
      .mockReturnValueOnce(createWhereSelectBuilder([expensive, cheap]));

    const result = await service.getWishlistByUserId('user-1', 'lowest');

    expect(result.data.items.map((item: any) => item.id)).toEqual([
      'item-cheap',
      'item-expensive',
    ]);
  });

  it('sorts wishlist items by highest price using discounted price first', async () => {
    const wishlist = {
      id: 'wishlist-1',
      userId: 'user-1',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };
    const discountedButExpensive = {
      id: 'item-discounted',
      wishlistId: 'wishlist-1',
      bookId: 'book-1',
      bookPrice: 3000,
      bookDiscountedPrice: 1500,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    };
    const expensive = {
      id: 'item-expensive',
      wishlistId: 'wishlist-1',
      bookId: 'book-2',
      bookPrice: 2000,
      bookDiscountedPrice: null,
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-03'),
    };

    db.select
      .mockReturnValueOnce(createFindOneBuilder([wishlist]))
      .mockReturnValueOnce(
        createWhereSelectBuilder([discountedButExpensive, expensive]),
      );

    const result = await service.getWishlistByUserId('user-1', 'highest');

    expect(result.data.items.map((item: any) => item.id)).toEqual([
      'item-expensive',
      'item-discounted',
    ]);
  });
});
