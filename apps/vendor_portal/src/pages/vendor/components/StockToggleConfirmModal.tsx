import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';

export interface PendingStockToggle {
  type: 'PRODUCT' | 'VARIANT';
  id: string;
  name: string;
  parentName?: string;
  currentInStock: boolean;
  nextInStock: boolean;
}

export interface StockToggleConfirmModalProps {
  pendingToggle: PendingStockToggle | null;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export const StockToggleConfirmModal: React.FC<StockToggleConfirmModalProps> = ({
  pendingToggle,
  onClose,
  onConfirm,
  isLoading,
}) => {
  const { t } = useTranslation();

  if (!pendingToggle) return null;

  const isMarkingSoldOut = !pendingToggle.nextInStock;
  const isVariant = pendingToggle.type === 'VARIANT';
  const targetLabel = isVariant ? t('catalog.variation') : t('catalog.dish');

  return (
    <Modal
      isOpen={!!pendingToggle}
      onClose={onClose}
      title={isMarkingSoldOut ? t('catalog.markSoldOutTitle') : t('catalog.restockTitle')}
      description={t('catalog.modalDesc', { target: targetLabel })}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isLoading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant={isMarkingSoldOut ? 'danger' : 'success'}
            size="md"
            onClick={onConfirm}
            isLoading={isLoading}
            leftIcon={
              isMarkingSoldOut ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )
            }
          >
            {isMarkingSoldOut ? t('catalog.confirmSoldOut') : t('catalog.confirmInStock')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <div
          className={`rounded-xl border p-3.5 flex items-start gap-3 ${
            isMarkingSoldOut
              ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/30'
              : 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/30'
          }`}
        >
          <div
            className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
              isMarkingSoldOut
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300'
                : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300'
            }`}
          >
            {isMarkingSoldOut ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
              {pendingToggle.name}
            </h4>
            {isVariant && pendingToggle.parentName && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {pendingToggle.parentName}
              </p>
            )}
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
              <span className="text-slate-500">{t('catalog.statusChange')}</span>
              <span
                className={
                  pendingToggle.currentInStock
                    ? 'text-emerald-600 font-bold'
                    : 'text-rose-600 font-bold'
                }
              >
                {pendingToggle.currentInStock ? t('catalog.inStock') : t('catalog.soldOut')}
              </span>
              <span className="text-slate-400">➔</span>
              <span
                className={
                  pendingToggle.nextInStock
                    ? 'text-emerald-600 font-bold'
                    : 'text-rose-600 font-bold'
                }
              >
                {pendingToggle.nextInStock ? t('catalog.inStock') : t('catalog.soldOut')}
              </span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {isMarkingSoldOut
            ? t('catalog.soldOutConsequence', { target: targetLabel })
            : t('catalog.restockConsequence', { target: targetLabel })}
        </p>
      </div>
    </Modal>
  );
};
