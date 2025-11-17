import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AppConfig } from '../config/app.config';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { compare, hash } from 'bcrypt';

type HashFn = (data: string, saltOrRounds: number) => Promise<string>;
type CompareFn = (
  data: string,
  encrypted: string,
) => Promise<boolean>;

describe('AuthService', () => {
  let service: AuthService;
  let db: any;
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let appConfig: AppConfig;
  const mockedHash = hash as unknown as jest.MockedFunction<HashFn>;
  const mockedCompare = compare as unknown as jest.MockedFunction<CompareFn>;

  const jwtConfig = {
    accessSecret: 'access-secret',
    accessExpiresIn: '15m',
    refreshSecret: 'refresh-secret',
    refreshExpiresIn: '7d',
  };

  beforeEach(async () => {
    db = {
      query: {
        users: {
          findFirst: jest.fn(),
        },
      },
      insert: jest.fn(),
    };

    jwt = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    appConfig = {
      get jwt() {
        return jwtConfig;
      },
    } as AppConfig;

    mockedHash.mockReset();
    mockedCompare.mockReset();
    jwt.signAsync.mockReset();
    jwt.verifyAsync.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: 'DRIZZLE',
          useValue: db,
        },
        {
          provide: JwtService,
          useValue: jwt,
        },
        {
          provide: AppConfig,
          useValue: appConfig,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('registers a new user and returns tokens', async () => {
    db.query.users.findFirst.mockResolvedValueOnce(undefined);

    mockedHash.mockResolvedValue('hashed-password');
    jwt.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const insertValues = jest.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValue({ values: insertValues });

    const result = await service.register({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'secret123',
      phone: undefined,
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: 'hashed-password',
        role: 'CUSTOMER',
      }),
    );
    expect(mockedHash).toHaveBeenCalledWith('secret123', 10);
    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sub: expect.any(String),
        email: 'john@example.com',
        role: 'CUSTOMER',
      }),
    );
    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      2,
      { sub: expect.any(String) },
      {
        secret: jwtConfig.refreshSecret,
        expiresIn: jwtConfig.refreshExpiresIn,
      },
    );
    expect(result).toEqual({
      userId: expect.any(String),
      role: 'CUSTOMER',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('throws when registering with existing email', async () => {
    db.query.users.findFirst.mockResolvedValueOnce({ id: 'user-1' });

    await expect(
      service.register({
        name: 'Jane',
        email: 'jane@example.com',
        password: 'secret',
        phone: undefined,
      }),
    ).rejects.toThrow(ConflictException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('throws unauthorized when credentials are invalid', async () => {
    db.query.users.findFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'john@example.com',
      passwordHash: 'hashed',
      role: 'CUSTOMER',
    });
    mockedCompare.mockResolvedValue(false);

    await expect(
      service.login({ email: 'john@example.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('issues new access token from refresh token', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1' });
    db.query.users.findFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'john@example.com',
      role: 'CUSTOMER',
    });
    jwt.signAsync.mockResolvedValue('new-access-token');

    const result = await service.verifyAndIssueAccessByRefreshToken(
      'refresh-token',
    );

    expect(jwt.verifyAsync).toHaveBeenCalledWith('refresh-token', {
      secret: jwtConfig.refreshSecret,
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'john@example.com',
      role: 'CUSTOMER',
    });
    expect(result).toEqual({
      userId: 'user-1',
      role: 'CUSTOMER',
      accessToken: 'new-access-token',
    });
  });
});
