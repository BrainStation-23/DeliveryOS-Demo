import React, { useEffect, useState } from 'react';
import { AdminBrand } from '../../../../services/adminApi';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';

export interface CreateVendorPayload {
  name: string;
  brandId?: string;
  addressText: string;
  contactPhone: string;
  commissionRate: number;
  defaultPrepTimeMinutes: number;
  latitude: number;
  longitude: number;
}

interface CreateVendorModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  brands: AdminBrand[];
  onClose: () => void;
  onSubmit: (payload: CreateVendorPayload) => void;
}

export const CreateVendorModal: React.FC<CreateVendorModalProps> = ({
  isOpen,
  isSubmitting,
  brands,
  onClose,
  onSubmit,
}) => {
  const [vendorName, setVendorName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [addressText, setAddressText] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [commissionRate, setCommissionRate] = useState('15');
  const [defaultPrepTime, setDefaultPrepTime] = useState('20');
  const [latitude, setLatitude] = useState('23.7925');
  const [longitude, setLongitude] = useState('90.4078');

  useEffect(() => {
    if (isOpen) {
      setVendorName('');
      setBrandId('');
      setAddressText('');
      setContactPhone('');
      setCommissionRate('15');
      setDefaultPrepTime('20');
      setLatitude('23.7925');
      setLongitude('90.4078');
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Onboard New Merchant Outlet"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!vendorName || !addressText || !contactPhone}
            isLoading={isSubmitting}
            onClick={() =>
              onSubmit({
                name: vendorName,
                brandId: brandId || undefined,
                addressText,
                contactPhone,
                commissionRate: parseFloat(commissionRate) || 15,
                defaultPrepTimeMinutes: parseInt(defaultPrepTime, 10) || 20,
                latitude: parseFloat(latitude) || 23.7925,
                longitude: parseFloat(longitude) || 90.4078,
              })
            }
          >
            Onboard Outlet
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Store / Branch Name
          </label>
          <Input
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="e.g. Burger Point — Uttara Branch"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Brand (optional — outlet operates standalone when empty)
          </label>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">— No brand (standalone outlet) —</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Physical Street Address
          </label>
          <Input
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder="e.g. Sector 4, Road 7, House 12, Uttara, Dhaka"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Store Phone
            </label>
            <Input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+8801700000000"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Platform Commission (%)
            </label>
            <Input
              type="number"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              placeholder="15"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              GPS Latitude
            </label>
            <Input
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="23.7925"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              GPS Longitude
            </label>
            <Input
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="90.4078"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};
