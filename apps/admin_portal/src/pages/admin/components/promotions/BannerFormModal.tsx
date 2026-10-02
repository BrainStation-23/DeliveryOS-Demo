import React, { useEffect, useState } from 'react';
import adminApi from '../../../../services/adminApi';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';
import { extractApiError } from '../../../../utils/apiError';

export interface BannerFormPayload {
  title: string;
  imageUrl: string;
  sortOrder: number;
}

interface BannerFormModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: BannerFormPayload) => void;
  /** null clears a previous upload error; a string surfaces a new one on the page banner. */
  onUploadError: (message: string | null) => void;
}

export const BannerFormModal: React.FC<BannerFormModalProps> = ({
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
  onUploadError,
}) => {
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [bannerSortOrder, setBannerSortOrder] = useState('0');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBannerTitle('');
      setBannerImageUrl('');
      setBannerSortOrder('0');
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Promotional Hero Banner"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!bannerTitle || !bannerImageUrl}
            isLoading={isSubmitting}
            onClick={() =>
              onSubmit({
                title: bannerTitle,
                imageUrl: bannerImageUrl,
                sortOrder: parseInt(bannerSortOrder, 10) || 0,
              })
            }
          >
            Publish Banner
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
            Banner Image (Upload or paste a URL)
          </label>
          <div className="flex gap-2">
            <Input
              value={bannerImageUrl}
              onChange={(e) => setBannerImageUrl(e.target.value)}
              placeholder="https://… or upload a file"
            />
            <label
              className={`inline-flex shrink-0 items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${
                isUploadingImage ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {isUploadingImage ? 'Uploading…' : 'Upload'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={isUploadingImage}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setIsUploadingImage(true);
                  try {
                    const url = await adminApi.uploadImage(file);
                    setBannerImageUrl(url);
                    onUploadError(null);
                  } catch (err) {
                    onUploadError(extractApiError(err, 'Image upload failed.'));
                  } finally {
                    setIsUploadingImage(false);
                  }
                }}
              />
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Display Sequence Rank (Sort Order)
          </label>
          <Input
            type="number"
            value={bannerSortOrder}
            onChange={(e) => setBannerSortOrder(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>
    </Modal>
  );
};
