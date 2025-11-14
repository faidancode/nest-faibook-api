import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimitService } from './rate-limit.service';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly appConfig: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();

    const ip =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      'unknown';

    const { loginLimit, loginTtl } = this.appConfig.rateLimit;

    // key 'login' → dipisah dari bucket global
    this.rateLimitService.check(ip, 'login', loginLimit, loginTtl * 1000);

    return true;
  }
}
