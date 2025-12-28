import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { CategoriesAdminController } from './categories.admin.controller';

describe('CategoriesAdminController', () => {
  let controller: CategoriesAdminController;
  let service: jest.Mocked<CategoriesService>;

  beforeEach(async () => {
    const serviceMock: Partial<Record<keyof CategoriesService, any>> = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesAdminController],
      providers: [
        {
          provide: CategoriesService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<CategoriesAdminController>(
      CategoriesAdminController,
    );
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
      page: '1',
      pageSize: '10',
      sort: 'name:asc',
      search: 'fik',
    });

    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'fik' }),
    );
  });

  it('returns category by id', async () => {
    service.findOne.mockResolvedValue({ id: '1' } as any);

    const result = await controller.findOne('1');

    expect(service.findOne).toHaveBeenCalledWith('1');
    expect(result).toEqual({ id: '1' });
  });

  it('validates payload when creating category', async () => {
    const dto = {
      name: 'Fiksi',
      icon: 'Book',
      description: 'desc',
      active: true,
    };
    service.create.mockResolvedValue({ id: '1', ...dto, slug: 'fiksi' } as any);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: '1', ...dto, slug: 'fiksi' });
  });

  it('passes id and payload to update', async () => {
    const dto = { name: 'Updated' };
    service.update.mockResolvedValue({ id: '1', ...dto } as any);

    const result = await controller.update('1', dto);

    expect(service.update).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ name: 'Updated' }),
    );
    expect(result).toEqual({ id: '1', ...dto });
  });

  it('removes category and returns null', async () => {
    service.remove.mockResolvedValue(undefined);

    const result = await controller.remove('1');

    expect(service.remove).toHaveBeenCalledWith('1');
    expect(result).toEqual({
      ok: true,
      data: null,
      meta: null,
      error: null,
    });
  });
});
