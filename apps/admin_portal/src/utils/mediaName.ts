/**
 * Library display-name handling for media uploads. The name is metadata only
 * (the stored filename is server-generated), but it powers library search, so
 * it is trimmed, path-safe, and capped before leaving the browser.
 */
export function normalizeMediaName(raw: string, fallback: string): string {
  const cleaned = (raw || '')
    .replace(/[\r\n/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 255);
  return cleaned || fallback.slice(0, 255);
}

/** Derives the default library name from an uploaded file (extension stripped). */
export function defaultMediaNameForFile(fileName: string): string {
  const base = (fileName || '').split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : dot === 0 ? '' : base;
  return stem.trim() || 'Untitled image';
}
