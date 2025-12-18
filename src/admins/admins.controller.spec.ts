import { Test, TestingModule } from '@nestjs/testing';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';

describe('AdminsController', () => {
  let controller: AdminsController;
  let service: jest.Mocked<AdminsService>;

  beforeEach(async () => {
    const serviceMock: Partial<Record<keyof AdminsService, any>> = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminsController],
      providers: [
        {
          provide: AdminsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminsController>(AdminsController);
    service = module.get(AdminsService) as jest.Mocked<AdminsService>;
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

    const result = await controller.list({
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

    await controller.list({
      page: '1',
      pageSize: '10',
      sort: 'name:asc',
      search: 'admin',
    });

    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'admin' }),
    );
  });

  it('returns admin by id', async () => {
    service.findOne.mockResolvedValue({ id: '1', email: 'a@b.com' } as any);

    const result = await controller.detail('1');

    expect(service.findOne).toHaveBeenCalledWith('1');
    expect(result).toEqual({ id: '1', email: 'a@b.com' });
  });

  it('validates payload when creating admin', async () => {
    const dto = {
      name: 'Admin',
      email: 'admin@mail.com',
      password: 'secret123',
      phone: '0812345678',
    };

    service.create.mockResolvedValue({
      id: '1',
      name: dto.name,
      email: dto.email,
    } as any);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({
      id: '1',
      name: dto.name,
      email: dto.email,
    });
  });

  it('removes admin and returns ok response', async () => {
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
