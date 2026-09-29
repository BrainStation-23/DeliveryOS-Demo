import React from 'react';
import { Phone, MapPin, FileText } from 'lucide-react';
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
  if (!order) return null;

  return (
    <Modal
      isOpen={!!order}
      onClose={onClose}
      title={`Order #${order.orderNumber} Details`}
      description={`Placed ${formatDateTime(order.createdAt)} • ${order.vendorName}`}
      size="lg"
      footer={
        <div className="flex justify-end w-full">
          <Button
            variant="outline"
            className="min-h-[44px] px-5 rounded-xl font-semibold"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">
                Customer & Contact
              </span>
              <p className="font-extrabold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
                {order.customerName}
              </p>
              {order.customerPhone && (
                <p className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mt-1 font-mono">
                  <Phone className="h-3.5 w-3.5 text-primary-500" />
                  {order.customerPhone}
                </p>
              )}
            </div>

            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">
                Delivery Destination
              </span>
              <p className="text-slate-700 dark:text-slate-300 flex items-start gap-1.5 mt-1 leading-snug">
                <MapPin className="h-3.5 w-3.5 text-rose-500 mt-0.5 shrink-0" />
                <span>
                  {order.deliveryAddress?.addressLine || 'Address snapshot unavailable'}
                </span>
              </p>
            </div>
          </div>

          {order.customerNotes && (
            <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-700/60">
              <div className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800/60">
                <FileText className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-bold block text-amber-950 dark:text-amber-200">Customer Cooking Note:</span>
                  <p className="italic mt-0.5">{order.customerNotes}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2.5">
            Ordered Items ({order.items?.length || 0})
          </h4>
          {order.items && order.items.length > 0 ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {order.items.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-white dark:bg-slate-900 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100">
                        {item.quantity}x
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {item.productName}
                      </span>
                      {item.variant && (
                        <Badge variant="purple" size="sm">
                          {item.variant.name} (+{formatCurrency(item.variant.priceDelta)})
                        </Badge>
                      )}
                    </div>

                    {item.addons && item.addons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.addons.map((ad, aIdx) => (
                          <span
                            key={aIdx}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            + {ad.name} ({formatCurrency(ad.price)})
                          </span>
                        ))}
                      </div>
                    )}

                    {item.instructions && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                        Special request: {item.instructions}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                      {formatCurrency(item.totalPrice)}
                    </span>
                    <span className="block text-[10px] text-slate-400 font-medium">
                      {formatCurrency(item.unitPrice)} each
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
              Line items breakdown not recorded for legacy order
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/30 space-y-2.5 text-xs">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Order Gross Subtotal</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(order.grossAmount)}
            </span>
          </div>
          <div className="flex justify-between text-rose-600 dark:text-rose-400">
            <span>Platform Commission ({order.commissionRate}%)</span>
            <span className="font-semibold">-{formatCurrency(order.commissionAmount)}</span>
          </div>
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 flex justify-between text-base font-extrabold text-emerald-600 dark:text-emerald-400">
            <span>Net Vendor Payable</span>
            <span>{formatCurrency(order.netVendorPayable)}</span>
          </div>
          <div className="flex justify-between items-center pt-1 text-[11px] text-slate-500">
            <span>Payment Mode: {order.paymentMethod}</span>
            <span>
              Settlement:{' '}
              <strong className={order.settlementStatus === 'SETTLED' ? 'text-emerald-600' : 'text-amber-600'}>
                {order.settlementStatus}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
