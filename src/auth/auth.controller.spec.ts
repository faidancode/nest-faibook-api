import { Test, TestingModule } from '@nestjs/testing';
import type { Response, Request } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const serviceMock: Partial<Record<keyof AuthService, jest.Mock>> = {
      register: jest.fn(),
      login: jest.fn(),
      verifyAndIssueAccessByRefreshToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    service = module.get(AuthService) as jest.Mocked<AuthService>;
  });

  it('registers web client and sets cookies', async () => {
    service.register.mockResolvedValue({
      userId: '00000000-0000-0000-0000-000000000001',
      role: 'CUSTOMER',
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    const res = {
      cookie: jest.fn(),
    } as unknown as Response;

    const result = await controller.register(
      undefined,
      {
        name: 'John',
        email: 'john@example.com',
        password: 'secret123',
      },
      res,
    );

    expect(service.register).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      ok: true,
      data: {
        userId: '00000000-0000-0000-0000-000000000001',
        role: 'CUSTOMER',
      },
      meta: null,
      error: null,
    });
  });

  it('registers mobile client and returns tokens in body', async () => {
    service.register.mockResolvedValue({
      userId: '00000000-0000-0000-0000-000000000002',
      role: 'CUSTOMER',
      accessToken: 'access-mobile',
      refreshToken: 'refresh-mobile',
    });

    const res = {
      cookie: jest.fn(),
    } as unknown as Response;

    const result = await controller.register(
      'mobile',
      {
        name: 'Jane',
        email: 'jane@example.com',
        password: 'secret123',
      },
      res,
    );

    expect(res.cookie).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      data: {
        userId: '00000000-0000-0000-0000-000000000002',
        role: 'CUSTOMER',
        accessToken: 'access-mobile',
        refreshToken: 'refresh-mobile',
      },
      meta: null,
      error: null,
    });
  });

  it('refreshes access token for web clients using cookies', async () => {
    service.verifyAndIssueAccessByRefreshToken.mockResolvedValue({
      userId: '00000000-0000-0000-0000-000000000003',
      role: 'CUSTOMER',
      accessToken: 'new-access',
    });

    const req = {
      cookies: {
        refreshToken: 'refresh-token',
      },
    } as unknown as Request;

    const res = {
      cookie: jest.fn(),
    } as unknown as Response;

    const result = await controller.refresh(undefined, req, {}, res);

    expect(service.verifyAndIssueAccessByRefreshToken).toHaveBeenCalledWith(
      'refresh-token',
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'accessToken',
      'new-access',
      expect.objectContaining({
        httpOnly: true,
      }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        userId: '00000000-0000-0000-0000-000000000003',
        role: 'CUSTOMER',
      },
      meta: null,
      error: null,
    });
  });
});
