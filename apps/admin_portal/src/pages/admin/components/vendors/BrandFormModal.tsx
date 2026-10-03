import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Images } from 'lucide-react';
import { AdminBrand } from '../../../../services/adminApi';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';
import { MediaPickerModal } from '../../../../components/media/MediaPickerModal';
import { resolveMediaUrl } from '../../../../utils/mediaUrl';
import { BrandOwnerPicker, BrandOwnerState } from './BrandOwnerPicker';

export interface BrandFormPayload {
  name: string;
  logoUrl?: string;
  owner: BrandOwnerState;
}

interface BrandFormModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  /** Null = create mode. */
  editing: AdminBrand | null;
  onClose: () => void;
  onSubmit: (payload: BrandFormPayload) => void;
}

export const BrandFormModal: React.FC<BrandFormModalProps> = ({
  isOpen,
  isSubmitting,
  editing,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [owner, setOwner] = useState<BrandOwnerState>({
    userId: null,
    label: '',
    changed: false,
  });

  // Stable while the dialog is open — a fresh object identity per render would
  // retrigger the picker's reset effect and wipe an in-progress search.
  const initialOwner = useMemo(
    () => (editing?.owner ? { userId: editing.owner.userId, fullName: editing.owner.fullName } : null),
    [editing],
  );

  // The picker remounts against the editing brand via its initialOwner prop;
  // this stable callback keeps its change notifications from re-rendering us.
  const handleOwnerChange = useCallback((state: BrandOwnerState) => setOwner(state), []);

  useEffect(() => {
    if (isOpen) {
      setName(editing?.name || '');
      setLogoUrl(editing?.logoUrl || '');
    }
  }, [isOpen, editing]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={editing ? `Edit Brand — ${editing.name}` : 'Create Brand'}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={!name.trim()} isLoading={isSubmitting} onClick={() => onSubmit({ name: name.trim(), logoUrl: logoUrl || undefined, owner })}>
              {editing ? 'Save Brand' : 'Create Brand'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Brand Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Burger Point"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Brand Logo (from the central Media Library)
            </label>
            <div className="flex gap-2">
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="Optional — pick a logo from the media library"
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
            </div>
            {logoUrl && (
              <div className="mt-2 h-20 w-20 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden dark:border-slate-800 dark:bg-slate-800">
                <img src={resolveMediaUrl(logoUrl)} alt="Brand logo preview" className="h-full w-full object-cover" />
              </div>
            )}
          </div>

          <BrandOwnerPicker initialOwner={initialOwner} onChange={handleOwnerChange} />
        </div>
      </Modal>

      <MediaPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(url) => setLogoUrl(url)}
      />
    </>
  );
};
