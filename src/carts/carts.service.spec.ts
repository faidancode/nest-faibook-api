import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CartsService } from './carts.service';

describe('CartsService', () => {
  let service: CartsService;
  let db: any;

  const createFindOneBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  });

  const createSelectWithLimitBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  });

  const createSelectWithWhereBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(rows),
  });

  const createSelectWithJoinBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  });

  beforeEach(async () => {
    db = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartsService,
        {
          provide: 'DRIZZLE',
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<CartsService>(CartsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws when cart is missing', async () => {
    db.select.mockReturnValueOnce(createFindOneBuilder([]));

    await expect(service.findOne('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates a cart with items', async () => {
    const insertCartValues = jest.fn().mockResolvedValue(undefined);
    const insertItemsValues = jest.fn().mockResolvedValue(undefined);
    db.select.mockReturnValueOnce(createSelectWithLimitBuilder([]));
    db.insert
      .mockReturnValueOnce({ values: insertCartValues })
      .mockReturnValueOnce({ values: insertItemsValues });

    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: 'cart-1' } as any);

    const created = await service.create({
      userId: 'user-1',
      items: [
        {
          bookId: 'product-1',
          quantity: 2,
          priceCentsAtAdd: 1500,
        },
      ],
    });

    expect(insertCartValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    );
    expect(insertItemsValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          bookId: 'product-1',
          quantity: 2,
          priceCentsAtAdd: 1500,
        }),
      ]),
    );
    expect(created).toEqual({ id: 'cart-1' });
    findOneSpy.mockRestore();
  });

  it('merges items when cart already exists', async () => {
    const now = new Date();
    const existingCart = { id: 'cart-1', userId: 'user-1', createdAt: now, updatedAt: now };
    const existingItem = {
      id: 'item-1',
      cartId: 'cart-1',
      bookId: 'product-1',
      quantity: 2,
      priceCentsAtAdd: 1500,
    };

    db.select
      .mockReturnValueOnce(createSelectWithLimitBuilder([existingCart]))
      .mockReturnValueOnce(createSelectWithWhereBuilder([existingItem]));

    const updateItemWhere = jest.fn().mockResolvedValue(undefined);
    const updateItemSet = jest.fn().mockReturnValue({ where: updateItemWhere });
    const updateCartWhere = jest.fn().mockResolvedValue(undefined);
    const updateCartSet = jest.fn().mockReturnValue({ where: updateCartWhere });
    db.update
      .mockReturnValueOnce({ set: updateItemSet })
      .mockReturnValueOnce({ set: updateCartSet });

    const insertValues = jest.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValueOnce({ values: insertValues });

    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: 'cart-1' } as any);

    await service.create({
      userId: 'user-1',
      items: [
        { bookId: 'product-1', quantity: 3, priceCentsAtAdd: 2000 },
        { bookId: 'product-2', quantity: 1, priceCentsAtAdd: 1200 },
      ],
    });

    expect(updateItemSet).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 3, priceCentsAtAdd: 2000 }),
    );
    expect(insertValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          bookId: 'product-2',
          quantity: 1,
          priceCentsAtAdd: 1200,
        }),
      ]),
    );
    expect(updateCartSet).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) }),
    );
    expect(findOneSpy).toHaveBeenCalledWith('cart-1');
    findOneSpy.mockRestore();
  });

  it('removes cart and its items', async () => {
    db.select.mockReturnValueOnce(
      createSelectWithLimitBuilder([{ id: 'cart-1' }]),
    );

    const findOneSpy = jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 'cart-1',
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    } as any);

    const deleteCartItemsWhere = jest.fn().mockResolvedValue(undefined);
    const deleteCartsWhere = jest.fn().mockResolvedValue(undefined);
    const tx = {
      delete: jest
        .fn()
        .mockReturnValueOnce({ where: deleteCartItemsWhere })
        .mockReturnValueOnce({ where: deleteCartsWhere }),
    };

    db.transaction.mockImplementation(async (cb: any) => cb(tx));

    await service.remove('cart-1');

    expect(tx.delete).toHaveBeenCalledTimes(2);
    expect(deleteCartItemsWhere).toHaveBeenCalled();
    expect(deleteCartsWhere).toHaveBeenCalled();
    findOneSpy.mockRestore();
  });

  it('updates item quantity for the current user and returns cart detail', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: 'cart-1', cartUserId: 'user-1', stock: 5 },
    ]);
    db.select.mockReturnValueOnce(selectBuilder);

    const updateItemWhere = jest.fn().mockResolvedValue(undefined);
    const updateItemSet = jest.fn().mockReturnValue({ where: updateItemWhere });
    const updateCartWhere = jest.fn().mockResolvedValue(undefined);
    const updateCartSet = jest.fn().mockReturnValue({ where: updateCartWhere });
    db.update
      .mockReturnValueOnce({ set: updateItemSet })
      .mockReturnValueOnce({ set: updateCartSet });

    jest
      .spyOn(service, 'getCartDetail')
      .mockResolvedValue({ id: 'cart-1' } as any);

    const result = await service.updateItemQuantityForUser(
      'item-1',
      'user-1',
      3,
    );

    expect(selectBuilder.where).toHaveBeenCalled();
    expect(updateItemSet).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 3 }),
    );
    expect(updateCartSet).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) }),
    );
    expect(result).toEqual({ id: 'cart-1' });
  });

  it('rejects when updating another user cart item', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: 'cart-1', cartUserId: 'other-user', stock: 5 },
    ]);
    db.select.mockReturnValueOnce(selectBuilder);

    await expect(
      service.updateItemQuantityForUser('item-1', 'user-1', 2),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects when quantity exceeds stock', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: 'cart-1', cartUserId: 'user-1', stock: 1 },
    ]);
    db.select.mockReturnValueOnce(selectBuilder);

    await expect(
      service.updateItemQuantityForUser('item-1', 'user-1', 2),
    ).rejects.toThrow(BadRequestException);
  });

  it('removes item for current user and returns cart', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: 'cart-1', cartUserId: 'user-1' },
    ]);
    db.select.mockReturnValueOnce(selectBuilder);

    const deleteWhere = jest.fn().mockResolvedValue(undefined);
    db.delete.mockReturnValueOnce({ where: deleteWhere });

    const updateCartWhere = jest.fn().mockResolvedValue(undefined);
    const updateCartSet = jest.fn().mockReturnValue({ where: updateCartWhere });
    db.update.mockReturnValueOnce({ set: updateCartSet });

    jest
      .spyOn(service, 'getCartDetail')
      .mockResolvedValue({ id: 'cart-1' } as any);

    const result = await service.removeItemForUser('item-1', 'user-1');

    expect(selectBuilder.where).toHaveBeenCalled();
    expect(deleteWhere).toHaveBeenCalled();
    expect(updateCartSet).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) }),
    );
    expect(result).toEqual({ id: 'cart-1' });
  });

  it('rejects removing other user cart item', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: 'cart-1', cartUserId: 'other-user' },
    ]);
    db.select.mockReturnValueOnce(selectBuilder);

    await expect(
      service.removeItemForUser('item-1', 'user-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects removing missing cart item', async () => {
    const selectBuilder = createSelectWithJoinBuilder([]);
    db.select.mockReturnValueOnce(selectBuilder);

    await expect(
      service.removeItemForUser('item-1', 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('decrements quantity when greater than one', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: 'cart-1', cartUserId: 'user-1', quantity: 3 },
    ]);
    db.select.mockReturnValueOnce(selectBuilder);

    const updateWhere = jest.fn().mockResolvedValue(undefined);
    const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
    const updateCartWhere = jest.fn().mockResolvedValue(undefined);
    const updateCartSet = jest.fn().mockReturnValue({ where: updateCartWhere });
    db.update
      .mockReturnValueOnce({ set: updateSet })
      .mockReturnValueOnce({ set: updateCartSet });

    jest
      .spyOn(service, 'getCartDetail')
      .mockResolvedValue({ id: 'cart-1' } as any);

    const result = await service.decrementItemForUser('item-1', 'user-1');

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 2 }),
    );
    expect(updateCartSet).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) }),
    );
    expect(result).toEqual({ id: 'cart-1' });
  });

  it('deletes item when quantity is one', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: 'cart-1', cartUserId: 'user-1', quantity: 1 },
    ]);
    db.select.mockReturnValueOnce(selectBuilder);

    const deleteWhere = jest.fn().mockResolvedValue(undefined);
    db.delete.mockReturnValueOnce({ where: deleteWhere });

    const updateCartWhere = jest.fn().mockResolvedValue(undefined);
    const updateCartSet = jest.fn().mockReturnValue({ where: updateCartWhere });
    db.update.mockReturnValueOnce({ set: updateCartSet });

    jest
      .spyOn(service, 'getCartDetail')
      .mockResolvedValue({ id: 'cart-1' } as any);

    const result = await service.decrementItemForUser('item-1', 'user-1');

    expect(deleteWhere).toHaveBeenCalled();
    expect(updateCartSet).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) }),
    );
    expect(result).toEqual({ id: 'cart-1' });
  });

  it('rejects decrement on other user cart item', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: 'cart-1', cartUserId: 'other-user', quantity: 2 },
    ]);
    db.select.mockReturnValueOnce(selectBuilder);

    await expect(
      service.decrementItemForUser('item-1', 'user-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects decrement when item missing', async () => {
    const selectBuilder = createSelectWithJoinBuilder([]);
    db.select.mockReturnValueOnce(selectBuilder);

    await expect(
      service.decrementItemForUser('item-1', 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
