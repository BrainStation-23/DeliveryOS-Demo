import React, { useState } from 'react';
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
} from 'lucide-react';
import { KDSOrder, KDSOrderItem } from '../../types/kds';
import { CountdownTimer } from './CountdownTimer';
import { OrderRejectModal } from './OrderRejectModal';
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
  const [selectedCustomTime, setSelectedCustomTime] = useState<number>(defaultPrepTimeMinutes);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const getElapsedMins = () => {
    const timeVal = order.createdAt || order.placedAt;
    const created = timeVal ? new Date(timeVal).getTime() : Date.now();
    const diffMins = Math.max(0, Math.floor((Date.now() - created) / (1000 * 60)));
    return diffMins === 0 ? 'Just now' : `${diffMins}m ago`;
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
        'flex flex-col rounded-xl border bg-white p-3.5 shadow-xs transition-all dark:bg-slate-900',
        isNew && 'border-rose-200 ring-2 ring-rose-400/20 dark:border-rose-800 dark:ring-rose-950',
        isPreparing && 'border-amber-200 dark:border-amber-900/60',
        isReady && 'border-emerald-200 dark:border-emerald-900/60'
      )}
    >
      {/* Top Header: Order #, Elapsed, Price, Payment */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800 gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
              #{order.orderNumber}
            </span>
            <span className="flex items-center text-[10px] text-slate-500 font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
              <Clock className="h-3 w-3 mr-1 text-slate-400" />
              {getElapsedMins()}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[140px] sm:max-w-[180px]">
            Customer: <span className="font-semibold text-slate-700 dark:text-slate-200">{customerName}</span>
          </p>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(order.totalAmount)}
          </span>
          <div className="mt-1">
            {order.paymentMethod === 'CASH_ON_DELIVERY' ? (
              <Badge variant="warning" size="sm">
                <Banknote className="h-3 w-3 mr-1" /> COD
              </Badge>
            ) : (
              <Badge variant="success" size="sm">
                <CreditCard className="h-3 w-3 mr-1" /> Paid
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Rider Status Strip */}
      <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/60">
        {order.rider ? (
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-medium text-[11px]">
            <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Rider: <strong>{riderName || 'Assigned'}</strong></span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium text-[11px]">
            <Bike className="h-3.5 w-3.5 shrink-0" />
            <span>Awaiting Rider Broadcast</span>
          </div>
        )}
        {riderPhone && (
          <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">{riderPhone}</span>
        )}
      </div>

      {/* Order Items List */}
      <div className="my-2.5 flex-1 space-y-2">
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
            <div key={item.id} className="text-xs">
              <div className="flex items-start justify-between font-semibold text-slate-800 dark:text-slate-200">
                <span className="leading-snug">
                  <span className="inline-block w-4 font-bold text-primary-600 dark:text-primary-400">
                    {item.quantity}&times;
                  </span>
                  {productName}
                </span>
                <span className="text-slate-500 shrink-0 ml-2 font-medium">{formatCurrency(subtotal)}</span>
              </div>

              {variantName && (
                <div className="ml-4 text-[11px] text-slate-500 dark:text-slate-400">
                  Option: <span className="font-medium text-slate-700 dark:text-slate-300">{variantName}</span>
                </div>
              )}

              {toppings.length > 0 && (
                <div className="ml-4 text-[11px] text-slate-500 dark:text-slate-400">
                  Extras: {toppings.map((t) => t.name).join(', ')}
                </div>
              )}

              {item.instructions && (
                <div className="ml-4 mt-0.5 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900 italic border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">
                  &ldquo;{item.instructions}&rdquo;
                </div>
              )}
            </div>
          );
        })}

        {order.customerNotes && (
          <div className="mt-2 rounded-lg border border-amber-200/90 bg-amber-50/60 p-2 text-[11px] text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <span className="font-bold text-amber-950 dark:text-amber-100">Note: </span>
            <span className="italic">{order.customerNotes}</span>
          </div>
        )}
      </div>

      {/* Footer Action Buttons */}
      <div className="mt-auto border-t border-slate-100 pt-2.5 dark:border-slate-800">
        {isNew && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Button
                variant="primary"
                size="md"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                onClick={() => onAccept && onAccept(order.id, selectedCustomTime)}
                isLoading={isActionLoading}
                leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
              >
                Accept ({selectedCustomTime}m)
              </Button>

              <button
                type="button"
                onClick={() => setShowTimePicker(!showTimePicker)}
                className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors shadow-xs"
                title="Select custom preparation time"
                aria-label="Select custom preparation time"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              <Button
                variant="outline"
                size="md"
                className="px-3 font-semibold border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
                onClick={() => setShowRejectModal(true)}
                title="Reject incoming order"
                leftIcon={<XCircle className="h-3.5 w-3.5" />}
              >
                Reject
              </Button>
            </div>

            {showTimePicker && (
              <div className="flex flex-wrap items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-xs gap-1 dark:border-slate-700 dark:bg-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px] px-1">Prep:</span>
                <div className="flex flex-wrap gap-1">
                  {[15, 20, 25, 35, 45].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setSelectedCustomTime(mins);
                        setShowTimePicker(false);
                      }}
                      className={cn(
                        'h-7 px-2.5 rounded-md font-semibold text-xs transition-colors',
                        selectedCustomTime === mins
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                      )}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            )}

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
          <div className="flex items-center justify-between gap-2">
            <CountdownTimer
              acceptedAt={order.acceptedAt || order.updatedAt || order.placedAt}
              prepTimeMinutes={order.prepTimeMinutes || defaultPrepTimeMinutes}
            />
            <Button
              variant="primary"
              size="md"
              className="shadow-xs font-semibold"
              onClick={() => onMarkReady && onMarkReady(order.id)}
              isLoading={isActionLoading}
              rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Ready for Pickup
            </Button>
          </div>
        )}

        {isReady && (
          <div className="flex items-center justify-between gap-2">
            <Badge variant="info" size="sm">
              At Counter
            </Badge>
            <Button
              variant="primary"
              size="md"
              className="shadow-xs font-semibold"
              onClick={() => onHandover && onHandover(order.id)}
              isLoading={isActionLoading}
              leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
            >
              Hand to Rider
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
