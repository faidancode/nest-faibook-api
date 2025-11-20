import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

describe('BooksController', () => {
  let controller: BooksController;
  let service: jest.Mocked<BooksService>;

  beforeEach(async () => {
    const serviceMock: Partial<Record<keyof BooksService, jest.Mock>> = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      getReviewsBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        {
          provide: BooksService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<BooksController>(BooksController);
    service = module.get(BooksService) as jest.Mocked<BooksService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('parses list query parameters before delegating to service', async () => {
    const payload = {
      items: [],
      meta: { page: 2, pageSize: 5, total: 0, totalPages: 0 },
    };
    service.findAll.mockResolvedValue(payload as any);

    const query = await controller.findAll({
      page: '2',
      pageSize: '5',
      sort: 'createdAt:desc',
      categoryId: '00000000-0000-0000-0000-000000000000',
      active: 'true',
    });

    expect(service.findAll).toHaveBeenCalledWith({
      page: 2,
      pageSize: 5,
      q: undefined,
      sort: 'createdAt:desc',
      categoryId: '00000000-0000-0000-0000-000000000000',
      authorId: undefined,
      active: true,
    });
    expect(query).toBe(payload);
  });

  it('returns a single book with wishlist context when user is authenticated', async () => {
    service.findOne.mockResolvedValue({ id: 'book-1' } as any);
    const req = { user: { sub: 'user-1' } };

    const book = await controller.findOne('book-1', req as any);

    expect(service.findOne).toHaveBeenCalledWith('book-1', {
      userId: 'user-1',
    });
    expect(book).toEqual({ id: 'book-1' });
  });

  it('returns a single book for anonymous user', async () => {
    service.findOne.mockResolvedValue({ id: 'book-1' } as any);

    const book = await controller.findOne('book-1', {} as any);

    expect(service.findOne).toHaveBeenCalledWith('book-1', {
      userId: undefined,
    });
    expect(book).toEqual({ id: 'book-1' });
  });

  it('parses review query parameters before delegating to service', async () => {
    const payload = {
      book: { id: 'book-1', title: 'Book A' },
      reviews: [],
      ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
    service.getReviewsBySlug.mockResolvedValue(payload as any);

    const reviews = await controller.getReviewsBySlug('book-a', {
      sort: 'highest',
      rating: '4',
    });

    expect(service.getReviewsBySlug).toHaveBeenCalledWith('book-a', {
      sort: 'highest',
      rating: 4,
    });
    expect(reviews).toBe(payload);
  });

  it('validates payload when creating book', async () => {
    service.create.mockResolvedValue({ id: 'book-1' } as any);

    const body = {
      title: 'Book Title',
      categoryId: '00000000-0000-0000-0000-000000000000',
      priceCents: 1000,
      coverUrl: 'https://example.com/a.jpg',
      description: 'desc',
    };

    const result = await controller.create(body);

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Book Title',
        priceCents: 1000,
      }),
    );
    expect(result).toEqual({ id: 'book-1' });
  });

  it('passes id and payload to update', async () => {
    service.update.mockResolvedValue({ id: 'book-1', title: 'Updated' } as any);

    const body = { title: 'Updated' };
    const result = await controller.update('book-1', body);

    expect(service.update).toHaveBeenCalledWith(
      'book-1',
      expect.objectContaining({ title: 'Updated' }),
    );
    expect(result).toEqual({ id: 'book-1', title: 'Updated' });
  });

  it('removes book and returns null payload', async () => {
    service.remove.mockResolvedValue(undefined);

    const result = await controller.remove('book-1');

    expect(service.remove).toHaveBeenCalledWith('book-1');
    expect(result).toBeNull();
  });
});
