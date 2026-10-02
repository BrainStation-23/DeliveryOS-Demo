import apiClient from '../apiClient';

export default apiClient;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Strips the `{ success, data }` response envelope (tolerating a bare body). */
export function unwrapData<T>(res: { data: unknown }): T {
  const body = res.data as { data?: unknown } | undefined;
  return ((body?.data ?? body) as T);
}

/** Normalizes list payloads that historically arrived as array | {items} | {data}. */
export function normalizeArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray((payload as { items?: unknown } | null)?.items)) {
    return (payload as { items: T[] }).items;
  }
  if (Array.isArray((payload as { data?: unknown } | null)?.data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

export function toPaginated<T>(payload: unknown, fallbackPage: number, fallbackLimit: number): Paginated<T> {
  const body = (payload as Partial<Paginated<T>> | null) ?? {};
  const items = Array.isArray(body.items) ? body.items : [];
  const total = typeof body.total === 'number' ? body.total : items.length;
  const limit = typeof body.limit === 'number' ? body.limit : fallbackLimit;
  return {
    items,
    total: Math.max(0, total),
    page: typeof body.page === 'number' ? body.page : fallbackPage,
    limit,
    totalPages:
      typeof body.totalPages === 'number' ? body.totalPages : Math.max(1, Math.ceil(total / limit)),
  };
}
