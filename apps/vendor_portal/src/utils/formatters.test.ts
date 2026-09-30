import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDateTime, formatTime, isSameDay } from './formatters';

describe('formatCurrency', () => {
  it('renders amounts with the ৳ symbol and thousands separators', () => {
    expect(formatCurrency(1500)).toBe('৳ 1,500');
    expect(formatCurrency(0)).toBe('৳ 0');
  });

  it('coerces nullish and non-numeric input to 0 instead of NaN', () => {
    expect(formatCurrency(null)).toBe('৳ 0');
    expect(formatCurrency(undefined)).toBe('৳ 0');
    expect(formatCurrency('garbage')).toBe('৳ 0');
  });

  it('accepts numeric strings from API payloads', () => {
    expect(formatCurrency('2500')).toBe('৳ 2,500');
  });
});

describe('formatDateTime', () => {
  it('returns empty string for missing or invalid dates', () => {
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime('not-a-date')).toBe('');
  });

  it('formats an ISO string into a medium date + short time', () => {
    const result = formatDateTime(new Date('2026-09-15T14:30:00'));
    expect(result).toBe('Sep 15, 2026, 2:30 PM');
  });
});

describe('formatTime', () => {
  it('returns empty string for missing or invalid input', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime('invalid')).toBe('');
  });

  it('extracts a short clock time', () => {
    expect(formatTime(new Date('2026-09-15T14:30:00'))).toMatch(/\d{1,2}:30/);
  });
});

describe('isSameDay', () => {
  it('is true only when year, month, and date all match', () => {
    expect(isSameDay(new Date(2026, 8, 15, 9, 0), new Date(2026, 8, 15, 23, 59))).toBe(true);
    expect(isSameDay(new Date(2026, 8, 15), new Date(2026, 8, 16))).toBe(false);
    expect(isSameDay(new Date(2026, 8, 15), new Date(2027, 8, 15))).toBe(false);
    expect(isSameDay(new Date(2026, 8, 15), new Date(2026, 9, 15))).toBe(false);
  });
});
