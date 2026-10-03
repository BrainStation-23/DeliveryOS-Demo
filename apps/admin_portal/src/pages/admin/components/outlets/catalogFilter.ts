import { AdminCatalog } from '../../../../services/adminApi';

export interface CatalogCategoryView {
  id: string;
  name: string;
  /** Products after the search filter — empty categories drop out entirely. */
  products: AdminCatalog['categories'][number]['products'];
  totalProducts: number;
}

/** Filters the catalog tree by product (or category) name. While searching,
 *  categories with no surviving products drop out; with no search term every
 *  category stays listed — including freshly created empty ones, which must
 *  remain visible (and manageable) on the outlet page. */
export function filterCatalog(
  categories: AdminCatalog['categories'] | undefined,
  query: string,
): CatalogCategoryView[] {
  const term = (query || '').trim().toLowerCase();
  return (categories || [])
    .map((category) => {
      if (!term) {
        return { id: category.id, name: category.name, products: category.products, totalProducts: category.products.length };
      }
      const categoryMatches = category.name.toLowerCase().includes(term);
      const products = categoryMatches
        ? category.products
        : category.products.filter((product) => product.name.toLowerCase().includes(term));
      return { id: category.id, name: category.name, products, totalProducts: category.products.length };
    })
    .filter((category) => !term || category.products.length > 0);
}

/** While searching, collapsed categories must still reveal their matches —
 *  the effective collapsed set is emptied whenever a term is active. */
export function effectiveCollapsed(collapsed: Set<string>, isSearching: boolean): Set<string> {
  return isSearching ? new Set<string>() : collapsed;
}
