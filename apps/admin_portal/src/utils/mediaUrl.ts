/**
 * Media URLs are persisted relative (`/uploads/...`) so assets stay portable
 * across hosts. Rendering resolves them against the API base only when the
 * portals are deployed split-origin; same-origin edge/dev proxies serve them
 * untouched.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url || !url.startsWith('/')) return url || '';
  const base = (import.meta.env.VITE_API_URL as string | undefined) || '';
  if (!base) return url;
  return `${base.replace(/\/$/, '')}${url}`;
}
