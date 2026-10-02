import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Images } from 'lucide-react';
import adminApi, { AdminBanner } from '../../../../services/adminApi';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';
import { MediaPickerModal } from '../../../../components/media/MediaPickerModal';
import { resolveMediaUrl } from '../../../../utils/mediaUrl';

export interface BannerFormPayload {
  title: string;
  imageUrl: string;
  linkType: AdminBanner['linkType'];
  targetId?: string;
  targetUrl?: string;
  sortOrder: number;
  startsAt?: string;
  endsAt?: string;
}

interface BannerFormModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  /** null = create mode; a banner = edit mode prefilled from it */
  editing: AdminBanner | null;
  onClose: () => void;
  onSubmit: (payload: BannerFormPayload) => void;
}

const LINK_TYPES: Array<{ id: AdminBanner['linkType']; label: string; hint: string }> = [
  { id: 'OUTLET', label: 'Outlet', hint: 'Opens the outlet page in the customer app' },
  { id: 'CATEGORY', label: 'Category', hint: 'Opens discovery filtered by a central category' },
  { id: 'EXTERNAL', label: 'External URL', hint: 'Opens an absolute https link in the browser' },
];

/** Converts an ISO timestamp to the datetime-local input format (or ''). */
function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const BannerFormModal: React.FC<BannerFormModalProps> = ({
  isOpen,
  isSubmitting,
  editing,
  onClose,
  onSubmit,
}) => {
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [bannerSortOrder, setBannerSortOrder] = useState('0');
  const [linkType, setLinkType] = useState<AdminBanner['linkType']>('OUTLET');
  const [targetId, setTargetId] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { data: outlets = [] } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: adminApi.getVendors,
    enabled: isOpen,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['admin-central-categories'],
    queryFn: adminApi.getCentralCategories,
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      setBannerTitle(editing?.title || '');
      setBannerImageUrl(editing?.imageUrl || '');
      setBannerSortOrder(String(editing?.sortOrder ?? 0));
      setLinkType(editing?.linkType || 'OUTLET');
      setTargetId(editing?.targetId || '');
      setTargetUrl(editing?.targetUrl || '');
      setStartsAt(toDateTimeLocal(editing?.startsAt));
      setEndsAt(toDateTimeLocal(editing?.endsAt));
      setValidationError(null);
    }
  }, [isOpen, editing]);

  const isValidLink =
    linkType === 'EXTERNAL' ? /^https?:\/\/.+/i.test(targetUrl.trim()) : targetId !== '';

  const submit = () => {
    if (linkType === 'EXTERNAL' && !/^https?:\/\/.+/i.test(targetUrl.trim())) {
      setValidationError('External banners require an absolute http(s) URL.');
      return;
    }
    if (linkType !== 'EXTERNAL' && !targetId) {
      setValidationError('Select the outlet or category the banner deeplinks to.');
      return;
    }
    setValidationError(null);
    onSubmit({
      title: bannerTitle,
      imageUrl: bannerImageUrl,
      linkType,
      ...(linkType === 'EXTERNAL' ? { targetUrl: targetUrl.trim() } : { targetId }),
      sortOrder: parseInt(bannerSortOrder, 10) || 0,
      ...(startsAt ? { startsAt: new Date(startsAt).toISOString() } : {}),
      ...(endsAt ? { endsAt: new Date(endsAt).toISOString() } : {}),
    });
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={editing ? 'Edit Promotional Banner' : 'Add Promotional Hero Banner'}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!bannerTitle || !bannerImageUrl || !isValidLink}
              isLoading={isSubmitting}
              onClick={submit}
            >
              {editing ? 'Save Changes' : 'Publish Banner'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Banner Title
            </label>
            <Input
              value={bannerTitle}
              onChange={(e) => setBannerTitle(e.target.value)}
              placeholder="e.g. 50% Off Pilot Weekend Feast"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Banner Image (from the central Media Library)
            </label>
            <div className="flex gap-2">
              <Input
                value={bannerImageUrl}
                onChange={(e) => setBannerImageUrl(e.target.value)}
                placeholder="Pick an image from the media library"
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
                Browse Library
              </Button>
            </div>
            {bannerImageUrl && (
              <div className="mt-2 h-28 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden dark:border-slate-800 dark:bg-slate-800">
                <img
                  src={resolveMediaUrl(bannerImageUrl)}
                  alt="Banner preview"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-3 space-y-3 dark:border-slate-800">
            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tap Deeplink (customer app opens this on banner tap)
              </span>
              <div className="grid grid-cols-3 gap-2">
                {LINK_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setLinkType(type.id)}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-all cursor-pointer ${
                      linkType === type.id
                        ? 'border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-500 dark:bg-primary-950/40 dark:text-primary-300'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {LINK_TYPES.find((t) => t.id === linkType)?.hint}
              </p>
            </div>

            {linkType === 'OUTLET' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Outlet
                </label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Select an outlet...</option>
                  {outlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name}
                      {outlet.brandName ? ` — ${outlet.brandName}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {linkType === 'CATEGORY' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Category
                </label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Select a category...</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {linkType === 'EXTERNAL' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destination URL
                </label>
                <Input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://example.com/promo"
                />
              </div>
            )}

            {validationError && <p className="text-xs text-rose-600 dark:text-rose-400">{validationError}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Display Sequence Rank
              </label>
              <Input
                type="number"
                value={bannerSortOrder}
                onChange={(e) => setBannerSortOrder(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Starts At
                </label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ends At (optional)
                </label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <MediaPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(url) => setBannerImageUrl(url)}
      />
    </>
  );
};
