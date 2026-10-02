import React, { useState } from 'react';
import { AdminBrand, AdminVendor } from '../../../../services/adminApi';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';

export interface EditVendorPayload {
  name: string;
  brandId?: string;
  contactPhone: string;
  commissionRate: number;
  defaultPrepTimeMinutes: number;
  deliveryRadiusKm: number;
}

interface EditVendorModalProps {
  vendor: AdminVendor;
  brands: AdminBrand[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: EditVendorPayload) => void;
}

export const EditVendorModal: React.FC<EditVendorModalProps> = ({
  vendor,
  brands,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [editName, setEditName] = useState(vendor.name);
  const [editBrandId, setEditBrandId] = useState(vendor.brandId || '');
  const [editContactPhone, setEditContactPhone] = useState(vendor.contactPhone);
  const [editCommissionRate, setEditCommissionRate] = useState(String(vendor.commissionRate));
  const [editDefaultPrepTime, setEditDefaultPrepTime] = useState(String(vendor.defaultPrepTimeMinutes));
  const [editDeliveryRadius, setEditDeliveryRadius] = useState(String(vendor.deliveryRadiusKm || 5));

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Edit Outlet: ${vendor.name}`}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            isLoading={isSubmitting}
            onClick={() =>
              onSubmit({
                name: editName,
                brandId: editBrandId,
                contactPhone: editContactPhone,
                commissionRate: parseFloat(editCommissionRate),
                defaultPrepTimeMinutes: parseInt(editDefaultPrepTime, 10),
                deliveryRadiusKm: parseFloat(editDeliveryRadius),
              })
            }
          >
            Save Changes
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
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Store Name"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Brand
          </label>
          <select
            value={editBrandId}
            onChange={(e) => setEditBrandId(e.target.value)}
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
            Store Phone
          </label>
          <Input
            value={editContactPhone}
            onChange={(e) => setEditContactPhone(e.target.value)}
            placeholder="+8801700000000"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Commission (%)
            </label>
            <Input
              type="number"
              value={editCommissionRate}
              onChange={(e) => setEditCommissionRate(e.target.value)}
              placeholder="15"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Avg Prep (mins)
            </label>
            <Input
              type="number"
              value={editDefaultPrepTime}
              onChange={(e) => setEditDefaultPrepTime(e.target.value)}
              placeholder="20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Radius (km)
            </label>
            <Input
              type="number"
              value={editDeliveryRadius}
              onChange={(e) => setEditDeliveryRadius(e.target.value)}
              placeholder="5"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};
