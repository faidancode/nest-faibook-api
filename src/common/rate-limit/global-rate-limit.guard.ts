import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimitService } from './rate-limit.service';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class GlobalRateLimitGuard implements CanActivate {
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

    const { globalLimit, globalTtl } = this.appConfig.rateLimit;

    this.rateLimitService.check(ip, 'global', globalLimit, globalTtl * 1000);

    return true;
  }
}
