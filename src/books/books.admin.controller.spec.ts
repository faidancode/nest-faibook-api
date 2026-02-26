import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BooksService } from './books.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { BooksAdminController } from './books.admin.controller';

const VALID_UUID = '04ece12f-7361-4d11-95ab-3c9ea83e1c17';
const CATEGORY_UUID = '00000000-0000-0000-0000-000000000000';
describe('BooksAdminController', () => {
  let controller: BooksAdminController;
  let service: jest.Mocked<BooksService>;
  let cloudinary: jest.Mocked<CloudinaryService>;

  beforeEach(async () => {
    const serviceMock: Partial<Record<keyof BooksService, jest.Mock>> = {
      findAllAdmin: jest.fn(), // Sesuai dengan controller baris 41
      findOne: jest.fn(), // Sesuai dengan controller baris 52
      getReviewsByBookId: jest.fn(), // Sesuai dengan controller baris 47
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const cloudinaryMock: Partial<Record<keyof CloudinaryService, jest.Mock>> =
      {
        uploadImage: jest.fn(),
      };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksAdminController],
      providers: [
        { provide: BooksService, useValue: serviceMock },
        { provide: CloudinaryService, useValue: cloudinaryMock },
      ],
    }).compile();

    controller = module.get<BooksAdminController>(BooksAdminController);
    service = module.get(BooksService) as jest.Mocked<BooksService>;
    cloudinary = module.get(
      CloudinaryService,
    ) as jest.Mocked<CloudinaryService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('parses list query parameters before delegating to findAllAdmin', async () => {
      const payload = { items: [], meta: { total: 0 } };
      service.findAllAdmin.mockResolvedValue(payload as any);

      const query = await controller.findAll({
        page: '2',
        pageSize: '5',
        active: 'true',
      });

      expect(service.findAllAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          pageSize: 5,
          active: true,
        }),
      );
      expect(query).toBe(payload);
    });
  });

  describe('create', () => {
    const validBody = {
      title: 'Book Title',
      categoryId: '00000000-0000-0000-0000-000000000000',
      priceCents: 1000,
      description: 'Some description',
      authorId: '00000000-0000-0000-0000-000000000000',
      stock: 10,
    };

    it('validates payload using provided coverUrl when no file is uploaded', async () => {
      service.create.mockResolvedValue({ id: 'book-1' } as any);
      const bodyWithUrl = {
        ...validBody,
        coverUrl: 'https://test.com/img.jpg',
      };

      const result = await controller.create(undefined, bodyWithUrl);

      expect(cloudinary.uploadImage).not.toHaveBeenCalled();
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          coverUrl: 'https://test.com/img.jpg',
        }),
      );
      expect(result).toEqual({ id: 'book-1' });
    });

    it('uploads file to cloudinary and uses the returned url', async () => {
      service.create.mockResolvedValue({ id: 'book-1' } as any);
      cloudinary.uploadImage.mockResolvedValue('https://cdn.test/uploaded.jpg');

      const file = {
        buffer: Buffer.from('file'),
        size: 10,
      } as Express.Multer.File;

      const result = await controller.create(file, validBody);

      // Verifikasi parameter Cloudinary sesuai controller baris 69
      expect(cloudinary.uploadImage).toHaveBeenCalledWith(
        file,
        'faibook/books',
      );
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          coverUrl: 'https://cdn.test/uploaded.jpg',
        }),
      );
      expect(result).toEqual({ id: 'book-1' });
    });

    it('throws BadRequestException when neither file nor coverUrl is provided', async () => {
      await expect(controller.create(undefined, validBody)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getReviewsByBookId', () => {
    it('delegates to service with parsed query', async () => {
      const payload = { data: [], ok: true };
      service.getReviewsByBookId.mockResolvedValue(payload as any);

      await controller.getReviewsByBookId('book-1', { rating: '5' });

      expect(service.getReviewsByBookId).toHaveBeenCalledWith(
        'book-1',
        expect.objectContaining({ rating: 5 }),
      );
    });
  });

  describe('update', () => {
    it('passes id and parsed payload to service', async () => {
      service.update.mockResolvedValue({ id: VALID_UUID } as any);

      const body = { title: 'New Title', priceCents: '2000' };
      await controller.update(VALID_UUID, undefined, body);

      expect(service.update).toHaveBeenCalledWith(
        VALID_UUID,
        expect.objectContaining({
          title: 'New Title',
          priceCents: 2000,
        }),
      );
    });
  });

  describe('remove', () => {
    it('removes book and returns standardized response', async () => {
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove(VALID_UUID);

      expect(service.remove).toHaveBeenCalledWith(VALID_UUID);
      expect(result).toEqual({
        ok: true,
        data: null,
        meta: null,
        error: null,
      });
    });
  });
});
