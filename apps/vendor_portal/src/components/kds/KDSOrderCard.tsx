import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Bike,
  CreditCard,
  Banknote,
  CheckCircle,
  ArrowRight,
  UserCheck,
  ChevronDown,
  XCircle,
  User,
} from 'lucide-react';
import { KDSOrder, KDSOrderItem } from '../../types/kds';
import { CountdownTimer } from './CountdownTimer';
import { OrderRejectModal } from './OrderRejectModal';
import { KDSPrepTimePicker } from './KDSPrepTimePicker';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import { formatCurrency } from '../../utils/formatters';

interface KDSOrderCardProps {
  order: KDSOrder;
  defaultPrepTimeMinutes?: number;
  onAccept?: (orderId: string, prepTimeMinutes?: number) => void;
  onReject?: (orderId: string, reasonCode: string, reasonNotes?: string) => Promise<unknown> | void;
  onMarkReady?: (orderId: string) => void;
  onHandover?: (orderId: string) => void;
  isActionLoading?: boolean;
  isRejecting?: boolean;
}

export const KDSOrderCard: React.FC<KDSOrderCardProps> = ({
  order,
  defaultPrepTimeMinutes = 20,
  onAccept,
  onReject,
  onMarkReady,
  onHandover,
  isActionLoading = false,
  isRejecting = false,
}) => {
  const { t } = useTranslation();
  const [selectedCustomTime, setSelectedCustomTime] = useState<number>(defaultPrepTimeMinutes);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const getElapsedMins = () => {
    const timeVal = order.createdAt || order.placedAt;
    const created = timeVal ? new Date(timeVal).getTime() : Date.now();
    const diffMins = Math.max(0, Math.floor((Date.now() - created) / (1000 * 60)));
    return diffMins === 0 ? t('kds.justNow') : t('kds.mAgo', { count: diffMins });
  };

  const isNew = order.status === 'PLACED' || order.status === 'RIDER_ASSIGNED';
  const isPreparing = order.status === 'ACCEPTED' || order.status === 'PREPARING';
  const isReady = order.status === 'READY_FOR_PICKUP';

  const customerName = order.customer?.fullName || order.customerPhoneSnapshot || 'Customer';
  const riderName = order.rider?.fullName || order.rider?.user?.fullName;
  const riderPhone = order.rider?.phone || order.rider?.user?.phone;
  const items: KDSOrderItem[] = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.orderItems)
    ? order.orderItems
    : [];

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-white p-3.5 sm:p-4 shadow-xs transition-all hover:shadow-md dark:bg-slate-900',
        isNew && 'border-rose-300 ring-2 ring-rose-400/25 dark:border-rose-800/80 dark:ring-rose-950/60',
        isPreparing && 'border-amber-300/90 dark:border-amber-800/80',
        isReady && 'border-emerald-300/90 dark:border-emerald-800/80'
      )}
    >
      {/* Top Header: Order #, Elapsed Time, Price & Payment */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800 gap-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-mono tracking-tight">
              #{order.orderNumber}
            </span>
            <span className="inline-flex items-center text-[11px] text-slate-600 font-medium bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-md">
              <Clock className="h-3 w-3 mr-1 text-slate-400" />
              {getElapsedMins()}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
            <User className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="truncate">
              {t('kds.customer')}{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">{customerName}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(order.totalAmount)}
          </span>
          <div className="mt-1">
            {order.paymentMethod === 'CASH_ON_DELIVERY' ? (
              <Badge variant="warning" size="sm">
                <Banknote className="h-3 w-3 mr-1" /> {t('kds.cod')}
              </Badge>
            ) : (
              <Badge variant="success" size="sm">
                <CreditCard className="h-3 w-3 mr-1" /> {t('kds.paid')}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Courier / Handover Status Strip */}
      <div className="my-2.5 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/60 border border-slate-100/80 dark:border-slate-800/80">
        {order.rider ? (
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-medium text-xs truncate">
            <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">
              {t('kds.rider')} <span className="font-semibold">{riderName || t('kds.assigned')}</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium text-xs">
            <Bike className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>{t('kds.awaitingRider')}</span>
          </div>
        )}
        {riderPhone && (
          <span className="text-xs text-slate-500 font-mono shrink-0 ml-2 font-medium">
            {riderPhone}
          </span>
        )}
      </div>

      {/* Order Items List */}
      <div className="my-1.5 flex-1 space-y-2.5">
        {items.map((item) => {
          const productName = item.productName || item.productNameSnapshot || 'Item';
          const subtotal = item.subtotal ?? item.totalPrice ?? 0;
          const variantName = item.variant?.name || item.variantSnapshot?.name;
          const toppings = Array.isArray(item.toppings)
            ? item.toppings
            : Array.isArray(item.addonsSnapshot)
            ? item.addonsSnapshot
            : [];

          return (
            <div key={item.id} className="text-xs space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-1.5 leading-snug min-w-0">
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md font-bold text-xs bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 shrink-0 mt-0.5">
                    {item.quantity}&times;
                  </span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {productName}
                  </span>
                </div>
                <span className="text-slate-500 dark:text-slate-400 shrink-0 text-xs font-medium">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              {variantName && (
                <div className="ml-6 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{t('kds.option')}</span>{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{variantName}</span>
                </div>
              )}

              {toppings.length > 0 && (
                <div className="ml-6 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{t('kds.extras')}</span>{' '}
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {toppings.map((t) => t.name).join(', ')}
                  </span>
                </div>
              )}

              {item.instructions && (
                <div className="ml-6 mt-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] text-amber-950 italic border border-amber-200/90 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/60 font-medium">
                  &ldquo;{item.instructions}&rdquo;
                </div>
              )}
            </div>
          );
        })}

        {order.customerNotes && (
          <div className="mt-2.5 rounded-xl border border-amber-300/80 bg-amber-50/70 p-2.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider text-[10px] block">
              {t('kds.note')}
            </span>
            <span className="italic font-medium block mt-0.5">{order.customerNotes}</span>
          </div>
        )}
      </div>

      {/* Footer Action Buttons */}
      <div className="mt-auto border-t border-slate-100 pt-3 dark:border-slate-800">
        {isNew && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="md"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                onClick={() => onAccept && onAccept(order.id, selectedCustomTime)}
                isLoading={isActionLoading}
                leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
              >
                {t('kds.acceptOrder', { time: selectedCustomTime })}
              </Button>

              <button
                type="button"
                onClick={() => setShowTimePicker(!showTimePicker)}
                className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
                title="Select preparation time"
                aria-label="Select preparation time"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              <Button
                variant="outline"
                size="md"
                className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
                onClick={() => setShowRejectModal(true)}
                title={t('kds.reject')}
                leftIcon={<XCircle className="h-3.5 w-3.5" />}
              >
                {t('kds.reject')}
              </Button>
            </div>

            <KDSPrepTimePicker
              isOpen={showTimePicker}
              selectedMinutes={selectedCustomTime}
              onSelectMinutes={(mins) => {
                setSelectedCustomTime(mins);
                setShowTimePicker(false);
              }}
            />

            <OrderRejectModal
              isOpen={showRejectModal}
              orderNumber={order.orderNumber}
              orderId={order.id}
              isRejecting={isRejecting}
              onClose={() => setShowRejectModal(false)}
              onConfirmReject={async (orderId, reasonCode, reasonNotes) => {
                if (onReject) {
                  await onReject(orderId, reasonCode, reasonNotes);
                }
              }}
            />
          </div>
        )}

        {isPreparing && (
          <div className="flex items-center justify-between gap-2.5">
            <CountdownTimer
              acceptedAt={order.acceptedAt || order.updatedAt || order.placedAt}
              prepTimeMinutes={order.prepTimeMinutes || defaultPrepTimeMinutes}
            />
            <Button
              variant="primary"
              size="md"
              className="flex-1 shadow-xs"
              onClick={() => onMarkReady && onMarkReady(order.id)}
              isLoading={isActionLoading}
              rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
            >
              {t('kds.markReady')}
            </Button>
          </div>
        )}

        {isReady && (
          <div className="flex items-center justify-between gap-2.5">
            <Badge variant="info" size="md" className="h-9 px-3 font-semibold text-xs">
              {t('kds.atCounter')}
            </Badge>
            <Button
              variant="primary"
              size="md"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              onClick={() => onHandover && onHandover(order.id)}
              isLoading={isActionLoading}
              leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
            >
              {t('kds.handover')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
