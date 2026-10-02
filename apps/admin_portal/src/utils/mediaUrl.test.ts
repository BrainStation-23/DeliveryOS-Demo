import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveMediaUrl } from './mediaUrl';

describe('resolveMediaUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns absolute URLs untouched', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');
    expect(resolveMediaUrl('https://images.unsplash.com/photo-1?w=600')).toBe(
      'https://images.unsplash.com/photo-1?w=600',
    );
    expect(resolveMediaUrl('http://cdn.example.org/banner.png')).toBe('http://cdn.example.org/banner.png');
  });

  it('keeps relative URLs same-origin when no API base is configured (edge/dev proxy)', () => {
    vi.stubEnv('VITE_API_URL', '');
    expect(resolveMediaUrl('/uploads/2026-10-02-banner.png')).toBe('/uploads/2026-10-02-banner.png');
  });

  it('prefixes the API base for relative URLs on split-origin deployments', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.deliveryos.example/');
    expect(resolveMediaUrl('/uploads/banner.png')).toBe('https://api.deliveryos.example/uploads/banner.png');
  });

  it('tolerates null/empty input', () => {
    expect(resolveMediaUrl(null)).toBe('');
    expect(resolveMediaUrl('')).toBe('');
  });
});
