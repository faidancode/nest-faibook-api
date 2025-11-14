// src/common/http/response.ts

export interface PaginationMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

export interface ResponseError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ResponseEnvelope<T = unknown> {
  ok: boolean;
  data: T | null;
  meta: PaginationMeta | null;
  error: ResponseError | null;
}

export function ok<T = unknown>(
  data: T,
  meta: PaginationMeta | null = null,
): ResponseEnvelope<T> {
  return {
    ok: true,
    data,
    meta,
    error: null,
  };
}

export function okNoContent(): ResponseEnvelope<null> {
  return {
    ok: true,
    data: null,
    meta: null,
    error: null,
  };
}

export function fail(
  code: string,
  message: string,
  details?: unknown,
): ResponseEnvelope<null> {
  return {
    ok: false,
    data: null,
    meta: null,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}
