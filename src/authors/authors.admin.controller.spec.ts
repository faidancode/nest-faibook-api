import { Test, TestingModule } from '@nestjs/testing';
import { AuthorsAdminController } from './authors.admin.controller';
import { AuthorsService } from './authors.service';

describe('AuthorsAdminController', () => {
  let controller: AuthorsAdminController;
  let service: jest.Mocked<AuthorsService>;

  beforeEach(async () => {
    const serviceMock: Partial<Record<keyof AuthorsService, any>> = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findBooksBySlug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthorsAdminController],
      providers: [
        {
          provide: AuthorsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AuthorsAdminController>(AuthorsAdminController);
    service = module.get(AuthorsService) as jest.Mocked<AuthorsService>;
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
      search: 'john',
    });

    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'john' }),
    );
  });

  it('returns author by id', async () => {
    service.findOne.mockResolvedValue({ id: '1' } as any);

    const result = await controller.findOne('1');

    expect(service.findOne).toHaveBeenCalledWith('1');
    expect(result).toEqual({ id: '1' });
  });

  it('validates payload when creating author', async () => {
    const dto = { name: 'John Doe', bio: 'Bio' };
    service.create.mockResolvedValue({
      id: '1',
      ...dto,
      slug: 'john-doe',
    } as any);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: '1', ...dto, slug: 'john-doe' });
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

  it('removes author and returns null', async () => {
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

  it('parses query when listing books by author slug', async () => {
    const payload = {
      author: { id: 'a1' },
      items: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    };
    service.findBooksBySlug.mockResolvedValue(payload as any);

    const result = await controller.findBooksBySlug('john-doe', {
      page: '1',
      pageSize: '10',
      sort: 'title:asc',
    });

    expect(service.findBooksBySlug).toHaveBeenCalledWith('john-doe', {
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
    expect(result).toBe(payload);
  });
});
