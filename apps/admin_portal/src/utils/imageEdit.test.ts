import { describe, expect, it } from 'vitest';
import {
  CROP_ASPECT_PRESETS,
  RESIZE_CAPS,
  computeResizedDimensions,
  exportMimeType,
  exportQuality,
} from './imageEdit';

describe('computeResizedDimensions', () => {
  it('keeps dimensions untouched when no cap applies', () => {
    expect(computeResizedDimensions(1600, 900)).toEqual({ width: 1600, height: 900 });
    expect(computeResizedDimensions(1600, 900, 1920)).toEqual({ width: 1600, height: 900 });
    expect(computeResizedDimensions(400, 300, 1920)).toEqual({ width: 400, height: 300 });
  });

  it('scales down proportionally to the longest edge and never upscales', () => {
    expect(computeResizedDimensions(3840, 2160, 1920)).toEqual({ width: 1920, height: 1080 });
    expect(computeResizedDimensions(900, 1800, 1280)).toEqual({ width: 640, height: 1280 });
    expect(computeResizedDimensions(5000, 100, 800)).toEqual({ width: 800, height: 16 });
  });

  it('clamps to at least one pixel on extreme aspect ratios', () => {
    expect(computeResizedDimensions(10000, 3, 800)).toEqual({ width: 800, height: 1 });
  });

  it('returns zeroed dimensions for degenerate inputs', () => {
    expect(computeResizedDimensions(0, 100)).toEqual({ width: 0, height: 0 });
    expect(computeResizedDimensions(NaN, 100, 800)).toEqual({ width: 0, height: 0 });
    expect(computeResizedDimensions(-5, 100)).toEqual({ width: 0, height: 0 });
  });
});

describe('exportMimeType', () => {
  it('passes through canvas-safe lossless types', () => {
    expect(exportMimeType('image/png')).toBe('image/png');
    expect(exportMimeType('image/webp')).toBe('image/webp');
  });

  it('maps everything else to JPEG, including animated GIFs', () => {
    expect(exportMimeType('image/gif')).toBe('image/jpeg');
    expect(exportMimeType('image/jpeg')).toBe('image/jpeg');
    expect(exportMimeType('application/octet-stream')).toBe('image/jpeg');
  });
});

describe('exportQuality', () => {
  it('uses a high-quality target only for lossy encodings', () => {
    expect(exportQuality('image/jpeg')).toBe(0.92);
    expect(exportQuality('image/webp')).toBe(0.92);
    expect(exportQuality('image/png')).toBeUndefined();
  });
});

describe('preset catalogs', () => {
  it('exposes a free-form option plus fixed aspect ratios', () => {
    expect(CROP_ASPECT_PRESETS[0]).toEqual({ id: 'FREE', label: 'Free' });
    expect(CROP_ASPECT_PRESETS.filter((p) => p.value !== undefined)).toHaveLength(3);
  });

  it('exposes an original-size option plus descending pixel caps', () => {
    expect(RESIZE_CAPS[0].maxDimension).toBeUndefined();
    const caps = RESIZE_CAPS.map((c) => c.maxDimension ?? Infinity);
    expect(caps).toEqual([...caps].sort((a, b) => b - a));
  });
});
