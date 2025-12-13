import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import * as schema from '../infra/drizzle/schema';
import type {
  JwtPayload,
  LoginInput,
  RegisterInput,
  Role,
} from './auth.schemas';
import type { DrizzleDb } from '../infra/drizzle/client';
import { AppConfig } from '../config/app.config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { addMinutes, isAfter } from 'date-fns';
import { EmailService } from 'src/email/email.service';
import { ConfigService } from '@nestjs/config';
import { Env } from 'src/config/env.schema';

type Db = MySql2Database<typeof schema> | DrizzleDb;

@Injectable()
export class AuthService {
  constructor(
    @Inject('DRIZZLE') private readonly db: Db,
    private readonly jwt: JwtService,
    private readonly appConfig: AppConfig,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService<Env, true>
  ) {}

  private async validateUser(email: string, password: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    return user;
  }

  private async signAccessToken(user: {
    id: string;
    email: string;
    role: Role;
  }) {
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
      user: {
        name: user.name,
        email: user.email,
      },
      accessToken,
      refreshToken,
    };
  }

  async register(dto: RegisterInput) {
    const existing = await this.db.query.users.findFirst({
      where: eq(schema.users.email, dto.email),
      columns: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const userId = randomUUID();
    const role: Role = 'CUSTOMER';

    await this.db.insert(schema.users).values({
      id: userId,
      name: dto.name,
      email: dto.email,
      phone: dto.phone ?? null,
      passwordHash,
      role,
    });

    const accessToken = await this.signAccessToken({
      id: userId,
      email: dto.email,
      role,
    });

    const refreshToken = await this.signRefreshToken({ id: userId });

    return {
      userId,
      role,
      user: {
        name: dto.name,
        email: dto.email,
      },
      accessToken,
      refreshToken,
    };
  }

  // Method untuk refresh token (dipanggil dari controller)
  async refreshAccessToken(rawRefreshToken: string) {
    const jwtCfg = this.appConfig.jwt;

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(rawRefreshToken, {
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
    const refreshToken = await this.signRefreshToken({ id: user.id });

    return {
      userId: user.id,
      role: user.role as Role,
      user: {
        name: user.name,
        email: user.email,
      },
      accessToken,
      refreshToken,
    };
  }

  async verifyAndIssueAccessByRefreshToken(refreshToken: string) {
    return this.refreshAccessToken(refreshToken);
  }

  async getMe(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      userId: user.id,
      role: user.role as Role,
      user: {
        name: user.name,
        email: user.email,
        ...(user.phone ? { phone: user.phone } : {}),
      },
    };
  }

  async getCustomerByEmail(email: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      userId: user.id,
      role: user.role as Role,
      user: {
        name: user.name,
        email: user.email,
        ...(user.phone ? { phone: user.phone } : {}),
      },
    };
  }

  async requestPasswordReset(email: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
      columns: { id: true, name:true },
    });

    // Security Best Practice: Selalu kembalikan respons OK/Sukses,
    // bahkan jika email tidak ditemukan, untuk mencegah enumerasi user.
    if (!user) {
      console.log(
        `[PASSWORD_RESET] Email not found: ${email}. Skipping token generation.`,
      );
      return { success: true, emailSent: false };
    }

    const resetToken = randomUUID();
    const expiresAt = addMinutes(new Date(), 30); // Token kedaluwarsa dalam 30 menit
    const newId = randomUUID();
    await this.db
      .insert(schema.passwordResetTokens)
      .values({
        id: newId,
        userId: user.id,
        token: resetToken,
        expiresAt: expiresAt, // Simpan format ISO
      })
      .onDuplicateKeyUpdate({
        set: { token: resetToken, expiresAt: expiresAt },
      });

    const BASE_URL = this.configService.get<string>('WEBSTORE_URL'); 
    const resetUrl = `${BASE_URL}/reset-password?token=${resetToken}`;
    await this.emailService.sendResetPasswordEmail(
        email, 
        resetUrl, 
        user.name // Asumsi Anda mengambil nama pengguna saat mencari user
    );

    return {
      success: true,
      emailSent: true,
      resetToken,
    };
  }

  // --- NEW METHOD 2: Menggunakan token untuk reset password ---
  async resetPassword(token: string, newPassword: string) {
    const resetRecord = await this.db.query.passwordResetTokens.findFirst({
      where: eq(schema.passwordResetTokens.token, token),
    });

    if (!resetRecord) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    // Cek kedaluwarsa
    if (isAfter(new Date(), new Date(resetRecord.expiresAt))) {
      // Hapus token yang sudah kedaluwarsa agar tidak dapat digunakan lagi
      await this.db
        .delete(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.token, token));
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, resetRecord.userId),
    });

    if (!user) {
      // Hapus token jika user tidak ada
      await this.db
        .delete(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.token, token));
      throw new UnauthorizedException('User not found');
    }

    // 1. Hash password baru
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 2. Update password user
    await this.db
      .update(schema.users)
      .set({ passwordHash })
      .where(eq(schema.users.id, resetRecord.userId));

    // 3. Hapus/Revoke token agar tidak dapat digunakan lagi
    await this.db
      .delete(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.token, token));

    return { success: true };
  }
}
