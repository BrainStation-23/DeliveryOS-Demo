import React, { useEffect, useState } from 'react';
import { AdminCoupon } from '../../../../services/adminApi';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';

export interface CouponFormPayload {
  code: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  usageLimit: number;
}

interface CouponFormModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  /** null = create mode; a coupon = edit mode prefilled from it */
  editing: AdminCoupon | null;
  onClose: () => void;
  onSubmit: (payload: CouponFormPayload) => void;
}

export const CouponFormModal: React.FC<CouponFormModalProps> = ({
  isOpen,
  isSubmitting,
  editing,
  onClose,
  onSubmit,
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [couponDescription, setCouponDescription] = useState('');
  const [couponType, setCouponType] = useState<'PERCENTAGE' | 'FLAT'>('PERCENTAGE');
  const [couponValue, setCouponValue] = useState('20');
  const [minSpend, setMinSpend] = useState('300');
  const [maxDiscount, setMaxDiscount] = useState('100');
  const [usageLimit, setUsageLimit] = useState('500');

  useEffect(() => {
    if (isOpen) {
      setCouponCode(editing?.code || '');
      setCouponDescription(editing?.description || '');
      setCouponType(editing?.discountType || 'PERCENTAGE');
      setCouponValue(String(editing?.discountValue ?? 20));
      setMinSpend(String(editing?.minOrderAmount ?? 300));
      setMaxDiscount(editing?.maxDiscountAmount != null ? String(editing.maxDiscountAmount) : '');
      setUsageLimit(String(editing?.usageLimit ?? 500));
    }
  }, [isOpen, editing]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit Coupon ${editing.code}` : 'Create Promotional Discount Coupon'}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!couponCode || !couponValue}
            isLoading={isSubmitting}
            onClick={() =>
              onSubmit({
                code: couponCode,
                description: couponDescription,
                discountType: couponType,
                discountValue: parseFloat(couponValue) || 0,
                minOrderAmount: parseFloat(minSpend) || 0,
                maxDiscountAmount: maxDiscount ? parseFloat(maxDiscount) : undefined,
                usageLimit: parseInt(usageLimit, 10) || 1000,
              })
            }
          >
            {editing ? 'Save Changes' : 'Activate Promo Code'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Coupon Code (Alphanumeric)
          </label>
          <Input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="e.g. WELCOME50"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Description
          </label>
          <Input
            value={couponDescription}
            onChange={(e) => setCouponDescription(e.target.value)}
            placeholder="e.g. 20% discount on first 5 orders"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Discount Type
            </label>
            <select
              value={couponType}
              onChange={(e) => setCouponType(e.target.value as 'PERCENTAGE' | 'FLAT')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FLAT">Flat Deduction (৳)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Discount Value
            </label>
            <Input
              type="number"
              value={couponValue}
              onChange={(e) => setCouponValue(e.target.value)}
              placeholder="20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Min Spend (৳)
            </label>
            <Input
              type="number"
              value={minSpend}
              onChange={(e) => setMinSpend(e.target.value)}
              placeholder="300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Max Cap (৳)
            </label>
            <Input
              type="number"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              placeholder="100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Usage Limit
            </label>
            <Input
              type="number"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="500"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};
