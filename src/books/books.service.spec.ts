import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BooksService } from './books.service';

describe('BooksService', () => {
  let service: BooksService;
  let db: any;

  const createSelectBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
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
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  });

  const createWishlistCheckBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  });

  const createReviewsSelectBuilder = (rows: any[]) => ({
    from: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockResolvedValue(rows),
  });

  beforeEach(async () => {
    db = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        {
          provide: 'DRIZZLE',
          useValue: db,
        },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns books with pagination metadata', async () => {
    const rows = [
      {
        id: 'book-1',
        title: 'Book A',
        authorName: 'John Writer',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    db.select
      .mockReturnValueOnce(createSelectBuilder(rows))
      .mockReturnValueOnce(createCountBuilder(rows.length));

    const result = await service.findAll({
      page: 1,
      pageSize: 10,
      q: undefined,
      sort: 'title:asc',
      categoryId: undefined,
      authorId: undefined,
      active: undefined,
    });

    expect(result).toEqual({
      items: rows,
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('throws when book is missing', async () => {
    db.select.mockReturnValueOnce(createFindOneBuilder([]));

    await expect(service.findOne('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('marks the book as wishlisted when user already saved it', async () => {
    const row = { id: 'book-1', authorName: null };
    db.select
      .mockReturnValueOnce(createFindOneBuilder([row]))
      .mockReturnValueOnce(createWishlistCheckBuilder([{ id: 'wishlist-item' }]))
      .mockReturnValueOnce(createReviewsSelectBuilder([]));

    const result = await service.findOne('book-1', { userId: 'user-1' });

    expect(result.isWishlisted).toBe(true);
  });

  it('returns not wishlisted when user has no record', async () => {
    const row = { id: 'book-1', authorName: null };
    db.select
      .mockReturnValueOnce(createFindOneBuilder([row]))
      .mockReturnValueOnce(createWishlistCheckBuilder([]))
      .mockReturnValueOnce(createReviewsSelectBuilder([]));

    const result = await service.findOne('book-1', { userId: 'user-1' });

    expect(result.isWishlisted).toBe(false);
  });

  it('creates a book and generates slug from title', async () => {
    const insertValues = jest.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValue({ values: insertValues });
    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: 'book-1', slug: 'book-a', authorName: null } as any);

    const created = await service.create({
      title: 'Book A',
      categoryId: 'cat-1',
      authorId: undefined,
      isbn: undefined,
      priceCents: 1000,
      coverUrl: 'https://example.com/cover.jpg',
      description: 'Desc',
      stock: 2,
      discountPriceCents: undefined,
      pages: undefined,
      language: undefined,
      publisher: undefined,
      publishedAt: undefined,
      slug: undefined,
      active: true,
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'book-a', title: 'Book A' }),
    );
    expect(created).toEqual({ id: 'book-1', slug: 'book-a', authorName: null });
    findOneSpy.mockRestore();
  });

  it('updates a book using provided fields', async () => {
    const existing = {
      id: 'book-1',
      title: 'Old Title',
      slug: 'old-title',
      categoryId: 'cat-1',
      authorId: null,
      isbn: null,
      priceCents: 1000,
      discountPriceCents: null,
      stock: 5,
      coverUrl: 'https://example.com/a.jpg',
      description: 'desc',
      pages: null,
      language: null,
      publisher: null,
      publishedAt: null,
      isActive: true,
      authorName: null,
    };
    const updatedRow = { ...existing, title: 'New Title' };

    const findOneSpy = jest.spyOn(service, 'findOne');
    findOneSpy.mockResolvedValueOnce(existing as any);
    findOneSpy.mockResolvedValueOnce(updatedRow as any);

    const whereMock = jest.fn().mockResolvedValue(undefined);
    const setMock = jest.fn().mockReturnValue({ where: whereMock });
    db.update.mockReturnValue({ set: setMock });

    const result = await service.update('book-1', {
      title: 'New Title',
      priceCents: 1500,
    });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Title',
        priceCents: 1500,
      }),
    );
    expect(whereMock).toHaveBeenCalled();
    expect(result).toEqual(updatedRow);
    findOneSpy.mockRestore();
  });

  it('soft deletes a book', async () => {
    const findOneSpy = jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: 'book-1', authorName: null } as any);

    const whereMock = jest.fn().mockResolvedValue(undefined);
    const setMock = jest.fn().mockReturnValue({ where: whereMock });
    db.update.mockReturnValue({ set: setMock });

    await service.remove('book-1');

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
    expect(whereMock).toHaveBeenCalled();
    findOneSpy.mockRestore();
  });
});
