// src/common/http/exception.filter.ts

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { JwtPayload } from '../../auth/auth.schemas';
import { fail, ResponseEnvelope } from './response';

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
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithContext>();

    const requestId = request.requestId;
    const userId = request.user?.sub ?? request.user?.id;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorEnvelope: ResponseEnvelope<null>;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as HttpExceptionResponse;
      const message =
        typeof res === 'string'
          ? res
          : Array.isArray(res.message)
            ? res.message.join(', ')
            : res?.message || res?.error || 'HTTP Error';

      errorEnvelope = fail(
        `HTTP_${status}`,
        message,
        res && typeof res === 'object' ? res : undefined,
      );
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      errorEnvelope = fail('VALIDATION_ERROR', 'Validation failed', {
        issues: exception.issues,
      });
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorEnvelope = fail('INTERNAL_SERVER_ERROR', 'Internal server error');
    }

    this.logger.error(
      `[${requestId ?? '-'}] ${request.method} ${request.url} -> ${status} ${
        exception instanceof Error ? exception.message : ''
      }`,
      exception instanceof Error ? exception.stack : undefined,
      userId ? `user:${userId}` : undefined,
    );

    if (requestId && errorEnvelope.error) {
      const currentDetails = errorEnvelope.error.details;
      errorEnvelope.error.details = {
        ...(typeof currentDetails === 'object' && currentDetails !== null
          ? (currentDetails as Record<string, unknown>)
          : {}),
        requestId,
      };
    }

    response.status(status).json(errorEnvelope);
  }
}
