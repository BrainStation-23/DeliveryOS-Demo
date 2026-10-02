import { describe, expect, it } from 'vitest';
import {
  VariationDraft,
  createVariationDraft,
  moveVariationUp,
  removeVariation,
  toVariationDrafts,
  validateVariations,
} from './variationsEditor';

const drafts = (n: number): VariationDraft[] =>
  Array.from({ length: n }, (_, i) => ({ name: `V${i + 1}`, price: String(100 * (i + 1)), isInStock: true }));

describe('variationsEditor drafts', () => {
  it('maps server variations into editable drafts', () => {
    const result = toVariationDrafts([
      { id: 'v1', name: 'Single', price: 320, sortOrder: 1, isInStock: true },
      { id: 'v2', name: 'Double', price: 440, sortOrder: 2, isInStock: false },
    ]);
    expect(result).toEqual([
      { id: 'v1', name: 'Single', price: '320', isInStock: true },
      { id: 'v2', name: 'Double', price: '440', isInStock: false },
    ]);
    expect(toVariationDrafts(undefined as never)).toEqual([]);
  });

  it('swaps upward but never moves the first row (product price anchor)', () => {
    expect(moveVariationUp(drafts(3), 0)).toEqual(drafts(3));
    const moved = moveVariationUp(drafts(3), 2);
    expect(moved.map((d) => d.name)).toEqual(['V1', 'V3', 'V2']);
  });

  it('removes rows but protects the first', () => {
    expect(removeVariation(drafts(3), 0)).toEqual(drafts(3));
    expect(removeVariation(drafts(3), 1).map((d) => d.name)).toEqual(['V1', 'V3']);
  });
});

describe('validateVariations', () => {
  it('parses drafts into ordered absolute prices, preserving ids', () => {
    const result = validateVariations([
      { id: 'v1', name: 'Single', price: '320', isInStock: true },
      { name: '  Double  ', price: ' 440 ', isInStock: false },
    ]);
    expect(result.valid).toBe(true);
    expect(result.variations).toEqual([
      { id: 'v1', name: 'Single', price: 320, isInStock: true },
      { name: 'Double', price: 440, isInStock: false },
    ]);
  });

  it('rejects empty editors and blank rows are ignored', () => {
    expect(validateVariations([]).error).toMatch('at least one variation');
    expect(validateVariations([createVariationDraft(), { name: 'Only', price: '50', isInStock: true }].slice(1)).valid).toBe(true);
  });

  it('rejects missing names and invalid prices with the offending variation named', () => {
    expect(validateVariations([{ name: '', price: '50', isInStock: true }]).error).toMatch('name');
    expect(validateVariations([{ name: 'Single', price: 'abc', isInStock: true }]).error).toMatch('Single');
    expect(validateVariations([{ name: 'Single', price: '-5', isInStock: true }]).error).toMatch('Single');
  });
});
