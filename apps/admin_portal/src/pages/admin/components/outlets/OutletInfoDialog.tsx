import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Images, MapPin } from 'lucide-react';
import adminApi from '../../../../services/adminApi';
import { OrderFlowModeValue } from '../../../../services/admin/vendors.api';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';
import { MediaPickerModal } from '../../../../components/media/MediaPickerModal';
import { LocationPickerModal } from '../../../../components/common/LocationPickerModal';
import { resolveMediaUrl } from '../../../../utils/mediaUrl';

export interface OutletInfoPayload {
  name: string;
  typeId: string;
  orderFlowMode: OrderFlowModeValue;
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

const FLOW_MODE_HELP: Record<OrderFlowModeValue, string> = {
  RIDER_FIRST: 'Zero Food Waste — couriers secure the order before the kitchen starts prep.',
  VENDOR_FIRST: 'Traditional Retail — the kitchen preps first; couriers are called when ready.',
};

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
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [commission, setCommission] = useState('15');
  const [prep, setPrep] = useState('20');
  const [radius, setRadius] = useState('5');
  const [latitude, setLatitude] = useState('23.7925');
  const [longitude, setLongitude] = useState('90.4078');
  const [typeId, setTypeId] = useState('');
  const [orderFlowMode, setOrderFlowMode] = useState<OrderFlowModeValue>('RIDER_FIRST');

  const { data: outletTypes = [] } = useQuery({
    queryKey: ['admin-outlet-types'],
    queryFn: adminApi.listOutletTypes,
    enabled: isOpen,
  });

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
      setTypeId(initial?.typeId || '');
      setOrderFlowMode(initial?.orderFlowMode || 'RIDER_FIRST');
    }
  }, [isOpen, initial]);

  const isCreate = !editing;
  // Creation is restricted to active types; editing may keep a hidden type selected.
  const selectableTypes = isCreate ? outletTypes.filter((t) => t.isActive) : outletTypes;

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
            disabled={!name.trim() || !phone.trim() || !typeId || (isCreate && !address.trim())}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                typeId,
                orderFlowMode,
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Outlet Type <span className="text-red-500">*</span>
            </label>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="" disabled>
                Select a business type…
              </option>
              {selectableTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {!t.isActive ? ' (hidden)' : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Types are managed in Settings → Outlet Types; hidden types keep existing outlets but exclude new ones.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Order Flow Mode
            </label>
            <select
              value={orderFlowMode}
              onChange={(e) => setOrderFlowMode(e.target.value as OrderFlowModeValue)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="RIDER_FIRST">RIDER_FIRST (Zero Food Waste)</option>
              <option value="VENDOR_FIRST">VENDOR_FIRST (Traditional Retail)</option>
            </select>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{FLOW_MODE_HELP[orderFlowMode]}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Street Address
          </label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Sector 4, Road 7, House 12, Uttara, Dhaka" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Outlet Geolocation (Map Coordinates)
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400 shrink-0">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                  <span>
                    {Number.isFinite(parseFloat(latitude)) && Number.isFinite(parseFloat(longitude))
                      ? `${parseFloat(latitude).toFixed(5)}, ${parseFloat(longitude).toFixed(5)}`
                      : 'No location selected'}
                  </span>
                  {Number.isFinite(parseFloat(latitude)) && Number.isFinite(parseFloat(longitude)) && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                      Pointed
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {Number.isFinite(parseFloat(latitude)) && Number.isFinite(parseFloat(longitude))
                    ? `Lat: ${parseFloat(latitude).toFixed(6)} · Lng: ${parseFloat(longitude).toFixed(6)}`
                    : 'Point the exact outlet entrance on the map'}
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsLocationPickerOpen(true)}
              leftIcon={<MapPin className="h-4 w-4 text-primary-600 dark:text-primary-400" />}
              className="shrink-0 cursor-pointer"
            >
              {Number.isFinite(parseFloat(latitude)) && Number.isFinite(parseFloat(longitude))
                ? 'Change on Map'
                : 'Select on Map'}
            </Button>
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

    <LocationPickerModal
      isOpen={isLocationPickerOpen}
      initialLat={Number.isFinite(parseFloat(latitude)) ? parseFloat(latitude) : undefined}
      initialLng={Number.isFinite(parseFloat(longitude)) ? parseFloat(longitude) : undefined}
      outletName={name.trim() || undefined}
      onClose={() => setIsLocationPickerOpen(false)}
      onConfirm={({ latitude: pickedLat, longitude: pickedLng }) => {
        setLatitude(String(pickedLat));
        setLongitude(String(pickedLng));
      }}
    />
    </>
  );
};
