import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Images, PackageCheck, PackageX, Plus, Trash2 } from 'lucide-react';
import adminApi, { AdminCatalogProduct, SaveProductPayload } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';
import { Alert } from '../../../../components/ui/Alert';
import { MediaPickerModal } from '../../../../components/media/MediaPickerModal';
import {
  VariationDraft,
  createVariationDraft,
  moveVariationUp,
  removeVariation,
  toVariationDrafts,
  validateVariations,
} from '../../../../utils/variationsEditor';
import { resolveMediaUrl } from '../../../../utils/mediaUrl';
import { formatCurrency } from '../../../../utils/formatters';
import { extractApiError } from '../../../../utils/apiError';

interface ProductDialogProps {
  /** Product to view/edit; null = create mode. */
  product: AdminCatalogProduct | null;
  isOpen: boolean;
  createContext: { vendorId: string; categoryId?: string } | null;
  onClose: () => void;
}

/**
 * Unified product dialog (ADR-017): view mode for existing items, edit/create
 * modes with the ordered variations editor — first variation anchors the
 * product price; at least one variation always remains.
 */
export const ProductDialog: React.FC<ProductDialogProps> = ({ product, isOpen, createContext, onClose }) => {
  const queryClient = useQueryClient();
  const isCreate = !product;
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isInStock, setIsInStock] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [drafts, setDrafts] = useState<VariationDraft[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(isCreate ? 'edit' : 'view');
      setActionError(null);
      if (product) {
        setName(product.name);
        setDescription(product.description || '');
        setImageUrl(product.imageUrl || '');
        setIsInStock(product.isInStock);
        setDrafts(toVariationDrafts(product.variants));
      } else {
        setName('');
        setDescription('');
        setImageUrl('');
        setIsInStock(true);
        setDrafts([createVariationDraft()]);
      }
      setCategoryId(product?.id ? '' : createContext?.categoryId || '');
    }
    // categoryId is set by the consumer through createContext on open
    if (isOpen && product) {
      setCategoryId(''); // server-side category is untouched on edit unless provided
    }
  }, [isOpen, product, isCreate, createContext]);

  const saveMutation = useMutation({
    mutationFn: (payload: SaveProductPayload) =>
      adminApi.saveProduct(payload, product?.id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-outlet-detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      onClose();
    },
    onError: (err) => setActionError(extractApiError(err, 'Product save failed.')),
  });

  const patchDraft = (index: number, patch: Partial<VariationDraft>) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const handleSave = () => {
    const validation = validateVariations(drafts);
    if (!validation.valid) {
      setActionError(validation.error || 'Invalid variations.');
      return;
    }
    const payload: SaveProductPayload = {
      name: name.trim(),
      description: description.trim() || null,
      imageUrl: imageUrl || null,
      isInStock,
      categoryId: categoryId || (createContext?.categoryId as string),
      variations: validation.variations,
    };
    if (isCreate) {
      payload.vendorId = createContext?.vendorId;
    }
    saveMutation.mutate(payload);
  };

  const viewPrice = product?.variants?.[0]?.price ?? 0;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        title={isCreate ? 'New Product' : mode === 'view' ? product?.name || 'Product' : `Edit — ${product?.name}`}
        description={
          mode === 'view' || isCreate
            ? isCreate
              ? 'Ordered variations — the first one sets the product price'
              : `${formatCurrency(viewPrice)} · from first variation`
            : undefined
        }
        footer={
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {mode === 'edit' && drafts.length > 0 && validateVariations(drafts).valid
                ? `Product price: ${formatCurrency(validateVariations(drafts).variations[0].price)}`
                : ''}
            </div>
            <div className="flex items-center gap-2">
              {mode === 'view' ? (
                <>
                  <Button variant="outline" size="sm" onClick={onClose}>
                    Close
                  </Button>
                  <Button size="sm" onClick={() => setMode('edit')}>
                    Edit Product
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => (isCreate ? onClose() : setMode('view'))}>
                    {isCreate ? 'Cancel' : 'Back to View'}
                  </Button>
                  <Button
                    size="sm"
                    isLoading={saveMutation.isPending}
                    disabled={!name.trim() || (isCreate && !categoryId && !createContext?.categoryId)}
                    onClick={handleSave}
                  >
                    {isCreate ? 'Create Product' : 'Save Product'}
                  </Button>
                </>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {actionError && <Alert type="error" message={actionError} onDismiss={() => setActionError(null)} />}

          {mode === 'view' && product && (
            <>
              <div className="flex items-start gap-4">
                <div className="h-20 w-20 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0 dark:border-slate-800 dark:bg-slate-800">
                  {imageUrl ? (
                    <img src={resolveMediaUrl(imageUrl)} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-400">No image</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{product.name}</h4>
                    {product.isInStock ? (
                      <Badge variant="success">In Stock</Badge>
                    ) : (
                      <Badge variant="danger">Out of Stock</Badge>
                    )}
                  </div>
                  {product.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{product.description}</p>
                  )}
                  <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 mt-1.5">
                    {formatCurrency(product.variants[0]?.price ?? 0)} · from first variation
                  </p>
                </div>
              </div>

              <div>
                <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Variations ({product.variants.length})
                </h5>
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 dark:border-slate-800 dark:divide-slate-800 overflow-hidden text-xs">
                  {product.variants.map((variant, index) => (
                    <div key={variant.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {index === 0 && <Badge variant="primary">Product price</Badge>}
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{variant.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {variant.isInStock ? (
                          <Badge variant="success">Available</Badge>
                        ) : (
                          <Badge variant="default">Unavailable</Badge>
                        )}
                        <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(variant.price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {mode === 'edit' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Product Name
                  </label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Peri-Peri Chicken Burger" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Stock Status
                  </label>
                  <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 w-fit">
                    <button
                      type="button"
                      onClick={() => setIsInStock(true)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold cursor-pointer ${
                        isInStock ? 'bg-emerald-500 text-white' : 'text-slate-500'
                      }`}
                    >
                      <PackageCheck className="h-3 w-3" /> In Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInStock(false)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold cursor-pointer ${
                        !isInStock ? 'bg-rose-500 text-white' : 'text-slate-500'
                      }`}
                    >
                      <PackageX className="h-3 w-3" /> Out of Stock
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional short description" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Image (from the central Media Library)
                </label>
                <div className="flex gap-2 items-start">
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Optional — pick an image from the library"
                    readOnly
                    className="cursor-default"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setIsPickerOpen(true)}
                    leftIcon={<Images className="h-4 w-4" />}
                  >
                    Browse
                  </Button>
                  {imageUrl && (
                    <div className="h-9 w-9 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 dark:border-slate-800 dark:bg-slate-800">
                      <img src={resolveMediaUrl(imageUrl)} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Variations — first row sets the product price
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 px-2 text-primary-600 dark:text-primary-400"
                    onClick={() => setDrafts((prev) => [...prev, createVariationDraft()])}
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Add Variation
                  </Button>
                </div>
                <div className="space-y-2">
                  {drafts.map((draft, index) => (
                    <div
                      key={draft.id || `new-${index}`}
                      className={`rounded-xl border p-2.5 grid grid-cols-[1fr_120px_auto_auto] gap-2 items-center ${
                        index === 0
                          ? 'border-primary-300 bg-primary-50/40 dark:border-primary-900/50 dark:bg-primary-950/20'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {index === 0 && (
                        <span className="col-span-4 -mb-1 text-[10px] font-bold text-primary-700 dark:text-primary-300">
                          Product price anchor
                        </span>
                      )}
                      <Input
                        value={draft.name}
                        onChange={(e) => patchDraft(index, { name: e.target.value })}
                        placeholder="Variation name"
                        className="text-xs"
                      />
                      <Input
                        type="number"
                        value={draft.price}
                        onChange={(e) => patchDraft(index, { price: e.target.value })}
                        placeholder="Price"
                        className="text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => patchDraft(index, { isInStock: !draft.isInStock })}
                        className={`h-8 px-2 rounded-lg text-[10px] font-bold cursor-pointer ${
                          draft.isInStock
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-slate-200 text-slate-500 dark:bg-slate-800'
                        }`}
                        title={draft.isInStock ? 'Available' : 'Unavailable'}
                      >
                        {draft.isInStock ? 'AVAIL' : 'OFF'}
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDrafts((prev) => moveVariationUp(prev, index))}
                          disabled={index === 0}
                          className="h-8 w-7 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer dark:hover:bg-slate-800"
                          title="Move up (first row = product price)"
                        >
                          <ArrowUp className="h-3.5 w-3.5 mx-auto" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDrafts((prev) => removeVariation(prev, index))}
                          disabled={index === 0}
                          className="h-8 w-7 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-30 cursor-pointer dark:hover:bg-rose-950/40"
                          title={index === 0 ? 'The first variation cannot be removed' : 'Delete variation'}
                        >
                          <Trash2 className="h-3.5 w-3.5 mx-auto" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  Deleting a variation is safe for past orders — history reads immutable snapshots. Removing rows other
                  than the first keeps the product price anchored to the top row.
                </p>
              </div>
            </>
          )}
        </div>
      </Modal>

      <MediaPickerModal isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} onSelect={(url) => setImageUrl(url)} />
    </>
  );
};
