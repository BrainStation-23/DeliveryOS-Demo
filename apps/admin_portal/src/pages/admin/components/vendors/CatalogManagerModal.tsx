import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { BookOpen, PackageX, PackageCheck, Pencil } from 'lucide-react';
import adminApi, { AdminVendor } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { QueryErrorBanner } from '../../../../components/common/QueryErrorBanner';
import { useVendorCatalog } from './useVendorCatalog';
import { formatCurrency } from '../../../../utils/formatters';
import { extractApiError } from '../../../../utils/apiError';

interface CatalogManagerModalProps {
  vendor: AdminVendor | null;
  onClose: () => void;
  onError: (message: string) => void;
}

/**
 * Admin catalog governance view: inspect an outlet's full menu and exercise
 * the override powers (price override + product availability). Creating and
 * editing items stays in the vendor portal — the admin governs, the merchant
 * operates.
 */
export const CatalogManagerModal: React.FC<CatalogManagerModalProps> = ({ vendor, onClose, onError }) => {
  const [priceTarget, setPriceTarget] = useState<{ id: string; name: string; basePrice: number } | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: catalog, isLoading, isError, error, refetch } = useVendorCatalog(vendor?.id || null);

  const invalidateAndRefetch = () => refetch();

  const priceMutation = useMutation({
    mutationFn: ({ productId, basePrice }: { productId: string; basePrice: number }) =>
      adminApi.overrideProductPrice(productId, basePrice),
    onSuccess: () => {
      setPriceTarget(null);
      setActionError(null);
      invalidateAndRefetch();
    },
    onError: (err) => setActionError(extractApiError(err, 'Price override failed.')),
  });

  const stockMutation = useMutation({
    mutationFn: ({ productId, isInStock }: { productId: string; isInStock: boolean }) =>
      adminApi.setProductStock(productId, isInStock),
    onSuccess: () => {
      setActionError(null);
      invalidateAndRefetch();
    },
    onError: (err) => setActionError(extractApiError(err, 'Availability update failed.')),
  });

  const safeCategories = Array.isArray(catalog?.categories) ? catalog.categories : [];
  const totalProducts = safeCategories.reduce((sum, c) => sum + (c.products?.length || 0), 0);

  return (
    <>
      <Modal
        isOpen={!!vendor}
        onClose={onClose}
        size="xl"
        title={`Catalog — ${vendor?.name || ''}`}
        description={`${safeCategories.length} categories · ${totalProducts} products · governance view (price override & availability)`}
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Menu creation &amp; editing lives in the vendor portal
            </span>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {actionError && (
            <div className="text-xs font-medium text-rose-600 dark:text-rose-400">{actionError}</div>
          )}

          {isLoading ? (
            <div className="py-16 text-center">
              <LoadingSpinner size="lg" label="Loading outlet catalog..." />
            </div>
          ) : isError ? (
            <QueryErrorBanner error={error} onRetry={() => refetch()} />
          ) : safeCategories.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 italic">
              This outlet has no active categories yet — the merchant builds their menu in the vendor portal.
            </div>
          ) : (
            safeCategories.map((category) => (
              <div key={category.id} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-primary-600" />
                    {category.name}
                  </span>
                  <span className="text-[10px] text-slate-500">{category.products.length} items</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {category.products.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-400 italic">No products in this category.</div>
                  ) : (
                    category.products.map((product) => (
                      <div key={product.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {product.name}
                            </span>
                            {product.isInStock ? (
                              <Badge variant="success">In Stock</Badge>
                            ) : (
                              <Badge variant="danger">Out of Stock</Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {formatCurrency(product.basePrice)}
                            {product.variants.length > 0 && ` · ${product.variants.length} variant${product.variants.length === 1 ? '' : 's'}`}
                            {product.addonGroups.length > 0 && ` · ${product.addonGroups.length} add-on group${product.addonGroups.length === 1 ? '' : 's'}`}
                          </div>
                        </div>

                        <div className="inline-flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => {
                              setPriceTarget({ id: product.id, name: product.name, basePrice: product.basePrice });
                              setNewPrice(String(product.basePrice));
                            }}
                            leftIcon={<Pencil className="h-3.5 w-3.5" />}
                          >
                            Price
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`text-xs h-7 px-2 ${
                              product.isInStock
                                ? 'border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400'
                            }`}
                            isLoading={
                              stockMutation.isPending && stockMutation.variables?.productId === product.id
                            }
                            onClick={() =>
                              stockMutation.mutate({ productId: product.id, isInStock: !product.isInStock })
                            }
                            leftIcon={product.isInStock ? <PackageX className="h-3.5 w-3.5" /> : <PackageCheck className="h-3.5 w-3.5" />}
                          >
                            {product.isInStock ? 'Mark Out' : 'Restore'}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!priceTarget}
        onClose={() => setPriceTarget(null)}
        title={`Override Price — ${priceTarget?.name || ''}`}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setPriceTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              isLoading={priceMutation.isPending}
              onClick={() => {
                const parsed = parseFloat(newPrice);
                if (priceTarget && !isNaN(parsed) && parsed > 0) {
                  priceMutation.mutate({ productId: priceTarget.id, basePrice: parsed });
                }
              }}
            >
              Apply Override
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Current base price: <strong>{formatCurrency(priceTarget?.basePrice || 0)}</strong>. The override applies
            immediately across this outlet's storefront.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Base Price (৳)
            </label>
            <Input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="250" />
          </div>
        </div>
      </Modal>
    </>
  );
};
