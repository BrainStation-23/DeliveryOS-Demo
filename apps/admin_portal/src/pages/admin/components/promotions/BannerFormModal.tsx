import React, { useEffect, useState } from 'react';
import { Images } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';
import { MediaPickerModal } from '../../../../components/media/MediaPickerModal';
import { resolveMediaUrl } from '../../../../utils/mediaUrl';

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
}

export const BannerFormModal: React.FC<BannerFormModalProps> = ({
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [bannerSortOrder, setBannerSortOrder] = useState('0');
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBannerTitle('');
      setBannerImageUrl('');
      setBannerSortOrder('0');
    }
  }, [isOpen]);

  return (
    <>
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

      <MediaPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(url) => setBannerImageUrl(url)}
      />
    </>
  );
};
