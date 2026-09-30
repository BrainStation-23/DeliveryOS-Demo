import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDateTime, formatPhoneNumber } from './formatters';

describe('formatCurrency', () => {
  it('renders whole amounts with the ৳ symbol and thousands separators', () => {
    expect(formatCurrency(1500)).toBe('৳ 1,500');
    expect(formatCurrency(0)).toBe('৳ 0');
  });

  it('renders two decimals only when explicitly requested', () => {
    expect(formatCurrency(1234.5, { decimals: true })).toBe('৳ 1,234.50');
    expect(formatCurrency(1234.5)).toBe('৳ 1,234.5');
  });

  it('coerces nullish and string inputs to 0 instead of NaN', () => {
    expect(formatCurrency(null)).toBe('৳ 0');
    expect(formatCurrency(undefined)).toBe('৳ 0');
    expect(formatCurrency('not-a-number')).toBe('৳ 0');
  });

  it('accepts numeric strings from API payloads', () => {
    expect(formatCurrency('2500')).toBe('৳ 2,500');
  });
});

describe('formatDateTime', () => {
  it('returns empty string for missing or invalid dates', () => {
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime(undefined)).toBe('');
    expect(formatDateTime('not-a-date')).toBe('');
  });

  it('formats a full date-time by default and respects mode overrides', () => {
    const d = new Date('2026-09-15T14:30:00');
    expect(formatDateTime(d)).toBe('Sep 15, 2026, 2:30 PM');
    expect(formatDateTime(d, 'time')).toMatch(/\d{1,2}:\d{2}/);
    expect(formatDateTime(d, 'date')).not.toContain(':');
  });

  it('accepts ISO strings from the API', () => {
    const result = formatDateTime('2026-09-15T14:30:00Z');
    expect(result).not.toBe('');
  });
});

describe('formatPhoneNumber', () => {
  it('trims whitespace and preserves E.164 format', () => {
    expect(formatPhoneNumber('  +8801700000001  ')).toBe('+8801700000001');
  });

  it('returns empty string for nullish input', () => {
    expect(formatPhoneNumber(null)).toBe('');
    expect(formatPhoneNumber(undefined)).toBe('');
  });
});
