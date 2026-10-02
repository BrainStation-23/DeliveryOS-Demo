import React from 'react';
import { Search, UserCheck, Bike } from 'lucide-react';
import { FleetRider } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../components/common/EmptyState';
import {
  FleetApprovalFilter,
  FleetStatusFilter,
} from './fleetFilters';

interface FleetRosterPanelProps {
  riders: FleetRider[];
  isLoading: boolean;
  statusFilter: FleetStatusFilter;
  approvalFilter: FleetApprovalFilter;
  searchQuery: string;
  pendingApplicantsCount: number;
  approvalTogglePendingFor: string | null;
  onStatusFilterChange: (filter: FleetStatusFilter) => void;
  onApprovalFilterChange: (filter: FleetApprovalFilter) => void;
  onSearchQueryChange: (query: string) => void;
  onSetCashLimit: (rider: FleetRider) => void;
  onToggleApproval: (rider: FleetRider) => void;
}

export const FleetRosterPanel: React.FC<FleetRosterPanelProps> = ({
  riders,
  isLoading,
  statusFilter,
  approvalFilter,
  searchQuery,
  pendingApplicantsCount,
  approvalTogglePendingFor,
  onStatusFilterChange,
  onApprovalFilterChange,
  onSearchQueryChange,
  onSetCashLimit,
  onToggleApproval,
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(['ALL', 'ONLINE', 'ON_TRIP', 'OFFLINE'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onStatusFilterChange(s)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-primary-600 text-white font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {s === 'ALL' ? 'All Activity' : s.replace('_', ' ')}
          </button>
        ))}

        <span className="text-slate-300 dark:text-slate-700">|</span>

        {(['ALL', 'APPROVED', 'PENDING'] as const).map((a) => (
          <button
            key={a}
            onClick={() => onApprovalFilterChange(a)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 ${
              approvalFilter === a
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <span>{a === 'ALL' ? 'All Couriers' : a === 'APPROVED' ? 'Approved' : 'Applicant Couriers'}</span>
            {a === 'PENDING' && pendingApplicantsCount > 0 && (
              <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white font-bold">
                {pendingApplicantsCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search name, phone, vehicle..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
    </div>

    {isLoading ? (
      <div className="py-16 text-center">
        <LoadingSpinner size="lg" label="Contacting fleet satellites..." />
      </div>
    ) : riders.length === 0 ? (
      <EmptyState message="No couriers match the current filter criteria." className="my-4" />
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Courier</th>
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Vehicle</th>
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Approval</th>
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Status</th>
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Active Trip</th>
              <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Cash in Hand</th>
              <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {riders.map((rider) => (
              <tr key={rider.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-3 px-3 whitespace-nowrap">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{rider.riderName}</div>
                  <div className="text-[11px] text-slate-500">{rider.phone}</div>
                </td>
                <td className="py-3 px-3 capitalize whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Bike className="h-3.5 w-3.5 text-slate-400" />
                    <span>{rider.vehicleType}</span>
                  </div>
                </td>
                <td className="py-3 px-3 whitespace-nowrap">
                  {rider.isApproved !== false ? (
                    <Badge variant="success">Approved</Badge>
                  ) : (
                    <Badge variant="warning">Pending Review</Badge>
                  )}
                </td>
                <td className="py-3 px-3 whitespace-nowrap">
                  {rider.status === 'ONLINE' && (
                    <Badge variant="success">Idle & Ready</Badge>
                  )}
                  {rider.status === 'ON_TRIP' && (
                    <Badge variant="info">On Delivery</Badge>
                  )}
                  {rider.status === 'OFFLINE' && (
                    <Badge variant="default">Offline</Badge>
                  )}
                </td>
                <td className="py-3 px-3 whitespace-nowrap">
                  {rider.activeOrder ? (
                    <div className="text-[11px]">
                      <span className="font-semibold text-primary-600 dark:text-primary-400">
                        {rider.activeOrder.orderNumber}
                      </span>
                      <div className="text-slate-500 truncate max-w-[120px]">{rider.activeOrder.vendorName}</div>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">None</span>
                  )}
                </td>
                <td className="py-3 px-3 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span
                      className={`font-semibold ${
                        rider.cashSafetyWarning ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      ৳{rider.cashInHand}
                    </span>
                    <span className="text-[11px] text-slate-400">/ ৳{rider.maxCashLimit}</span>
                  </div>
                  {rider.cashSafetyWarning && (
                    <span className="text-[10px] text-amber-500 font-medium">Near Limit</span>
                  )}
                </td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => onSetCashLimit(rider)}
                    >
                      Set Limit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`text-xs h-7 px-2.5 ${
                        rider.isApproved !== false
                          ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                      }`}
                      isLoading={approvalTogglePendingFor === rider.id}
                      onClick={() => onToggleApproval(rider)}
                    >
                      {rider.isApproved !== false ? (
                        'Suspend'
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <UserCheck className="h-3 w-3" />
                          Approve Courier
                        </span>
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
