import React from 'react';
import { useTranslation } from 'react-i18next';
import { Product, ProductVariant } from '../../../../types/kds';
import { StockToggleSwitch } from '../../../../components/common/StockToggleSwitch';

interface CatalogProductCardProps {
  product: Product;
  onInitiateProductToggle: (product: { id: string; name: string; isInStock: boolean }) => void;
  onInitiateVariantToggle: (
    productName: string,
    variant: { id: string; name: string; isInStock: boolean }
  ) => void;
  isProductLoading: boolean;
  loadingVariantId?: string | null;
}

export const CatalogProductCard: React.FC<CatalogProductCardProps> = ({
  product,
  onInitiateProductToggle,
  onInitiateVariantToggle,
  isProductLoading,
  loadingVariantId,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`rounded-xl border p-3.5 sm:p-4 transition-all flex flex-col justify-between ${
        product.isInStock
          ? 'border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'
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
              onToggle={() => onInitiateProductToggle(product)}
              isLoading={isProductLoading}
              ariaLabel={product.name}
            />
          </div>
        </div>

        {product.variants && product.variants.length > 0 && (
          <div className="mt-3.5 border-t border-slate-100 pt-2.5 space-y-1.5 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              {t('catalog.variants')}
            </span>
            {product.variants.map((variant: ProductVariant) => (
              <div
                key={variant.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60"
              >
                <span className="flex-1 min-w-0 text-slate-700 dark:text-slate-300 font-medium truncate">
                  {variant.name}
                </span>
                <span className="shrink-0 text-slate-500 dark:text-slate-400 font-semibold tabular-nums">
                  ৳{variant.price}
                </span>
                <div className="shrink-0">
                  <StockToggleSwitch
                    size="sm"
                    isInStock={variant.isInStock}
                    onToggle={() => onInitiateVariantToggle(product.name, variant)}
                    isLoading={loadingVariantId === variant.id}
                    ariaLabel={`${product.name} ${variant.name}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
