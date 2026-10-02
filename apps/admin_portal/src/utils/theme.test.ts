import { describe, expect, it } from 'vitest';
import { parseStoredTheme, toggleTheme } from './theme';

describe('parseStoredTheme', () => {
  it('accepts the two persisted theme values', () => {
    expect(parseStoredTheme('dark')).toBe('dark');
    expect(parseStoredTheme('light')).toBe('light');
  });

  it('falls back to light for null, missing, or corrupted values', () => {
    expect(parseStoredTheme(null)).toBe('light');
    expect(parseStoredTheme('')).toBe('light');
    expect(parseStoredTheme('DARK')).toBe('light');
    expect(parseStoredTheme('anything-else')).toBe('light');
  });
});

describe('toggleTheme', () => {
  it('flips between the two modes', () => {
    expect(toggleTheme('light')).toBe('dark');
    expect(toggleTheme('dark')).toBe('light');
  });
});
