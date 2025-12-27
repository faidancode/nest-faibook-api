import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimitService } from './rate-limit.service';
import { AppConfig } from '../../config/app.config';
import { SKIP_RATE_LIMIT } from '../constants/rate-limit-constants';
import { Reflector } from '@nestjs/core';

@Injectable()
export class GlobalRateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly appConfig: AppConfig,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.get<boolean>(
      SKIP_RATE_LIMIT,
      context.getHandler(),
    );

    if (skip) return true;

    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();

    const ip =
      (req.headers['cf-connecting-ip'] as string) || // Cloudflare
      (req.headers['x-real-ip'] as string) || // Nginx
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      '0.0.0.0';

    const { globalLimit, globalTtl } = this.appConfig.rateLimit;

    this.rateLimitService.check(ip, 'global', globalLimit, globalTtl * 1000);

    return true;
  }
}
