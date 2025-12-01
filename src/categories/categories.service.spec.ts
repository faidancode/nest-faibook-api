import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { NotFoundException } from '@nestjs/common';

describe('CategoriesService', () => {
  let service: CategoriesService;
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
      query: {
        categories: {
          findFirst: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: 'DRIZZLE',
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns paginated categories', async () => {
    const rows = [
      {
        id: '1',
        name: 'Fiksi',
        slug: 'fiksi',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    db.select
      .mockReturnValueOnce(createSelectBuilder(rows))
      .mockReturnValueOnce(createCountBuilder(rows.length));

    const result = await service.findAll({
      page: 1,
      pageSize: 5,
      q: undefined,
      search: undefined,
      sort: 'name:asc',
    });

    expect(result).toEqual({
      items: rows,
      meta: {
        page: 1,
        pageSize: 5,
        total: rows.length,
        totalPages: 1,
      },
    });
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('applies search term when listing categories', async () => {
    const rows = [];
    db.select
      .mockReturnValueOnce(createSelectBuilder(rows))
      .mockReturnValueOnce(createCountBuilder(0));

    const buildWhereSpy = jest.spyOn<any>(service as any, 'buildWhere');

    await service.findAll({
      page: 1,
      pageSize: 10,
      q: undefined,
      search: 'fik',
      sort: 'name:asc',
    });

    expect(buildWhereSpy).toHaveBeenCalledWith(undefined, 'fik');
    buildWhereSpy.mockRestore();
  });

  it('throws when category not found', async () => {
    db.select.mockReturnValueOnce(createFindOneBuilder([]));

    await expect(service.findOne('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates a category and derives slug from name when missing', async () => {
    const insertValues = jest.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValue({ values: insertValues });
    db.select.mockReturnValueOnce(createFindOneBuilder([]));
    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: 'x', name: 'Fiksi', slug: 'fiksi' } as any);

    const created = await service.create({
      name: 'Fiksi Baru',
      icon: undefined,
      description: undefined,
      slug: undefined,
      active: true,
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'fiksi-baru' }),
    );
    expect(created).toEqual({
      id: 'x',
      name: 'Fiksi',
      slug: 'fiksi',
    });

    findOneSpy.mockRestore();
  });

  it('soft deletes a category', async () => {
    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: 'cat-1' } as any);

    const whereMock = jest.fn().mockResolvedValue(undefined);
    const setMock = jest.fn().mockReturnValue({ where: whereMock });
    db.update.mockReturnValue({ set: setMock });

    await service.remove('cat-1');

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
    expect(whereMock).toHaveBeenCalled();

    findOneSpy.mockRestore();
  });
});
