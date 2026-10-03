import React, { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';

/** Minimal courier cash profile the modal needs — satisfies FleetRider rows
 *  and RiderDetail profiles alike without structural casts. */
export interface CashLimitModalRider {
  riderName: string;
  cashInHand: number;
  maxCashLimit: number;
}

interface CashLimitModalProps {
  rider: CashLimitModalRider;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (limit: number) => void;
}

export const CashLimitModal: React.FC<CashLimitModalProps> = ({
  rider,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [newCashLimit, setNewCashLimit] = useState<string>(rider.maxCashLimit.toString());

  const submit = () => {
    const limit = parseFloat(newCashLimit);
    if (!isNaN(limit) && limit > 0) {
      onSubmit(limit);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Adjust Cash Safety Limit — ${rider.riderName}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" isLoading={isSubmitting} onClick={submit}>
            Save Threshold
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Set the maximum Cash on Delivery (COD) threshold this rider can hold before automated dispatch holds
          orders.
        </p>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Current Cash in Hand
          </label>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100">৳{rider.cashInHand}</div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            New Maximum Cash Limit (BDT)
          </label>
          <Input
            type="number"
            value={newCashLimit}
            onChange={(e) => setNewCashLimit(e.target.value)}
            placeholder="5000"
          />
        </div>
      </div>
    </Modal>
  );
};
