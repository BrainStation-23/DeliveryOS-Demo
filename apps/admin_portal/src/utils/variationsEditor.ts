import { AdminProductVariation } from '../services/adminApi';

export interface VariationDraft {
  id?: string;
  name: string;
  price: string;
  isInStock: boolean;
}

/**
 * Draft rows for the variations editor. Prices stay strings while editing;
 * the first row is the product price (ADR-017) and is never removable.
 */
export function toVariationDrafts(variants: AdminProductVariation[]): VariationDraft[] {
  return (Array.isArray(variants) ? variants : []).map((v) => ({
    id: v.id,
    name: v.name,
    price: String(v.price),
    isInStock: v.isInStock,
  }));
}

export function createVariationDraft(): VariationDraft {
  return { name: '', price: '', isInStock: true };
}

export function moveVariationUp(drafts: VariationDraft[], index: number): VariationDraft[] {
  if (index <= 0 || index >= drafts.length) return drafts;
  const next = [...drafts];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return next;
}

export function removeVariation(drafts: VariationDraft[], index: number): VariationDraft[] {
  if (index <= 0 || index >= drafts.length) return drafts; // first row is the product price
  return drafts.filter((_, i) => i !== index);
}

export interface VariationValidation {
  valid: boolean;
  error?: string;
  variations: Array<{ id?: string; name: string; price: number; isInStock: boolean }>;
}

/** Parses + validates drafts; index 0 becomes the product price. */
export function validateVariations(drafts: VariationDraft[]): VariationValidation {
  const cleaned = drafts
    .map((d) => ({ ...d, name: d.name.trim(), price: d.price.trim() }))
    .filter((d) => d.name !== '' || d.price !== '');

  if (cleaned.length === 0) {
    return { valid: false, error: 'Add at least one variation — the first one sets the product price.', variations: [] };
  }

  const variations: VariationValidation['variations'] = [];
  for (const draft of cleaned) {
    if (!draft.name) {
      return { valid: false, error: 'Every variation needs a name.', variations: [] };
    }
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price < 0) {
      return { valid: false, error: `“${draft.name}” needs a valid non-negative price.`, variations: [] };
    }
    variations.push({ ...(draft.id ? { id: draft.id } : {}), name: draft.name, price, isInStock: draft.isInStock });
  }

  return { valid: true, variations };
}
