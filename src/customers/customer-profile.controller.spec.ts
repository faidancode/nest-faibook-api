import { Test, TestingModule } from '@nestjs/testing';
import { CustomerProfileController } from './customer-profile.controller';
import { CustomersService } from './customers.service';

describe('CustomerProfileController', () => {
  let controller: CustomerProfileController;
  let service: jest.Mocked<CustomersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerProfileController],
      providers: [
        {
          provide: CustomersService,
          useValue: {
            updateProfile: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CustomerProfileController>(
      CustomerProfileController,
    );
    service = module.get(CustomersService) as jest.Mocked<CustomersService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates to service with authenticated user id', async () => {
    const payload = {
      id: 'cust-1',
      name: 'New Name',
      email: 'a@example.com',
      role: 'CUSTOMER',
    };
    service.updateProfile.mockResolvedValue(payload as any);

    const result = await controller.update(
      { name: 'New Name', password: 'secret123' },
      {
        user: {
          sub: 'cust-1',
          email: 'a@example.com',
          role: 'CUSTOMER',
        },
      } as any,
    );

    expect(service.updateProfile).toHaveBeenCalledWith('cust-1', {
      name: 'New Name',
      password: 'secret123',
    });
    expect(result).toBe(payload);
  });
});
