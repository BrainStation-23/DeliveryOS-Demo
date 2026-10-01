import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Search,
  CheckCircle2,
  XCircle,
  Tag,
  RefreshCw,
  X,
  UtensilsCrossed,
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
import {
  StockToggleConfirmModal,
  PendingStockToggle,
} from './components/StockToggleConfirmModal';

export const VendorCatalogPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeOutletId, outlets } = useVendorOutlet();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [pendingToggle, setPendingToggle] = useState<PendingStockToggle | null>(null);

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

  const isPendingMutation = productStockMutation.isPending || variantStockMutation.isPending;

  const handleInitiateProductToggle = (product: { id: string; name: string; isInStock: boolean }) => {
    setPendingToggle({
      type: 'PRODUCT',
      id: product.id,
      name: product.name,
      currentInStock: product.isInStock,
      nextInStock: !product.isInStock,
    });
  };

  const handleInitiateVariantToggle = (
    productName: string,
    variant: { id: string; name: string; isInStock: boolean }
  ) => {
    setPendingToggle({
      type: 'VARIANT',
      id: variant.id,
      name: variant.name,
      parentName: productName,
      currentInStock: variant.isInStock,
      nextInStock: !variant.isInStock,
    });
  };

  const handleConfirmStockToggle = () => {
    if (!pendingToggle) return;
    if (pendingToggle.type === 'PRODUCT') {
      productStockMutation.mutate(
        { productId: pendingToggle.id, isInStock: pendingToggle.nextInStock },
        { onSettled: () => setPendingToggle(null) }
      );
    } else {
      variantStockMutation.mutate(
        { variantId: pendingToggle.id, isInStock: pendingToggle.nextInStock },
        { onSettled: () => setPendingToggle(null) }
      );
    }
  };

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
      const q = (searchQuery || '').trim().toLowerCase();
      const matchingProducts = catProducts.filter((p) => {
        if (!p) return false;
        const matchesQuery =
          !q ||
          Boolean((p.name || '').toLowerCase().includes(q)) ||
          Boolean(p.description && p.description.toLowerCase().includes(q));
        if (!matchesQuery) return false;

        if (stockFilter === 'IN_STOCK') return Boolean(p.isInStock);
        if (stockFilter === 'OUT_OF_STOCK') return !p.isInStock;
        return true;
      });
      return { ...cat, products: matchingProducts };
    })
    .filter((cat): cat is typeof categories[0] => cat !== null && cat.products.length > 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={t('catalog.title')}
        description={t('catalog.description')}
        icon={<UtensilsCrossed className="h-5 w-5 text-amber-500" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            {t('common.refresh')}
          </Button>
        }
      />

      {/* Row 1: Search and Availability Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Input
            placeholder={t('catalog.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4 text-slate-400" />}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Stock Status Filter Buttons */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0 bg-slate-100 p-1.5 rounded-xl border border-slate-200 dark:bg-slate-800/80 dark:border-slate-700/80">
          <button
            type="button"
            onClick={() => setStockFilter('ALL')}
            className={`inline-flex items-center gap-2 h-9 px-3.5 sm:px-4 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer ${
              stockFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span>{t('catalog.allItems')}</span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                stockFilter === 'ALL'
                  ? 'bg-slate-100 text-slate-800 dark:bg-slate-600 dark:text-slate-100'
                  : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {allProducts.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStockFilter('IN_STOCK')}
            className={`inline-flex items-center gap-2 h-9 px-3.5 sm:px-4 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer ${
              stockFilter === 'IN_STOCK'
                ? 'bg-white text-emerald-700 shadow-xs dark:bg-slate-700 dark:text-emerald-400'
                : 'text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{t('catalog.inStock')}</span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                stockFilter === 'IN_STOCK'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                  : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {totalInStock}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStockFilter('OUT_OF_STOCK')}
            className={`inline-flex items-center gap-2 h-9 px-3.5 sm:px-4 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer ${
              stockFilter === 'OUT_OF_STOCK'
                ? 'bg-white text-rose-700 shadow-xs dark:bg-slate-700 dark:text-rose-400'
                : 'text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400'
            }`}
          >
            <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            <span>{t('catalog.soldOut')}</span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                stockFilter === 'OUT_OF_STOCK'
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                  : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {totalOutOfStock}
            </span>
          </button>
        </div>
      </div>

      {/* Row 2: Category Filter Pills (Non-Scrollable, Natural Wrap) */}
      <div className="border-y border-slate-100 dark:border-slate-800/80 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`inline-flex items-center gap-2 h-9 px-3.5 sm:px-4 rounded-xl text-xs font-semibold transition-all select-none cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 shadow-xs'
            }`}
          >
            <span>{t('catalog.allCategories')}</span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                selectedCategory === 'ALL'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {categories.length}
            </span>
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-2 h-9 px-3.5 sm:px-4 rounded-xl text-xs font-semibold transition-all select-none cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 shadow-xs'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {cat.products.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="py-20">
          <LoadingSpinner size="lg" label={t('common.loading')} />
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <Layers className="mx-auto h-10 w-10 text-slate-400 mb-2.5" />
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{t('catalog.noProducts')}</h4>
          {(searchQuery || selectedCategory !== 'ALL' || stockFilter !== 'ALL') && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setStockFilter('ALL');
                }}
              >
                {t('catalog.clearFilter')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredCategories.map((category) => (
            <div key={category.id} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                <Tag className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {category.name}
                </h3>
                <span className="text-xs text-slate-400 font-medium">({category.products.length})</span>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                {category.products.map((product) => (
                  <div
                    key={product.id}
                    className={`rounded-xl border p-3.5 sm:p-4 transition-all flex flex-col justify-between ${
                      product.isInStock
                        ? 'border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900'
                        : 'border-rose-200 bg-rose-50/20 opacity-80 dark:border-rose-950 dark:bg-rose-950/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 pr-1">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug truncate">
                            {product.name}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                            {product.description || t('catalog.standardRecipe')}
                          </p>
                          <span className="mt-2 inline-block text-xs font-bold text-amber-600 dark:text-amber-400">
                            ৳ {product.basePrice}
                          </span>
                        </div>

                        <div className="shrink-0 pt-0.5">
                          <StockToggleSwitch
                            size="md"
                            isInStock={product.isInStock}
                            onToggle={() => handleInitiateProductToggle(product)}
                            isLoading={
                              productStockMutation.isPending &&
                              productStockMutation.variables?.productId === product.id
                            }
                            ariaLabel={`${product.name}`}
                          />
                        </div>
                      </div>

                      {product.variants && product.variants.length > 0 && (
                        <div className="mt-3.5 border-t border-slate-100 pt-2.5 space-y-1.5 dark:border-slate-800">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            {t('catalog.variants')}
                          </span>
                          {product.variants.map((variant) => (
                            <div
                              key={variant.id}
                              className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60"
                            >
                              <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[140px]">
                                {variant.name}{' '}
                                {variant.priceDelta !== 0 && (
                                  <span className="text-slate-400 font-normal">
                                    ({variant.priceDelta > 0 ? '+' : ''}৳{variant.priceDelta})
                                  </span>
                                )}
                              </span>
                              <div className="shrink-0">
                                <StockToggleSwitch
                                  size="sm"
                                  isInStock={variant.isInStock}
                                  onToggle={() =>
                                    handleInitiateVariantToggle(product.name, variant)
                                  }
                                  isLoading={
                                    variantStockMutation.isPending &&
                                    variantStockMutation.variables?.variantId === variant.id
                                  }
                                  ariaLabel={`${product.name} ${variant.name}`}
                                />
                              </div>
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

      <StockToggleConfirmModal
        pendingToggle={pendingToggle}
        onClose={() => {
          if (!isPendingMutation) setPendingToggle(null);
        }}
        onConfirm={handleConfirmStockToggle}
        isLoading={isPendingMutation}
      />
    </div>
  );
};
