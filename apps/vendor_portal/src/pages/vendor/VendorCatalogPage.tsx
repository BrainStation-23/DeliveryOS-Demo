import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Tag, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useVendorOutlet } from '../../contexts/VendorOutletContext';
import kdsApi from '../../services/kdsApi';
import { OutletCatalog, Product } from '../../types/kds';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import {
  StockToggleConfirmModal,
  PendingStockToggle,
} from './components/StockToggleConfirmModal';
import {
  CatalogFilterToolbar,
  StockFilterType,
} from './components/catalog/CatalogFilterToolbar';
import { CategoryFilterBar } from './components/catalog/CategoryFilterBar';
import { CatalogProductCard } from './components/catalog/CatalogProductCard';

export const VendorCatalogPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeOutletId, outlets } = useVendorOutlet();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<StockFilterType>('ALL');
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

      <CatalogFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        stockFilter={stockFilter}
        onStockFilterChange={setStockFilter}
        totalItems={allProducts.length}
        inStockCount={totalInStock}
        outOfStockCount={totalOutOfStock}
      />

      <CategoryFilterBar
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {isLoading ? (
        <div className="py-20">
          <LoadingSpinner size="lg" label={t('common.loading')} />
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <Layers className="mx-auto h-10 w-10 text-slate-400 mb-2.5" />
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {t('catalog.noProducts')}
          </h4>
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
                <span className="text-xs text-slate-400 font-medium">
                  ({category.products.length})
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                {category.products.map((product: Product) => (
                  <CatalogProductCard
                    key={product.id}
                    product={product}
                    onInitiateProductToggle={handleInitiateProductToggle}
                    onInitiateVariantToggle={handleInitiateVariantToggle}
                    isProductLoading={
                      productStockMutation.isPending &&
                      productStockMutation.variables?.productId === product.id
                    }
                    loadingVariantId={
                      variantStockMutation.isPending
                        ? variantStockMutation.variables?.variantId
                        : null
                    }
                  />
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
