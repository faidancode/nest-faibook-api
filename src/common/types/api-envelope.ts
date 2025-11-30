export type ApiEnvelope<T> = {
  data: T;
  meta: Record<string, unknown>;
  error: Record<string, unknown>;
  ok: boolean;
};

export type PaginationMeta = {
  total?: number;
  totalPages?: number;
  page?: number;
  limit?: number;
};