import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

const VALID_UUID = '04ece12f-7361-4d11-95ab-3c9ea83e1c17';
describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: jest.Mocked<CategoriesService>;

  beforeEach(async () => {
    const serviceMock: Partial<Record<keyof CategoriesService, any>> = {
      findAll: jest.fn(),
      findBooksBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = module.get(CategoriesService) as jest.Mocked<CategoriesService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('parses list query params before delegating to service', async () => {
    const payload = {
      items: [],
      meta: { page: 2, pageSize: 5, total: 0, totalPages: 0 },
    };
    service.findAll.mockResolvedValue(payload as any);

    const result = await controller.findAll({
      page: '2',
      pageSize: '5',
      sort: 'createdAt:desc',
    });

    expect(service.findAll).toHaveBeenCalledWith({
      page: 2,
      pageSize: 5,
      q: undefined,
      search: undefined,
      sort: 'createdAt:desc',
    });
    expect(result).toBe(payload);
  });

  it('passes search param to service', async () => {
    service.findAll.mockResolvedValue({ items: [], meta: {} } as any);

    await controller.findAll({
      page: VALID_UUID,
      pageSize: '10',
      sort: 'name:asc',
      search: 'fik',
    });

    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'fik' }),
    );
  });

  it('returns category by id', async () => {
    // 1. Mock service agar menerima dua argumen
    // Kita gunakan expect.any(Object) karena Zod parse akan memberikan default values
    service.findBooksBySlug.mockResolvedValue({ id: VALID_UUID } as any);

    // 2. Panggil controller dengan 2 argumen (id dan objek query kosong)
    const result = await controller.findBySlug(VALID_UUID, {});

    // 3. Verifikasi dengan dua argumen
    expect(service.findBooksBySlug).toHaveBeenCalledWith(
      VALID_UUID,
      expect.objectContaining({
        page: expect.any(Number),
        pageSize: expect.any(Number),
      }),
    );

    expect(result).toEqual({ id: VALID_UUID });
  });
});
