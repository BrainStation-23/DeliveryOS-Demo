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

describe('Admin Portal i18n locales symmetry', () => {
  const enKeys = getLeafKeys(en as Record<string, unknown>);
  const bnKeys = getLeafKeys(bn as Record<string, unknown>);
  const arKeys = getLeafKeys(ar as Record<string, unknown>);

  it('contains a populated key catalog in en.json', () => {
    expect(enKeys.length).toBeGreaterThan(20);
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

  it('ensures all statically referenced translation keys in codebase exist in en.json', () => {
    const modules = import.meta.glob<string>('../**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    });

    const keyRegex = /\bt\(\s*['`"]([a-zA-Z0-9_.-]+)['`"]/g;
    const missingKeys: { file: string; key: string }[] = [];

    function getNested(obj: Record<string, unknown>, keyPath: string): unknown {
      const parts = keyPath.split('.');
      let cur: unknown = obj;
      for (const part of parts) {
        if (cur == null || typeof cur !== 'object' || !(part in (cur as Record<string, unknown>))) {
          return undefined;
        }
        cur = (cur as Record<string, unknown>)[part];
      }
      return cur;
    }

    for (const [filePath, content] of Object.entries(modules)) {
      if (filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx')) {
        continue;
      }
      let match: RegExpExecArray | null;
      while ((match = keyRegex.exec(content)) !== null) {
        const key = match[1];
        if (getNested(en as Record<string, unknown>, key) === undefined) {
          missingKeys.push({ file: filePath, key });
        }
      }
    }

    expect(missingKeys).toEqual([]);
  });
});
