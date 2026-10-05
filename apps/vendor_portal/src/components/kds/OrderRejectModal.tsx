import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  { code: 'OUT_OF_STOCK', key: 'kds.reasons.OUT_OF_STOCK' },
  { code: 'KITCHEN_OVERLOAD', key: 'kds.reasons.KITCHEN_OVERLOAD' },
  { code: 'STORE_CLOSING_SOON', key: 'kds.reasons.STORE_CLOSING_SOON' },
  { code: 'OTHER', key: 'kds.reasons.OTHER' },
] as const;

export const OrderRejectModal: React.FC<OrderRejectModalProps> = ({
  isOpen,
  orderNumber,
  orderId,
  isRejecting,
  onClose,
  onConfirmReject,
}) => {
  const { t } = useTranslation();
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
      title={t('kds.rejectModalTitle', { orderNumber })}
      description={t('kds.rejectModalDesc')}
    >
      <div className="space-y-3.5">
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('kds.rejectReasonLabel')}
          </label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {REJECT_REASONS.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setReasonCode(item.code)}
                className={cn(
                  'h-10 rounded-xl border px-3 py-2 text-xs font-semibold text-left transition-colors flex items-center cursor-pointer',
                  reasonCode === item.code
                    ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                )}
              >
                {t(item.key)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('kds.additionalNotes')}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('kds.notesPlaceholder')}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="mt-4 flex gap-2.5">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isRejecting}
          >
            {t('kds.keepOrder')}
          </Button>
          <Button
            variant="danger"
            className="flex-1 font-bold"
            isLoading={isRejecting}
            onClick={handleConfirm}
          >
            {t('kds.confirmReject')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
