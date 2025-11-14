import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import * as schema from '../infra/drizzle/schema';
import type { JwtPayload, LoginInput, Role } from './auth.schemas';
import type { DrizzleDb } from '../infra/drizzle/client'; // kalau kamu expose type
import { AppConfig } from '../config/app.config';

type Db = MySql2Database<typeof schema> | DrizzleDb;

@Injectable()
export class AuthService {
  constructor(
    @Inject('DRIZZLE') private readonly db: Db,
    private readonly jwt: JwtService,
    private readonly appConfig: AppConfig,
  ) {}

  private async validateUser(email: string, password: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const bcrypt = await import('bcrypt');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  private async signAccessToken(user: {
    id: string;
    email: string;
    role: Role;
  }) {
    const jwtCfg = this.appConfig.jwt;
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwt.signAsync(payload);
  }

  private async signRefreshToken(user: { id: string }) {
    const jwtCfg = this.appConfig.jwt;
    return this.jwt.signAsync(
      { sub: user.id },
      {
        secret: jwtCfg.refreshSecret,
        expiresIn: jwtCfg.refreshExpiresIn,
      },
    );
  }

  async login(dto: LoginInput) {
    const user = await this.validateUser(dto.email, dto.password);

    const accessToken = await this.signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role as Role,
    });

    const refreshToken = await this.signRefreshToken({ id: user.id });

    return {
      userId: user.id,
      role: user.role as Role,
      accessToken,
      refreshToken,
    };
  }

  async verifyAndIssueAccessByRefreshToken(refreshToken: string) {
    const jwtCfg = this.appConfig.jwt;

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(refreshToken, {
        secret: jwtCfg.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, payload.sub),
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const accessToken = await this.signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role as Role,
    });

    return {
      userId: user.id,
      role: user.role as Role,
      accessToken,
      // optional: bisa juga rotate refreshToken di sini, untuk sekarang kita biarin sama
    };
  }
}
