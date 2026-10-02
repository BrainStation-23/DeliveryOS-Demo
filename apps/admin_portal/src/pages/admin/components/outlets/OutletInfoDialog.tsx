import React, { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';

export interface OutletInfoPayload {
  name: string;
  contactPhone: string;
  addressText?: string;
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
      setCommission(String(initial?.commissionRate ?? 15));
      setPrep(String(initial?.defaultPrepTimeMinutes ?? 20));
      setRadius(String(initial?.deliveryRadiusKm ?? 5));
      setLatitude('23.7925');
      setLongitude('90.4078');
    }
  }, [isOpen, initial]);

  const isCreate = !editing;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreate ? `New Outlet — ${brandName || 'Brand'}` : `Edit Outlet — ${editing?.name || ''}`}
      description={isCreate ? 'Onboarded under this brand (brands own every outlet)' : 'Brand link, GPS, and governance stay managed from the outlet page'}
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
                commissionRate: parseFloat(commission) || 15,
                defaultPrepTimeMinutes: parseInt(prep, 10) || 20,
                deliveryRadiusKm: parseFloat(radius) || 5,
                ...(isCreate
                  ? { latitude: parseFloat(latitude) || 23.7925, longitude: parseFloat(longitude) || 90.4078 }
                  : {}),
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

        {isCreate && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Street Address
              </label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Sector 4, Road 7, House 12, Uttara, Dhaka" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">GPS Latitude</label>
                <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="23.7925" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">GPS Longitude</label>
                <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="90.4078" />
              </div>
            </div>
          </>
        )}

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
  );
};
