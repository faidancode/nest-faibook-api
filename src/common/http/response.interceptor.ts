// src/common/http/response.interceptor.ts

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ok, type PaginationMeta, type ResponseEnvelope } from './response';

type PaginatedResponse<T = unknown> = {
  items: T;
  meta?: PaginationMeta | null;
};

function isResponseEnvelope(value: unknown): value is ResponseEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ResponseEnvelope>;
  return 'ok' in candidate && 'data' in candidate && 'error' in candidate;
}

function isPaginatedResponse(value: unknown): value is PaginatedResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return 'items' in record && 'meta' in record;
}

@Injectable()
export class ResponseEnvelopeInterceptor
  implements NestInterceptor<unknown, ResponseEnvelope>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseEnvelope> {
    return next.handle().pipe(
      map((data: unknown) => {
        // Jika handler sudah mengembalikan envelope, jangan dibungkus lagi
        if (isResponseEnvelope(data)) {
          return data;
        }

        // Jika handler mengembalikan { data, meta } → bungkus sebagai envelope
        if (isPaginatedResponse(data)) {
          return {
            ok: true,
            data: data.items,
            meta: data.meta ?? null,
            error: null,
          } satisfies ResponseEnvelope;
        }

        // Default: data tunggal
        return ok(data);
      }),
    );
  }
}
