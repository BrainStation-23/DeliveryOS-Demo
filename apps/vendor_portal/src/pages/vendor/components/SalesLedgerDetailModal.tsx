import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Phone,
  FileText,
  User,
  Bike,
  AlertTriangle,
  UtensilsCrossed,
  Receipt,
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { LedgerItem } from '../../../types/ledger';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';

interface SalesLedgerDetailModalProps {
  order: LedgerItem | null;
  onClose: () => void;
}

export const SalesLedgerDetailModal: React.FC<SalesLedgerDetailModalProps> = ({
  order,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!order) return null;

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <Badge variant="success" size="sm">{t('orders.orderStatuses.DELIVERED')}</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger" size="sm">{t('orders.orderStatuses.CANCELLED')}</Badge>;
      case 'DISPATCHED':
        return <Badge variant="primary" size="sm">{t('orders.orderStatuses.DISPATCHED')}</Badge>;
      case 'READY_FOR_PICKUP':
        return <Badge variant="warning" size="sm">{t('orders.orderStatuses.READY_FOR_PICKUP')}</Badge>;
      case 'PREPARING':
        return <Badge variant="warning" size="sm">{t('orders.orderStatuses.PREPARING')}</Badge>;
      case 'ACCEPTED':
        return <Badge variant="primary" size="sm">{t('orders.orderStatuses.ACCEPTED')}</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  const isCancelled = order.orderStatus === 'CANCELLED';

  return (
    <Modal
      isOpen={!!order}
      onClose={onClose}
      title={t('orders.detailModal.title', { orderNumber: order.orderNumber })}
      description={t('orders.detailModal.placedAt', {
        time: formatDateTime(order.placedAt || order.createdAt),
        vendor: order.vendorName,
      })}
      size="md"
      footer={
        <div className="flex justify-end w-full">
          <Button variant="outline" size="md" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-0.5">
        {/* Header Status & Payment Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5 sm:p-3 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t('orders.detailModal.orderStatus')}:
            </span>
            {getOrderStatusBadge(order.orderStatus)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {order.paymentMethod === 'ONLINE_GATEWAY' ? 'Digital Gateway' : 'COD'}
            </span>
            {order.paymentStatus === 'PAID' ? (
              <Badge variant="success" size="sm">{t('orders.paymentStatuses.PAID')}</Badge>
            ) : order.paymentStatus === 'FAILED' ? (
              <Badge variant="danger" size="sm">{t('orders.paymentStatuses.FAILED')}</Badge>
            ) : (
              <Badge variant="warning" size="sm">{t('orders.paymentStatuses.PENDING')}</Badge>
            )}
          </div>
        </div>

        {/* Cancellation Reason Alert (shown only if cancelled) */}
        {isCancelled && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-bold block">
                {t('orders.detailModal.orderCancelledAlert')}
              </span>
              <p className="mt-0.5 text-[11px] text-rose-800 dark:text-rose-300">
                <span className="font-semibold">{t('orders.detailModal.cancellationReason')}</span>{' '}
                {order.rejectionReason || t('orders.detailModal.noReasonProvided')}
              </p>
            </div>
          </div>
        )}

        {/* Cooking / Kitchen Notes (prominent for kitchen staff) */}
        {order.customerNotes && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            <FileText className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-bold text-[11px] uppercase tracking-wider block text-amber-800 dark:text-amber-300">
                {t('orders.detailModal.cookingNote')}
              </span>
              <p className="mt-0.5 font-medium italic">{order.customerNotes}</p>
            </div>
          </div>
        )}

        {/* Compact Contact & Handover Strip (Customer & Courier) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Customer Contact */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center gap-1.5 text-slate-500 mb-1">
              <User className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {t('orders.table.customer')}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
              {order.customerName}
            </p>
            {order.customerPhone ? (
              <a
                href={`tel:${order.customerPhone}`}
                className="inline-flex items-center gap-1.5 mt-1 font-mono text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:underline"
              >
                <Phone className="h-3 w-3" />
                {order.customerPhone}
              </a>
            ) : (
              <span className="text-[11px] text-slate-400 italic block mt-1">
                {t('orders.detailModal.noReasonProvided')}
              </span>
            )}
          </div>

          {/* Courier Handover */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center gap-1.5 text-slate-500 mb-1">
              <Bike className="h-3.5 w-3.5 text-sky-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {t('orders.detailModal.courierAssigned')}
              </span>
            </div>
            {order.rider ? (
              <>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {order.rider.fullName}
                </p>
                {order.rider.phone ? (
                  <a
                    href={`tel:${order.rider.phone}`}
                    className="inline-flex items-center gap-1.5 mt-1 font-mono text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    {order.rider.phone}
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-400 block mt-1 capitalize">
                    {order.rider.vehicleType || 'Motorcycle'}
                  </span>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-1">
                {t('orders.detailModal.noCourier')}
              </p>
            )}
          </div>
        </div>

        {/* Ordered Food Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <UtensilsCrossed className="h-3.5 w-3.5 text-amber-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider">
                {t('orders.detailModal.orderedItems', { count: order.items?.length || 0 })}
              </h4>
            </div>
            {order.prepTimeMinutes && (
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {t('orders.detailModal.prepTime')}: {order.prepTimeMinutes} {t('kds.mins')}
              </span>
            )}
          </div>

          {order.items && order.items.length > 0 ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {order.items.map((item, idx) => (
                <div key={idx} className="p-3 bg-white dark:bg-slate-900 flex items-start justify-between text-xs gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-extrabold text-[11px]">
                        {item.quantity}×
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {item.productName}
                      </span>
                      {item.variant && (
                        <Badge variant="primary" size="sm">
                          {item.variant.name}
                        </Badge>
                      )}
                    </div>

                    {item.addons && item.addons.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.addons.map((ad, aIdx) => (
                          <span
                            key={aIdx}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            + {ad.name} ({formatCurrency(ad.price)})
                          </span>
                        ))}
                      </div>
                    )}

                    {item.instructions && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                        {t('kds.specialRequest')} {item.instructions}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                      {formatCurrency(item.totalPrice)}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      {formatCurrency(item.unitPrice)} {t('orders.detailModal.each')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
              {t('orders.detailModal.noLineItems')}
            </div>
          )}
        </div>

        {/* Vendor Earnings & Settlement Summary */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 mb-1">
            <Receipt className="h-3.5 w-3.5 text-emerald-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {t('orders.detailModal.financialSummary')}
            </h4>
          </div>

          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>{t('orders.detailModal.grossSubtotal')}</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(order.grossAmount)}
            </span>
          </div>

          <div className="flex justify-between text-rose-600 dark:text-rose-400">
            <span>{t('orders.detailModal.commission', { rate: order.commissionRate })}</span>
            <span className="font-semibold">-{formatCurrency(order.commissionAmount)}</span>
          </div>

          {/* Highlighted Net Payable to Vendor */}
          <div className="mt-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60 flex items-center justify-between text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-300">
            <span>{t('orders.detailModal.netPayable')}</span>
            <span>{formatCurrency(order.netVendorPayable)}</span>
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
            <span>
              {t('orders.detailModal.settlement')}{' '}
              <strong className={order.settlementStatus === 'SETTLED' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                {order.settlementStatus === 'SETTLED' ? t('orders.settled') : t('orders.pending')}
              </strong>
            </span>
            {order.settledAt && (
              <span className="text-[10px] text-slate-400 font-mono">
                {formatDateTime(order.settledAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
