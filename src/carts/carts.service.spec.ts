import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CartsService } from './carts.service';
import * as schema from '../infra/drizzle/schema';

const VALID_CART_ID = '04ece12f-7361-4d11-95ab-3c9ea83e1c17';
const VALID_BOOK_1 = 'b0f80e0c-9b8e-4a8e-a2e1-73614d1195ab';
const VALID_BOOK_2 = 'c1a80e0c-9b8e-4a8e-a2e1-73614d1195ac';
const VALID_USER_ID = 'd2b80e0c-9b8e-4a8e-a2e1-73614d1195ad';
const VALID_ITEM_1 = 'd2b80e0c-9b8e-4a8e-a2e1-73614d1195ad';

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

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
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
      .mockResolvedValue({ id: VALID_CART_ID } as any);

    const created = await service.create({
      userId: VALID_USER_ID,
      items: [
        {
          bookId: VALID_BOOK_1,
          quantity: 2,
          priceCentsAtAdd: 1500,
        },
      ],
    });

    expect(insertCartValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: VALID_USER_ID }),
    );
    expect(insertItemsValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          bookId: VALID_BOOK_1,
          quantity: 2,
          priceCentsAtAdd: 1500,
        }),
      ]),
    );
    expect(created).toEqual({ id: VALID_CART_ID });
    findOneSpy.mockRestore();
  });

  it('replaces items when cart already exists', async () => {
    const now = new Date();

    const existingCart = {
      id: VALID_CART_ID,
      userId: VALID_USER_ID,
      createdAt: now,
      updatedAt: now,
    };

    // 1️⃣ mock select existing cart
    db.select.mockReturnValueOnce(createSelectWithLimitBuilder([existingCart]));

    // 2️⃣ mock transaction internals
    const txDeleteWhere = jest.fn().mockResolvedValue(undefined);
    const txDelete = jest.fn().mockReturnValue({
      where: txDeleteWhere,
    });

    const insertValues = jest.fn().mockResolvedValue(undefined);
    const txInsert = jest.fn().mockReturnValue({
      values: insertValues,
    });

    const txUpdateWhere = jest.fn().mockResolvedValue(undefined);
    const txUpdateSet = jest.fn().mockReturnValue({
      where: txUpdateWhere,
    });
    const txUpdate = jest.fn().mockReturnValue({
      set: txUpdateSet,
    });

    const tx = {
      delete: txDelete,
      insert: txInsert,
      update: txUpdate,
    };

    db.transaction.mockImplementation(async (cb) => {
      return cb(tx as any);
    });

    // 3️⃣ spy findOne
    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: VALID_CART_ID } as any);

    // 4️⃣ call service
    await service.create({
      userId: VALID_USER_ID,
      items: [
        { bookId: VALID_BOOK_1, quantity: 3, priceCentsAtAdd: 2000 },
        { bookId: VALID_BOOK_2, quantity: 1, priceCentsAtAdd: 1200 },
      ],
    });

    // ✅ ASSERTIONS (sesuai REPLACE LOGIC)

    // a. items lama dihapus
    expect(txDelete).toHaveBeenCalledWith(schema.cartItems);
    expect(txDeleteWhere).toHaveBeenCalled();

    // b. items baru diinsert (FULL replace)
    expect(insertValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          bookId: VALID_BOOK_1,
          quantity: 3,
          priceCentsAtAdd: 2000,
        }),
        expect.objectContaining({
          bookId: VALID_BOOK_2,
          quantity: 1,
          priceCentsAtAdd: 1200,
        }),
      ]),
    );

    // c. cart timestamp diupdate
    expect(txUpdate).toHaveBeenCalledWith(schema.carts);
    expect(txUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedAt: expect.any(Date),
      }),
    );

    // d. return value via findOne
    expect(findOneSpy).toHaveBeenCalledWith(VALID_CART_ID);

    findOneSpy.mockRestore();
  });

  it('removes cart and its items', async () => {
    db.select.mockReturnValueOnce(
      createSelectWithLimitBuilder([{ id: VALID_CART_ID }]),
    );

    const findOneSpy = jest.spyOn(service, 'findOne').mockResolvedValue({
      id: VALID_CART_ID,
      userId: VALID_USER_ID,
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

    await service.remove(VALID_CART_ID);

    expect(tx.delete).toHaveBeenCalledTimes(2);
    expect(deleteCartItemsWhere).toHaveBeenCalled();
    expect(deleteCartsWhere).toHaveBeenCalled();
    findOneSpy.mockRestore();
  });

  it('updates item quantity for the current user and returns cart detail', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: VALID_CART_ID, cartUserId: VALID_USER_ID, stock: 5 },
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
      .mockResolvedValue({ id: VALID_CART_ID } as any);

    const result = await service.updateItemQuantityForUser(
      VALID_ITEM_1,
      VALID_USER_ID,
      3,
    );

    expect(selectBuilder.where).toHaveBeenCalled();
    expect(updateItemSet).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 3 }),
    );
    expect(updateCartSet).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) }),
    );
    expect(result).toEqual({ id: VALID_CART_ID });
  });

  it('rejects when updating another user cart item', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: VALID_CART_ID, cartUserId: 'other-user', stock: 5 },
    ]);
    db.select.mockReturnValueOnce(selectBuilder);

    await expect(
      service.updateItemQuantityForUser(VALID_ITEM_1, VALID_USER_ID, 2),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects when quantity exceeds stock', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: VALID_CART_ID, cartUserId: VALID_USER_ID, stock: 1 },
    ]);
    db.select.mockReturnValueOnce(selectBuilder);

    await expect(
      service.updateItemQuantityForUser(VALID_ITEM_1, VALID_USER_ID, 2),
    ).rejects.toThrow(BadRequestException);
  });

  it('removes item for current user and returns cart', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: VALID_CART_ID, cartUserId: VALID_USER_ID },
    ]);
    db.select.mockReturnValueOnce(selectBuilder);

    const deleteWhere = jest.fn().mockResolvedValue(undefined);
    db.delete.mockReturnValueOnce({ where: deleteWhere });

    const updateCartWhere = jest.fn().mockResolvedValue(undefined);
    const updateCartSet = jest.fn().mockReturnValue({ where: updateCartWhere });
    db.update.mockReturnValueOnce({ set: updateCartSet });

    jest
      .spyOn(service, 'getCartDetail')
      .mockResolvedValue({ id: VALID_CART_ID } as any);

    const result = await service.removeItemForUser(VALID_ITEM_1, VALID_USER_ID);

    expect(selectBuilder.where).toHaveBeenCalled();
    expect(deleteWhere).toHaveBeenCalled();
    expect(updateCartSet).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) }),
    );
    expect(result).toEqual({ id: VALID_CART_ID });
  });

  it('rejects removing other user cart item', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: VALID_CART_ID, cartUserId: 'other-user' },
    ]);
    db.select.mockReturnValueOnce(selectBuilder);

    await expect(
      service.removeItemForUser(VALID_ITEM_1, VALID_USER_ID),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects removing missing cart item', async () => {
    const selectBuilder = createSelectWithJoinBuilder([]);
    db.select.mockReturnValueOnce(selectBuilder);

    await expect(
      service.removeItemForUser(VALID_ITEM_1, VALID_USER_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('decrements quantity when greater than one', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: VALID_CART_ID, cartUserId: VALID_USER_ID, quantity: 3 },
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
      .mockResolvedValue({ id: VALID_CART_ID } as any);

    const result = await service.decrementItemForUser(
      VALID_ITEM_1,
      VALID_USER_ID,
    );

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 2 }),
    );
    expect(updateCartSet).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) }),
    );
    expect(result).toEqual({ id: VALID_CART_ID });
  });

  it('deletes item when quantity is one', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: VALID_CART_ID, cartUserId: VALID_USER_ID, quantity: 1 },
    ]);
    db.select.mockReturnValueOnce(selectBuilder);

    const deleteWhere = jest.fn().mockResolvedValue(undefined);
    db.delete.mockReturnValueOnce({ where: deleteWhere });

    const updateCartWhere = jest.fn().mockResolvedValue(undefined);
    const updateCartSet = jest.fn().mockReturnValue({ where: updateCartWhere });
    db.update.mockReturnValueOnce({ set: updateCartSet });

    jest
      .spyOn(service, 'getCartDetail')
      .mockResolvedValue({ id: VALID_CART_ID } as any);

    const result = await service.decrementItemForUser(
      VALID_ITEM_1,
      VALID_USER_ID,
    );

    expect(deleteWhere).toHaveBeenCalled();
    expect(updateCartSet).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) }),
    );
    expect(result).toEqual({ id: VALID_CART_ID });
  });

  it('rejects decrement on other user cart item', async () => {
    const selectBuilder = createSelectWithJoinBuilder([
      { cartId: VALID_CART_ID, cartUserId: 'other-user', quantity: 2 },
    ]);
    db.select.mockReturnValueOnce(selectBuilder);

    await expect(
      service.decrementItemForUser(VALID_ITEM_1, VALID_USER_ID),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects decrement when item missing', async () => {
    const selectBuilder = createSelectWithJoinBuilder([]);
    db.select.mockReturnValueOnce(selectBuilder);

    await expect(
      service.decrementItemForUser(VALID_ITEM_1, VALID_USER_ID),
    ).rejects.toThrow(NotFoundException);
  });
});
