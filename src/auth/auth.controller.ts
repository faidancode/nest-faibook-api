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

type ClientType = 'web' | 'mobile';

function resolveClientType(
  clientHeader?: string,
  userAgentHeader?: string,
): ClientType {
  const header = clientHeader?.toLowerCase();
  if (header === 'mobile') return 'mobile';

  const ua = userAgentHeader?.toLowerCase() ?? '';
  const looksLikeMobileApp =
    ua.includes('expo') ||
    ua.includes('reactnative') ||
    ua.includes('react-native') ||
    ua.includes('okhttp');

  if (looksLikeMobileApp) return 'mobile';

  return 'web';
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

    if (clientType === 'web') {
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
    console.log({ clientType });
    if (clientType === 'web') {
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

    if (clientType === 'web') {
      // Web: ambil refreshToken dari cookie
      const cookies = req.cookies as Record<string, unknown> | undefined;
      const refreshToken =
        typeof cookies?.refreshToken === 'string'
          ? cookies.refreshToken
          : undefined;

      if (!refreshToken) {
        return fail('NO_REFRESH_TOKEN', 'Missing refresh token');
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

    if (clientType === 'web') {
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
    const { email } = parsed;
    const user = await this.authService.getCustomerByEmail(email);
    const name = user.user.name;

    const result = await this.authService.requestPasswordReset(parsed.email);

    // Jika token berhasil dibuat dan email perlu dikirim (emailSent: true),
    // Lanjutkan ke logic pengiriman email di sini.

    if (result.emailSent && result.resetToken) {
      // DI SINI ADALAH TEMPAT UNTUK MENGIRIM EMAIL DENGAN RESEND & REACT EMAIL

      // Contoh: Membuat URL Reset. Anda perlu mendapatkan BASE_URL dari config.
      const BASE_URL = process.env.WEBSTORE_URL || 'http://localhost:3001';
      const resetUrl = `${BASE_URL}/reset-password?token=${result.resetToken}`;

      // Panggil service email Anda di sini:
      await this.emailService.sendResetPasswordEmail(
        parsed.email,
        resetUrl,
        name,
      );
    }

    // Keamanan: Selalu berikan respons OK yang generik kepada pengguna
    return ok({
      message:
        'If the email is registered, a password reset link has been sent.',
    });
  }

  // --- NEW ENDPOINT 2: Actual Password Reset ---
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: unknown) {
    const parsed: ResetPasswordInput = ResetPasswordSchema.parse(body);

    // Di service, password akan di-hash, user diupdate, dan token dihapus.
    await this.authService.resetPassword(parsed.token, parsed.newPassword);

    // Anda bisa mengirim email notifikasi password berhasil diubah di sini jika diperlukan.

    return ok({ message: 'Password has been successfully reset.' });
  }
}
