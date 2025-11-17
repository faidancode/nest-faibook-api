import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AddressesService } from './addresses.service';

describe('AddressesService', () => {
  let service: AddressesService;
  let db: any;

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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressesService,
        {
          provide: 'DRIZZLE',
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<AddressesService>(AddressesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns paginated addresses list', async () => {
    const now = new Date();
    const rows = [
      {
        id: 'addr-1',
        userId: 'user-1',
        label: 'Rumah',
        recipientName: 'Budi',
        recipientPhone: '08123',
        street: 'Jl. Mawar',
        subdistrict: null,
        district: null,
        city: null,
        province: null,
        postalCode: null,
        isPrimary: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ];

    const listBuilder = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockResolvedValue(rows),
    };

    const countBuilder = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([{ total: rows.length }]),
    };

    db.select
      .mockReturnValueOnce(listBuilder)
      .mockReturnValueOnce(countBuilder);

    const result = await service.findAll({
      page: 1,
      pageSize: 5,
      userId: undefined,
    });

    expect(result).toEqual({
      items: [
        {
          id: 'addr-1',
          userId: 'user-1',
          label: 'Rumah',
          recipientName: 'Budi',
          recipientPhone: '08123',
          street: 'Jl. Mawar',
          subdistrict: null,
          district: null,
          city: null,
          province: null,
          postalCode: null,
          isPrimary: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      meta: { page: 1, pageSize: 5, total: 1, totalPages: 1 },
    });
  });

  it('throws when address does not exist', async () => {
    db.select.mockReturnValueOnce(createFindOneBuilder([]));

    await expect(service.findOne('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates address and unsets other primaries when requested', async () => {
    const insertValues = jest.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValue({ values: insertValues });

    const clearWhere = jest.fn().mockResolvedValue(undefined);
    const clearSet = jest.fn().mockReturnValue({ where: clearWhere });
    db.update.mockReturnValue({ set: clearSet });

    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: 'addr-1' } as any);

    const payload = {
      userId: 'user-1',
      label: 'Rumah',
      recipientName: 'Budi',
      recipientPhone: '08123',
      street: 'Jl. Mawar',
      isPrimary: true,
    };

    const created = await service.create(payload as any);

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        isPrimary: true,
      }),
    );
    expect(clearSet).toHaveBeenCalledWith(
      expect.objectContaining({
        isPrimary: false,
      }),
    );
    expect(created).toEqual({ id: 'addr-1' });
    findOneSpy.mockRestore();
  });

  it('updates address and ensures new primary overrides others', async () => {
    const existing = {
      id: 'addr-1',
      userId: 'user-1',
      label: 'Rumah',
      recipientName: 'Budi',
      recipientPhone: '08123',
      street: 'Jl. Mawar',
      subdistrict: null,
      district: null,
      city: null,
      province: null,
      postalCode: null,
      isPrimary: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedRow = { ...existing, isPrimary: true };

    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValueOnce(existing as any)
      .mockResolvedValueOnce(updatedRow as any);

    const updateWhere = jest.fn().mockResolvedValue(undefined);
    const updateSet = jest.fn().mockReturnValue({ where: updateWhere });

    const clearWhere = jest.fn().mockResolvedValue(undefined);
    const clearSet = jest.fn().mockReturnValue({ where: clearWhere });

    db.update
      .mockReturnValueOnce({ set: updateSet })
      .mockReturnValueOnce({ set: clearSet });

    const result = await service.update('addr-1', {
      userId: 'user-1',
      isPrimary: true,
    });

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        isPrimary: true,
      }),
    );
    expect(clearSet).toHaveBeenCalledWith(
      expect.objectContaining({
        isPrimary: false,
      }),
    );
    expect(result).toEqual(updatedRow);

    findOneSpy.mockRestore();
  });

  it('soft deletes address entries for owner', async () => {
    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({
        id: 'addr-1',
        userId: 'user-1',
      } as any);

    const whereMock = jest.fn().mockResolvedValue(undefined);
    const setMock = jest.fn().mockReturnValue({ where: whereMock });
    db.update.mockReturnValue({ set: setMock });

    await service.remove('addr-1', 'user-1');

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: expect.any(Date),
        isPrimary: false,
      }),
    );
    expect(whereMock).toHaveBeenCalled();

    findOneSpy.mockRestore();
  });

  it('throws when deleting address not owned by user', async () => {
    const findOneSpy = jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'addr-1',
      userId: 'different-user',
    } as any);

    await expect(service.remove('addr-1', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );

    findOneSpy.mockRestore();
  });
});
