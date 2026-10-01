import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Search,
  CheckCircle2,
  XCircle,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useVendorOutlet } from '../../contexts/VendorOutletContext';
import kdsApi from '../../services/kdsApi';
import { OutletCatalog } from '../../types/kds';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { StockToggleSwitch } from '../../components/common/StockToggleSwitch';

export const VendorCatalogPage: React.FC = () => {
  const { user } = useAuth();
  const { activeOutletId, outlets } = useVendorOutlet();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const vendorId =
    activeOutletId && activeOutletId !== 'ALL'
      ? activeOutletId
      : outlets[0]?.id || user?.vendorId || '';

  const { data: catalog, isLoading, refetch } = useQuery<OutletCatalog>({
    queryKey: ['vendor-catalog', vendorId],
    queryFn: () => kdsApi.getOutletCatalog(vendorId),
    enabled: !!vendorId,
  });

  const productStockMutation = useMutation({
    mutationFn: ({ productId, isInStock }: { productId: string; isInStock: boolean }) =>
      kdsApi.toggleProductStock(productId, isInStock),
    onMutate: async ({ productId, isInStock }) => {
      await queryClient.cancelQueries({ queryKey: ['vendor-catalog', vendorId] });
      const previous = queryClient.getQueryData<OutletCatalog>(['vendor-catalog', vendorId]);

      if (previous && Array.isArray(previous.categories)) {
        queryClient.setQueryData<OutletCatalog>(['vendor-catalog', vendorId], {
          ...previous,
          categories: previous.categories.map((cat) => ({
            ...cat,
            products: (Array.isArray(cat.products) ? cat.products : []).map((p) =>
              p.id === productId ? { ...p, isInStock } : p
            ),
          })),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['vendor-catalog', vendorId], context.previous);
      }
    },
  });

  const variantStockMutation = useMutation({
    mutationFn: ({ variantId, isInStock }: { variantId: string; isInStock: boolean }) =>
      kdsApi.toggleVariantStock(variantId, isInStock),
    onMutate: async ({ variantId, isInStock }) => {
      await queryClient.cancelQueries({ queryKey: ['vendor-catalog', vendorId] });
      const previous = queryClient.getQueryData<OutletCatalog>(['vendor-catalog', vendorId]);

      if (previous && Array.isArray(previous.categories)) {
        queryClient.setQueryData<OutletCatalog>(['vendor-catalog', vendorId], {
          ...previous,
          categories: previous.categories.map((cat) => ({
            ...cat,
            products: (Array.isArray(cat.products) ? cat.products : []).map((p) => ({
              ...p,
              variants: (Array.isArray(p.variants) ? p.variants : []).map((v) =>
                v.id === variantId ? { ...v, isInStock } : v
              ),
            })),
          })),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['vendor-catalog', vendorId], context.previous);
      }
    },
  });

  const categories = Array.isArray(catalog?.categories) ? catalog.categories : [];
  const allProducts = categories.flatMap((c) => (Array.isArray(c?.products) ? c.products : []));
  const totalInStock = allProducts.filter((p) => Boolean(p && p.isInStock)).length;
  const totalOutOfStock = allProducts.filter((p) => Boolean(p && !p.isInStock)).length;

  const filteredCategories = categories
    .map((cat) => {
      if (!cat) return null;
      if (selectedCategory !== 'ALL' && cat.id !== selectedCategory) {
        return null;
      }
      const catProducts = Array.isArray(cat.products) ? cat.products : [];
      const q = (searchQuery || '').toLowerCase();
      const matchingProducts = catProducts.filter(
        (p) =>
          Boolean(p && (p.name || '').toLowerCase().includes(q)) ||
          Boolean(p && p.description && p.description.toLowerCase().includes(q))
      );
      return { ...cat, products: matchingProducts };
    })
    .filter((cat): cat is typeof categories[0] => cat !== null && cat.products.length > 0);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Menu & Stock Control"
        description="Toggle live dish availability to prevent orders for 86'd items"
        badge={
          <Badge variant="primary" size="md">
            {allProducts.length} Items
          </Badge>
        }
        actions={
          <>
            <Badge variant="success" size="md">
              <CheckCircle2 className="h-3 w-3 mr-1" /> {totalInStock} In Stock
            </Badge>
            {totalOutOfStock > 0 && (
              <Badge variant="danger" size="md">
                <XCircle className="h-3 w-3 mr-1" /> {totalOutOfStock} Sold Out
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
          </>
        }
      />

      {/* Filter and Category Pills */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search items or variants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-3.5 w-3.5" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`inline-flex items-center justify-center h-8 rounded-lg px-3 text-xs font-semibold transition-all select-none ${
              selectedCategory === 'ALL'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`inline-flex items-center justify-center h-8 rounded-lg px-3 text-xs font-semibold transition-all select-none ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {cat.name} ({cat.products.length})
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-20">
          <LoadingSpinner size="lg" label="Loading menu items..." />
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <Layers className="mx-auto h-10 w-10 text-slate-400 mb-2.5" />
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">No items match your filter</h4>
          <p className="text-xs text-slate-500 mt-1">Try searching for a different dish name or reset category selection</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredCategories.map((category) => (
            <div key={category.id} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                <Tag className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {category.name}
                </h3>
                <span className="text-xs text-slate-400 font-medium">({category.products.length} items)</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {category.products.map((product) => (
                  <div
                    key={product.id}
                    className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                      product.isInStock
                        ? 'border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900'
                        : 'border-rose-200 bg-rose-50/20 opacity-80 dark:border-rose-950 dark:bg-rose-950/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug truncate">
                            {product.name}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                            {product.description || 'Standard outlet recipe'}
                          </p>
                          <span className="mt-1.5 inline-block text-xs font-bold text-amber-600 dark:text-amber-400">
                            ৳ {product.basePrice}
                          </span>
                        </div>

                        <div className="shrink-0">
                          <StockToggleSwitch
                            size="md"
                            isInStock={product.isInStock}
                            onToggle={(nextState) =>
                              productStockMutation.mutate({
                                productId: product.id,
                                isInStock: nextState,
                              })
                            }
                            isLoading={
                              productStockMutation.isPending &&
                              productStockMutation.variables?.productId === product.id
                            }
                            ariaLabel={`Toggle stock availability for ${product.name}`}
                          />
                        </div>
                      </div>

                      {product.variants && product.variants.length > 0 && (
                        <div className="mt-3 border-t border-slate-100 pt-2.5 space-y-1.5 dark:border-slate-800">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Variants:
                          </span>
                          {product.variants.map((variant) => (
                            <div
                              key={variant.id}
                              className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/60"
                            >
                              <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[140px]">
                                {variant.name}{' '}
                                {variant.priceDelta !== 0 && (
                                  <span className="text-slate-400 font-normal">
                                    ({variant.priceDelta > 0 ? '+' : ''}৳{variant.priceDelta})
                                  </span>
                                )}
                              </span>
                              <StockToggleSwitch
                                size="sm"
                                isInStock={variant.isInStock}
                                onToggle={(nextState) =>
                                  variantStockMutation.mutate({
                                    variantId: variant.id,
                                    isInStock: nextState,
                                  })
                                }
                                isLoading={
                                  variantStockMutation.isPending &&
                                  variantStockMutation.variables?.variantId === variant.id
                                }
                                ariaLabel={`Toggle stock for ${product.name} ${variant.name}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
