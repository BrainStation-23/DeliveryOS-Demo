import type { PixelCrop } from 'react-image-crop';

export interface CropAspectPreset {
  id: string;
  label: string;
  /** Undefined = free-form selection. */
  value?: number;
}

export const CROP_ASPECT_PRESETS: CropAspectPreset[] = [
  { id: 'FREE', label: 'Free' },
  { id: 'WIDE', label: '16:9', value: 16 / 9 },
  { id: 'CLASSIC', label: '4:3', value: 4 / 3 },
  { id: 'SQUARE', label: '1:1', value: 1 },
];

export interface ResizeCap {
  id: string;
  label: string;
  /** Undefined = keep the cropped pixel dimensions. */
  maxDimension?: number;
}

export const RESIZE_CAPS: readonly ResizeCap[] = [
  { id: 'ORIGINAL', label: 'Original size' },
  { id: 'PX_1920', label: 'Max 1920px', maxDimension: 1920 },
  { id: 'PX_1280', label: 'Max 1280px', maxDimension: 1280 },
  { id: 'PX_800', label: 'Max 800px', maxDimension: 800 },
];

export interface ResizedDimensions {
  width: number;
  height: number;
}

/** Proportionally caps the longest edge at maxDimension; never upscales. */
export function computeResizedDimensions(
  width: number,
  height: number,
  maxDimension?: number,
): ResizedDimensions {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }
  const longest = Math.max(width, height);
  if (!maxDimension || maxDimension <= 0 || longest <= maxDimension) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Canvas export mapping: GIF re-encodes as PNG (canvas cannot emit animation),
 * PNG keeps its transparency support, everything else passes through.
 */
export function exportMimeType(sourceMime: string): 'image/png' | 'image/jpeg' | 'image/webp' {
  if (sourceMime === 'image/png' || sourceMime === 'image/webp') return sourceMime;
  return 'image/jpeg';
}

/** Lossless formats ignore the quality hint; lossy ones use a high-quality target. */
export function exportQuality(mimeType: string): number | undefined {
  return mimeType === 'image/jpeg' || mimeType === 'image/webp' ? 0.92 : undefined;
}

export interface CroppedImage {
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
}

export async function cropImageToBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
  sourceMimeType: string,
  maxDimension?: number,
): Promise<CroppedImage> {
  const dims = computeResizedDimensions(crop.width, crop.height, maxDimension);
  if (dims.width === 0 || dims.height === 0) {
    throw new Error('The selected crop area is empty');
  }

  const canvas = document.createElement('canvas');
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas rendering is unavailable in this browser');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, dims.width, dims.height);

  const mimeType = exportMimeType(sourceMimeType);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, exportQuality(mimeType)),
  );
  if (!blob) {
    throw new Error('Failed to encode the cropped image');
  }
  return { blob, width: dims.width, height: dims.height, mimeType };
}
