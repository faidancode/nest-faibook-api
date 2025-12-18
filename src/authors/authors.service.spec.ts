import { Test, TestingModule } from '@nestjs/testing';
import { AuthorsService } from './authors.service';
import { NotFoundException } from '@nestjs/common';

describe('AuthorsService', () => {
  let service: AuthorsService;
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
        AuthorsService,
        {
          provide: 'DRIZZLE',
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<AuthorsService>(AuthorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns paginated authors', async () => {
    const rows = [
      {
        id: '1',
        name: 'John Doe',
        slug: 'john-doe',
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

  it('applies search term when listing authors', async () => {
    const rows: any[] = [];
    db.select
      .mockReturnValueOnce(createSelectBuilder(rows))
      .mockReturnValueOnce(createCountBuilder(0));

    const buildWhereSpy = jest.spyOn(
      AuthorsService.prototype as any,
      'buildWhere',
    );

    await service.findAll({
      page: 1,
      pageSize: 10,
      q: undefined,
      search: 'john',
      sort: 'name:asc',
    });

    expect(buildWhereSpy).toHaveBeenCalledWith(undefined, 'john');
    buildWhereSpy.mockRestore();
  });

  it('throws when author not found', async () => {
    db.select.mockReturnValueOnce(createFindOneBuilder([]));

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('creates an author and derives slug from name when missing', async () => {
    const insertValues = jest.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValue({ values: insertValues });
    db.select.mockReturnValueOnce(createFindOneBuilder([]));
    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({
        id: 'a1',
        name: 'John Doe',
        slug: 'john-doe',
      } as any);

    const created = await service.create({
      name: 'John Doe',
      bio: undefined,
      slug: undefined,
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'john-doe' }),
    );
    expect(created).toEqual({
      id: 'a1',
      name: 'John Doe',
      slug: 'john-doe',
    });

    findOneSpy.mockRestore();
  });

  it('lists books by author slug', async () => {
    const author = { id: 'a1', name: 'John Doe', slug: 'john-doe' };
    const books = [{ id: 'b1', title: 'Book 1' }];

    const authorBuilder = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([author]),
    };

    const bookListBuilder = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockResolvedValue(books),
    };

    const countBuilder = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([{ total: books.length }]),
    };

    db.select
      .mockReturnValueOnce(authorBuilder)
      .mockReturnValueOnce(bookListBuilder)
      .mockReturnValueOnce(countBuilder);

    const result = await service.findBooksBySlug('john-doe', {
      page: 1,
      pageSize: 10,
      q: undefined,
      category: undefined,
      categoryId: undefined,
      authorId: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      active: undefined,
      sort: 'title:asc',
    });

    expect(result).toEqual({
      author,
      items: books,
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    expect(db.select).toHaveBeenCalledTimes(3);
  });

  it('soft deletes an author', async () => {
    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: 'a1' } as any);

    const whereMock = jest.fn().mockResolvedValue(undefined);
    const setMock = jest.fn().mockReturnValue({ where: whereMock });
    db.update.mockReturnValue({ set: setMock });

    await service.remove('a1');

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
    expect(whereMock).toHaveBeenCalled();

    findOneSpy.mockRestore();
  });
});
