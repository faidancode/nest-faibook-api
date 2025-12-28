import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

describe('BooksController', () => {
  let controller: BooksController;
  let service: jest.Mocked<BooksService>;

  beforeEach(async () => {
    // Definisi mock yang sesuai dengan method di BooksService
    const serviceMock: Partial<Record<keyof BooksService, jest.Mock>> = {
      findAll: jest.fn(),
      findBySlug: jest.fn(), // Gunakan findBySlug sesuai controller
      getReviewsBySlug: jest.fn(),
      getReviewsByUserId: jest.fn(),
      checkReviewEligibility: jest.fn(),
      createReview: jest.fn(),
    };

    const cloudinaryMock = {
      uploadImage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        { provide: BooksService, useValue: serviceMock },
        { provide: CloudinaryService, useValue: cloudinaryMock },
      ],
    }).compile();

    controller = module.get<BooksController>(BooksController);
    service = module.get(BooksService) as jest.Mocked<BooksService>;
  });

  describe('findAll', () => {
    it('parses list query parameters before delegating to service', async () => {
      const payload = { items: [], meta: { page: 1, pageSize: 10 } };
      service.findAll.mockResolvedValue(payload as any);

      const result = await controller.findAll({
        page: '2',
        pageSize: '5',
        active: 'true',
      });

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          pageSize: 5,
          active: true,
        }),
      );
      expect(result).toBe(payload);
    });
  });

  describe('findBySlug', () => {
    it('returns a single book by slug', async () => {
      const payload = { id: 'book-1', title: 'Test Book' };
      service.findBySlug.mockResolvedValue(payload as any);

      const result = await controller.findBySlug('book-1');

      // Sesuai kode controller Anda: return this.booksService.findBySlug(slug)
      // Tidak ada parameter userId di implementasi controller Anda saat ini
      expect(service.findBySlug).toHaveBeenCalledWith('book-1');
      expect(result).toEqual(payload);
    });
  });

  describe('getReviewsByUserId', () => {
    it('enforces identity and allows owner to access reviews', async () => {
      const payload = { data: [], ok: true };
      service.getReviewsByUserId.mockResolvedValue(payload as any);

      const mockReq = {
        user: { sub: 'user-1', role: 'CUSTOMER' },
      } as any;

      const result = await controller.getReviewsByUserId(
        'user-1',
        { page: '1', limit: '5' },
        mockReq,
      );

      expect(service.getReviewsByUserId).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ page: 1, pageSize: 5 }),
      );
      expect(result).toBe(payload);
    });

    it('throws ForbiddenException if user tries to access others reviews', async () => {
      const mockReq = {
        user: { sub: 'user-hacker', role: 'CUSTOMER' },
      } as any;

      await expect(
        controller.getReviewsByUserId('user-victim', {}, mockReq),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getReviewEligibility', () => {
    it('returns eligibility for authenticated user', async () => {
      const payload = { eligible: true };
      service.checkReviewEligibility.mockResolvedValue(payload as any);

      const mockReq = { user: { sub: 'user-1' } } as any;
      const result = await controller.getReviewEligibility('book-a', mockReq);

      expect(service.checkReviewEligibility).toHaveBeenCalledWith(
        'book-a',
        'user-1',
      );
      expect(result.data).toEqual(payload);
    });

    it('returns eligibility for anonymous user as null', async () => {
      service.checkReviewEligibility.mockResolvedValue({
        eligible: false,
      } as any);

      const mockReq = { user: undefined } as any;
      await controller.getReviewEligibility('book-a', mockReq);

      expect(service.checkReviewEligibility).toHaveBeenCalledWith(
        'book-a',
        null,
      );
    });
  });

  describe('createReview', () => {
    it('creates a review with parsed rating and user sub', async () => {
      const payload = { ok: true };
      service.createReview.mockResolvedValue(payload as any);

      const mockReq = { user: { sub: 'user-1' } } as any;
      const result = await controller.createReview(
        'book-a',
        { rating: '5', body: 'Great!' },
        mockReq,
      );

      expect(service.createReview).toHaveBeenCalledWith(
        'book-a',
        { rating: 5, body: 'Great!' },
        'user-1',
      );
      expect(result).toBe(payload);
    });
  });
});
