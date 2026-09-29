import React from 'react';
import { Bike, MessageSquare, ShoppingBag, XCircle, UserCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge, OrderStatusBadge } from '../ui/Badge';
import { AdminOrder } from '../../services/adminApi';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

interface OrderDetailsModalProps {
  isOpen: boolean;
  order: AdminOrder | null;
  onClose: () => void;
  onOpenCancel: (order: AdminOrder) => void;
  onOpenAssign: (order: AdminOrder) => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  isOpen,
  order,
  onClose,
  onOpenCancel,
  onOpenAssign,
}) => {
  if (!order) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Order Details — #${order.orderNumber}`}
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <div className="flex items-center gap-2">
            {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && order.status !== 'DISPATCHED' && (
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
            {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
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
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-800/60 dark:border-slate-700">
          <div>
            <span className="text-xs text-slate-500 block mb-0.5">Order Status</span>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 block mb-0.5">Placed At</span>
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {formatDateTime(order.placedAt)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">
              Store Outlet
            </span>
            <div className="font-medium text-slate-700 dark:text-slate-300">{order.vendorName}</div>
            <div className="text-slate-500 text-[11px] mt-0.5">{order.vendorAddress}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">
              Customer Details
            </span>
            <div className="font-medium text-slate-700 dark:text-slate-300">{order.customerName}</div>
            <div className="text-slate-500 text-[11px]">{order.customerPhone}</div>
            <div className="text-slate-500 text-[11px] mt-1">
              <span className="font-medium text-slate-600 dark:text-slate-400">Delivery: </span>
              {order.deliveryAddress}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
          <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">
            Assigned Delivery Courier
          </span>
          {order.riderName ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bike className="h-4 w-4 text-primary-600" />
                <div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{order.riderName}</div>
                  <div className="text-[11px] text-slate-500">{order.riderPhone}</div>
                </div>
              </div>
              <Badge variant="info">Assigned</Badge>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-amber-600 dark:text-amber-400">
              <span className="font-medium italic">No courier assigned yet (Waiting in dispatch pool)</span>
              {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 px-2 self-start sm:self-auto"
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
        </div>

        <div className="rounded-lg border border-slate-200 bg-amber-50/40 p-3 text-xs dark:border-amber-900/30 dark:bg-amber-950/20">
          <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300 mb-1">
            <MessageSquare className="h-3.5 w-3.5" />
            Customer Special Cooking & Delivery Notes
          </div>
          <p className="text-slate-700 dark:text-slate-300 italic">
            {order.customerNotes ? `"${order.customerNotes}"` : 'No special notes specified by customer.'}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-100 mb-2">
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5 text-primary-600" />
              Line Items ({order.items?.length || 0})
            </span>
            <span className="text-slate-500 font-normal">Subtotal</span>
          </div>
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 dark:border-slate-800 dark:divide-slate-800 overflow-hidden text-xs">
            {order.items && order.items.length > 0 ? (
              order.items.map((item) => (
                <div key={item.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                    <div className="text-[11px] text-slate-500">
                      {item.quantity} x {formatCurrency(item.unitPrice)}
                    </div>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-3 text-center text-slate-400 italic">No line items recorded</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs space-y-1.5 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Items Subtotal:</span>
            <span>
              {formatCurrency(
                order.items?.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) ||
                  order.totalAmount - (order.deliveryFee || 0)
              )}
            </span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Delivery Fee:</span>
            <span>{formatCurrency(order.deliveryFee || 0)}</span>
          </div>
          <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-slate-100 pt-1.5 border-t border-slate-200 dark:border-slate-700">
            <span>Total Amount:</span>
            <span className="text-primary-600 dark:text-primary-400">{formatCurrency(order.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 pt-1">
            <span>Payment Method & Status:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {order.paymentMethod} • {order.paymentStatus}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
