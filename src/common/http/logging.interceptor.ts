// src/common/http/logging.interceptor.ts

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { createLogger, format, transports, type Logger } from 'winston';
import type { JwtPayload } from '../../auth/auth.schemas';

type RequestWithContext = Request & {
  requestId?: string;
  user?: JwtPayload & { id?: string };
};

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger: Logger;

  constructor() {
    const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
    this.logger = createLogger({
      level,
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json(),
      ),
      transports: [new transports.Console()],
    });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<RequestWithContext>();
    const response = httpCtx.getResponse<Response>();

    const { method, originalUrl: url = request.url, ip } = request;
    const userId = request.user?.sub ?? request.user?.id;
    const requestId = request.requestId;
    const startedAt = Date.now();

    this.logger.info('Incoming request', {
      requestId,
      method,
      url,
      ip,
      userId,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startedAt;
          this.logger.info('Request completed', {
            requestId,
            method,
            url,
            statusCode: response.statusCode,
            duration,
            userId,
          });
        },
        error: (err: unknown) => {
          const duration = Date.now() - startedAt;
          this.logger.error('Request failed', {
            requestId,
            method,
            url,
            statusCode: response.statusCode,
            duration,
            userId,
            errorMessage: err instanceof Error ? err.message : String(err),
            errorStack: err instanceof Error ? err.stack : undefined,
          });
        },
      }),
    );
  }
}
