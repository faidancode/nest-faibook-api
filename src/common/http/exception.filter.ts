// src/common/http/exception.filter.ts

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { JwtPayload } from '../../auth/auth.schemas';
import { fail, ResponseEnvelope, ResponseError } from './response';

type RequestWithContext = Request & {
  requestId?: string;
  user?: JwtPayload & { id?: string };
};

type HttpExceptionResponse =
  | string
  | {
      message?: string | string[];
      error?: string;
      [key: string]: unknown;
    };

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestWithContext>();

    const requestId = req.requestId;
    const userId = req.user?.sub ?? req.user?.id;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error: ResponseError;

    // ========================
    // 1) HttpException (Nest)
    // ========================
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        // Contoh: throw new NotFoundException('Not found')
        error = {
          code: `HTTP_${status}`,
          message: response,
        };
      } else if (response && typeof response === 'object') {
        const obj = response as Record<string, any>;

        // ✅ Utamakan code custom dari payload (misal: RATE_LIMITED)
        const code: string =
          (obj.code as string) ??
          (obj.error?.code as string) ??
          `HTTP_${status}`;

        // Cari message yang paling masuk akal
        const message: string =
          (obj.message as string) ??
          (obj.error?.message as string) ??
          ((typeof obj.error === 'string' ? obj.error : '') ||
            `HTTP Error ${status}`);

        // Buang field yang sudah kita angkat ke level atas
        const { code: _c, message: _m, error: _e, ...rest } = obj;
        const hasDetails = Object.keys(rest).length > 0;

        error = {
          code,
          message,
          ...(hasDetails ? { details: rest } : {}),
        };
      } else {
        error = {
          code: `HTTP_${status}`,
          message: 'HTTP Error',
        };
      }
    }
    // ========================
    // 2) ZodError (validasi)
    // ========================
    else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      error = {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          issues: exception.issues,
        },
      };
    }
    // ========================
    // 3) Fallback generic error
    // ========================
    else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      error = {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      };
    }

    const isProd = process.env.NODE_ENV === 'production';

    // Tambah requestId kalau ada
    if (requestId && !isProd) {
      error = {
        ...error,
        details: {
          ...(error.details ?? {}),
          requestId,
        },
      };
    }

    // Logging
    const msg = (exception as any)?.message ?? error.message;
    const stack = (exception as any)?.stack;
    this.logger.error(
      `[${requestId ?? '-'}] ${req.method} ${req.url} -> ${status} ${msg}`,
      stack,
      userId ? `user:${userId}` : undefined,
    );

    const envelope: ResponseEnvelope<null> = {
      ok: false,
      data: null,
      meta: null,
      error,
    };

    res.status(status).json(envelope);
  }
}
