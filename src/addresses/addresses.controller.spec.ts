import { Test, TestingModule } from '@nestjs/testing';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

describe('AddressesController', () => {
  let controller: AddressesController;
  let service: jest.Mocked<AddressesService>;

  beforeEach(async () => {
    const serviceMock: Partial<Record<keyof AddressesService, jest.Mock>> = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddressesController],
      providers: [
        {
          provide: AddressesService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AddressesController>(AddressesController);
    service = module.get(AddressesService) as jest.Mocked<AddressesService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('parses query params for list endpoints', async () => {
    service.findAll.mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    } as any);

    await controller.findAll({
      userId: '00000000-0000-0000-0000-000000000000',
    });

    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '00000000-0000-0000-0000-000000000000',
      }),
    );
  });

  it('fetches addresses by user id using dedicated endpoint', async () => {
    service.findAll.mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    } as any);

    await controller.getAddressesByUserID(
      '00000000-0000-0000-0000-000000000000',
      { pageSize: '2' },
    );

    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '00000000-0000-0000-0000-000000000000',
        pageSize: 2,
      }),
    );
  });

  it('validates create payloads before passing to service', async () => {
    service.create.mockResolvedValue({ id: 'addr-1' } as any);

    const body = {
      userId: '00000000-0000-0000-0000-000000000000',
      label: 'Rumah',
      recipientName: 'Budi',
      recipientPhone: '08123',
      street: 'Jl. Mawar',
      isPrimary: 'true',
    };

    const created = await controller.create(body);

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '00000000-0000-0000-0000-000000000000',
        isPrimary: true,
      }),
    );
    expect(created).toEqual({ id: 'addr-1' });
  });

  it('allows customers to create addresses via dedicated route', async () => {
    service.create.mockResolvedValue({ id: 'addr-1' } as any);

    const created = await controller.createForCustomer({
      userId: '00000000-0000-0000-0000-000000000000',
      label: 'Kantor',
      recipientName: 'Andi',
      recipientPhone: '08123',
      street: 'Jl. Melati',
    });

    expect(service.create).toHaveBeenCalled();
    expect(created).toEqual({ id: 'addr-1' });
  });

  it('removes address entries and returns null payload', async () => {
    service.remove.mockResolvedValue(undefined);

    const result = await controller.removeCustomer('addr-1', {
      userId: '00000000-0000-0000-0000-000000000000',
    });

    expect(service.remove).toHaveBeenCalledWith(
      'addr-1',
      '00000000-0000-0000-0000-000000000000',
    );
    expect(result).toBeNull();
  });

  it('lets customer edit their own addresses', async () => {
    const payload = {
      label: 'Rumah',
      isPrimary: 'true',
    };
    service.update.mockResolvedValue({ id: 'addr-1' } as any);

    const updated = await controller.edit('addr-1', payload);

    expect(service.update).toHaveBeenCalledWith(
      'addr-1',
      expect.objectContaining({
        label: 'Rumah',
        isPrimary: true,
      }),
    );
    expect(updated).toEqual({ id: 'addr-1' });
  });
});
