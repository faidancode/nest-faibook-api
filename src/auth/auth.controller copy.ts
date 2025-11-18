import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  LoginSchema,
  type LoginInput,
  RefreshMobileSchema,
  type RefreshMobileInput,
  RegisterSchema,
  type RegisterInput,
} from './auth.schemas';
import { ok, fail } from '../common/http/response';
import { JwtAuthGuard } from './jwt.guard';
import { UseGuards } from '@nestjs/common';

type ClientType = 'web' | 'mobile';

function resolveClientType(headerValue?: string): ClientType {
  if (!headerValue) return 'web';
  const v = headerValue.toLowerCase();
  return v === 'mobile' ? 'mobile' : 'web';
}

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Headers('x-client-type') clientHeader: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientType = resolveClientType(clientHeader);
    const parsed: RegisterInput = RegisterSchema.parse(body);

    const { accessToken, refreshToken, role, userId } =
      await this.authService.register(parsed);

    if (clientType === 'web') {
      const isProd = process.env.NODE_ENV === 'production';

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: 15 * 60 * 1000,
        path: '/',
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return ok({
        userId,
        role,
      });
    }

    return ok({
      userId,
      role,
      accessToken,
      refreshToken,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Headers('x-client-type') clientHeader: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientType = resolveClientType(clientHeader);

    const parsed: LoginInput = LoginSchema.parse(body);
    const { accessToken, refreshToken, role, userId, user } =
      await this.authService.login(parsed);

    if (clientType === 'web') {
      const isProd = process.env.NODE_ENV === 'production';

      // Access token cookie (boleh lebih pendek)
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: 15 * 60 * 1000, // 15 menit
        path: '/',
      });

      // Refresh token cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
        path: '/',
      });

      // Body bisa minimal (frontend web opsional pakai accessToken dari body)
      return ok({
        userId,
        user:{
          name: user.name, // kosongkan saja
          email: user.email,
        },
        role,
      });
    }

    // clientType === "mobile"
    return ok({
      userId,
      role,
      accessToken,
      refreshToken,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Headers('x-client-type') clientHeader: string | undefined,
    @Req() req: Request,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientType = resolveClientType(clientHeader);

    if (clientType === 'web') {
      const cookies = req.cookies as Record<string, unknown> | undefined;
      const refreshToken =
        typeof cookies?.refreshToken === 'string'
          ? cookies.refreshToken
          : undefined;
      if (!refreshToken) {
        return fail('NO_REFRESH_TOKEN', 'Missing refresh token');
      }

      const { accessToken, role, userId } =
        await this.authService.verifyAndIssueAccessByRefreshToken(refreshToken);

      const isProd = process.env.NODE_ENV === 'production';

      // Update accessToken cookie
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: 15 * 60 * 1000,
        path: '/',
      });

      return ok({
        userId,
        role,
      });
    }

    // clientType === "mobile"
    const parsed: RefreshMobileInput = RefreshMobileSchema.parse(body);
    const { accessToken, role, userId } =
      await this.authService.verifyAndIssueAccessByRefreshToken(
        parsed.refreshToken,
      );

    // Untuk simple case, kita tidak rotate refreshToken
    return ok({
      userId,
      role,
      accessToken,
      // refreshToken: parsed.refreshToken, // bisa ikut dikembalikan kalau mau
    });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Headers('x-client-type') clientHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientType = resolveClientType(clientHeader);

    if (clientType === 'web') {
      // Hapus cookie
      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });
    }

    // mobile: tidak ada cookie, client cukup hapus token lokal
    return ok({ loggedOut: true });
  }
}
