import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { AdminOrder } from '../../services/adminApi';
import { formatCurrency } from '../../utils/formatters';

interface CancelOrderModalProps {
  isOpen: boolean;
  order: AdminOrder | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  isOpen,
  order,
  isPending,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');

  if (!order) return null;

  const handleConfirm = () => {
    if (reason.trim().length >= 5) {
      onConfirm(reason.trim());
      setReason('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Force Cancel Order #${order.orderNumber}`}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Dismiss
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={reason.trim().length < 5}
            isLoading={isPending}
            onClick={handleConfirm}
          >
            Confirm Force Cancellation
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Alert
          type="error"
          message="Force-cancelling an order reverses pending commission ledgers, releases assigned couriers, and refunds online payments. This action is permanently logged in audit trails."
        />

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/50 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Customer:</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {order.customerName} ({order.customerPhone})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Store Outlet:</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{order.vendorName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Total Amount:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(order.totalAmount)} ({order.paymentMethod})
            </span>
          </div>

          {order.items && order.items.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 block mb-1 font-semibold">
                Items to be cancelled:
              </span>
              <div className="space-y-0.5 text-slate-700 dark:text-slate-300">
                {order.items.map((i) => (
                  <div key={i.id} className="flex justify-between text-[11px]">
                    <span>{i.quantity}x {i.name}</span>
                    <span>{formatCurrency(i.quantity * i.unitPrice)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Mandatory Cancellation Audit Reason (min 5 chars)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer requested emergency cancellation via hotline"
            rows={3}
            className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>
    </Modal>
  );
};
