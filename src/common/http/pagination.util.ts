// src/common/http/pagination.util.ts

import { PaginationMeta } from './response';

export interface PaginationParams {
  page: number;
  pageSize: number;
  total: number;
}

export function buildPaginationMeta(params: PaginationParams): PaginationMeta {
  const { page, pageSize, total } = params;
  const totalPages = Math.ceil(total / pageSize);

  return {
    page,
    pageSize,
    total,
    totalPages,
  };
}
