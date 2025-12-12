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
} from './auth.schemas';
import { ok, fail } from '../common/http/response';
import { JwtAuthGuard } from './jwt.guard';

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
  constructor(private readonly authService: AuthService) {}

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
        sameSite: isProd ? "none" : 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProd, 
        sameSite: isProd ? "none" : 'lax',
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
    console.log({clientType});
    if (clientType === 'web') {
      const isProd = process.env.NODE_ENV === 'production';

      // Set cookies untuk web
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: isProd, 
        sameSite: isProd ? "none" : 'lax',
        maxAge: 15 * 60 * 1000, // 15 menit
        path: '/',
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProd, 
        sameSite: isProd ? "none" : 'lax',
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

      const result = await this.authService.verifyAndIssueAccessByRefreshToken(
        refreshToken,
      );

      const isProd = process.env.NODE_ENV === 'production';

      // Update both tokens in cookies so the browser keeps them in sync
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: isProd, 
        sameSite: isProd ? "none" : 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: isProd, 
        sameSite: isProd ? "none" : 'lax',
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
}
