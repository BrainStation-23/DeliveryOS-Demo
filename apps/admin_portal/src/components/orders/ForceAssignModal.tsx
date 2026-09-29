import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { AdminOrder, FleetRider } from '../../services/adminApi';
import { formatCurrency } from '../../utils/formatters';

interface ForceAssignModalProps {
  isOpen: boolean;
  order: AdminOrder | null;
  availableRiders: FleetRider[];
  selectedRiderId: string;
  isPending: boolean;
  onClose: () => void;
  onSelectRider: (riderId: string) => void;
  onConfirm: () => void;
}

export const ForceAssignModal: React.FC<ForceAssignModalProps> = ({
  isOpen,
  order,
  availableRiders,
  selectedRiderId,
  isPending,
  onClose,
  onSelectRider,
  onConfirm,
}) => {
  if (!order) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manual Dispatch Override — #${order.orderNumber}`}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!selectedRiderId}
            isLoading={isPending}
            onClick={onConfirm}
          >
            Confirm Dispatch Override
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Alert
          type="warning"
          message="Manual assignment forces this order to the designated courier and transmits real-time telemetry updates to the customer app and store kitchen console."
        />

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs space-y-1.5 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex justify-between">
            <span className="text-slate-500">Store Outlet:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{order.vendorName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Customer Drop-off:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{order.deliveryAddress}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Gross Total:</span>
            <span className="font-semibold text-primary-600">{formatCurrency(order.totalAmount)}</span>
          </div>

          {order.items && order.items.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 block mb-1 font-semibold">
                Items ({order.items.length}):
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

          {order.customerNotes && (
            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-400 text-[11px]">
              <strong>Note:</strong> {order.customerNotes}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Select Active Courier
          </label>
          {availableRiders.length === 0 ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20">
              No couriers are currently online in the pilot zone.
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {availableRiders.map((rider) => (
                <label
                  key={rider.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                    selectedRiderId === rider.id
                      ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="dispatch_rider"
                      value={rider.id}
                      checked={selectedRiderId === rider.id}
                      onChange={() => onSelectRider(rider.id)}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {rider.riderName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {rider.phone} • {rider.vehicleType}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px]">
                    {rider.status === 'ONLINE' ? (
                      <Badge variant="success">Idle</Badge>
                    ) : (
                      <Badge variant="info">On Trip</Badge>
                    )}
                    <div className="text-slate-400 mt-0.5">{formatCurrency(rider.cashInHand)} COD</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
