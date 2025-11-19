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
    where: jest.fn().mockResolvedValue(rows),
  });

  const createFindOneBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
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

    expect(result).toEqual([]);
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
    };

    db.select
      .mockReturnValueOnce(createOrderSelectBuilder([wishlist]))
      .mockReturnValueOnce(createWhereSelectBuilder([item]));

    const result = await service.findAll();

    expect(result).toEqual([
      {
        ...wishlist,
        items: [item],
      },
    ]);
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

    expect(result).toEqual({
      ...wishlist,
      items: [item],
    });
  });

  it('creates wishlist along with items', async () => {
    db.select.mockReturnValueOnce(createFindOneBuilder([]));

    const insertWishlistValues = jest.fn().mockResolvedValue(undefined);
    const insertItemsValues = jest.fn().mockResolvedValue(undefined);

    db.insert
      .mockReturnValueOnce({ values: insertWishlistValues })
      .mockReturnValueOnce({ values: insertItemsValues });

    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: 'wishlist-1' } as any);

    await service.create({
      userId: 'user-1',
      items: [{ bookId: 'book-1' }],
    });

    expect(insertWishlistValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    );
    expect(insertItemsValues).toHaveBeenCalledWith([
      expect.objectContaining({ bookId: 'book-1' }),
    ]);
    expect(findOneSpy).toHaveBeenCalledWith(expect.any(String));

    findOneSpy.mockRestore();
  });

  it('reuses existing wishlist when user already has one', async () => {
    const existing = {
      id: 'wishlist-1',
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    db.select.mockReturnValueOnce(createFindOneBuilder([existing]));

    const deleteWhereMock = jest.fn().mockResolvedValue(undefined);
    db.delete.mockReturnValueOnce({ where: deleteWhereMock });

    const insertItemsValues = jest.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValueOnce({ values: insertItemsValues });

    const updateWhereMock = jest.fn().mockResolvedValue(undefined);
    const setMock = jest.fn().mockReturnValue({ where: updateWhereMock });
    db.update.mockReturnValue({ set: setMock });

    const updatedResult = { ...existing, items: [] };
    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue(updatedResult as any);

    const result = await service.create({
      userId: existing.userId,
      items: [{ bookId: 'book-1' }],
    });

    expect(deleteWhereMock).toHaveBeenCalled();
    expect(insertItemsValues).toHaveBeenCalledWith([
      expect.objectContaining({ wishlistId: existing.id, bookId: 'book-1' }),
    ]);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) }),
    );
    expect(result).toEqual(updatedResult);

    findOneSpy.mockRestore();
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

    const findOneSpy = jest.spyOn(service, 'findOne');
    findOneSpy.mockResolvedValueOnce(existing as any);
    findOneSpy.mockResolvedValueOnce(updated as any);

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
    expect(result).toEqual(updated);

    findOneSpy.mockRestore();
  });

  it('removes wishlist and its items', async () => {
    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: 'wishlist-1' } as any);

    const deleteItemsWhere = jest.fn().mockResolvedValue(undefined);
    const deleteWishlistWhere = jest.fn().mockResolvedValue(undefined);

    db.delete
      .mockReturnValueOnce({ where: deleteItemsWhere })
      .mockReturnValueOnce({ where: deleteWishlistWhere });

    await service.remove('wishlist-1');

    expect(deleteItemsWhere).toHaveBeenCalled();
    expect(deleteWishlistWhere).toHaveBeenCalled();
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
    const createSpy = jest
      .spyOn(service, 'create')
      .mockResolvedValue(created as any);

    const result = await service.getWishlistByUserId('user-1');

    expect(createSpy).toHaveBeenCalledWith({ userId: 'user-1', items: [] });
    expect(result).toEqual(created);

    createSpy.mockRestore();
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

    expect(result).toEqual({
      ...wishlist,
      items: [item],
    });
  });
});
