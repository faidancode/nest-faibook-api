import { Test, TestingModule } from '@nestjs/testing';
import { AdminsService } from './admins.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('AdminsService', () => {
  let service: AdminsService;
  let db: any;

  const createSelectBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue(rows),
  });

  const createCountBuilder = (total: number) => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([{ total }]),
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminsService,
        {
          provide: 'DRIZZLE',
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<AdminsService>(AdminsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns paginated admins', async () => {
    const rows = [
      {
        id: '1',
        name: 'Admin',
        email: 'admin@mail.com',
        role: 'ADMIN',
      },
    ];

    db.select
      .mockReturnValueOnce(createSelectBuilder(rows))
      .mockReturnValueOnce(createCountBuilder(rows.length));

    const result = await service.findAll({
      page: 1,
      pageSize: 10,
      q: undefined,
      search: undefined,
      sort: 'name:asc',
    });

    expect(result).toEqual({
      items: rows,
      meta: {
        page: 1,
        pageSize: 10,
        total: rows.length,
        totalPages: 1,
      },
    });
  });

  it('throws when admin not found', async () => {
    db.select.mockReturnValueOnce(createFindOneBuilder([]));

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('throws conflict when email already exists', async () => {
    db.select.mockReturnValueOnce(
      createFindOneBuilder([{ id: '1', deletedAt: null }]),
    );

    await expect(
      service.create({
        name: 'Admin',
        email: 'admin@mail.com',
        password: 'secret',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('creates admin when email does not exist', async () => {
    const insertValues = jest.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValue({ values: insertValues });
    db.select.mockReturnValueOnce(createFindOneBuilder([]));

    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: 'admin-1' } as any);

    const result = await service.create({
      name: 'Admin',
      email: 'admin@mail.com',
      password: 'secret',
    });

    expect(insertValues).toHaveBeenCalled();
    expect(result).toEqual({ id: 'admin-1' });

    findOneSpy.mockRestore();
  });

  it('soft deletes admin', async () => {
    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: 'admin-1' } as any);

    const whereMock = jest.fn().mockResolvedValue(undefined);
    const setMock = jest.fn().mockReturnValue({ where: whereMock });
    db.update.mockReturnValue({ set: setMock });

    await service.remove('admin-1');

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
    expect(whereMock).toHaveBeenCalled();

    findOneSpy.mockRestore();
  });
});
