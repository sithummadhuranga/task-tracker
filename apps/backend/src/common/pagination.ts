export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// totalPages floors at 1 even when total is 0 — an empty result set is still "page 1 of 1", not
// "page 1 of 0", which read as a broken response (and forced a client-side Math.max patch before
// this was shared between the tasks and users list endpoints).
export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) };
}
