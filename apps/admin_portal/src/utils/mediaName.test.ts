import { describe, expect, it } from 'vitest';
import { defaultMediaNameForFile, normalizeMediaName } from './mediaName';

describe('normalizeMediaName', () => {
  it('trims whitespace and collapses repeated spaces', () => {
    expect(normalizeMediaName('  Weekend   Feast  ', 'fallback')).toBe('Weekend Feast');
  });

  it('strips path separators and newlines so names stay single-line and safe', () => {
    expect(normalizeMediaName('../../etc/passwd\nroot/x', 'fallback')).toBe('.. .. etc passwd root x');
  });

  it('caps length at 255 characters', () => {
    expect(normalizeMediaName('a'.repeat(400), 'fallback')).toHaveLength(255);
  });

  it('falls back when the input is empty or only separators', () => {
    expect(normalizeMediaName('', 'Hero Banner')).toBe('Hero Banner');
    expect(normalizeMediaName('   ', 'Hero Banner')).toBe('Hero Banner');
  });
});

describe('defaultMediaNameForFile', () => {
  it('strips the extension from a plain file name', () => {
    expect(defaultMediaNameForFile('IMG_20261002_142331.jpg')).toBe('IMG_20261002_142331');
    expect(defaultMediaNameForFile('hero banner.png')).toBe('hero banner');
  });

  it('handles dotted stems, path prefixes, and empty input', () => {
    expect(defaultMediaNameForFile('my.photo.v2.webp')).toBe('my.photo.v2');
    expect(defaultMediaNameForFile('/uploads/ledger.csv')).toBe('ledger');
    expect(defaultMediaNameForFile('')).toBe('Untitled image');
    expect(defaultMediaNameForFile('.hidden')).toBe('Untitled image');
  });
});
