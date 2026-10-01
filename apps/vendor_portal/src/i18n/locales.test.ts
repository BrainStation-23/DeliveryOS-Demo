import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import bn from './locales/bn.json';
import ar from './locales/ar.json';

function getLeafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys = keys.concat(getLeafKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe('Vendor Portal i18n locales symmetry', () => {
  const enKeys = getLeafKeys(en as Record<string, unknown>);
  const bnKeys = getLeafKeys(bn as Record<string, unknown>);
  const arKeys = getLeafKeys(ar as Record<string, unknown>);

  it('contains valid and populated keys in en.json', () => {
    expect(enKeys.length).toBeGreaterThan(100);
  });

  it('ensures Bengali locale has matching keys with English', () => {
    const missingInBn = enKeys.filter((key) => !bnKeys.includes(key));
    const extraInBn = bnKeys.filter((key) => !enKeys.includes(key));

    expect(missingInBn).toEqual([]);
    expect(extraInBn).toEqual([]);
  });

  it('ensures Arabic locale has matching keys with English', () => {
    const missingInAr = enKeys.filter((key) => !arKeys.includes(key));
    const extraInAr = arKeys.filter((key) => !enKeys.includes(key));

    expect(missingInAr).toEqual([]);
    expect(extraInAr).toEqual([]);
  });

  it('ensures all translation leaf values are non-empty strings', () => {
    function assertNonEmpty(obj: Record<string, unknown>, lang: string, prefix = '') {
      for (const [key, val] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          assertNonEmpty(val as Record<string, unknown>, lang, fullKey);
        } else {
          expect(typeof val, `${lang}:${fullKey} should be a string`).toBe('string');
          expect((val as string).trim().length, `${lang}:${fullKey} must not be empty`).toBeGreaterThan(0);
        }
      }
    }

    assertNonEmpty(en as Record<string, unknown>, 'en');
    assertNonEmpty(bn as Record<string, unknown>, 'bn');
    assertNonEmpty(ar as Record<string, unknown>, 'ar');
  });
});
