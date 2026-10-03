import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FolderPlus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { AdminCatalog, AdminCatalogProduct } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { EmptyState } from '../../../../components/common/EmptyState';
import { resolveMediaUrl } from '../../../../utils/mediaUrl';
import { formatCurrency } from '../../../../utils/formatters';
import { effectiveCollapsed, filterCatalog } from './catalogFilter';

export interface OutletCatalogSectionProps {
  categories: AdminCatalog['categories'];
  onEditProduct: (product: AdminCatalogProduct) => void;
  /** Opens the product dialog in create mode; a preset category skips its picker. */
  onCreateProduct: (categoryId: string | undefined) => void;
  onDeleteProduct: (product: AdminCatalogProduct) => void;
  onCreateCategory: () => void;
  onEditCategory: (category: { id: string; name: string }) => void;
  /** Requested only for product-less categories; the caller confirm-gates. */
  onDeleteCategory: (category: { id: string; name: string }) => void;
}

/**
 * Outlet catalog board: product/category search, collapsible category groups
 * (auto-expanded while searching), and lean product rows with edit + delete.
 */
export const OutletCatalogSection: React.FC<OutletCatalogSectionProps> = ({
  categories,
  onEditProduct,
  onCreateProduct,
  onDeleteProduct,
  onCreateCategory,
  onEditCategory,
  onDeleteCategory,
}) => {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const term = search.trim();
  const isSearching = term.length > 0;
  const visibleCategories = useMemo(() => filterCatalog(categories, search), [categories, search]);
  const collapsedNow = effectiveCollapsed(collapsed, isSearching);

  const toggleCategory = (categoryId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const totalProducts = (categories || []).reduce((sum, category) => sum + category.products.length, 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Catalog</h3>
          <p className="text-[11px] text-slate-400">
            {totalProducts} products · {(categories || []).length} categories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search products or categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-xs h-8"
            onClick={() => onCreateProduct(undefined)}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            Product
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-xs h-8"
            onClick={onCreateCategory}
            leftIcon={<FolderPlus className="h-3.5 w-3.5" />}
          >
            Category
          </Button>
        </div>
      </div>

      {(categories || []).length === 0 ? (
        <EmptyState
          message="No menu categories yet — create the first product to get started."
          action={
            <Button size="sm" onClick={() => onCreateProduct(undefined)} leftIcon={<Plus className="h-4 w-4" />}>
              New Product
            </Button>
          }
        />
      ) : visibleCategories.length === 0 ? (
        <p className="py-8 text-center text-xs text-slate-400">
          No products match “{term}”.
        </p>
      ) : (
        <div className="space-y-2.5">
          {visibleCategories.map((category) => {
            const isCollapsed = collapsedNow.has(category.id);
            return (
              <div key={category.id} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50/70 dark:bg-slate-800/40">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center gap-2 text-left cursor-pointer min-w-0"
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 truncate">
                      {category.name}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {category.products.length}
                      {category.products.length !== category.totalProducts ? ` of ${category.totalProducts}` : ''}
                    </span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onDeleteCategory({ id: category.id, name: category.name })}
                      disabled={category.totalProducts > 0}
                      className={`rounded-lg p-1 transition-colors ${
                        category.totalProducts > 0
                          ? 'text-slate-200 cursor-not-allowed dark:text-slate-700'
                          : 'text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 cursor-pointer'
                      }`}
                      title={
                        category.totalProducts > 0
                          ? `Category has ${category.totalProducts} product(s) — move or delete them first`
                          : 'Delete category'
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditCategory({ id: category.id, name: category.name })}
                      className="rounded-lg p-1 text-slate-300 hover:bg-slate-200 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                      title="Rename category"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onCreateProduct(category.id)}
                      className="text-[11px] font-semibold text-primary-600 hover:underline cursor-pointer dark:text-primary-400"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {category.products.length === 0 ? (
                      <div className="px-3.5 py-3 text-xs text-slate-400 italic">No products in this category.</div>
                    ) : (
                      category.products.map((product) => (
                        <div
                          key={product.id}
                          className="w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => onEditProduct(product)}
                            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer flex-1"
                          >
                            {product.imageUrl && (
                              <img
                                src={resolveMediaUrl(product.imageUrl)}
                                alt={product.name}
                                className="h-8 w-8 rounded-lg object-cover shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {product.name}
                                </span>
                                {!product.isInStock && <Badge variant="danger">Out</Badge>}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {product.variants.length} variation{product.variants.length === 1 ? '' : 's'}
                              </div>
                            </div>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {formatCurrency(product.variants[0]?.price ?? 0)}
                            </span>
                            <button
                              type="button"
                              onClick={() => onDeleteProduct(product)}
                              className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                              title="Delete product"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
