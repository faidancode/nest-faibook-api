// src/common/http/request-id.interceptor.ts

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { AppConfig } from '../../config/app.config';

type RequestWithHeaders = Request & {
  requestId?: string;
};

@Injectable()
export class RequestIdInterceptor implements NestInterceptor<unknown, unknown> {
  private readonly headerName: string;

  constructor(private readonly appConfig: AppConfig) {
    this.headerName = this.appConfig.requestIdHeader.toLowerCase();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<RequestWithHeaders>();
    const res = httpCtx.getResponse<Response>();

    const existingId =
      req.headers[this.headerName] ||
      req.headers[this.headerName.toLowerCase()];
    const requestId =
      (Array.isArray(existingId) ? existingId[0] : existingId) || randomUUID();

    req.requestId = requestId;
    res.setHeader(this.headerName, requestId);

    return next.handle();
  }
}
