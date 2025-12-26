import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
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
  type JwtPayload,
  RequestPasswordResetSchema,
  type RequestPasswordResetInput,
  ResetPasswordSchema,
  type ResetPasswordInput,
} from './auth.schemas';
import { ok, fail } from '../common/http/response';
import { JwtAuthGuard } from './jwt.guard';
import { EmailService } from 'src/email/email.service';
import { ZodValidationPipe } from 'src/common/http/zod.validation.pipe';

export type ClientType = 'web-admin' | 'web-customer' | 'mobile';

function resolveClientType(
  clientHeader?: string,
  userAgentHeader?: string,
): ClientType {
  const header = clientHeader?.toLowerCase();

  // 1️⃣ Explicit mobile
  if (header === 'mobile') return 'mobile';

  // 2️⃣ Explicit web client
  if (header === 'web-admin') return 'web-admin';
  if (header === 'web-customer') return 'web-customer';

  // 3️⃣ Auto-detect mobile app via User-Agent
  const ua = userAgentHeader?.toLowerCase() ?? '';
  const looksLikeMobileApp =
    ua.includes('expo') ||
    ua.includes('reactnative') ||
    ua.includes('react-native') ||
    ua.includes('okhttp');

  if (looksLikeMobileApp) return 'mobile';

  // 4️⃣ Safe default
  return 'web-customer';
}

function isWebClient(clientType: ClientType) {
  return clientType === 'web-admin' || clientType === 'web-customer';
}

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Headers('x-client-type') clientHeader: string | undefined,
    @Headers('user-agent') userAgentHeader: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientType = resolveClientType(clientHeader, userAgentHeader);
    const parsed: RegisterInput = RegisterSchema.parse(body);

    const { accessToken, refreshToken, role, userId, user } =
      await this.authService.register(parsed);

    if (isWebClient(clientType)) {
      const isProd = process.env.NODE_ENV === 'production';

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return ok({
        userId,
        role,
        user: {
          name: user.name,
          email: user.email,
        },
      });
    }

    // Mobile: return tokens in body
    return ok({
      userId,
      role,
      user: {
        name: user.name,
        email: user.email,
      },
      accessToken,
      refreshToken,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Headers('x-client-type') clientHeader: string | undefined,
    @Headers('user-agent') userAgentHeader: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientType = resolveClientType(clientHeader, userAgentHeader);
    const parsed: LoginInput = LoginSchema.parse(body);

    const { accessToken, refreshToken, role, userId, user } =
      await this.authService.login(parsed);
    if (clientType === 'web-admin' && role !== 'ADMIN') {
      throw new UnauthorizedException(
        'You are not allowed to access admin dashboard',
      );
    }
    if (isWebClient(clientType)) {
      const isProd = process.env.NODE_ENV === 'production';

      // Set cookies untuk web
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000, // 15 menit
        path: '/',
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
        path: '/',
      });

      // Response tanpa token
      return ok({
        userId,
        user: {
          name: user.name,
          email: user.email,
        },
        role,
      });
    }

    // Mobile: return tokens in body
    return ok({
      userId,
      role,
      user: {
        name: user.name,
        email: user.email,
      },
      accessToken,
      refreshToken,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Headers('x-client-type') clientHeader: string | undefined,
    @Headers('user-agent') userAgentHeader: string | undefined,
    @Req() req: Request,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientType = resolveClientType(clientHeader, userAgentHeader);

    if (isWebClient(clientType)) {
      // Web: ambil refreshToken dari cookie
      const cookies = req.cookies as Record<string, unknown> | undefined;
      const refreshToken =
        typeof cookies?.refreshToken === 'string'
          ? cookies.refreshToken
          : undefined;

      if (!refreshToken) {
        throw new UnauthorizedException({
          code: 'NO_REFRESH_TOKEN',
          message: 'Missing refresh token',
        });
      }

      const result =
        await this.authService.verifyAndIssueAccessByRefreshToken(refreshToken);

      const isProd = process.env.NODE_ENV === 'production';

      // Update both tokens in cookies so the browser keeps them in sync
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return ok({
        userId: result.userId,
        role: result.role,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }

    // Mobile: ambil refreshToken dari body
    const parsed: RefreshMobileInput = RefreshMobileSchema.parse(body);
    const result = await this.authService.verifyAndIssueAccessByRefreshToken(
      parsed.refreshToken,
    );

    return ok({
      userId: result.userId,
      role: result.role,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Headers('x-client-type') clientHeader: string | undefined,
    @Headers('user-agent') userAgentHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientType = resolveClientType(clientHeader, userAgentHeader);

    if (isWebClient(clientType)) {
      // Hapus cookie
      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });
    }

    // Mobile: client hapus token secara lokal
    return ok({ loggedOut: true });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request & { user: JwtPayload }) {
    const result = await this.authService.getMe(req.user.sub);
    return ok(result);
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(
    @Body(new ZodValidationPipe(RequestPasswordResetSchema))
    parsed: RequestPasswordResetInput,
  ) {
    //(anti user enumeration)
    const result = await this.authService.requestPasswordReset(parsed.email);

    // Return the full result including message and emailSent flag
    return ok({
      success: result.success,
      emailSent: result.emailSent,
      message:
        result.message ??
        'If the email is registered, a password reset link has been sent.',
    });
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: unknown) {
    const parsed: ResetPasswordInput = ResetPasswordSchema.parse(body);
    await this.authService.resetPassword(parsed.token, parsed.newPassword);

    return ok({ message: 'Password has been successfully reset.' });
  }
}
