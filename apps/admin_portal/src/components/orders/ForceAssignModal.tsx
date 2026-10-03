import React, { useEffect, useMemo, useState } from 'react';
import { Bike, Navigation, SearchX } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { SearchInput } from '../common/SearchInput';
import { AdminOrder, FleetRider } from '../../services/adminApi';
import { formatCurrency } from '../../utils/formatters';
import {
  buildAssignmentCandidates,
  filterCandidatesByQuery,
  AssignCandidate,
} from '../../pages/admin/components/orders/riderAssignment';

export interface ForceAssignModalProps {
  isOpen: boolean;
  order: AdminOrder | null;
  /** Live fleet radar rows (GPS + active order state) for every courier. */
  fleet: FleetRider[];
  isPending: boolean;
  onClose: () => void;
  onConfirm: (riderId: string) => void;
}

function distanceLabel(distanceKm: number | null): string {
  if (distanceKm == null) return 'GPS pending';
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
}

const CandidateRow: React.FC<{
  candidate: AssignCandidate;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ candidate, isSelected, onSelect }) => {
  const { rider, distanceKm, blockedReason } = candidate;
  const blocked = !!blockedReason;

  return (
    <label
      className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-all ${
        blocked
          ? 'border-slate-100 bg-slate-50/60 opacity-60 dark:border-slate-800 dark:bg-slate-900'
          : isSelected
            ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20 cursor-pointer'
            : 'border-slate-200 hover:bg-slate-50 cursor-pointer dark:border-slate-800 dark:hover:bg-slate-800'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <input
          type="radio"
          name="dispatch_rider"
          value={rider.id}
          checked={isSelected}
          disabled={blocked}
          onChange={onSelect}
          className="text-primary-600 focus:ring-primary-500 shrink-0"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {rider.riderName}
            </span>
            {blocked ? (
              <Badge variant="default">{blockedReason}</Badge>
            ) : distanceKm != null ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                <Navigation className="h-2.5 w-2.5" />
                {distanceLabel(distanceKm)}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 italic">{distanceLabel(null)}</span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            <span className="inline-flex items-center gap-1">
              <Bike className="h-3 w-3" />
              {rider.vehicleType}
            </span>
            <span className="mx-1">·</span>
            {rider.phone}
          </div>
        </div>
      </div>
      <div className="text-right shrink-0">
        {!rider.isOnline ? (
          <Badge variant="default">Offline</Badge>
        ) : rider.activeOrder ? (
          <Badge variant="info">On Trip</Badge>
        ) : (
          <Badge variant="success">Idle</Badge>
        )}
        <div
          className={`text-[11px] mt-0.5 ${
            rider.cashSafetyWarning ? 'text-rose-600 font-semibold dark:text-rose-400' : 'text-slate-400'
          }`}
        >
          {formatCurrency(rider.cashInHand)} COD
        </div>
      </div>
    </label>
  );
};

/** Manual dispatch override: couriers ranked by live distance from the outlet
 *  (blocked ones mirror the API guards and stay unselectable), searchable by
 *  name / phone / vehicle. */
export const ForceAssignModal: React.FC<ForceAssignModalProps> = ({
  isOpen,
  order,
  fleet,
  isPending,
  onClose,
  onConfirm,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRiderId, setSelectedRiderId] = useState('');

  const candidates = useMemo(() => buildAssignmentCandidates(fleet, order), [fleet, order]);
  const assignable = useMemo(() => candidates.filter((c) => !c.blockedReason), [candidates]);
  const visible = useMemo(() => filterCandidatesByQuery(candidates, searchQuery), [candidates, searchQuery]);

  // Preselect the nearest assignable courier whenever a new order opens; the
  // operator can always override before confirming. Deliberately not keyed on
  // the fleet array — live GPS patches must not reset an in-progress selection.
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedRiderId(assignable[0]?.rider.id ?? '');
    }
  }, [isOpen, order?.id]);

  if (!order) return null;

  const selected = assignable.find((c) => c.rider.id === selectedRiderId);
  const onlineCount = fleet.filter((r) => r.isOnline).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={`Manual Dispatch Override — #${order.orderNumber}`}
      description={`${order.vendorName} · ${order.deliveryAddress}`}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!selected}
            isLoading={isPending}
            onClick={() => selected && onConfirm(selected.rider.id)}
          >
            {selected ? `Assign ${selected.rider.riderName}` : 'Select a Courier'}
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
          <div className="flex justify-between gap-4">
            <span className="text-slate-500 shrink-0">Customer Drop-off:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300 text-right">{order.deliveryAddress}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Gross Total:</span>
            <span className="font-semibold text-primary-600">{formatCurrency(order.totalAmount)}</span>
          </div>

          {order.items && order.items.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 block mb-1 font-semibold">Items ({order.items.length}):</span>
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

        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Select Courier
              <span className="ml-1.5 font-normal text-slate-400">
                {assignable.length} of {fleet.length} assignable · sorted by outlet distance
              </span>
            </label>
            <SearchInput
              value={searchQuery}
              onChange={(value) => setSearchQuery(value)}
              placeholder="Search couriers by name, phone, vehicle..."
              className="sm:w-64"
            />
          </div>

          {fleet.length === 0 ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20">
              No couriers are registered on the platform yet — approve applicants on the Rider Fleet screen first.
            </div>
          ) : onlineCount === 0 ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20">
              No couriers are currently on duty. Couriers must toggle duty ON in the rider app before assignment.
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 flex items-center justify-center gap-2 dark:border-slate-800 dark:bg-slate-900">
              <SearchX className="h-4 w-4" /> No couriers match “{searchQuery}”.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1" role="radiogroup" aria-label="Select courier">
              {visible.map((candidate) => (
                <CandidateRow
                  key={candidate.rider.id}
                  candidate={candidate}
                  isSelected={selectedRiderId === candidate.rider.id}
                  onSelect={() => setSelectedRiderId(candidate.rider.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
