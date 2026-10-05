import { describe, expect, it } from 'vitest';
import { AdminCatalog } from '../../../../services/adminApi';
import { effectiveCollapsed, filterCatalog } from './catalogFilter';

const categories: AdminCatalog['categories'] = [
  {
    id: 'cat-1',
    name: 'Signature Burgers',
    sortOrder: 1,
    products: [
      { id: 'p1', name: 'Peri-Peri Chicken Burger', description: null, basePrice: 320, imageUrl: null, isInStock: true, sortOrder: 1, variants: [] },
      { id: 'p2', name: 'Beef Smash Burger', description: null, basePrice: 380, imageUrl: null, isInStock: true, sortOrder: 2, variants: [] },
    ],
  },
  {
    id: 'cat-2',
    name: 'Sides',
    sortOrder: 2,
    products: [
      { id: 'p3', name: 'French Fries', description: null, basePrice: 120, imageUrl: null, isInStock: true, sortOrder: 1, variants: [] },
    ],
  },
];

describe('filterCatalog', () => {
  it('keeps empty categories listed when not searching (fresh categories stay manageable)', () => {
    const withEmpty: AdminCatalog['categories'] = [
      ...categories,
      { id: 'cat-empty', name: 'New Empty Category', sortOrder: 3, products: [] },
    ];
    const view = filterCatalog(withEmpty, '');
    expect(view.map((c) => c.name)).toContain('New Empty Category');
    // …but a search that matches nothing in it drops the dead heading.
    expect(filterCatalog(withEmpty, 'fries').some((c) => c.id === 'cat-empty')).toBe(false);
  });

  it('returns every category with its full product list for an empty query', () => {
    const view = filterCatalog(categories, '');
    expect(view.map((c) => c.name)).toEqual(['Signature Burgers', 'Sides']);
    expect(view[0].products).toHaveLength(2);
    expect(view[0].totalProducts).toBe(2);
  });

  it('matches products case-insensitively and drops categories without matches', () => {
    const view = filterCatalog(categories, 'burger');
    expect(view).toHaveLength(1);
    expect(view[0].name).toBe('Signature Burgers');
    expect(view[0].products.map((p) => p.name)).toEqual(['Peri-Peri Chicken Burger', 'Beef Smash Burger']);
    expect(view[0].totalProducts).toBe(2);
  });

  it('keeps the whole category when the category name itself matches', () => {
    const view = filterCatalog(categories, 'sides');
    expect(view).toHaveLength(1);
    expect(view[0].products).toHaveLength(1);
  });

  it('returns an empty view when nothing matches', () => {
    expect(filterCatalog(categories, 'pizza')).toEqual([]);
  });
});

describe('effectiveCollapsed', () => {
  it('ignores collapsed categories while a search is active', () => {
    const collapsed = new Set(['cat-1', 'cat-2']);
    expect(effectiveCollapsed(collapsed, true).size).toBe(0);
  });

  it('preserves the collapsed set when not searching', () => {
    const collapsed = new Set(['cat-1']);
    expect(effectiveCollapsed(collapsed, false)).toEqual(new Set(['cat-1']));
  });
});
