import React, { useEffect, useState } from 'react';
import { Images } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';
import { MediaPickerModal } from '../../../../components/media/MediaPickerModal';
import { resolveMediaUrl } from '../../../../utils/mediaUrl';

export interface OutletInfoPayload {
  name: string;
  contactPhone: string;
  addressText?: string;
  bannerUrl?: string;
  commissionRate: number;
  defaultPrepTimeMinutes: number;
  deliveryRadiusKm: number;
  latitude?: number;
  longitude?: number;
}

interface OutletInfoDialogProps {
  isOpen: boolean;
  isSubmitting: boolean;
  /** Null = create mode (brand locked); otherwise edit the given outlet. */
  editing: { id: string; name: string } | null;
  brandName?: string;
  initial?: Partial<OutletInfoPayload>;
  onClose: () => void;
  onSubmit: (payload: OutletInfoPayload) => void;
}

/**
 * Unified outlet info dialog — create (brand pre-locked by the calling brand
 * card) and edit share one form; the brand link itself never changes here.
 */
export const OutletInfoDialog: React.FC<OutletInfoDialogProps> = ({
  isOpen,
  isSubmitting,
  editing,
  brandName,
  initial,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [commission, setCommission] = useState('15');
  const [prep, setPrep] = useState('20');
  const [radius, setRadius] = useState('5');
  const [latitude, setLatitude] = useState('23.7925');
  const [longitude, setLongitude] = useState('90.4078');

  useEffect(() => {
    if (isOpen) {
      setName(initial?.name || '');
      setPhone(initial?.contactPhone || '');
      setAddress(initial?.addressText || '');
      setBannerUrl(initial?.bannerUrl || '');
      setCommission(String(initial?.commissionRate ?? 15));
      setPrep(String(initial?.defaultPrepTimeMinutes ?? 20));
      setRadius(String(initial?.deliveryRadiusKm ?? 5));
      setLatitude(String(initial?.latitude ?? 23.7925));
      setLongitude(String(initial?.longitude ?? 90.4078));
    }
  }, [isOpen, initial]);

  const isCreate = !editing;

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreate ? `New Outlet — ${brandName || 'Brand'}` : `Edit Outlet — ${editing?.name || ''}`}
      description={isCreate ? 'Onboarded under this brand (brands own every outlet)' : 'Outlet identity, contact, street address, GPS pin, and commercial terms'}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            isLoading={isSubmitting}
            disabled={!name.trim() || !phone.trim() || (isCreate && !address.trim())}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                contactPhone: phone.trim(),
                addressText: address.trim() || undefined,
                bannerUrl: bannerUrl || undefined,
                commissionRate: parseFloat(commission) || 15,
                defaultPrepTimeMinutes: parseInt(prep, 10) || 20,
                deliveryRadiusKm: parseFloat(radius) || 5,
                ...(Number.isFinite(parseFloat(latitude)) ? { latitude: parseFloat(latitude) } : {}),
                ...(Number.isFinite(parseFloat(longitude)) ? { longitude: parseFloat(longitude) } : {}),
              })
            }
          >
            {isCreate ? 'Onboard Outlet' : 'Save Outlet Info'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Outlet / Branch Name
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Burger Point — Uttara Branch" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Contact Phone
            </label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+8801700000000" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Street Address
          </label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Sector 4, Road 7, House 12, Uttara, Dhaka" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              GPS Latitude <span className="font-normal text-slate-400">(-90 to 90)</span>
            </label>
            <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="23.7925" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              GPS Longitude <span className="font-normal text-slate-400">(-180 to 180)</span>
            </label>
            <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="90.4078" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Cover Image (customer banner — the brand logo represents the outlet)
          </label>
          <div className="flex gap-2">
            <Input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="Optional" readOnly className="cursor-default" />
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => setIsMediaPickerOpen(true)} leftIcon={<Images className="h-4 w-4" />}>
              Pick
            </Button>
          </div>
          {bannerUrl && (
            <div className="mt-2 h-16 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden dark:border-slate-800 dark:bg-slate-800">
              <img src={resolveMediaUrl(bannerUrl)} alt="Cover preview" className="h-full w-full object-cover" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Commission %</label>
            <Input type="number" value={commission} onChange={(e) => setCommission(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Prep (min)</label>
            <Input type="number" value={prep} onChange={(e) => setPrep(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Radius (km)</label>
            <Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
          </div>
        </div>
      </div>
    </Modal>

    <MediaPickerModal
      isOpen={isMediaPickerOpen}
      onClose={() => setIsMediaPickerOpen(false)}
      onSelect={(url) => {
        setBannerUrl(url);
        setIsMediaPickerOpen(false);
      }}
    />
    </>
  );
};
