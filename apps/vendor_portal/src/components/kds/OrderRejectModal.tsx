import React, { useState } from 'react';
import { XCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface OrderRejectModalProps {
  isOpen: boolean;
  orderNumber: string;
  orderId: string;
  isRejecting: boolean;
  onClose: () => void;
  onConfirmReject: (orderId: string, reasonCode: string, notes?: string) => Promise<unknown> | void;
}

const REJECT_REASONS = [
  { code: 'OUT_OF_STOCK', label: 'Out of Stock' },
  { code: 'KITCHEN_OVERLOAD', label: 'Kitchen Busy' },
  { code: 'STORE_CLOSING_SOON', label: 'Closing Soon' },
  { code: 'OTHER', label: 'Other' },
];

export const OrderRejectModal: React.FC<OrderRejectModalProps> = ({
  isOpen,
  orderNumber,
  orderId,
  isRejecting,
  onClose,
  onConfirmReject,
}) => {
  const [reasonCode, setReasonCode] = useState('OUT_OF_STOCK');
  const [notes, setNotes] = useState('');

  const handleConfirm = async () => {
    await onConfirmReject(orderId, reasonCode, notes);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={`Reject Order #${orderNumber}`}
      description="Rejecting will cancel the order, release couriers, and refund any online payment to the customer."
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Reason for Rejection
          </label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {REJECT_REASONS.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setReasonCode(item.code)}
                className={cn(
                  'min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold text-left transition-colors flex items-center',
                  reasonCode === item.code
                    ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Additional Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Patty unavailable for remainder of shift"
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="mt-5 flex gap-2.5">
          <Button
            variant="outline"
            className="flex-1 min-h-[44px] rounded-xl"
            onClick={onClose}
            disabled={isRejecting}
          >
            Keep Order
          </Button>
          <Button
            variant="primary"
            className="flex-1 min-h-[44px] bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl"
            isLoading={isRejecting}
            onClick={handleConfirm}
          >
            Confirm Reject
          </Button>
        </div>
      </div>
    </Modal>
  );
};
