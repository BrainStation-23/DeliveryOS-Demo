import React from 'react';
import { Bike, Check, Clock, MessageSquare, ShoppingBag, Store, User, UserCheck, XCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge, OrderStatusBadge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { AdminOrder } from '../../services/adminApi';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { buildOrderTimeline } from '../../utils/orderTimeline';
import { cn } from '../../utils/cn';

interface OrderDetailsModalProps {
  isOpen: boolean;
  order: AdminOrder | null;
  onClose: () => void;
  /** Dispatch overrides render only where provided (order history, not dashboard). */
  onOpenCancel?: (order: AdminOrder) => void;
  onOpenAssign?: (order: AdminOrder) => void;
  isLoading?: boolean;
}

const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ icon, title, children, className }) => (
  <div className={cn('rounded-xl border border-slate-200 p-3.5 dark:border-slate-800', className)}>
    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 mb-2.5">
      {icon}
      {title}
    </div>
    {children}
  </div>
);

const DetailLine: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <span className="block text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
    <div className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-0.5">{children}</div>
  </div>
);

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  isOpen,
  order,
  onClose,
  onOpenCancel,
  onOpenAssign,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Order Details" size="lg">
        <div className="py-12">
          <LoadingSpinner size="lg" label="Loading order details..." />
        </div>
      </Modal>
    );
  }

  if (!order) return null;

  const safeItems = Array.isArray(order.items) ? order.items : [];
  const computedSubtotal =
    safeItems.reduce((sum, i) => sum + (i?.quantity || 0) * (i?.unitPrice || 0), 0) ||
    order.subtotal ||
    order.totalAmount - (order.deliveryFee || 0);
  const couponDiscount = order.couponDiscount || 0;
  const timeline = buildOrderTimeline(order);
  const isActive = order.status !== 'DELIVERED' && order.status !== 'CANCELLED';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={`Order ${order.orderNumber}`}
      description={`Placed ${formatDateTime(order.placedAt)}`}
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <Badge variant={order.paymentStatus === 'PAID' ? 'success' : 'warning'}>
              {order.paymentMethod === 'CASH_ON_DELIVERY' ? 'COD' : 'Online'} · {order.paymentStatus}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {isActive && order.status !== 'DISPATCHED' && onOpenCancel && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400"
                onClick={() => {
                  onClose();
                  onOpenCancel(order);
                }}
                leftIcon={<XCircle className="h-3.5 w-3.5" />}
              >
                Force Cancel
              </Button>
            )}
            {isActive && onOpenAssign && (
              <Button
                size="sm"
                className="text-xs h-8"
                onClick={() => {
                  onClose();
                  onOpenAssign(order);
                }}
                leftIcon={<UserCheck className="h-3.5 w-3.5" />}
              >
                {order.riderId ? 'Reassign Courier' : 'Force Assign'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3.5">
        {/* Parties */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SectionCard icon={<Store className="h-3.5 w-3.5 text-primary-600" />} title="Outlet">
            <DetailLine label="Store">{order.vendorName}</DetailLine>
            <div className="mt-2">
              <DetailLine label="Address">{order.vendorAddress}</DetailLine>
            </div>
          </SectionCard>
          <SectionCard icon={<User className="h-3.5 w-3.5 text-primary-600" />} title="Customer">
            <DetailLine label="Name">{order.customerName}</DetailLine>
            <div className="mt-2">
              <DetailLine label="Phone">{order.customerPhone}</DetailLine>
            </div>
          </SectionCard>
          <SectionCard icon={<Bike className="h-3.5 w-3.5 text-primary-600" />} title="Courier">
            {order.riderName ? (
              <>
                <DetailLine label="Assigned To">{order.riderName}</DetailLine>
                <div className="mt-2">
                  <DetailLine label="Phone">{order.riderPhone || '—'}</DetailLine>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-xs italic font-medium text-amber-600 dark:text-amber-400">
                  No courier assigned yet — waiting in dispatch pool
                </span>
                {isActive && onOpenAssign && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2 self-start"
                    onClick={() => {
                      onClose();
                      onOpenAssign(order);
                    }}
                  >
                    Assign Now
                  </Button>
                )}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Lifecycle timeline */}
          <SectionCard icon={<Clock className="h-3.5 w-3.5 text-primary-600" />} title="Lifecycle">
            <ol className="space-y-0">
              {timeline.map((step, index) => (
                <li key={step.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full border-2 shrink-0',
                        step.state === 'done' && 'border-emerald-500 bg-emerald-500 text-white',
                        step.state === 'active' && 'border-primary-500 bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 animate-pulse',
                        step.state === 'pending' && 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 text-slate-300 dark:text-slate-600',
                        step.state === 'cancelled' && 'border-rose-500 bg-rose-500 text-white',
                      )}
                    >
                      {step.state === 'done' && <Check className="h-3 w-3" />}
                      {step.state === 'cancelled' && <XCircle className="h-3 w-3" />}
                    </span>
                    {index < timeline.length - 1 && (
                      <span
                        className={cn(
                          'w-0.5 flex-1 min-h-4',
                          timeline[index + 1]?.state === 'done' || step.state === 'done'
                            ? 'bg-emerald-400/60'
                            : 'bg-slate-200 dark:bg-slate-800',
                          step.state === 'cancelled' && 'bg-rose-400/60',
                        )}
                      />
                    )}
                  </div>
                  <div className="pb-3 min-w-0">
                    <div
                      className={cn(
                        'text-xs font-semibold',
                        step.state === 'pending'
                          ? 'text-slate-400 dark:text-slate-500'
                          : step.state === 'cancelled'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-800 dark:text-slate-200',
                      )}
                    >
                      {step.label}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {step.timestamp ? formatDateTime(step.timestamp) : step.state === 'active' ? 'In progress…' : 'Pending'}
                    </div>
                    {step.detail && (
                      <div className="text-[10px] font-medium text-rose-600 dark:text-rose-400 mt-0.5">Reason: {step.detail}</div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>

          {/* Items + money */}
          <div className="space-y-3">
            <SectionCard icon={<ShoppingBag className="h-3.5 w-3.5 text-primary-600" />} title={`Items (${safeItems.length})`}>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {safeItems.length > 0 ? (
                  safeItems.map((item) => (
                    <div key={item.id} className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                        <div className="text-[10px] text-slate-500">
                          {item.quantity} × {formatCurrency(item.unitPrice)}
                        </div>
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 italic">No line items recorded</div>
                )}
              </div>
            </SectionCard>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs space-y-1.5 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Items Subtotal</span>
                <span>{formatCurrency(computedSubtotal)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Coupon Discount</span>
                  <span>−{formatCurrency(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Delivery Fee</span>
                <span>{formatCurrency(order.deliveryFee || 0)}</span>
              </div>
              {(order.taxAmount || 0) > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Tax</span>
                  <span>{formatCurrency(order.taxAmount || 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-slate-100 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                <span>Total</span>
                <span className="text-primary-600 dark:text-primary-400">{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery destination + notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SectionCard icon={<Store className="h-3.5 w-3.5 text-primary-600" />} title="Delivery Address">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
              {order.deliveryAddress}
            </p>
          </SectionCard>
          <SectionCard
            icon={<MessageSquare className="h-3.5 w-3.5 text-amber-500" />}
            title="Customer Notes"
            className="bg-amber-50/40 dark:bg-amber-950/10"
          >
            <p className="text-xs text-slate-700 dark:text-slate-300 italic">
              {order.customerNotes ? `"${order.customerNotes}"` : 'No special notes specified by customer.'}
            </p>
          </SectionCard>
        </div>
      </div>
    </Modal>
  );
};
