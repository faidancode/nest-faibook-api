import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AppConfig } from '../config/app.config';
import { EmailService } from 'src/email/email.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { compare, hash } from 'bcrypt';

type HashFn = (data: string, saltOrRounds: number) => Promise<string>;
type CompareFn = (data: string, encrypted: string) => Promise<boolean>;

describe('AuthService', () => {
  let service: AuthService;
  let db: any;
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let appConfig: AppConfig;
  let emailService: jest.Mocked<EmailService>;
  let configService: { get: jest.Mock };
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

    emailService = {
      sendResetPasswordEmail: jest.fn(),
      sendConfirmationLink: jest.fn(),
      sendConfirmationPin: jest.fn(),
    } as unknown as jest.Mocked<EmailService>;

    configService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };

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
        {
          provide: EmailService,
          useValue: emailService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('registers a new user and returns tokens', async () => {
    db.query.users.findFirst.mockResolvedValueOnce(undefined);
    jest
      .spyOn(service, 'requestEmailConfirmation')
      .mockResolvedValueOnce({ success: true, emailSent: true });

    mockedHash.mockResolvedValue('hashed-password');
    jwt.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const insertValues = jest.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValue({ values: insertValues });

    const result = await service.register(
      {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
        phone: undefined,
      },
      'Web',
    );

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
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('throws when registering with existing email', async () => {
    db.query.users.findFirst.mockResolvedValueOnce({ id: 'user-1' });

    await expect(
      service.register(
        {
          name: 'Jane',
          email: 'jane@example.com',
          password: 'secret',
          phone: undefined,
        },
        'Web',
      ),
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
      name: 'John Doe',
      email: 'john@example.com',
      role: 'CUSTOMER',
    });
    jwt.signAsync
      .mockResolvedValueOnce('new-access-token')
      .mockResolvedValueOnce('new-refresh-token');

    const result =
      await service.verifyAndIssueAccessByRefreshToken('refresh-token');

    expect(jwt.verifyAsync).toHaveBeenCalledWith('refresh-token', {
      secret: jwtConfig.refreshSecret,
    });
    expect(jwt.signAsync).toHaveBeenNthCalledWith(1, {
      sub: 'user-1',
      email: 'john@example.com',
      role: 'CUSTOMER',
    });
    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      2,
      { sub: 'user-1' },
      {
        secret: jwtConfig.refreshSecret,
        expiresIn: jwtConfig.refreshExpiresIn,
      },
    );
    expect(result).toEqual({
      userId: 'user-1',
      role: 'CUSTOMER',
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
  });

  it('returns user profile for getMe', async () => {
    db.query.users.findFirst.mockResolvedValueOnce({
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '0800000',
      role: 'CUSTOMER',
    });

    const result = await service.getMe('user-1');

    expect(db.query.users.findFirst).toHaveBeenCalledWith({
      where: expect.anything(),
    });
    expect(result).toEqual({
      userId: 'user-1',
      role: 'CUSTOMER',
      user: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '0800000',
      },
    });
  });

  it('throws unauthorized when user is missing in getMe', async () => {
    db.query.users.findFirst.mockResolvedValueOnce(undefined);

    await expect(service.getMe('missing')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
